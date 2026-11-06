-- Secure portal roles. Run once in Supabase SQL Editor.
-- Existing Monazzam login becomes Admin; email and password are unchanged.
create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role text not null check (role in ('admin','staff')) default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_profiles (id, full_name, email, phone, role, is_active)
select id, 'Monazzam Khan', lower(email), '0307-4326061', 'admin', true
from auth.users where lower(email) = 'monazzamkhan@gmail.com'
on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone, role = 'admin', is_active = true, updated_at = now();

create or replace function public.current_erp_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.app_profiles where id = auth.uid() and is_active = true $$;

create or replace function public.is_erp_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_erp_role() = 'admin', false) $$;

alter table public.app_profiles enable row level security;
drop policy if exists "Users can read own profile" on public.app_profiles;
create policy "Users can read own profile" on public.app_profiles for select to authenticated using (id = auth.uid() or public.is_erp_admin());
grant usage on schema public to authenticated;
grant select on public.app_profiles to authenticated;
grant execute on function public.current_erp_role() to authenticated;
grant execute on function public.is_erp_admin() to authenticated;
