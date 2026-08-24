-- Add category column to service_income for income categorization.
ALTER TABLE public.service_income
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';
