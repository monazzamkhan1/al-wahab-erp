-- Customer stock returns: stock is added back to its original batch.
create table if not exists public.stock_returns (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  product_id uuid not null references public.products(id),
  batch_id uuid not null references public.product_batches(id),
  quantity numeric not null check (quantity > 0),
  return_date date not null default current_date,
  reference_no text,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
-- A return is always linked to the exact sale line it reverses.  This keeps
-- the customer's ledger, receivables and sales analysis accurate.
alter table public.stock_returns
  add column if not exists sale_id uuid references public.sales(id) on delete set null,
  add column if not exists sale_item_id uuid references public.sale_items(id) on delete set null,
  add column if not exists unit_rate numeric not null default 0,
  add column if not exists return_amount numeric not null default 0;
create index if not exists stock_returns_customer_sale_idx on public.stock_returns(customer_id, sale_id, return_date desc);
create index if not exists stock_returns_date_idx on public.stock_returns(return_date desc, created_at desc);
alter table public.stock_returns enable row level security;
drop policy if exists "Authenticated users can read stock returns" on public.stock_returns;
create policy "Authenticated users can read stock returns" on public.stock_returns for select to authenticated using (true);
drop policy if exists "Authenticated users can add stock returns" on public.stock_returns;
create policy "Authenticated users can add stock returns" on public.stock_returns for insert to authenticated with check (created_by = auth.uid());
grant select, insert on public.stock_returns to authenticated;

create or replace function public.save_customer_stock_return(
  p_customer_id uuid, p_sale_item_id uuid, p_quantity numeric,
  p_return_date date, p_reference_no text, p_notes text, p_created_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_return_id uuid;
  v_item record;
  v_returned numeric;
  v_unit_rate numeric;
begin
  if auth.uid() is distinct from p_created_by then raise exception 'Invalid signed-in user'; end if;
  if p_quantity <= 0 then raise exception 'Return quantity must be greater than zero'; end if;
  select si.id, si.sale_id, si.product_id, si.batch_id, si.quantity, si.amount, s.customer_id
  into v_item
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where si.id = p_sale_item_id and s.customer_id = p_customer_id;
  if not found then raise exception 'Selected item is not a sale made to this customer'; end if;
  select coalesce(sum(quantity), 0) into v_returned from public.stock_returns where sale_item_id = p_sale_item_id;
  if p_quantity > v_item.quantity - v_returned then raise exception 'Return quantity is more than the quantity sold (after previous returns)'; end if;
  v_unit_rate := coalesce(v_item.amount, 0) / nullif(v_item.quantity, 0);
  update public.product_batches set quantity = quantity + p_quantity where id = v_item.batch_id and product_id = v_item.product_id;
  if not found then raise exception 'Selected batch was not found'; end if;
  insert into public.stock_returns(customer_id, sale_id, sale_item_id, product_id, batch_id, quantity, return_date, reference_no, notes, unit_rate, return_amount, created_by)
    values(p_customer_id, v_item.sale_id, v_item.id, v_item.product_id, v_item.batch_id, p_quantity, p_return_date, nullif(trim(p_reference_no), ''), nullif(trim(p_notes), ''), v_unit_rate, round(v_unit_rate * p_quantity, 4), p_created_by)
    returning id into v_return_id;
  insert into public.stock_movements(product_id, batch_id, movement_type, quantity, reference_no, movement_date, notes)
    values(v_item.product_id, v_item.batch_id, 'return_in', p_quantity, nullif(trim(p_reference_no), ''), p_return_date, p_notes);
  return v_return_id;
end;
$$;
grant execute on function public.save_customer_stock_return(uuid, uuid, numeric, date, text, text, uuid) to authenticated;

-- Link historic returns (entered before the ledger feature) to their matching
-- customer sale line. Their stock has already been returned, so this only
-- restores the accounting/ledger side and never changes stock again.
do $$
declare r record; v_item record; v_rate numeric;
begin
  for r in select * from public.stock_returns where sale_item_id is null and customer_id is not null loop
    select si.id, si.sale_id, si.quantity, si.amount
      into v_item
      from public.sale_items si join public.sales s on s.id = si.sale_id
     where s.customer_id = r.customer_id and si.product_id = r.product_id and si.batch_id = r.batch_id
     order by s.invoice_date desc, s.created_at desc limit 1;
    if found then
      v_rate := coalesce(v_item.amount, 0) / nullif(v_item.quantity, 0);
      update public.stock_returns set sale_id = v_item.sale_id, sale_item_id = v_item.id,
        unit_rate = v_rate, return_amount = round(v_rate * quantity, 4)
      where id = r.id;
    end if;
  end loop;
end $$;
