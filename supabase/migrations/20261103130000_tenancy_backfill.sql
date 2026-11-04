-- ============================================================
-- M2 — tenancy backfill
--
-- Gives every existing profile a business, an owner membership and a
-- default branch, copies legacy `inventory` into `products` +
-- `branch_inventory`, and fills the tenant columns added by M1.
--
-- Expand phase: nothing is dropped. `inventory` and `profiles.business_*`
-- stay until M4; this migration only fills the new columns and copies data.
--
-- Written to be rerunnable:
--   * businesses are created only for profiles that neither own one nor have
--     an active membership;
--   * owner memberships and default branches use existence guards;
--   * products are matched by business + lower(btrim(name));
--   * branch_inventory inserts use ON CONFLICT DO NOTHING so a rerun never
--     resets stock that later sales have decremented;
--   * every backfill is `where <tenant column> is null`.
--
-- Runs with auth.uid() null (dashboard SQL editor, psql, db push), so
-- `fill_tenant` returns early and the explicit tenant values below stick.
-- A final DO block aborts the whole transaction if any row is left without a
-- business/branch, so M3's NOT NULL can never run against dirty data.
-- ============================================================

begin;

-- ---------- 1. One business per unaffiliated profile ----------

insert into public.businesses (name, business_type, currency, logo_url, phone, location, owner_id)
select
  coalesce(nullif(btrim(p.business_name), ''), 'My Business'),
  case when p.business_type in ('retail', 'services') then p.business_type else 'retail' end,
  coalesce(nullif(btrim(p.currency), ''), 'GHS'),
  coalesce(p.logo_url, ''),
  coalesce(p.phone, ''),
  coalesce(p.location, ''),
  p.id
from public.profiles p
where not exists (
    select 1 from public.business_members m
    where m.user_id = p.id and m.status = 'active'
  )
  and not exists (
    select 1 from public.businesses b
    where b.owner_id = p.id
  );

-- ---------- 2. Owner membership for every business owner ----------

insert into public.business_members (business_id, user_id, role, status)
select distinct on (b.owner_id)
  b.id, b.owner_id, 'owner', 'active'
from public.businesses b
join public.profiles p on p.id = b.owner_id
where not exists (
    select 1 from public.business_members m
    where m.user_id = b.owner_id and m.status = 'active'
  )
order by b.owner_id, b.created_at, b.id
on conflict (business_id, user_id) do update
  set role = 'owner', status = 'active';

-- ---------- 3. Every business gets one default branch ----------

-- New business (or a business M1 left branchless): add a default Main branch.
insert into public.branches (business_id, name, is_default)
select b.id, 'Main', true
from public.businesses b
where not exists (
  select 1 from public.branches br where br.business_id = b.id
);

-- A business with branches but no default: promote its lowest-id live branch.
with pick as (
  select distinct on (business_id) business_id, id
  from public.branches
  where archived_at is null
  order by business_id, id
)
update public.branches br
set is_default = true
from pick
where br.id = pick.id
  and not exists (
    select 1 from public.branches d
    where d.business_id = br.business_id and d.is_default
  );

-- ---------- 4. Backfill business_id on the ten business tables ----------

update public.sales t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.invoices t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.expenses t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.inventory t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.stores t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.categories t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.customers t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.services t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.service_income t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

update public.recurring_income t
set business_id = m.business_id
from public.business_members m
where t.business_id is null
  and t.user_id = m.user_id
  and m.status = 'active';

-- ---------- 5. Backfill branch_id on sales / invoices / expenses ----------

update public.sales t
set branch_id = br.id
from public.branches br
where t.branch_id is null
  and br.business_id = t.business_id
  and br.is_default;

update public.invoices t
set branch_id = br.id
from public.branches br
where t.branch_id is null
  and br.business_id = t.business_id
  and br.is_default;

update public.expenses t
set branch_id = br.id
from public.branches br
where t.branch_id is null
  and br.business_id = t.business_id
  and br.is_default;

-- ---------- 6. inventory -> products + branch_inventory ----------

