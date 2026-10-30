-- Supplier/customer payment ledgers and invoice enhancements.
-- Run in Supabase SQL Editor after the existing sales and purchase modules.

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.companies(id),
  purchase_id uuid references public.purchases(id) on delete set null,
  payment_date date not null default current_date,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'bank_transfer', 'online_transfer', 'cheque', 'other')),
  reference_no text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  sale_id uuid references public.sales(id) on delete set null,
  payment_date date not null default current_date,
  amount numeric not null check (amount > 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'bank_transfer', 'online_transfer', 'cheque', 'other')),
  reference_no text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- These fields also make the script safe when it is run again later.
alter table public.supplier_payments
  add column if not exists purchase_id uuid references public.purchases(id) on delete set null;
alter table public.customer_payments
  add column if not exists sale_id uuid references public.sales(id) on delete set null;

alter table public.sales
  add column if not exists booker_name text,
  add column if not exists supplier_name text;

alter table public.sale_items
  add column if not exists bonus_quantity numeric not null default 0 check (bonus_quantity >= 0);

create index if not exists supplier_payments_supplier_date_idx
  on public.supplier_payments (supplier_id, payment_date desc, created_at desc);
create index if not exists customer_payments_customer_date_idx
  on public.customer_payments (customer_id, payment_date desc, created_at desc);
create index if not exists supplier_payments_purchase_idx on public.supplier_payments (purchase_id);
create index if not exists customer_payments_sale_idx on public.customer_payments (sale_id);

alter table public.supplier_payments enable row level security;
alter table public.customer_payments enable row level security;

drop policy if exists "Authenticated users can read supplier payments" on public.supplier_payments;
create policy "Authenticated users can read supplier payments"
  on public.supplier_payments for select to authenticated using (true);
drop policy if exists "Authenticated users can add supplier payments" on public.supplier_payments;
create policy "Authenticated users can add supplier payments"
  on public.supplier_payments for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "Authenticated users can read customer payments" on public.customer_payments;
create policy "Authenticated users can read customer payments"
  on public.customer_payments for select to authenticated using (true);
drop policy if exists "Authenticated users can add customer payments" on public.customer_payments;
create policy "Authenticated users can add customer payments"
  on public.customer_payments for insert to authenticated with check (created_by = auth.uid());

grant select, insert on public.supplier_payments, public.customer_payments to authenticated;

-- Ledger detail is read directly by the signed-in ERP user.
grant select on public.sales, public.sale_items, public.purchases, public.purchase_items to authenticated;

-- This overload keeps historic invoices unchanged, but writes new optional invoice
-- fields and bonus quantities as snapshots for future invoices.
create or replace function public.save_sale_with_stock(
  p_customer_id uuid, p_invoice_no text, p_sale_date date, p_total_amount numeric,
  p_received_amount numeric, p_notes text, p_created_by uuid, p_items jsonb,
  p_apply_commission boolean, p_booker_name text, p_supplier_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid; v_sale_item_id uuid; v_item record; v_customer record;
  v_product record; v_batch record; v_commission_amount numeric; v_tp_rate numeric;
begin
  if auth.uid() is distinct from p_created_by then raise exception 'Invalid signed-in user'; end if;
  if p_total_amount < 0 or p_received_amount < 0 or p_received_amount > p_total_amount then
    raise exception 'Invalid sale payment amounts';
  end if;
  select commission_holder_id, commission_percent into v_customer from public.customers where id = p_customer_id;
  if not found then raise exception 'Selected customer was not found'; end if;

  insert into public.sales (customer_id, invoice_no, sale_date, total_amount, received_amount, notes, created_by, apply_commission, commission_holder_id, commission_percent, booker_name, supplier_name)
  values (p_customer_id, p_invoice_no, p_sale_date, p_total_amount, p_received_amount, p_notes, p_created_by,
    p_apply_commission and v_customer.commission_holder_id is not null and coalesce(v_customer.commission_percent, 0) > 0,
    v_customer.commission_holder_id, coalesce(v_customer.commission_percent, 0), nullif(trim(p_booker_name), ''), nullif(trim(p_supplier_name), ''))
  returning id into v_sale_id;

  for v_item in select * from jsonb_to_recordset(p_items) as item(
    product_id uuid, batch_id uuid, quantity numeric, bonus_quantity numeric, sale_rate numeric,
    discount numeric, tax numeric, amount numeric
  ) loop
    update public.product_batches set quantity = quantity - v_item.quantity - coalesce(v_item.bonus_quantity, 0)
      where id = v_item.batch_id and product_id = v_item.product_id
      and quantity >= v_item.quantity + coalesce(v_item.bonus_quantity, 0);
    if not found then raise exception 'Insufficient stock for the selected batch'; end if;
    select id, product_name, mrp, purchase_rate, tp_discount_percent into v_product from public.products where id = v_item.product_id;
    select batch_no, purchase_rate into v_batch from public.product_batches where id = v_item.batch_id;
    v_tp_rate := coalesce(v_product.mrp, 0) * (1 - coalesce(v_product.tp_discount_percent, 15) / 100);
    v_commission_amount := case when p_apply_commission and v_customer.commission_holder_id is not null
      then v_tp_rate * v_item.quantity * coalesce(v_customer.commission_percent, 0) / 100 else 0 end;
    insert into public.sale_items (sale_id, product_id, batch_id, quantity, bonus_quantity, sale_rate, discount, tax, amount,
      product_name_snapshot, batch_no_snapshot, mrp_snapshot, purchase_rate_snapshot, tp_discount_percent_snapshot,
      tp_rate_snapshot, commission_percent_snapshot, commission_amount, commission_applied)
    values (v_sale_id, v_item.product_id, v_item.batch_id, v_item.quantity, coalesce(v_item.bonus_quantity, 0),
      v_item.sale_rate, coalesce(v_item.discount, 0), coalesce(v_item.tax, 0), v_item.amount,
      v_product.product_name, v_batch.batch_no, coalesce(v_product.mrp, 0), coalesce(v_batch.purchase_rate, v_product.purchase_rate, 0),
      coalesce(v_product.tp_discount_percent, 15), v_tp_rate, coalesce(v_customer.commission_percent, 0),
      v_commission_amount, v_commission_amount > 0) returning id into v_sale_item_id;
    insert into public.stock_movements (product_id, batch_id, movement_type, quantity, reference_no, movement_date, notes)
      values (v_item.product_id, v_item.batch_id, 'sale_out', v_item.quantity + coalesce(v_item.bonus_quantity, 0), p_invoice_no, p_sale_date, p_notes);
    insert into public.customer_product_prices (customer_id, product_id, sale_rate, last_sale_id, updated_at)
      values (p_customer_id, v_item.product_id, v_item.sale_rate, v_sale_id, now())
      on conflict (customer_id, product_id) do update set sale_rate = excluded.sale_rate, last_sale_id = excluded.last_sale_id, updated_at = now();
    if v_commission_amount > 0 then
      insert into public.commission_ledger_entries (commission_holder_id, entry_date, entry_type, amount, reference_no, notes, sale_id, sale_item_id, created_by)
        values (v_customer.commission_holder_id, p_sale_date, 'commission', v_commission_amount, p_invoice_no, 'Commission on TP amount', v_sale_id, v_sale_item_id, p_created_by);
    end if;
  end loop;
  return v_sale_id;
end;
$$;

grant execute on function public.save_sale_with_stock(uuid, text, date, numeric, numeric, text, uuid, jsonb, boolean, text, text) to authenticated;
