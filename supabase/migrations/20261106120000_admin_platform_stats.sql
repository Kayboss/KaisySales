-- ============================================================
-- Admin platform-wide aggregates.
--
-- Tenant RLS keeps customers / service_income / recurring_income /
-- branch_inventory scoped to the caller's business. Migrations
-- 20261105180000 and 20261105190000 dropped the old "Admins can read
-- all ..." SELECT policies on purpose: an is_admin() table policy is
-- also evaluated for the admin's OWN app screens, so every business's
-- rows leaked into "my customers" / "my dashboard".
--
-- The admin panel therefore must not read those tables directly. It
-- asks for aggregates instead, through SECURITY DEFINER functions
-- that check is_admin(). Counts and totals only -- no individual row
-- ever crosses into a tenant screen -- and no unbounded client-side
-- select remains (PostgREST max_rows is 1000; the previous code was
-- silently truncating at that limit).
--
-- Every function here:
--   * is SECURITY DEFINER and owned by postgres, so it can read across
--     businesses where the caller's RLS would not;
--   * raises 42501 unless is_admin(), so the body is the permission;
--   * is REVOKEd from PUBLIC/anon and GRANTed to authenticated. The
--     default ACL for new public functions is postgres+service_role
--     only, so a missing GRANT would make it unreachable; a README
--     grant-only would leave a PUBLIC hole. Both are named explicitly.
-- ============================================================

