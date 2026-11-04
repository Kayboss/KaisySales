-- ============================================================
-- M4a — RPC extras the multi-branch frontend needs
--
-- M1 shipped the smallest RPC surface that made the tenancy migration
-- verifiable. This migration adds what §9 actually calls:
--
--   1. `businesses.category`, so Settings can read/write the business
--      record instead of `profiles.business_*`.
--   2. `sales.voided_at/voided_by/void_reason` and `void_sale()`; deleting a
--      sale loses the audit row, voiding keeps it and restores stock.
--   3. `record_sale()` takes a branch and a discount percentage, and falls
--      back to the branch's stored price/cost when the client omits them.
--   4. `create_product()` takes a branch and an opening stock, and lays the
--      product's stock row down at every live branch (staff: own branch only).
--   5. `set_branch_stock()` upserts a stock row, so an existing product can be
--      stocked at a second branch without a client-side insert/update dance.
--   6. Team surface: `my_permissions`, `list_business_members`,
--      `member_directory` (names for "Sold by"), invite helpers, and the
--      owner-only member mutations (modules, branch, remove, transfer).
--   7. Platform-admin read access to `business_members` / `businesses`, so the
--      admin Growth funnel can tell a cashier's login from a new business.
--
-- Everything is additive. The old `record_sale`/`create_product` overloads
-- are dropped: nothing in the app called them, and keeping two overloads
-- makes PostgREST argument resolution ambiguous.
-- ============================================================

-- ---------- 1. Business fields the frontend edits ----------

alter table public.businesses add column if not exists category text default '';

-- M2 created the business rows; the category only lived on the profile.
update public.businesses b
set category = coalesce(p.category, '')
from public.profiles p
where p.id = b.owner_id
  and coalesce(b.category, '') = '';

-- ---------- 2. Sale voids ----------

alter table public.sales add column if not exists voided_at timestamptz;
alter table public.sales add column if not exists voided_by uuid references auth.users(id) on delete set null;
alter table public.sales add column if not exists void_reason text default '';

create index if not exists sales_business_branch_live
  on public.sales (business_id, branch_id, date desc)
  where voided_at is null;

-- ---------- 3. Branch-aware product creation ----------

drop function if exists public.create_product(text, text, text, text, text, int);

