-- Run this once in Supabase SQL Editor before using /sales.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  invoice_no text not null unique,
  sale_date date not null default current_date,
  total_amount numeric not null default 0 check (total_amount >= 0),
  received_amount numeric not null default 0 check (received_amount >= 0 and received_amount <= total_amount),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  batch_id uuid not null references public.product_batches(id),
  quantity numeric not null check (quantity > 0),
  sale_rate numeric not null check (sale_rate >= 0),
  discount numeric not null default 0,
  tax numeric not null default 0,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

drop policy if exists "Authenticated users can read sales" on public.sales;
create policy "Authenticated users can read sales" on public.sales for select to authenticated using (true);
drop policy if exists "Authenticated users can read sale items" on public.sale_items;
create policy "Authenticated users can read sale items" on public.sale_items for select to authenticated using (true);

create or replace function public.save_sale_with_stock(
  p_customer_id uuid, p_invoice_no text, p_sale_date date, p_total_amount numeric,
  p_received_amount numeric, p_notes text, p_created_by uuid, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_sale_id uuid; v_item record;
begin
  if p_total_amount < 0 or p_received_amount < 0 or p_received_amount > p_total_amount then
    raise exception 'Invalid sale payment amounts';
  end if;
  insert into public.sales (customer_id, invoice_no, sale_date, total_amount, received_amount, notes, created_by)
  values (p_customer_id, p_invoice_no, p_sale_date, p_total_amount, p_received_amount, p_notes, p_created_by)
  returning id into v_sale_id;
  for v_item in select * from jsonb_to_recordset(p_items) as item(product_id uuid, batch_id uuid, quantity numeric, sale_rate numeric, discount numeric, tax numeric, amount numeric)
  loop
    update public.product_batches set quantity = quantity - v_item.quantity
      where id = v_item.batch_id and product_id = v_item.product_id and quantity >= v_item.quantity;
    if not found then raise exception 'Insufficient stock for the selected batch'; end if;
    insert into public.sale_items (sale_id, product_id, batch_id, quantity, sale_rate, discount, tax, amount)
      values (v_sale_id, v_item.product_id, v_item.batch_id, v_item.quantity, v_item.sale_rate, coalesce(v_item.discount, 0), coalesce(v_item.tax, 0), v_item.amount);
    insert into public.stock_movements (product_id, batch_id, movement_type, quantity, reference_no, movement_date, notes)
      values (v_item.product_id, v_item.batch_id, 'sale_out', v_item.quantity, p_invoice_no, p_sale_date, p_notes);
  end loop;
  return v_sale_id;
end;
$$;

grant execute on function public.save_sale_with_stock(uuid, text, date, numeric, numeric, text, uuid, jsonb) to authenticated;
