-- Per-service area pricing for the printing price calculator.
-- Each catalog service can define its own price-per-sq-ft (P) and the
-- inches/cm divisor, so different services can carry different rates.
-- Empty string = not set (falls back to the account default).
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS area_price TEXT DEFAULT '';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS area_divisor TEXT DEFAULT '';

NOTIFY pgrst, 'reload schema';