-- Area-based price calculator settings (printing / sheet pricing)
-- Area price = price per square foot (P) used as the base in the calculator.
-- Area divisor applied to inches/cm dimensions: amount = (L x H / divisor) x P x Q.
-- Feet dimensions use divisor = 1: amount = L x H x P x Q.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS area_price TEXT DEFAULT '0';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS area_divisor TEXT DEFAULT '144';