create or replace function public.create_product(
  p_name text,
  p_category text default '',
  p_unit text default 'pcs',
  p_price text default '',
  p_cost text default '',
  p_min_stock int default 5,
  p_branch_id bigint default null,
  p_stock int default 0
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_branch bigint;
  v_target bigint;
  v_id bigint;
  v_open int := greatest(coalesce(p_stock, 0), 0);
  v_min int := greatest(coalesce(p_min_stock, 5), 0);
begin
  select * into v_member from public.my_membership();
  if not found then
    raise exception 'No active business membership' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Product name is required' using errcode = '22023';
  end if;

  if v_member.role = 'staff' then
    v_target := v_member.branch_id;
    if v_target is null then
      raise exception 'Staff login has no branch' using errcode = '23514';
    end if;
    if p_branch_id is not null and p_branch_id <> v_target then
      raise exception 'Staff can only stock their own branch' using errcode = '42501';
    end if;
  else
    v_target := p_branch_id;
    if v_target is null then
      select id into v_target
      from public.branches
      where business_id = v_member.business_id and is_default and archived_at is null
      limit 1;
    end if;
    if v_target is null or not public.branch_belongs(v_member.business_id, v_target) then
      raise exception 'Branch % is not part of this business', p_branch_id using errcode = '42501';
    end if;
  end if;

  insert into public.products (business_id, name, category, unit)
  values (
    v_member.business_id,
    btrim(p_name),
    coalesce(p_category, ''),
    coalesce(nullif(btrim(p_unit), ''), 'pcs')
  )
  returning id into v_id;

  -- One stock row per live branch for the owner, so the product is visible in
  -- every branch switcher position. Staff only ever write their own branch.
  insert into public.branch_inventory (
    business_id, branch_id, product_id, stock, price, cost_price, min_stock, status
  )
  select
    v_member.business_id,
    b.id,
    v_id,
    case when b.id = v_target then v_open else 0 end,
    coalesce(p_price, ''),
    coalesce(p_cost, ''),
    v_min,
    case
      when (case when b.id = v_target then v_open else 0 end) <= 0 then 'Out of Stock'
      when (case when b.id = v_target then v_open else 0 end) <= v_min then 'Low Stock'
      else 'In Stock'
    end
  from public.branches b
  where b.business_id = v_member.business_id
    and b.archived_at is null
    and (v_member.role = 'owner' or b.id = v_target)
  on conflict (branch_id, product_id) do nothing;

  return v_id;
end;
$$;

-- ---------- 4. Branch-aware sales ----------

drop function if exists public.record_sale(bigint, int, text, date, text, double precision);

create or replace function public.record_sale(
  p_product_id bigint,
  p_quantity int,
  p_payment_method text default 'Cash',
  p_date date default null,
  p_unit_price text default null,
  p_cost double precision default null,
  p_branch_id bigint default null,
  p_discount numeric default 0
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
  v_stored_price text;
  v_stored_cost text;
  v_remaining int;
  v_shortfall int;
  v_price numeric;
  v_cost numeric;
  v_discount numeric;
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

  if v_member.role = 'staff' then
    v_branch := v_member.branch_id;
    if v_branch is null then
      raise exception 'Staff login has no branch' using errcode = '23514';
    end if;
    if p_branch_id is not null and p_branch_id <> v_branch then
      raise exception 'Staff can only sell from their own branch' using errcode = '42501';
    end if;
  else
    v_branch := p_branch_id;
    if v_branch is null then
      select id into v_branch
      from public.branches
      where business_id = v_member.business_id and is_default and archived_at is null
      limit 1;
    end if;
    if v_branch is null or not public.branch_belongs(v_member.business_id, v_branch) then
      raise exception 'Branch % is not part of this business', p_branch_id using errcode = '42501';
    end if;
  end if;

  select bi.stock, bi.min_stock, p.name, p.category,
         coalesce(bi.price, ''), coalesce(bi.cost_price, '')
  into v_stock, v_min, v_name, v_category, v_stored_price, v_stored_cost
  from public.branch_inventory bi
  join public.products p on p.id = bi.product_id
  where bi.business_id = v_member.business_id
    and bi.branch_id = v_branch
    and bi.product_id = p_product_id
  for update of bi;

  if not found then
    raise exception 'Product % is not stocked at this branch', p_product_id using errcode = 'P0002';
  end if;

  v_discount := least(greatest(coalesce(p_discount, 0), 0), 100);
  v_price := coalesce(
    nullif(regexp_replace(coalesce(nullif(p_unit_price, ''), v_stored_price, ''), '[^0-9.\-]', '', 'g'), '')::numeric,
    0
  );
  v_cost := coalesce(
    p_cost,
    nullif(regexp_replace(coalesce(v_stored_cost, ''), '[^0-9.\-]', '', 'g'), '')::numeric,
    0
  );

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

  v_total := round(v_price * p_quantity * (1 - v_discount / 100), 2);
  v_amount := public.normalize_amount(v_total::text);

  insert into public.sales (
    business_id, branch_id, user_id, item, category, quantity, unit_price,
    amount, payment_method, date, time, cost, product_id
  )
  values (
    v_member.business_id, v_branch, auth.uid(), v_name, v_category, p_quantity,
    v_price, v_amount, coalesce(nullif(p_payment_method, ''), 'Cash'),
    coalesce(p_date, current_date), to_char(now(), 'DD Mon HH24:MI'),
    v_cost, p_product_id
  )
  returning * into v_sale;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'branch_id', v_branch,
    'remaining', v_remaining,
    'shortfall', v_shortfall
  );
end;
$$;

-- ---------- 5. Void a sale ----------

create or replace function public.void_sale(p_sale_id bigint, p_reason text default '')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_sale public.sales;
  v_remaining int;
begin
  select * into v_member from public.my_membership();
  if not found then
    raise exception 'No active business membership' using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale % not found', p_sale_id using errcode = 'P0002';
  end if;
  if v_sale.business_id is distinct from v_member.business_id then
    raise exception 'Sale % belongs to another business', p_sale_id using errcode = '42501';
  end if;
  if not public.can_see_branch(v_sale.business_id, v_sale.branch_id) then
    raise exception 'Sale % is outside your branch', p_sale_id using errcode = '42501';
  end if;
  -- A cashier may fix their own mistake; only the owner may void someone
  -- else's sale.
  if v_member.role <> 'owner' and v_sale.user_id is distinct from auth.uid() then
    raise exception 'Only the owner can void another user''s sale' using errcode = '42501';
  end if;

  if v_sale.voided_at is not null then
    return jsonb_build_object('sale', to_jsonb(v_sale), 'already_voided', true);
  end if;

  update public.sales
  set voided_at = now(),
      voided_by = auth.uid(),
      void_reason = coalesce(nullif(btrim(p_reason), ''), 'No reason given'),
      updated_at = now()
  where id = p_sale_id
  returning * into v_sale;

  if v_sale.product_id is not null and v_sale.branch_id is not null then
    update public.branch_inventory
    set stock = stock + coalesce(v_sale.quantity, 0),
        status = case
          when stock + coalesce(v_sale.quantity, 0) <= 0 then 'Out of Stock'
          when stock + coalesce(v_sale.quantity, 0) <= min_stock then 'Low Stock'
          else 'In Stock'
        end,
        updated_at = now()
    where business_id = v_sale.business_id
      and branch_id = v_sale.branch_id
      and product_id = v_sale.product_id
    returning stock into v_remaining;
  end if;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'remaining', v_remaining,
    'already_voided', false
  );
