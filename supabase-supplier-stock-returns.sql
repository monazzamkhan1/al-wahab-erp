-- Supplier stock returns: stock is deducted from the selected original batch.
create table if not exists public.supplier_stock_returns (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.companies(id),
  product_id uuid not null references public.products(id),
  batch_id uuid not null references public.product_batches(id),
  quantity numeric not null check (quantity > 0),
  return_date date not null default current_date,
  reference_no text,
  notes text,
  purchase_id uuid references public.purchases(id) on delete set null,
  unit_rate numeric not null default 0,
  return_amount numeric not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Safe upgrades for portals created before financial supplier returns existed.
alter table public.supplier_stock_returns
  add column if not exists purchase_id uuid references public.purchases(id) on delete set null,
  add column if not exists unit_rate numeric not null default 0,
  add column if not exists return_amount numeric not null default 0;

create index if not exists supplier_stock_returns_date_idx on public.supplier_stock_returns(return_date desc, created_at desc);
alter table public.supplier_stock_returns enable row level security;
drop policy if exists "Authenticated users can read supplier stock returns" on public.supplier_stock_returns;
create policy "Authenticated users can read supplier stock returns" on public.supplier_stock_returns for select to authenticated using (true);
drop policy if exists "Authenticated users can add supplier stock returns" on public.supplier_stock_returns;
create policy "Authenticated users can add supplier stock returns" on public.supplier_stock_returns for insert to authenticated with check (created_by = auth.uid());
grant select, insert on public.supplier_stock_returns to authenticated;

create or replace function public.save_supplier_stock_return(
  p_supplier_id uuid, p_product_id uuid, p_batch_id uuid, p_quantity numeric,
  p_return_date date, p_reference_no text, p_notes text, p_created_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_return_id uuid; v_purchase_id uuid; v_unit_rate numeric;
begin
  if auth.uid() is distinct from p_created_by then raise exception 'Invalid signed-in user'; end if;
  if p_quantity <= 0 then raise exception 'Return quantity must be greater than zero'; end if;
  select pi.purchase_id, coalesce(pi.purchase_rate, pb.purchase_rate, 0)
    into v_purchase_id, v_unit_rate
    from public.purchase_items pi
    join public.purchases p on p.id = pi.purchase_id
    left join public.product_batches pb on pb.id = pi.batch_id
   where p.supplier_id = p_supplier_id and pi.product_id = p_product_id and pi.batch_id = p_batch_id
   order by p.invoice_date desc
   limit 1;
  v_unit_rate := coalesce(v_unit_rate, 0);
  update public.product_batches set quantity = quantity - p_quantity
    where id = p_batch_id and product_id = p_product_id and quantity >= p_quantity;
  if not found then raise exception 'Selected batch does not have enough available stock'; end if;
  insert into public.supplier_stock_returns(supplier_id, product_id, batch_id, quantity, return_date, reference_no, notes, purchase_id, unit_rate, return_amount, created_by)
    values(p_supplier_id, p_product_id, p_batch_id, p_quantity, p_return_date, nullif(trim(p_reference_no), ''), nullif(trim(p_notes), ''), v_purchase_id, v_unit_rate, round(v_unit_rate * p_quantity, 4), p_created_by)
    returning id into v_return_id;
  insert into public.stock_movements(product_id, batch_id, movement_type, quantity, reference_no, movement_date, notes)
    values(p_product_id, p_batch_id, 'return_out', p_quantity, nullif(trim(p_reference_no), ''), p_return_date, p_notes);
  return v_return_id;
end;
$$;

grant execute on function public.save_supplier_stock_return(uuid, uuid, uuid, numeric, date, text, text, uuid) to authenticated;
