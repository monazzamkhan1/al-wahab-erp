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
create index if not exists stock_returns_date_idx on public.stock_returns(return_date desc, created_at desc);
alter table public.stock_returns enable row level security;
drop policy if exists "Authenticated users can read stock returns" on public.stock_returns;
create policy "Authenticated users can read stock returns" on public.stock_returns for select to authenticated using (true);
drop policy if exists "Authenticated users can add stock returns" on public.stock_returns;
create policy "Authenticated users can add stock returns" on public.stock_returns for insert to authenticated with check (created_by = auth.uid());
grant select, insert on public.stock_returns to authenticated;

create or replace function public.save_customer_stock_return(
  p_customer_id uuid, p_product_id uuid, p_batch_id uuid, p_quantity numeric,
  p_return_date date, p_reference_no text, p_notes text, p_created_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_return_id uuid;
begin
  if auth.uid() is distinct from p_created_by then raise exception 'Invalid signed-in user'; end if;
  if p_quantity <= 0 then raise exception 'Return quantity must be greater than zero'; end if;
  update public.product_batches set quantity = quantity + p_quantity where id = p_batch_id and product_id = p_product_id;
  if not found then raise exception 'Selected batch was not found'; end if;
  insert into public.stock_returns(customer_id, product_id, batch_id, quantity, return_date, reference_no, notes, created_by)
    values(p_customer_id, p_product_id, p_batch_id, p_quantity, p_return_date, nullif(trim(p_reference_no), ''), nullif(trim(p_notes), ''), p_created_by)
    returning id into v_return_id;
  insert into public.stock_movements(product_id, batch_id, movement_type, quantity, reference_no, movement_date, notes)
    values(p_product_id, p_batch_id, 'customer_return_in', p_quantity, nullif(trim(p_reference_no), ''), p_return_date, p_notes);
  return v_return_id;
end;
$$;
grant execute on function public.save_customer_stock_return(uuid, uuid, uuid, numeric, date, text, text, uuid) to authenticated;
