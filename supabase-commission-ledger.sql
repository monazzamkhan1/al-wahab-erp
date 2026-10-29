-- Commission, party-ledger and historical price snapshots.
-- Run after supabase-sales-module.sql in Supabase SQL Editor.
-- This creates only structure; it does not add or alter business records.

alter table public.products
  add column if not exists mrp numeric not null default 0 check (mrp >= 0),
  add column if not exists tp_discount_percent numeric not null default 15 check (tp_discount_percent >= 0 and tp_discount_percent <= 100),
  add column if not exists is_milk_formula boolean not null default false;

create table if not exists public.commission_holders (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  holder_type text not null default 'person' check (holder_type in ('person', 'company')),
  phone text, notes text, is_active boolean not null default true, created_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists commission_holder_id uuid references public.commission_holders(id),
  add column if not exists commission_percent numeric not null default 0 check (commission_percent >= 0 and commission_percent <= 100),
  add column if not exists commission_enabled_default boolean not null default false;

create table if not exists public.customer_product_prices (
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sale_rate numeric not null check (sale_rate >= 0),
  last_sale_id uuid references public.sales(id) on delete set null,
  updated_at timestamptz not null default now(), primary key (customer_id, product_id)
);

alter table public.sales
  add column if not exists apply_commission boolean not null default false,
  add column if not exists commission_holder_id uuid references public.commission_holders(id),
  add column if not exists commission_percent numeric not null default 0;
alter table public.sale_items
  add column if not exists product_name_snapshot text, add column if not exists batch_no_snapshot text,
  add column if not exists mrp_snapshot numeric not null default 0, add column if not exists purchase_rate_snapshot numeric not null default 0,
  add column if not exists tp_discount_percent_snapshot numeric not null default 15, add column if not exists tp_rate_snapshot numeric not null default 0,
  add column if not exists commission_percent_snapshot numeric not null default 0, add column if not exists commission_amount numeric not null default 0,
  add column if not exists commission_applied boolean not null default false;

create table if not exists public.commission_ledger_entries (
  id uuid primary key default gen_random_uuid(), commission_holder_id uuid not null references public.commission_holders(id),
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('commission', 'paid_to_holder', 'expense_for_holder', 'received_from_holder', 'adjustment')),
  amount numeric not null check (amount >= 0), reference_no text, notes text,
  sale_id uuid references public.sales(id) on delete set null, sale_item_id uuid references public.sale_items(id) on delete set null,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists commission_ledger_entries_holder_date_idx on public.commission_ledger_entries (commission_holder_id, entry_date desc, created_at desc);

alter table public.commission_holders enable row level security;
alter table public.customer_product_prices enable row level security;
alter table public.commission_ledger_entries enable row level security;
drop policy if exists "Authenticated users can read commission holders" on public.commission_holders;
create policy "Authenticated users can read commission holders" on public.commission_holders for select to authenticated using (true);
drop policy if exists "Authenticated users can read saved customer prices" on public.customer_product_prices;
create policy "Authenticated users can read saved customer prices" on public.customer_product_prices for select to authenticated using (true);
drop policy if exists "Authenticated users can read commission ledger" on public.commission_ledger_entries;
create policy "Authenticated users can read commission ledger" on public.commission_ledger_entries for select to authenticated using (true);
drop policy if exists "Authenticated users can add commission ledger adjustments" on public.commission_ledger_entries;
create policy "Authenticated users can add commission ledger adjustments" on public.commission_ledger_entries for insert to authenticated with check (created_by = auth.uid());

create or replace function public.save_sale_with_stock(
  p_customer_id uuid, p_invoice_no text, p_sale_date date, p_total_amount numeric,
  p_received_amount numeric, p_notes text, p_created_by uuid, p_items jsonb, p_apply_commission boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_sale_id uuid; v_sale_item_id uuid; v_item record; v_customer record; v_product record; v_batch record; v_commission_amount numeric; v_tp_rate numeric;
begin
  if auth.uid() is distinct from p_created_by then raise exception 'Invalid signed-in user'; end if;
  if p_total_amount < 0 or p_received_amount < 0 or p_received_amount > p_total_amount then raise exception 'Invalid sale payment amounts'; end if;
  select commission_holder_id, commission_percent into v_customer from public.customers where id = p_customer_id;
  if not found then raise exception 'Selected customer was not found'; end if;
  insert into public.sales (customer_id, invoice_no, sale_date, total_amount, received_amount, notes, created_by, apply_commission, commission_holder_id, commission_percent)
  values (p_customer_id, p_invoice_no, p_sale_date, p_total_amount, p_received_amount, p_notes, p_created_by, p_apply_commission and v_customer.commission_holder_id is not null and coalesce(v_customer.commission_percent, 0) > 0, v_customer.commission_holder_id, coalesce(v_customer.commission_percent, 0)) returning id into v_sale_id;
  for v_item in select * from jsonb_to_recordset(p_items) as item(product_id uuid, batch_id uuid, quantity numeric, sale_rate numeric, discount numeric, tax numeric, amount numeric) loop
    update public.product_batches set quantity = quantity - v_item.quantity where id = v_item.batch_id and product_id = v_item.product_id and quantity >= v_item.quantity;
    if not found then raise exception 'Insufficient stock for the selected batch'; end if;
    select id, product_name, mrp, purchase_rate, tp_discount_percent into v_product from public.products where id = v_item.product_id;
    select batch_no, purchase_rate into v_batch from public.product_batches where id = v_item.batch_id;
    v_tp_rate := coalesce(v_product.mrp, 0) * (1 - coalesce(v_product.tp_discount_percent, 15) / 100);
    v_commission_amount := case when p_apply_commission and v_customer.commission_holder_id is not null then v_tp_rate * v_item.quantity * coalesce(v_customer.commission_percent, 0) / 100 else 0 end;
    insert into public.sale_items (sale_id, product_id, batch_id, quantity, sale_rate, discount, tax, amount, product_name_snapshot, batch_no_snapshot, mrp_snapshot, purchase_rate_snapshot, tp_discount_percent_snapshot, tp_rate_snapshot, commission_percent_snapshot, commission_amount, commission_applied)
    values (v_sale_id, v_item.product_id, v_item.batch_id, v_item.quantity, v_item.sale_rate, coalesce(v_item.discount, 0), coalesce(v_item.tax, 0), v_item.amount, v_product.product_name, v_batch.batch_no, coalesce(v_product.mrp, 0), coalesce(v_batch.purchase_rate, v_product.purchase_rate, 0), coalesce(v_product.tp_discount_percent, 15), v_tp_rate, coalesce(v_customer.commission_percent, 0), v_commission_amount, v_commission_amount > 0) returning id into v_sale_item_id;
    insert into public.stock_movements (product_id, batch_id, movement_type, quantity, reference_no, movement_date, notes) values (v_item.product_id, v_item.batch_id, 'sale_out', v_item.quantity, p_invoice_no, p_sale_date, p_notes);
    insert into public.customer_product_prices (customer_id, product_id, sale_rate, last_sale_id, updated_at) values (p_customer_id, v_item.product_id, v_item.sale_rate, v_sale_id, now()) on conflict (customer_id, product_id) do update set sale_rate = excluded.sale_rate, last_sale_id = excluded.last_sale_id, updated_at = now();
    if v_commission_amount > 0 then insert into public.commission_ledger_entries (commission_holder_id, entry_date, entry_type, amount, reference_no, notes, sale_id, sale_item_id, created_by) values (v_customer.commission_holder_id, p_sale_date, 'commission', v_commission_amount, p_invoice_no, 'Commission on TP amount', v_sale_id, v_sale_item_id, p_created_by); end if;
  end loop;
  return v_sale_id;
end;
$$;
grant execute on function public.save_sale_with_stock(uuid, text, date, numeric, numeric, text, uuid, jsonb, boolean) to authenticated;
