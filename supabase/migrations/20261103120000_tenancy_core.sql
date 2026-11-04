-- ============================================================
-- M1 — tenancy core
--
-- Creates the tenant anchor (businesses, branches, members, invites,
-- products, branch_inventory), adds tenant columns to the ten business
-- tables, installs the tenant helpers/triggers, and swaps RLS from
-- `user_id = auth.uid()` to business/branch membership.
--
-- Expand phase. Nothing here is removed: `inventory`, `user_id` and the
-- profile business columns stay until M4. Every new column is nullable and
-- every policy keeps a legacy branch for rows written before M2 backfills,
-- so an existing account keeps reading and writing its own records.
--
-- Order note: `branches` is created before `business_members` and
-- `business_invites`; the spec's listing puts the FK targets first only in
-- prose, but Postgres needs the referenced table to exist.
-- ============================================================

-- ---------- 1. Tenant tables ----------

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  business_type text not null default 'retail' check (business_type in ('retail','services')),
  currency text not null default 'GHS',
  logo_url text default '',
  phone text default '',
  location text default '',
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.branches (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  location text default '',
  phone text default '',
  address text default '',
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists branches_one_default
  on public.branches (business_id) where is_default;

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  branch_id bigint references public.branches(id) on delete set null,
  modules text[] not null default '{sales}',
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz default now(),
  primary key (business_id, user_id),
  constraint staff_needs_branch check (role = 'owner' or branch_id is not null)
);

-- one active business per login (lift only when a person needs two businesses)
create unique index if not exists business_members_one_active
  on public.business_members (user_id) where status = 'active';

create index if not exists business_members_user on public.business_members (user_id);

create table if not exists public.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null unique,
  branch_id bigint references public.branches(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text default '',
  unit text default 'pcs',
  created_at timestamptz default now()
);
-- deliberately no unique(name): existing inventory rows may duplicate names.
-- Add after a dedupe pass (deferred).