-- One product per business + case-insensitive name. Duplicate names (the
-- pre-M1 UI allowed them) are merged: their stock is summed, the price/cost
-- of the row with the most stock wins, and min_stock is the largest value.
-- `stock` is authoritative; the mirrored `quantity` column is ignored.
with inv as (
  select
    coalesce(i.business_id, m.business_id) as business_id,
    lower(btrim(i.name)) as nname,
    (array_agg(btrim(i.name) order by i.id))[1] as display_name,
    coalesce(min(nullif(btrim(i.category), '')), '') as category,
    coalesce(min(nullif(btrim(i.unit), '')), 'pcs') as unit,
    sum(coalesce(i.stock, 0))::int as stock,
    max(coalesce(i.min_stock, 5))::int as min_stock,
    (array_agg(coalesce(i.price, '') order by i.stock desc nulls last, i.id desc))[1] as price,
    (array_agg(coalesce(i.cost_price, '') order by i.stock desc nulls last, i.id desc))[1] as cost_price,
    min(i.created_at) as created_at,
    max(i.updated_at) as updated_at
  from public.inventory i
  join public.business_members m
    on m.user_id = i.user_id and m.status = 'active'
  where coalesce(i.business_id, m.business_id) is not null
  group by coalesce(i.business_id, m.business_id), lower(btrim(i.name))
),
new_products as (
  insert into public.products (business_id, name, category, unit, created_at)
  select g.business_id, g.display_name, g.category, g.unit, coalesce(g.created_at, now())
  from inv g
  where not exists (
    select 1 from public.products p
    where p.business_id = g.business_id
      and lower(btrim(p.name)) = g.nname
  )
  returning id, business_id, name
),
catalogue as (
  select p.id, p.business_id, lower(btrim(p.name)) as nname
  from public.products p
  union all
  select np.id, np.business_id, lower(btrim(np.name)) as nname
  from new_products np
),
chosen as (
  -- Existing products are in the pre-statement snapshot; the new ones come
  -- from the CTE. Lowest id wins if a name somehow exists twice.
  select distinct on (business_id, nname) id, business_id, nname
  from catalogue
  order by business_id, nname, id
)
insert into public.branch_inventory (
  business_id, branch_id, product_id, stock, price, cost_price,
  min_stock, status, created_at, updated_at
)
select
  g.business_id,
  br.id,
  c.id,
  g.stock,
  g.price,
  g.cost_price,
  g.min_stock,
  case
    when g.stock <= 0 then 'Out of Stock'
    when g.stock <= g.min_stock then 'Low Stock'
    else 'In Stock'
  end,
  coalesce(g.created_at, now()),
  coalesce(g.updated_at, now())
from inv g
join chosen c
  on c.business_id = g.business_id and c.nname = g.nname
join public.branches br
  on br.business_id = g.business_id
 and br.is_default
on conflict do nothing;

-- ---------- 7. Guard: refuse to leave M3 with dirty data ----------

do $$
declare
  v_problems text;
  v_n int;
begin
  select string_agg(format('%s=%s', t, n), ', ')
  into v_problems
  from (
    select 'sales' as t, count(*)::int as n from public.sales where business_id is null
    union all select 'invoices', count(*) from public.invoices where business_id is null
    union all select 'expenses', count(*) from public.expenses where business_id is null
    union all select 'inventory', count(*) from public.inventory where business_id is null
    union all select 'stores', count(*) from public.stores where business_id is null
    union all select 'categories', count(*) from public.categories where business_id is null
    union all select 'customers', count(*) from public.customers where business_id is null
    union all select 'services', count(*) from public.services where business_id is null
    union all select 'service_income', count(*) from public.service_income where business_id is null
    union all select 'recurring_income', count(*) from public.recurring_income where business_id is null
  ) c
  where n > 0;

  if v_problems is not null then
    raise exception 'tenancy backfill left unassigned business_id: %', v_problems;
  end if;

  select string_agg(format('%s=%s', t, n), ', ')
  into v_problems
  from (
    select 'sales' as t, count(*)::int as n from public.sales where branch_id is null
    union all select 'invoices', count(*) from public.invoices where branch_id is null
    union all select 'expenses', count(*) from public.expenses where branch_id is null
  ) c
  where n > 0;

  if v_problems is not null then
    raise exception 'tenancy backfill left unassigned branch_id: %', v_problems;
  end if;

  select count(*)::int into v_n
  from public.businesses b
  where not exists (
    select 1 from public.branches br
    where br.business_id = b.id and br.is_default
  );

  if v_n > 0 then
    raise exception '% businesses still have no default branch', v_n;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
