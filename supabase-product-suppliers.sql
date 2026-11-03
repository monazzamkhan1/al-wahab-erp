-- A product can be purchased from more than one actual supplier/distributor.
create table if not exists public.product_suppliers (
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.companies(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (product_id, supplier_id)
);

create index if not exists product_suppliers_supplier_id_idx
  on public.product_suppliers (supplier_id);

alter table public.product_suppliers enable row level security;

drop policy if exists "Authenticated users can read product suppliers" on public.product_suppliers;
create policy "Authenticated users can read product suppliers"
  on public.product_suppliers for select to authenticated using (true);

drop policy if exists "Authenticated users can add product suppliers" on public.product_suppliers;
create policy "Authenticated users can add product suppliers"
  on public.product_suppliers for insert to authenticated with check (true);

drop policy if exists "Authenticated users can delete product suppliers" on public.product_suppliers;
create policy "Authenticated users can delete product suppliers"
  on public.product_suppliers for delete to authenticated using (true);

grant select, insert, delete on public.product_suppliers to authenticated;

-- Add existing purchase history as supplier mappings without changing business data.
insert into public.product_suppliers (product_id, supplier_id)
select distinct purchase_items.product_id, purchases.supplier_id
from public.purchase_items
join public.purchases on purchases.id = purchase_items.purchase_id
where purchase_items.product_id is not null
  and purchases.supplier_id is not null
on conflict do nothing;