create table if not exists public.branch_inventory (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id bigint not null references public.branches(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  stock integer not null default 0,
  price text default '',
  cost_price text default '',
  min_stock integer not null default 5,
  status text default 'In Stock',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (branch_id, product_id)
);

create index if not exists branch_inventory_branch on public.branch_inventory (branch_id);

-- ---------- 2. Tenant columns on existing tables ----------

alter table public.sales            add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.invoices         add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.expenses         add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.inventory        add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.stores           add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.categories       add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.customers        add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.services         add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.service_income   add column if not exists business_id uuid references public.businesses(id) on delete cascade;
alter table public.recurring_income add column if not exists business_id uuid references public.businesses(id) on delete cascade;

-- branch dimension: retail rows only
alter table public.sales     add column if not exists branch_id bigint references public.branches(id) on delete set null;
alter table public.invoices  add column if not exists branch_id bigint references public.branches(id) on delete set null;
alter table public.expenses  add column if not exists branch_id bigint references public.branches(id) on delete set null;

-- link a sale to the product it actually sold (fixes name-matched voids)
alter table public.sales add column if not exists product_id bigint references public.products(id) on delete set null;

create index if not exists sales_business_branch on public.sales (business_id, branch_id, date desc);
create index if not exists invoices_business_branch on public.invoices (business_id, branch_id, date desc);
create index if not exists expenses_business_branch on public.expenses (business_id, branch_id, date desc);

-- Deleting a cashier must not delete their sales. Attribution becomes nullable
-- and the auth FK changes from CASCADE to SET NULL on every business table.
alter table public.sales            alter column user_id drop not null;
alter table public.invoices         alter column user_id drop not null;
alter table public.expenses         alter column user_id drop not null;
alter table public.inventory        alter column user_id drop not null;
alter table public.stores           alter column user_id drop not null;
alter table public.categories       alter column user_id drop not null;
alter table public.customers        alter column user_id drop not null;
alter table public.services         alter column user_id drop not null;
alter table public.service_income   alter column user_id drop not null;
alter table public.recurring_income alter column user_id drop not null;

alter table public.sales            drop constraint if exists sales_user_id_fkey;
alter table public.invoices         drop constraint if exists invoices_user_id_fkey;
alter table public.expenses         drop constraint if exists expenses_user_id_fkey;
alter table public.inventory        drop constraint if exists inventory_user_id_fkey;
alter table public.stores           drop constraint if exists stores_user_id_fkey;
alter table public.categories       drop constraint if exists categories_user_id_fkey;
alter table public.customers        drop constraint if exists customers_user_id_fkey;
alter table public.services         drop constraint if exists services_user_id_fkey;
alter table public.service_income   drop constraint if exists service_income_user_id_fkey;
alter table public.recurring_income drop constraint if exists recurring_income_user_id_fkey;

alter table public.sales            add constraint sales_user_id_fkey            foreign key (user_id) references auth.users(id) on delete set null;
alter table public.invoices         add constraint invoices_user_id_fkey         foreign key (user_id) references auth.users(id) on delete set null;
alter table public.expenses         add constraint expenses_user_id_fkey         foreign key (user_id) references auth.users(id) on delete set null;
alter table public.inventory        add constraint inventory_user_id_fkey        foreign key (user_id) references auth.users(id) on delete set null;
alter table public.stores           add constraint stores_user_id_fkey           foreign key (user_id) references auth.users(id) on delete set null;
alter table public.categories       add constraint categories_user_id_fkey       foreign key (user_id) references auth.users(id) on delete set null;
alter table public.customers        add constraint customers_user_id_fkey        foreign key (user_id) references auth.users(id) on delete set null;
alter table public.services         add constraint services_user_id_fkey         foreign key (user_id) references auth.users(id) on delete set null;
alter table public.service_income   add constraint service_income_user_id_fkey   foreign key (user_id) references auth.users(id) on delete set null;
alter table public.recurring_income add constraint recurring_income_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

-- ---------- 3. Helpers ----------

create or replace function public.my_membership()
returns public.business_members
language sql stable security definer set search_path = ''
as $$
  select *
  from public.business_members
  where user_id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.my_business_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select business_id
  from public.business_members
  where user_id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.is_business_member(b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where user_id = auth.uid() and business_id = b and status = 'active'
  )
$$;

create or replace function public.is_business_owner(b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where user_id = auth.uid() and business_id = b
      and role = 'owner' and status = 'active'
  )
$$;

create or replace function public.has_module(b uuid, m text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where user_id = auth.uid() and business_id = b and status = 'active'
      and (role = 'owner' or m = any(modules))
  )
$$;

create or replace function public.branch_belongs(b uuid, br bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.branches where id = br and business_id = b
  )
$$;

create or replace function public.can_see_branch(b uuid, br bigint)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- The branch must belong to the business as well as be visible to the caller.
  -- Without the first clause an owner could pair their own business_id with
  -- another business's branch_id and pass the owner side of the check.
  select public.branch_belongs(b, br)
  and exists (
    select 1
    from public.business_members
    where user_id = auth.uid() and business_id = b and status = 'active'
      and (role = 'owner' or branch_id = br)
  )
$$;

-- Only write path to businesses. Also gives the business a default branch, so
-- create_product/record_sale and branch-scoped expenses have somewhere to go.
create or replace function public.create_business(p_name text, p_type text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := coalesce(nullif(btrim(p_name), ''), 'My Business');
  v_type text := coalesce(nullif(btrim(p_type), ''), 'retail');
begin
  if auth.uid() is null then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  if v_type not in ('retail', 'services') then
    raise exception 'Unknown business type: %', v_type using errcode = '22023';
  end if;
  if exists (
    select 1 from public.business_members
    where user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'This login already belongs to a business' using errcode = '23505';
  end if;

  insert into public.businesses (name, business_type, owner_id)
  values (v_name, v_type, auth.uid())
  returning id into v_id;

  insert into public.business_members (business_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  -- Every business gets a default branch, including services ones. Services
  -- never reads branches, but expenses are branch-scoped and M3 makes
  -- branch_id NOT NULL, so a branchless business would have nowhere to file
  -- them.
  insert into public.branches (business_id, name, is_default)
  values (v_id, 'Main', true);

  return v_id;
end;
$$;

-- Only write path to business_members besides create_business.
create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.business_invites;
begin
  if auth.uid() is null then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;

  select * into v_invite
  from public.business_invites
  where code = btrim(p_code)
  for update;

  if not found then
    raise exception 'Invite not found' using errcode = 'P0002';
  end if;
  if v_invite.used_by is not null then
    raise exception 'Invite has already been used' using errcode = '23505';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'Invite has expired' using errcode = '22023';
  end if;
  if v_invite.branch_id is null then
    raise exception 'Invite has no branch assigned' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.business_members
    where user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'This login already belongs to a business' using errcode = '23505';
  end if;

  insert into public.business_members (business_id, user_id, role, branch_id)
  values (v_invite.business_id, auth.uid(), 'staff', v_invite.branch_id);

  update public.business_invites
  set used_by = auth.uid()
  where id = v_invite.id;

  return v_invite.business_id;
end;
$$;

create or replace function public.create_product(
  p_name text,
  p_category text,
  p_unit text,
  p_price text,
  p_cost text,
  p_min_stock int
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_branch bigint;
  v_id bigint;
begin
  select * into v_member from public.my_membership();
  if not found then
    raise exception 'No active business membership' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Product name is required' using errcode = '22023';
  end if;

  v_branch := v_member.branch_id;
  if v_branch is null then
    select id into v_branch
    from public.branches
    where business_id = v_member.business_id and is_default and archived_at is null
    limit 1;
  end if;
  if v_branch is null then
    raise exception 'No branch available for this business' using errcode = '23514';
  end if;

  insert into public.products (business_id, name, category, unit)
  values (v_member.business_id, btrim(p_name), coalesce(p_category, ''), coalesce(nullif(p_unit, ''), 'pcs'))
  returning id into v_id;

  insert into public.branch_inventory (
    business_id, branch_id, product_id, stock, price, cost_price, min_stock, status
  )
  values (
    v_member.business_id, v_branch, v_id, 0,
    coalesce(p_price, ''), coalesce(p_cost, ''),
    coalesce(p_min_stock, 5), 'Out of Stock'
  );

  return v_id;
end;
$$;

create or replace function public.record_sale(
  p_product_id bigint,
  p_quantity int,
  p_payment_method text,
  p_date date,
  p_unit_price text,
  p_cost double precision
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_branch bigint;
  v_stock int;
  v_min int;
  v_name text;
  v_category text;
  v_remaining int;
  v_shortfall int;
  v_price numeric;
  v_total numeric;
  v_amount text;
  v_sale public.sales;
begin
  select * into v_member from public.my_membership();
  if not found then
    raise exception 'No active business membership' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero' using errcode = '22023';
  end if;

  v_branch := v_member.branch_id;
  if v_branch is null then
    select id into v_branch
    from public.branches
    where business_id = v_member.business_id and is_default and archived_at is null
    limit 1;
  end if;
  if v_branch is null then
    select branch_id into v_branch
    from public.branch_inventory
    where business_id = v_member.business_id and product_id = p_product_id
    limit 1;
  end if;
  if v_branch is null then
    raise exception 'No branch available for this business' using errcode = '23514';
  end if;

  select bi.stock, bi.min_stock, p.name, p.category
  into v_stock, v_min, v_name, v_category
  from public.branch_inventory bi
  join public.products p on p.id = bi.product_id
  where bi.business_id = v_member.business_id
    and bi.branch_id = v_branch
    and bi.product_id = p_product_id
  for update of bi;

  if not found then
    raise exception 'Product % is not stocked at this branch', p_product_id using errcode = 'P0002';
  end if;

  v_shortfall := greatest(p_quantity - v_stock, 0);
  v_remaining := greatest(v_stock - p_quantity, 0);

  update public.branch_inventory
  set stock = v_remaining,
      status = case
        when v_remaining <= 0 then 'Out of Stock'
        when v_remaining <= v_min then 'Low Stock'
        else 'In Stock'
      end,
      updated_at = now()
  where business_id = v_member.business_id
    and branch_id = v_branch
    and product_id = p_product_id;

  v_price := coalesce(
    nullif(regexp_replace(coalesce(p_unit_price, ''), '[^0-9.\-]', '', 'g'), '')::numeric,
    0
  );
  v_total := v_price * p_quantity;
  v_amount := public.normalize_amount(v_total::text);

  insert into public.sales (
    business_id, branch_id, user_id, item, category, quantity, unit_price,
    amount, payment_method, date, time, cost, product_id
  )
  values (
    v_member.business_id, v_branch, auth.uid(), v_name, v_category, p_quantity,
    v_price, v_amount, coalesce(nullif(p_payment_method, ''), 'Cash'),
    coalesce(p_date, current_date), to_char(now(), 'DD Mon HH24:MI'),
    coalesce(p_cost, 0), p_product_id
  )
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'remaining', v_remaining,
    'shortfall', v_shortfall
  );
end;
$$;

-- Converts a paid invoice's lines into sales rows and stock movements in one
-- transaction, by product_id. Existing saves create one `sales` row for the
-- whole invoice from items[0]; this writes one row per line so each sale keeps
-- the product it actually sold. `_saleIds` in invoice.items makes the call
-- idempotent.
create or replace function public.record_invoice_sale(p_invoice_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_member public.business_members;
  v_branch bigint;
  v_line jsonb;
  v_product public.products;
  v_stock int;
  v_min int;
  v_qty int;
  v_price numeric;
  v_cost numeric;
  v_cost_text text;
  v_remaining int;
  v_shortfall int;
  v_sale jsonb;
  v_sales jsonb := '[]'::jsonb;
  v_existing jsonb;
  v_ids jsonb;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice % not found', p_invoice_id using errcode = 'P0002';
  end if;
  if lower(coalesce(v_invoice.status, '')) <> 'paid' then
    raise exception 'Invoice % is not paid', p_invoice_id using errcode = '22023';
  end if;

  select * into v_member from public.my_membership();
  if not found then
    raise exception 'No active business membership' using errcode = '42501';
  end if;
  if v_invoice.business_id is distinct from v_member.business_id then
    raise exception 'Invoice % belongs to another business', p_invoice_id using errcode = '42501';
  end if;
  if not public.can_see_branch(v_invoice.business_id, v_invoice.branch_id) then
    raise exception 'Invoice % is outside your branch', p_invoice_id using errcode = '42501';
  end if;

  select x.value into v_existing
  from jsonb_array_elements(coalesce(v_invoice.items, '[]'::jsonb)) as x(value)
  where x.value->>'type' = '_saleIds'
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'sales', coalesce(v_existing->'saleIds', '[]'::jsonb),
      'already_recorded', true
    );
  end if;

  -- Invoices converted by the pre-M1 client carry a single `_saleId` marker.
  -- Treat that as already recorded: re-running would double-decrement stock.
  select x.value into v_existing
  from jsonb_array_elements(coalesce(v_invoice.items, '[]'::jsonb)) as x(value)
  where x.value->>'type' = '_saleId'
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'sales', jsonb_build_array(v_existing->>'saleId'),
      'already_recorded', true
    );
  end if;

  v_branch := coalesce(v_invoice.branch_id, v_member.branch_id);
  if v_branch is null then
    select id into v_branch
    from public.branches
    where business_id = v_member.business_id and is_default and archived_at is null
    limit 1;
  end if;
  if v_branch is null then
    raise exception 'No branch available for this business' using errcode = '23514';
  end if;

  for v_line in
    select x.value
    from jsonb_array_elements(coalesce(v_invoice.items, '[]'::jsonb)) as x(value)
    where coalesce(x.value->>'type', '') = ''
  loop
    v_qty := coalesce((v_line->>'quantity')::int, 0);
    continue when v_qty <= 0;

    select * into v_product
    from public.products
    where business_id = v_member.business_id
      and lower(name) = lower(v_line->>'name')
    limit 1;

    if not found then
      raise exception 'No product matches invoice line "%"', v_line->>'name' using errcode = 'P0002';
    end if;

    select stock, min_stock, coalesce(cost_price, '')
    into v_stock, v_min, v_cost_text
    from public.branch_inventory
    where business_id = v_member.business_id
      and branch_id = v_branch
      and product_id = v_product.id
    for update;

    if not found then
      raise exception 'Product % is not stocked at this branch', v_product.name using errcode = 'P0002';
    end if;

    v_price := coalesce(
      nullif(regexp_replace(coalesce(v_line->>'unitPrice', ''), '[^0-9.\-]', '', 'g'), '')::numeric,
      0
    );
    v_cost := coalesce(
      nullif(regexp_replace(coalesce(v_cost_text, ''), '[^0-9.\-]', '', 'g'), '')::numeric,
      0
    );

    v_shortfall := greatest(v_qty - v_stock, 0);
    v_remaining := greatest(v_stock - v_qty, 0);

    update public.branch_inventory
    set stock = v_remaining,
        status = case
          when v_remaining <= 0 then 'Out of Stock'
          when v_remaining <= v_min then 'Low Stock'
          else 'In Stock'
        end,
        updated_at = now()
    where business_id = v_member.business_id
      and branch_id = v_branch
      and product_id = v_product.id;

    insert into public.sales (
      business_id, branch_id, user_id, item, category, quantity, unit_price,
      amount, payment_method, date, time, cost, product_id
    )
    values (
      v_member.business_id, v_branch, auth.uid(), v_product.name,
      v_product.category, v_qty, v_price,
      public.normalize_amount((v_price * v_qty)::text),
      'Invoice', v_invoice.date, to_char(now(), 'DD Mon HH24:MI'),
      v_cost * v_qty, v_product.id
    )
    returning to_jsonb(sales) into v_sale;

    v_sales := v_sales || jsonb_build_array(v_sale);
  end loop;

  select jsonb_agg((x.value->>'id')::bigint)
  into v_ids
  from jsonb_array_elements(v_sales) as x(value);

  update public.invoices
  set items = coalesce(items, '[]'::jsonb)
              || jsonb_build_array(jsonb_build_object('type', '_saleIds', 'saleIds', coalesce(v_ids, '[]'::jsonb))),
      updated_at = now()
  where id = p_invoice_id;

  return jsonb_build_object(
    'sales', v_sales,
    'already_recorded', false
  );
end;
$$;

-- ---------- 4. Tenant trigger ----------

-- BEFORE INSERT on every business table. Reads the row through jsonb so the
-- same function can serve tables that have no user_id (products) or no
-- branch_id (stores, categories, customers, services, service_income,
-- recurring_income, recurring_income) without raising "record has no field".
--
-- Pre-backfill fallback: an account with no membership yet keeps writing rows
-- with a null business_id, exactly as it did before M1. M2 gives every profile
-- a business; M3 makes the columns NOT NULL, at which point the fallback is
-- unreachable.
create or replace function public.fill_tenant()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_row jsonb := to_jsonb(NEW);
begin
  -- No end user: migrations, dashboard SQL and service-role jobs write the
  -- tenant columns explicitly. RLS still applies to anon/authenticated, and
  -- neither of those runs without a JWT in normal operation.
  if auth.uid() is null then
    return NEW;
  end if;

  select * into v_member from public.my_membership();

  if not found then
    if tg_table_name in ('products', 'branch_inventory') then
      raise exception 'No active business membership' using errcode = '42501';
    end if;
    if v_row ? 'business_id' then
      v_row := v_row || jsonb_build_object('business_id', null);
    end if;
    if v_row ? 'user_id' then
      v_row := v_row || jsonb_build_object('user_id', auth.uid());
    end if;
    NEW := jsonb_populate_record(NEW, v_row);
    return NEW;
  end if;

  if v_row ? 'business_id' then
    v_row := v_row || jsonb_build_object('business_id', v_member.business_id);
  end if;
  if v_row ? 'user_id' then
    v_row := v_row || jsonb_build_object('user_id', auth.uid());
  end if;
  if v_row ? 'branch_id' then
    if v_member.role = 'staff' then
      v_row := v_row || jsonb_build_object('branch_id', v_member.branch_id);
    elsif (v_row->>'branch_id') is null then
      -- Owners may leave the branch empty (legacy UI writes); file it at the
      -- default branch so branch-scoped policies and M3's NOT NULL hold.
      v_row := v_row || jsonb_build_object(
        'branch_id',
        (
          select b.id
          from public.branches b
          where b.business_id = v_member.business_id
            and b.is_default and b.archived_at is null
          limit 1
        )
      );
    end if;
  end if;

  NEW := jsonb_populate_record(NEW, v_row);
  return NEW;
end;
$$;

drop trigger if exists trg_fill_tenant on public.sales;
create trigger trg_fill_tenant before insert on public.sales
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.invoices;
create trigger trg_fill_tenant before insert on public.invoices
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.expenses;
create trigger trg_fill_tenant before insert on public.expenses
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.inventory;
create trigger trg_fill_tenant before insert on public.inventory
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.stores;
create trigger trg_fill_tenant before insert on public.stores
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.categories;
create trigger trg_fill_tenant before insert on public.categories
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.customers;
create trigger trg_fill_tenant before insert on public.customers
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.services;
create trigger trg_fill_tenant before insert on public.services
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.service_income;
create trigger trg_fill_tenant before insert on public.service_income
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.recurring_income;
create trigger trg_fill_tenant before insert on public.recurring_income
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.products;
create trigger trg_fill_tenant before insert on public.products
  for each row execute function public.fill_tenant();

drop trigger if exists trg_fill_tenant on public.branch_inventory;
create trigger trg_fill_tenant before insert on public.branch_inventory
  for each row execute function public.fill_tenant();

-- ---------- 5. RLS ----------

alter table public.businesses        enable row level security;
alter table public.branches          enable row level security;
alter table public.business_members  enable row level security;
alter table public.business_invites  enable row level security;
alter table public.products          enable row level security;
alter table public.branch_inventory  enable row level security;

-- Re-assert RLS on the tables M1 takes over. They already have it in
-- production; repeating it here keeps the migration safe to run against a
-- database where a table was created without it.
alter table public.sales            enable row level security;
alter table public.invoices         enable row level security;
alter table public.expenses         enable row level security;
alter table public.inventory        enable row level security;
alter table public.stores           enable row level security;
alter table public.categories       enable row level security;
alter table public.customers        enable row level security;
alter table public.services         enable row level security;
alter table public.service_income   enable row level security;
alter table public.recurring_income enable row level security;

-- Old per-user policies are replaced. Admin SELECT policies are left in place:
-- the admin dashboard still needs platform-wide read access.

drop policy if exists "Users can read their sales" on public.sales;
drop policy if exists "Users can insert their sales" on public.sales;
drop policy if exists "Users can update their sales" on public.sales;
drop policy if exists "Users can delete their sales" on public.sales;

drop policy if exists "Users can read their invoices" on public.invoices;
drop policy if exists "Users can insert their invoices" on public.invoices;
drop policy if exists "Users can update their invoices" on public.invoices;
drop policy if exists "Users can delete their invoices" on public.invoices;

drop policy if exists "Users can read their inventory" on public.inventory;
drop policy if exists "Users can insert their inventory" on public.inventory;
drop policy if exists "Users can update their inventory" on public.inventory;
drop policy if exists "Users can delete their inventory" on public.inventory;

drop policy if exists "Users can CRUD their expenses" on public.expenses;
drop policy if exists "Users can CRUD their stores" on public.stores;
drop policy if exists "Users can CRUD their categories" on public.categories;
drop policy if exists "Users can CRUD their customers" on public.customers;
drop policy if exists "Users can CRUD their services" on public.services;
drop policy if exists "Users can CRUD their service_income" on public.service_income;
drop policy if exists "Users can CRUD their recurring_income" on public.recurring_income;

-- businesses: members read, owner updates, nobody inserts directly
drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses
  for select to authenticated using (public.is_business_member(id));
drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses
  for update to authenticated
  using (public.is_business_owner(id))
  with check (public.is_business_owner(id));

-- business_members: own row or owner's full list; writes owner only
drop policy if exists business_members_select on public.business_members;
create policy business_members_select on public.business_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_business_owner(business_id));
drop policy if exists business_members_insert on public.business_members;
create policy business_members_insert on public.business_members
  for insert to authenticated
  with check (public.is_business_owner(business_id)
              and (branch_id is null or public.branch_belongs(business_id, branch_id)));
drop policy if exists business_members_update on public.business_members;
create policy business_members_update on public.business_members
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id)
              and (branch_id is null or public.branch_belongs(business_id, branch_id)));
drop policy if exists business_members_delete on public.business_members;
create policy business_members_delete on public.business_members
  for delete to authenticated using (public.is_business_owner(business_id));

-- business_invites: owner only
drop policy if exists business_invites_select on public.business_invites;
create policy business_invites_select on public.business_invites
  for select to authenticated using (public.is_business_owner(business_id));
drop policy if exists business_invites_insert on public.business_invites;
create policy business_invites_insert on public.business_invites
  for insert to authenticated
  with check (public.is_business_owner(business_id)
              and (branch_id is null or public.branch_belongs(business_id, branch_id)));
drop policy if exists business_invites_update on public.business_invites;
create policy business_invites_update on public.business_invites
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id)
              and (branch_id is null or public.branch_belongs(business_id, branch_id)));
