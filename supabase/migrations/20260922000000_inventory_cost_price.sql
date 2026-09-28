-- ============================================================
-- Cost price for retail inventory + COGS snapshot on sales.
-- 1) inventory.cost_price: purchase cost per unit. Stored as
--    GHX-prefixed TEXT to match the existing inventory.price.
-- 2) sales.cost: cost snapshot captured at the time of sale so
--    historical gross profit stays correct even if an item's
--    cost price is updated later on.
-- ============================================================

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS cost_price TEXT DEFAULT '';

ALTER TABLE sales ADD COLUMN IF NOT EXISTS cost DOUBLE PRECISION DEFAULT 0;

NOTIFY pgrst, 'reload schema';