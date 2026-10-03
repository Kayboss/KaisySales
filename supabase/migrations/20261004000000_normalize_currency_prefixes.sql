-- ============================================================
-- Normalise stored money text to a single `GHS <number>` format.
--
-- Amounts are stored as TEXT and every reader funnels through
-- parseAmount(), so a mixed prefix never broke a calculation. It did
-- however leak into CSV exports, any raw read of the column, and any
-- future comparison of one row against another.
--
-- Four formats had accumulated:
--   GHS 120.00     current, written by the app
--   GH<20B5>120.00 the pre-2026-09-30 cedi sign
--   GH<00A2>120.00 the cent sign, used by mistake on two expenses
--   GHS<00A0>120.00 a non-breaking space instead of a normal one
--   120 / 120<sp>  no prefix at all, and stray trailing spaces
--
-- Only the prefix is rewritten. The digits are carried across untouched, so
-- no amount changes value, and a leading minus is preserved ahead of the code
-- rather than being stripped with the prefix.
-- ============================================================

-- Kept as a function so the five rewrites below share one definition of
-- "canonical", and so the rule can be exercised on its own.
CREATE OR REPLACE FUNCTION public.normalize_amount(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Nothing numeric in it, so there is no amount to describe. Left alone
    -- rather than replaced with a zero, which would invent a figure.
    WHEN value IS NULL OR value !~ '[0-9]' THEN value
    ELSE (CASE WHEN btrim(value) ~ '^-' THEN '-GHS ' ELSE 'GHS ' END)
      || regexp_replace(btrim(value), '^[^0-9]*([0-9][0-9,]*(\.[0-9]+)?)', '\1')
      || CASE WHEN regexp_replace(btrim(value), '^[^0-9]*', '') ~ '\.' THEN '' ELSE '.00' END
  END
$$;

-- The function is a formatting helper, not part of the data model, so it is
-- not callable by a client. Matches how the other internal functions are locked
-- down.
REVOKE ALL ON FUNCTION public.normalize_amount(text) FROM PUBLIC;

UPDATE inventory SET price      = public.normalize_amount(price)      WHERE price      IS DISTINCT FROM public.normalize_amount(price);
UPDATE inventory SET cost_price = public.normalize_amount(cost_price) WHERE cost_price IS DISTINCT FROM public.normalize_amount(cost_price);
UPDATE expenses  SET amount     = public.normalize_amount(amount)    WHERE amount     IS DISTINCT FROM public.normalize_amount(amount);
UPDATE sales     SET amount     = public.normalize_amount(amount)    WHERE amount     IS DISTINCT FROM public.normalize_amount(amount);
UPDATE invoices  SET amount     = public.normalize_amount(amount)    WHERE amount     IS DISTINCT FROM public.normalize_amount(amount);

-- profiles.area_price and services.area_price are deliberately left alone:
-- they hold size pricing, not money, and are stored as bare numbers on purpose.