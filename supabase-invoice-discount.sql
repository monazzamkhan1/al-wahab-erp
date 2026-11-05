-- Invoice-level discount support.
-- Product-level discount remains stored on sale_items.discount.

alter table public.sales
  add column if not exists invoice_discount_percent numeric not null default 0
    check (invoice_discount_percent >= 0 and invoice_discount_percent <= 100),
  add column if not exists invoice_discount_amount numeric not null default 0
    check (invoice_discount_amount >= 0);

grant update (total_amount, invoice_discount_percent, invoice_discount_amount) on public.sales to authenticated;