end;
$$;

-- ---------- 6. Stock row upsert ----------

-- Restock/price edit for an existing product at a branch. `create_product`
-- lays the row down at every branch, but products created before this
-- migration only exist at their original branch; the inventory screen uses
-- this to bring one across.
create or replace function public.set_branch_stock(
  p_product_id bigint,
  p_branch_id bigint,
  p_stock int,
  p_price text default null,
  p_cost text default null,
  p_min_stock int default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_branch bigint;
  v_row public.branch_inventory;
  v_stock int := greatest(coalesce(p_stock, 0), 0);
  v_min int;
begin
  select * into v_member from public.my_membership();
  if not found then
    raise exception 'No active business membership' using errcode = '42501';
  end if;

  if v_member.role = 'staff' then
    v_branch := v_member.branch_id;
    if v_branch is null then
      raise exception 'Staff login has no branch' using errcode = '23514';
    end if;
    if p_branch_id is not null and p_branch_id <> v_branch then
      raise exception 'Staff can only stock their own branch' using errcode = '42501';
    end if;
  else
    v_branch := p_branch_id;
    if v_branch is null or not public.branch_belongs(v_member.business_id, v_branch) then
      raise exception 'Branch % is not part of this business', p_branch_id using errcode = '42501';
    end if;
  end if;

  if not exists (
    select 1 from public.products
    where id = p_product_id and business_id = v_member.business_id
  ) then
    raise exception 'Product % not found', p_product_id using errcode = 'P0002';
  end if;

  v_min := greatest(coalesce(p_min_stock, 5), 0);

  insert into public.branch_inventory (
    business_id, branch_id, product_id, stock, price, cost_price, min_stock, status
  )
  values (
    v_member.business_id, v_branch, p_product_id, v_stock,
    coalesce(p_price, ''), coalesce(p_cost, ''), v_min,
    case when v_stock <= 0 then 'Out of Stock'
         when v_stock <= v_min then 'Low Stock'
         else 'In Stock' end
  )
  on conflict (branch_id, product_id) do update
  set stock = excluded.stock,
      price = coalesce(p_price, public.branch_inventory.price),
      cost_price = coalesce(p_cost, public.branch_inventory.cost_price),
      min_stock = coalesce(p_min_stock, public.branch_inventory.min_stock),
      status = case
        when excluded.stock <= 0 then 'Out of Stock'
        when excluded.stock <= coalesce(p_min_stock, public.branch_inventory.min_stock) then 'Low Stock'
        else 'In Stock'
      end,
      updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- ---------- 7. Membership / team surface ----------

create or replace function public.my_permissions()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_business jsonb;
  v_branches jsonb;
begin
  select * into v_member from public.my_membership();
  if not found then
    return jsonb_build_object(
      'business_id', null,
      'role', null,
      'branch_id', null,
      'modules', '[]'::jsonb,
      'business', null,
      'branches', '[]'::jsonb
    );
  end if;

  select to_jsonb(b) into v_business
  from public.businesses b
  where b.id = v_member.business_id;

  select coalesce(
    jsonb_agg(to_jsonb(br) order by br.is_default desc, br.id),
    '[]'::jsonb
  )
  into v_branches
  from public.branches br
  where br.business_id = v_member.business_id
    and br.archived_at is null;

  return jsonb_build_object(
    'business_id', v_member.business_id,
    'role', v_member.role,
    'branch_id', v_member.branch_id,
    'modules', to_jsonb(v_member.modules),
    'business', v_business,
    'branches', v_branches
  );
end;
$$;

create or replace function public.list_business_members()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  branch_id bigint,
  branch_name text,
  modules text[],
  status text,
  joined_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_member public.business_members;
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can list members' using errcode = '42501';
  end if;

  return query
  select m.user_id, p.email, p.owner_name, m.role, m.branch_id, br.name,
         m.modules, m.status, m.created_at, p.last_sign_in_at
  from public.business_members m
  left join public.profiles p on p.id = m.user_id
  left join public.branches br on br.id = m.branch_id
  where m.business_id = v_member.business_id
  order by (m.role = 'owner') desc, coalesce(nullif(p.owner_name, ''), p.email), m.created_at;
end;
$$;

-- Names for "Sold by". Members can read teammates' display name + email, but
-- not their full profile row (profiles stays own-row for non-admins).
create or replace function public.member_directory()
returns table (
  user_id uuid,
  display_name text,
  email text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_member public.business_members;
begin
  select * into v_member from public.my_membership();
  if not found then
    raise exception 'No active business membership' using errcode = '42501';
  end if;

  return query
  select m.user_id,
         coalesce(nullif(p.owner_name, ''), nullif(p.email, ''), 'Unknown'),
         p.email
  from public.business_members m
  left join public.profiles p on p.id = m.user_id
  where m.business_id = v_member.business_id
    and m.status = 'active'
  order by coalesce(nullif(p.owner_name, ''), p.email);
end;
$$;

create or replace function public.create_invite(p_branch_id bigint default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_branch bigint;
  v_branch_name text;
  v_code text;
  v_invite public.business_invites;
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can invite staff' using errcode = '42501';
  end if;

  v_branch := p_branch_id;
  if v_branch is null then
    select id into v_branch
    from public.branches
    where business_id = v_member.business_id and is_default and archived_at is null
    limit 1;
  end if;
  if v_branch is null or not public.branch_belongs(v_member.business_id, v_branch) then
    raise exception 'Branch % is not part of this business', p_branch_id using errcode = '42501';
  end if;

  select name into v_branch_name from public.branches where id = v_branch;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (
      select 1 from public.business_invites where code = v_code
    );
  end loop;

  insert into public.business_invites (business_id, code, branch_id, created_by)
  values (v_member.business_id, v_code, v_branch, auth.uid())
  returning * into v_invite;

  return jsonb_build_object(
    'id', v_invite.id,
    'code', v_invite.code,
    'branch_id', v_invite.branch_id,
    'branch_name', v_branch_name,
    'expires_at', v_invite.expires_at,
    'created_at', v_invite.created_at,
    'used_by', v_invite.used_by
  );
end;
$$;

create or replace function public.list_invites()
returns table (
  id uuid,
  code text,
  branch_id bigint,
  branch_name text,
  expires_at timestamptz,
  used_by uuid,
  used_by_name text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_member public.business_members;
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can list invites' using errcode = '42501';
  end if;

  return query
  select i.id, i.code, i.branch_id, br.name, i.expires_at, i.used_by,
         coalesce(nullif(p.owner_name, ''), p.email), i.created_at
  from public.business_invites i
  left join public.branches br on br.id = i.branch_id
  left join public.profiles p on p.id = i.used_by
  where i.business_id = v_member.business_id
    and i.used_by is null
    and i.expires_at > now()
  order by i.created_at desc
  limit 20;
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can revoke invites' using errcode = '42501';
  end if;

  delete from public.business_invites
  where id = p_invite_id
    and business_id = v_member.business_id
    and used_by is null;

  return found;
end;
$$;

create or replace function public.set_member_modules(p_user_id uuid, p_modules text[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_target public.business_members;
  v_modules text[];
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can change member access' using errcode = '42501';
  end if;

  select * into v_target
  from public.business_members
  where business_id = v_member.business_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'owner' then
    raise exception 'The owner always has every module' using errcode = '22023';
  end if;

  v_modules := array(
    select distinct m
    from unnest(coalesce(p_modules, '{}')) as m
    where m in ('sales', 'reporting')
    order by m
  );
  if not ('sales' = any(v_modules)) then
    v_modules := array_append(v_modules, 'sales');
  end if;

  update public.business_members
  set modules = v_modules
  where business_id = v_member.business_id and user_id = p_user_id;

  return jsonb_build_object('user_id', p_user_id, 'modules', to_jsonb(v_modules));
end;
$$;

create or replace function public.set_member_branch(p_user_id uuid, p_branch_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_target public.business_members;
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can move staff' using errcode = '42501';
  end if;

  select * into v_target
  from public.business_members
  where business_id = v_member.business_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'owner' then
    raise exception 'The owner is not tied to a branch' using errcode = '22023';
  end if;
  if p_branch_id is null
     or not public.branch_belongs(v_member.business_id, p_branch_id)
     or not exists (
       select 1 from public.branches
       where id = p_branch_id and business_id = v_member.business_id and archived_at is null
     ) then
    raise exception 'Branch % is not part of this business', p_branch_id using errcode = '42501';
  end if;

  update public.business_members
  set branch_id = p_branch_id
  where business_id = v_member.business_id and user_id = p_user_id;

  return jsonb_build_object('user_id', p_user_id, 'branch_id', p_branch_id);
end;
$$;

create or replace function public.remove_member(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_target public.business_members;
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can remove members' using errcode = '42501';
  end if;

  select * into v_target
  from public.business_members
  where business_id = v_member.business_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'owner' then
    raise exception 'Transfer ownership before removing the owner' using errcode = '22023';
  end if;

  update public.business_members
  set status = 'removed'
  where business_id = v_member.business_id and user_id = p_user_id;

  return true;
end;
$$;

create or replace function public.transfer_ownership(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.business_members;
  v_target public.business_members;
  v_fallback_branch bigint;
begin
  select * into v_member from public.my_membership();
  if not found or v_member.role <> 'owner' then
    raise exception 'Only the owner can transfer ownership' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You are already the owner' using errcode = '22023';
  end if;

  select * into v_target
  from public.business_members
  where business_id = v_member.business_id
    and user_id = p_user_id
    and status = 'active'
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  v_fallback_branch := coalesce(
    v_target.branch_id,
    (select id from public.branches
     where business_id = v_member.business_id and is_default and archived_at is null
     limit 1)
  );
  if v_fallback_branch is null then
    raise exception 'No branch available for the demoted owner' using errcode = '23514';
  end if;

  -- Demote first: the promoted member is staff until this row changes, and
  -- staff_needs_branch requires the demoted owner to keep a branch.
  update public.business_members
  set role = 'staff', branch_id = v_fallback_branch
  where business_id = v_member.business_id and user_id = auth.uid();

  update public.business_members
  set role = 'owner', branch_id = null
  where business_id = v_member.business_id and user_id = p_user_id;

  update public.businesses
  set owner_id = p_user_id, updated_at = now()
  where id = v_member.business_id;

  return jsonb_build_object('business_id', v_member.business_id, 'owner_id', p_user_id);
end;
$$;

-- ---------- 8. Platform admin read access to tenancy ----------
--
-- The admin dashboard counts accounts (`fetchUsersWithStats`) and the Growth
-- funnel per profile, so a cashier's login would be counted as a new business.
-- Excluding them needs one read of `business_members`, which the M1 policies
-- deliberately deny: an owner can read their own business's members, nobody
-- else's. `is_admin()` is the same gate the rest of the admin area uses.
--
-- Both policies are permissive and add to the member/owner policies rather than
-- replacing them, so nothing a business can see changes. Read only: no admin
-- write path is created here.

drop policy if exists business_members_admin_select on public.business_members;
create policy business_members_admin_select on public.business_members
  for select to authenticated using (public.is_admin());

drop policy if exists businesses_admin_select on public.businesses;
create policy businesses_admin_select on public.businesses
  for select to authenticated using (public.is_admin());

-- ---------- 9. Grants ----------

revoke all on function public.create_product(text, text, text, text, text, int, bigint, int) from public, anon;
revoke all on function public.record_sale(bigint, int, text, date, text, double precision, bigint, numeric) from public, anon;
revoke all on function public.void_sale(bigint, text) from public, anon;
revoke all on function public.set_branch_stock(bigint, bigint, int, text, text, int) from public, anon;
revoke all on function public.my_permissions() from public, anon;
revoke all on function public.list_business_members() from public, anon;
revoke all on function public.member_directory() from public, anon;
revoke all on function public.create_invite(bigint) from public, anon;
revoke all on function public.list_invites() from public, anon;
revoke all on function public.revoke_invite(uuid) from public, anon;
revoke all on function public.set_member_modules(uuid, text[]) from public, anon;
revoke all on function public.set_member_branch(uuid, bigint) from public, anon;
revoke all on function public.remove_member(uuid) from public, anon;
revoke all on function public.transfer_ownership(uuid) from public, anon;

grant execute on function public.create_product(text, text, text, text, text, int, bigint, int) to authenticated;
grant execute on function public.record_sale(bigint, int, text, date, text, double precision, bigint, numeric) to authenticated;
grant execute on function public.void_sale(bigint, text) to authenticated;
grant execute on function public.set_branch_stock(bigint, bigint, int, text, text, int) to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.list_business_members() to authenticated;
grant execute on function public.member_directory() to authenticated;
grant execute on function public.create_invite(bigint) to authenticated;
grant execute on function public.list_invites() to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.set_member_modules(uuid, text[]) to authenticated;
grant execute on function public.set_member_branch(uuid, bigint) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid) to authenticated;

notify pgrst, 'reload schema';
