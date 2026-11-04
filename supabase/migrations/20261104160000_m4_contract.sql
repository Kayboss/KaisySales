-- ============================================================
-- M4: Contract phase of the tenancy migration.
--
-- Drops the legacy `inventory` table (all reads now go through
-- `products` + `branch_inventory`) and the `profiles.business_*`
-- columns (settings now read from `businesses`).
--
-- Safe to run only after the frontend no longer reads `inventory`
-- directly and settings come from `businesses` (see supabase.js
-- fetchUsersWithStats / fetchUserBusinessEmailMap).
-- ============================================================

-- 1. Drop triggers on inventory
DROP TRIGGER IF EXISTS trg_fill_tenant ON public.inventory;
DROP TRIGGER IF EXISTS trg_user_actions ON public.inventory;
DROP TRIGGER IF EXISTS inventory_sync_quantity ON public.inventory;

-- 2. Drop RLS policies on inventory
DROP POLICY IF EXISTS inventory_select ON public.inventory;
DROP POLICY IF EXISTS inventory_insert ON public.inventory;
DROP POLICY IF EXISTS inventory_update ON public.inventory;
DROP POLICY IF EXISTS inventory_delete ON public.inventory;

-- 3. Disable RLS on inventory
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;

-- 4. Drop the sync_inventory_quantity trigger function
DROP FUNCTION IF EXISTS public.sync_inventory_quantity();

-- 5. Drop the inventory table (cascades indexes, FKs, etc.)
DROP TABLE IF EXISTS public.inventory;

-- 6. Drop profiles.business_* columns (settings now come from businesses)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS business_name,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS business_type;

NOTIFY pgrst, 'reload schema';
