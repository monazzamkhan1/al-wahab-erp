grant update (notes, booker_name, supplier_name) on public.sales to authenticated;
grant update (notes) on public.purchases to authenticated;
drop policy if exists "Authenticated users can edit safe sale details" on public.sales;
create policy "Authenticated users can edit safe sale details" on public.sales for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can edit safe purchase details" on public.purchases;
create policy "Authenticated users can edit safe purchase details" on public.purchases for update to authenticated using (true) with check (true);
