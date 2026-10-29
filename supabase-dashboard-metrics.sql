-- Dashboard totals for signed-in ERP users. This reads data only.
-- Run in Supabase SQL Editor once, then deploy the matching app/page.js.

create or replace function public.get_dashboard_metrics()
returns table (
  products bigint,
  stock numeric,
  customers bigint,
  suppliers bigint,
  sales numeric,
  purchases numeric,
  receivables numeric,
  payables numeric
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.products),
    coalesce((select sum(quantity) from public.product_batches), 0),
    (select count(*) from public.customers),
    (select count(*) from public.companies where company_type in ('supplier', 'both')),
    coalesce((select sum(total_amount) from public.sales), 0),
    coalesce((select sum(total_amount) from public.purchases), 0),
    greatest(
      coalesce((select sum(total_amount - received_amount) from public.sales), 0),
      0
    ),
    greatest(
      coalesce((select sum(total_amount - paid_amount) from public.purchases), 0),
      0
    );
$$;

revoke all on function public.get_dashboard_metrics() from public;
grant execute on function public.get_dashboard_metrics() to authenticated;
