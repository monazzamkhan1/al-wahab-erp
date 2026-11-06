-- One shared configuration row for the ERP. Existing products and invoices
-- keep their own saved values; these settings only provide future defaults.
create table if not exists public.erp_settings (
  id boolean primary key default true check (id = true),
  company_name text not null default 'Al Wahab Enterprises',
  currency_label text not null default 'PKR (Rs.)',
  default_tp_discount_percent numeric not null default 15 check (default_tp_discount_percent between 0 and 100),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.erp_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.erp_settings enable row level security;
drop policy if exists "Authenticated users can read ERP settings" on public.erp_settings;
create policy "Authenticated users can read ERP settings" on public.erp_settings for select to authenticated using (true);
drop policy if exists "Authenticated users can update ERP settings" on public.erp_settings;
create policy "Authenticated users can update ERP settings" on public.erp_settings for update to authenticated using (true) with check (updated_by = auth.uid());
grant select, update on public.erp_settings to authenticated;
