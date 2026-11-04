-- ============================================================
-- M4b: Restore profiles.business_* columns as a services-mode
-- fallback.
--
-- M4 dropped these columns assuming all settings come from
-- `businesses`. Services mode has no businesses/branches/staff
-- and was never migrated to the tenancy tables, so it still
-- needs profiles.business_type/currency/logo_url/business_name.
--
-- Values are backfilled from `businesses` where a membership
-- exists, so existing retail owners keep their business row as
-- the source of truth. Services-only logins keep their profile
-- values.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS',
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'retail'
    CHECK (business_type IN ('retail','services'));

-- Backfill from businesses for logins that have a membership.
UPDATE public.profiles p
SET
  business_name = COALESCE(NULLIF(b.name, ''), p.business_name),
  currency = COALESCE(NULLIF(b.currency, ''), p.currency),
  logo_url = COALESCE(NULLIF(b.logo_url, ''), p.logo_url),
  business_type = COALESCE(NULLIF(b.business_type, ''), p.business_type)
FROM public.business_members m
JOIN public.businesses b ON b.id = m.business_id
WHERE p.id = m.user_id
  AND m.status = 'active'
  AND (p.business_name IS DISTINCT FROM COALESCE(NULLIF(b.name, ''), p.business_name)
       OR p.currency IS DISTINCT FROM COALESCE(NULLIF(b.currency, ''), p.currency)
       OR p.logo_url IS DISTINCT FROM COALESCE(NULLIF(b.logo_url, ''), p.logo_url)
       OR p.business_type IS DISTINCT FROM COALESCE(NULLIF(b.business_type, ''), p.business_type));

NOTIFY pgrst, 'reload schema';