-- Amounts are stored as TEXT ("GHS 25.00", older rows "GH₵ 25.00", some
-- empty). Mirrors the client's parseAmount(): strip everything that is
-- not a digit / dot / minus, then cast. A value with no number in it is
-- 0, never an invented figure.
--
-- `invoices` is the exception that needs both columns: the current invoice
-- screens (retail and services) write `amount` as `"GHS 136.00"` and never
-- touch `total`, while the four oldest invoices predate that and hold their
-- figure in `total` with an empty `amount`. Reading `total` alone reported
-- every recent invoice as GHS 0.00, so each read prefers the text column and
-- falls back to the legacy numeric one.
create or replace function public.amount_numeric(value text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when value is null then 0::numeric
    when regexp_replace(value, '[^0-9.\-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then regexp_replace(value, '[^0-9.\-]', '', 'g')::numeric
    else 0::numeric
  end
$$;

-- The invoice figure, from whichever column carries it (see the note above).
-- A helper rather than an inline CASE because two functions need the same rule
-- and a rule stated twice is a rule that drifts.
create or replace function public.invoice_numeric(p_amount text, p_total numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_amount, '') ~ '[0-9]' then public.amount_numeric(p_amount)
    else coalesce(p_total, 0)
  end
$$;

-- Per-account record counts and totals for the admin Users / Overview /
-- Growth / Subs screens. One row per profile, so a caller can merge it by id.
--
-- Sales, invoices, expenses, customers, service income and recurring income
-- are attributed by the record's own user_id (the account that wrote it).
-- Inventory is business-wide (no user_id), so it is attributed to every active
-- member of that business -- the same rule the client used, kept so a shared
-- business's stock still shows against the owner.
-- Voided sales are excluded: they are not revenue for the business either.
create or replace function public.admin_user_stats()
returns table (
  user_id uuid,
  sales_count bigint,
  sales_total numeric,
  invoice_count bigint,
  invoice_total numeric,
  expense_count bigint,
  expense_total numeric,
  customer_count bigint,
  service_income_count bigint,
  service_income_total numeric,
  recurring_income_count bigint,
  recurring_income_total numeric,
  inventory_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized. Admin access required.' using errcode = '42501';
  end if;

  return query
  with sales_agg as (
    select s.user_id, count(*) as n, coalesce(sum(public.amount_numeric(s.amount)), 0) as total
      from public.sales s
     where s.user_id is not null
       and s.voided_at is null
     group by s.user_id
  ),
  invoice_agg as (
    select i.user_id, count(*) as n, coalesce(sum(public.invoice_numeric(i.amount, i.total)), 0) as total
      from public.invoices i
     where i.user_id is not null
     group by i.user_id
  ),
  expense_agg as (
    select e.user_id, count(*) as n, coalesce(sum(public.amount_numeric(e.amount)), 0) as total
      from public.expenses e
     where e.user_id is not null
     group by e.user_id
  ),
  customer_agg as (
    select c.user_id, count(*) as n
      from public.customers c
     where c.user_id is not null
     group by c.user_id
  ),
  service_income_agg as (
    select si.user_id, count(*) as n, coalesce(sum(si.amount), 0) as total
      from public.service_income si
     where si.user_id is not null
     group by si.user_id
  ),
  recurring_income_agg as (
    select ri.user_id, count(*) as n, coalesce(sum(ri.amount), 0) as total
      from public.recurring_income ri
     where ri.user_id is not null
     group by ri.user_id
  ),
  inventory_agg as (
    select bi.business_id, count(*) as n
      from public.branch_inventory bi
     group by bi.business_id
  ),
  active_members as (
    select m.user_id, m.business_id
      from public.business_members m
     where m.status = 'active'
  ),
  inventory_by_user as (
    select am.user_id, sum(i.n) as n
      from active_members am
      join inventory_agg i on i.business_id = am.business_id
     group by am.user_id
  )
  select p.id,
         coalesce(sa.n, 0)::bigint,
         coalesce(sa.total, 0),
         coalesce(iv.n, 0)::bigint,
         coalesce(iv.total, 0),
         coalesce(ex.n, 0)::bigint,
         coalesce(ex.total, 0),
         coalesce(cu.n, 0)::bigint,
         coalesce(si.n, 0)::bigint,
         coalesce(si.total, 0),
         coalesce(ri.n, 0)::bigint,
         coalesce(ri.total, 0),
         coalesce(inv.n, 0)::bigint
    from public.profiles p
    left join sales_agg sa on sa.user_id = p.id
    left join invoice_agg iv on iv.user_id = p.id
    left join expense_agg ex on ex.user_id = p.id
    left join customer_agg cu on cu.user_id = p.id
    left join service_income_agg si on si.user_id = p.id
    left join recurring_income_agg ri on ri.user_id = p.id
    left join inventory_by_user inv on inv.user_id = p.id;
end;
$$;

-- Recent records across every table the admin Activity feed and the user
-- drawer show, newest first. Served from SQL because the client cannot read
-- customers / service_income / recurring_income across businesses.
-- p_user_id narrows it to one account (the AdminUserDetail drawer).
create or replace function public.admin_recent_activity(
  p_limit integer default 20,
  p_user_id uuid default null
)
returns table (
  record_type text,
  record_id bigint,
  user_id uuid,
  label text,
  amount numeric,
  happened_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 500));
begin
  if not public.is_admin() then
    raise exception 'Unauthorized. Admin access required.' using errcode = '42501';
  end if;

  return query
  select u.record_type, u.record_id, u.user_id, u.label, u.amount, u.happened_at
    from (
      select 'sales'::text as record_type,
             s.id as record_id,
             s.user_id,
             coalesce(nullif(s.item, ''), 'Sale') as label,
             public.amount_numeric(s.amount) as amount,
             s.created_at as happened_at
        from public.sales s
       where s.voided_at is null
         and (p_user_id is null or s.user_id = p_user_id)
      union all
      select 'invoices',
             i.id,
             i.user_id,
             'Invoice #' || i.id::text,
             public.invoice_numeric(i.amount, i.total),
             i.created_at
        from public.invoices i
       where p_user_id is null or i.user_id = p_user_id
      union all
      select 'expenses',
             e.id,
             e.user_id,
             coalesce(nullif(e.title, ''), 'Expense'),
             public.amount_numeric(e.amount),
             e.created_at
        from public.expenses e
       where p_user_id is null or e.user_id = p_user_id
      union all
      select 'customers',
             c.id,
             c.user_id,
             coalesce(nullif(c.name, ''), nullif(c.company, ''), 'New Customer'),
             null::numeric,
             c.created_at
        from public.customers c
       where p_user_id is null or c.user_id = p_user_id
      union all
      select 'service_income',
             si.id,
             si.user_id,
             coalesce(nullif(si.client_name, ''), 'Service Income'),
             si.amount,
             si.created_at
        from public.service_income si
       where p_user_id is null or si.user_id = p_user_id
      union all
      select 'recurring_income',
             ri.id,
             ri.user_id,
             coalesce(nullif(ri.client_name, ''), 'Recurring Income'),
             ri.amount,
             ri.created_at
        from public.recurring_income ri
       where p_user_id is null or ri.user_id = p_user_id
    ) u
   order by u.happened_at desc nulls last
   limit v_limit;
end;
$$;

-- Overview charts: page visits grouped by device, location and weekday.
-- One row per combination, so the client reduces a few dozen rows instead of
-- downloading every page view (the profile_rows cap is 1000; 30 days of visits
-- already exceeded it).
create or replace function public.admin_visit_stats(p_days integer default 30)
returns table (
  device_type text,
  location text,
  day_index integer,
  visits bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if not public.is_admin() then
    raise exception 'Unauthorized. Admin access required.' using errcode = '42501';
  end if;

  return query
  select coalesce(nullif(v.device_type, ''), 'desktop') as device_type,
         coalesce(nullif(v.location, ''), 'Unknown') as location,
         extract(dow from v.created_at)::integer as day_index,
         count(*)::bigint as visits
    from public.page_visits v
   where v.created_at >= now() - make_interval(days => v_days)
   group by 1, 2, 3;
end;
$$;

-- The Growth funnel's "came back" stage needs a second DAY, not a second page
-- view. Distinct (user, day) pairs stay small; the raw rows do not.
create or replace function public.admin_visit_days(p_days integer default 90)
returns table (
  user_id uuid,
  visit_day date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 90), 365));
begin
  if not public.is_admin() then
    raise exception 'Unauthorized. Admin access required.' using errcode = '42501';
  end if;

  return query
  select v.user_id,
         (v.created_at at time zone 'UTC')::date as visit_day
    from public.page_visits v
   where v.created_at >= now() - make_interval(days => v_days)
     and v.user_id is not null
   group by 1, 2;
end;
$$;

-- Fail closed: the helpers are internal, the four RPCs are callable only by a
-- signed-in user (and each refuses a non-admin inside its own body).
revoke all on function public.amount_numeric(text) from public, anon, authenticated;
revoke all on function public.invoice_numeric(text, numeric) from public, anon, authenticated;

revoke all on function public.admin_user_stats() from public, anon;
revoke all on function public.admin_recent_activity(integer, uuid) from public, anon;
revoke all on function public.admin_visit_stats(integer) from public, anon;
revoke all on function public.admin_visit_days(integer) from public, anon;

grant execute on function public.admin_user_stats() to authenticated;
grant execute on function public.admin_recent_activity(integer, uuid) to authenticated;
grant execute on function public.admin_visit_stats(integer) to authenticated;
grant execute on function public.admin_visit_days(integer) to authenticated;

notify pgrst, 'reload schema';
