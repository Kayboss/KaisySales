-- ============================================================
-- M3 — tenancy not null
--
-- Contracts the nullable tenant columns M1 added and M2 filled:
--   * business_id NOT NULL on the ten business tables;
--   * branch_id   NOT NULL on sales / invoices / expenses.
--
-- `products` and `branch_inventory` are already NOT NULL from M1.
--
-- This migration deliberately does no backfill. The preflight below aborts it
-- with an actionable message when M2 needs to be re-run (a new signup since the
-- backfill, or a row written before its owner had a membership). Re-running
-- `20261103130000_tenancy_backfill.sql` is safe and fixes both: it creates a
-- business for a new profile and fills any new null rows.
--
-- After this migration, `fill_tenant`'s pre-backfill fallback is no longer
-- reachable: a write from a login with no active membership now fails instead
-- of silently writing a null tenant. The frontend that creates a business
-- during onboarding (`ensureBusiness`) must be released with or before M3.
--
-- Idempotent: `set not null` is a no-op when the column is already NOT NULL,
-- and the preflight passes on clean data.
-- ============================================================

begin;

do $$
declare
  v_problems text;
  v_n int;
begin
  select string_agg(format('%s=%s', t, n), ', ')
  into v_problems
  from (
    select 'sales.business_id' as t, count(*)::int as n from public.sales where business_id is null
    union all select 'invoices.business_id', count(*) from public.invoices where business_id is null
    union all select 'expenses.business_id', count(*) from public.expenses where business_id is null
    union all select 'inventory.business_id', count(*) from public.inventory where business_id is null
    union all select 'stores.business_id', count(*) from public.stores where business_id is null
    union all select 'categories.business_id', count(*) from public.categories where business_id is null
    union all select 'customers.business_id', count(*) from public.customers where business_id is null
    union all select 'services.business_id', count(*) from public.services where business_id is null
    union all select 'service_income.business_id', count(*) from public.service_income where business_id is null
    union all select 'recurring_income.business_id', count(*) from public.recurring_income where business_id is null
    union all select 'sales.branch_id', count(*) from public.sales where branch_id is null
    union all select 'invoices.branch_id', count(*) from public.invoices where branch_id is null
    union all select 'expenses.branch_id', count(*) from public.expenses where branch_id is null
  ) c
  where n > 0;

  if v_problems is not null then
    raise exception
      'M3 preflight failed: unassigned rows (%). Re-run 20261103130000_tenancy_backfill.sql first.',
      v_problems;
  end if;

  select count(*)::int into v_n
  from public.profiles p
  where not exists (
    select 1 from public.business_members m
    where m.user_id = p.id and m.status = 'active'
  );

  if v_n > 0 then
    raise exception
      'M3 preflight failed: % profile(s) have no active business. Re-run 20261103130000_tenancy_backfill.sql first.',
      v_n;
  end if;
end $$;

alter table public.sales            alter column business_id set not null;
alter table public.invoices         alter column business_id set not null;
alter table public.expenses         alter column business_id set not null;
alter table public.inventory        alter column business_id set not null;
alter table public.stores           alter column business_id set not null;
alter table public.categories       alter column business_id set not null;
alter table public.customers        alter column business_id set not null;
alter table public.services         alter column business_id set not null;
alter table public.service_income   alter column business_id set not null;
alter table public.recurring_income alter column business_id set not null;

alter table public.sales     alter column branch_id set not null;
alter table public.invoices  alter column branch_id set not null;
alter table public.expenses  alter column branch_id set not null;

commit;

notify pgrst, 'reload schema';