drop policy if exists business_invites_delete on public.business_invites;
create policy business_invites_delete on public.business_invites
  for delete to authenticated using (public.is_business_owner(business_id));

-- branches: members read, owner writes
drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches
  for select to authenticated using (public.is_business_member(business_id));
drop policy if exists branches_insert on public.branches;
create policy branches_insert on public.branches
  for insert to authenticated with check (public.is_business_owner(business_id));
drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
drop policy if exists branches_delete on public.branches;
create policy branches_delete on public.branches
  for delete to authenticated using (public.is_business_owner(business_id));

-- products: business-wide identity, any member reads; create normally via RPC
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated using (public.is_business_member(business_id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated with check (public.is_business_member(business_id));
drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated using (public.is_business_member(business_id));

-- branch_inventory: branch-scoped
drop policy if exists branch_inventory_select on public.branch_inventory;
create policy branch_inventory_select on public.branch_inventory
  for select to authenticated using (public.can_see_branch(business_id, branch_id));
drop policy if exists branch_inventory_insert on public.branch_inventory;
create policy branch_inventory_insert on public.branch_inventory
  for insert to authenticated with check (public.can_see_branch(business_id, branch_id));
drop policy if exists branch_inventory_update on public.branch_inventory;
create policy branch_inventory_update on public.branch_inventory
  for update to authenticated
  using (public.can_see_branch(business_id, branch_id))
  with check (public.can_see_branch(business_id, branch_id));
drop policy if exists branch_inventory_delete on public.branch_inventory;
create policy branch_inventory_delete on public.branch_inventory
  for delete to authenticated using (public.can_see_branch(business_id, branch_id));

-- sales / invoices: branch-scoped, with the pre-backfill legacy branch
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));
drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));
drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id))
  with check ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));
