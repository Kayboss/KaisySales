-- ============================================================
-- Reconcile inventory.stock with the legacy quantity column.
--
-- The application reads and writes `inventory.stock` everywhere, but
-- supabase-schema.sql declares `quantity` and no migration ever added
-- `stock`. A database provisioned from the schema file therefore had no
-- `stock` column at all, and any row that did exist read as 0 units, so
-- stock deductions and stock values silently reported nothing.
--
-- This migration is idempotent and safe to run against a live database:
--   1. adds `stock` only when it is missing,
--   2. backfills from `quantity` when `stock` is still empty,
--   3. mirrors `stock` into `quantity` from now on, so the committed
--      schema stays truthful instead of drifting further out of date.
-- ============================================================

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Recover the real figures for rows that only ever had `quantity` recorded.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory'
      AND column_name = 'quantity'
  ) THEN
    UPDATE inventory
    SET stock = quantity
    WHERE COALESCE(stock, 0) = 0
      AND COALESCE(quantity, 0) <> 0;
  END IF;
END $$;

-- Keep the legacy column in step so any remaining reader of `quantity`
-- sees the same number the app does.
CREATE OR REPLACE FUNCTION public.sync_inventory_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock THEN
    NEW.quantity := NEW.stock;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_sync_quantity ON inventory;

CREATE TRIGGER inventory_sync_quantity
  BEFORE INSERT OR UPDATE OF stock ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_quantity();

-- This database carries a default ACL that grants EXECUTE on every new function
-- in `public` to anon and authenticated, so revoking from PUBLIC alone leaves
-- both roles able to call it. Name them explicitly. A trigger function needs
-- no runtime EXECUTE privilege, so this costs nothing.
REVOKE ALL ON FUNCTION public.sync_inventory_quantity() FROM PUBLIC, anon, authenticated;

-- A quantity of zero is not a meaningful threshold, so fall back to 5 as the
-- rest of the application does.
ALTER TABLE inventory ALTER COLUMN min_stock SET DEFAULT 5;

NOTIFY pgrst, 'reload schema';