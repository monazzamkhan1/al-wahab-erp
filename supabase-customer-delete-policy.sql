-- Run once in Supabase SQL Editor.
-- Allows signed-in ERP users to delete only unused customer master records.
-- The app separately blocks deletion when sales or payment history exists.

alter table public.customers enable row level security;

drop policy if exists "Authenticated users can delete customers" on public.customers;
create policy "Authenticated users can delete customers"
on public.customers
for delete
to authenticated
using (true);