drop policy if exists sales_delete on public.sales;
create policy sales_delete on public.sales
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id))
  with check ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.can_see_branch(business_id, branch_id));

-- expenses: reporting module + branch
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using ((business_id is null and user_id = auth.uid())
         or (public.has_module(business_id, 'reporting') and public.can_see_branch(business_id, branch_id)));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid())
              or (public.has_module(business_id, 'reporting') and public.can_see_branch(business_id, branch_id)));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated
  using ((business_id is null and user_id = auth.uid())
         or (public.has_module(business_id, 'reporting') and public.can_see_branch(business_id, branch_id)))
  with check ((business_id is null and user_id = auth.uid())
              or (public.has_module(business_id, 'reporting') and public.can_see_branch(business_id, branch_id)));
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid())
         or (public.has_module(business_id, 'reporting') and public.can_see_branch(business_id, branch_id)));

-- business-wide directories (services mode included)
drop policy if exists inventory_select on public.inventory;
create policy inventory_select on public.inventory
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists inventory_insert on public.inventory;
create policy inventory_insert on public.inventory
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists inventory_update on public.inventory;
create policy inventory_update on public.inventory
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id))
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists inventory_delete on public.inventory;
create policy inventory_delete on public.inventory
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));

drop policy if exists stores_select on public.stores;
create policy stores_select on public.stores
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists stores_insert on public.stores;
create policy stores_insert on public.stores
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists stores_update on public.stores;
create policy stores_update on public.stores
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id))
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists stores_delete on public.stores;
create policy stores_delete on public.stores
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id))
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id))
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists services_insert on public.services;
create policy services_insert on public.services
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists services_update on public.services;
create policy services_update on public.services
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id))
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists services_delete on public.services;
create policy services_delete on public.services
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));

drop policy if exists service_income_select on public.service_income;
create policy service_income_select on public.service_income
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists service_income_insert on public.service_income;
create policy service_income_insert on public.service_income
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists service_income_update on public.service_income;
create policy service_income_update on public.service_income
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id))
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists service_income_delete on public.service_income;
create policy service_income_delete on public.service_income
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));

drop policy if exists recurring_income_select on public.recurring_income;
create policy recurring_income_select on public.recurring_income
  for select to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists recurring_income_insert on public.recurring_income;
create policy recurring_income_insert on public.recurring_income
  for insert to authenticated
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists recurring_income_update on public.recurring_income;
create policy recurring_income_update on public.recurring_income
  for update to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id))
  with check ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));
drop policy if exists recurring_income_delete on public.recurring_income;
create policy recurring_income_delete on public.recurring_income
  for delete to authenticated
  using ((business_id is null and user_id = auth.uid()) or public.is_business_member(business_id));

-- ---------- 6. ACLs ----------

revoke all on public.businesses, public.business_members, public.business_invites,
              public.branches, public.products, public.branch_inventory from anon;

revoke all on public.businesses, public.business_members, public.business_invites,
              public.branches, public.products, public.branch_inventory from authenticated;

grant select, update on public.businesses to authenticated;
grant select, insert, update, delete on public.business_members to authenticated;
grant select, insert, update, delete on public.business_invites to authenticated;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.branch_inventory to authenticated;

grant usage, select on sequence public.branches_id_seq,
                         public.products_id_seq,
                         public.branch_inventory_id_seq to authenticated;

revoke all on function public.my_membership() from public, anon;
revoke all on function public.my_business_id() from public, anon;
revoke all on function public.is_business_member(uuid) from public, anon;
revoke all on function public.is_business_owner(uuid) from public, anon;
revoke all on function public.has_module(uuid, text) from public, anon;
revoke all on function public.branch_belongs(uuid, bigint) from public, anon;
revoke all on function public.can_see_branch(uuid, bigint) from public, anon;
revoke all on function public.create_business(text, text) from public, anon;
revoke all on function public.redeem_invite(text) from public, anon;
revoke all on function public.create_product(text, text, text, text, text, int) from public, anon;
revoke all on function public.record_sale(bigint, int, text, date, text, double precision) from public, anon;
revoke all on function public.record_invoice_sale(bigint) from public, anon;
revoke all on function public.fill_tenant() from public, anon;

grant execute on function public.my_membership() to authenticated;
grant execute on function public.my_business_id() to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;
grant execute on function public.has_module(uuid, text) to authenticated;
grant execute on function public.branch_belongs(uuid, bigint) to authenticated;
grant execute on function public.can_see_branch(uuid, bigint) to authenticated;
grant execute on function public.create_business(text, text) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.create_product(text, text, text, text, text, int) to authenticated;
grant execute on function public.record_sale(bigint, int, text, date, text, double precision) to authenticated;
grant execute on function public.record_invoice_sale(bigint) to authenticated;

notify pgrst, 'reload schema';
