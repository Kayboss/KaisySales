-- ============================================================
-- Acquisition: where a business first came from
-- ============================================================
--
-- The question this answers is "which channel brings people who actually
-- use the product", and it cannot be answered after the fact: a signup that
-- arrived from a WhatsApp group looks identical to one typed into the URL bar
-- unless the first touch is written down at signup time.
--
-- It is deliberately a separate table rather than a column on `profiles`:
--   * profiles is updatable by its owner, so a later settings save could
--     overwrite (or forge) the first touch. Here authenticated users have
--     INSERT and SELECT on their own row and nothing else, so a row is
--     written once and cannot be rewritten afterwards.
--   * it keeps the analytics concern out of the table every screen reads.
--
-- Written on the first signed-in render of a browser session, with the touch
-- remembered in sessionStorage from the landing page visit. Conflicts on the
-- primary key are ignored, so a second call is a no-op rather than an error.

CREATE TABLE IF NOT EXISTS public.acquisition (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'direct',
  medium TEXT DEFAULT '',
  campaign TEXT DEFAULT '',
  content TEXT DEFAULT '',
  term TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  landing_page TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.acquisition ENABLE ROW LEVEL SECURITY;

-- A user records their own first touch, once. No UPDATE policy exists on
-- purpose: the first touch is the only touch.
DROP POLICY IF EXISTS "Users can record their own acquisition" ON public.acquisition;
CREATE POLICY "Users can record their own acquisition"
  ON public.acquisition FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own acquisition" ON public.acquisition;
CREATE POLICY "Users can read their own acquisition"
  ON public.acquisition FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all acquisition" ON public.acquisition;
CREATE POLICY "Admins can read all acquisition"
  ON public.acquisition FOR SELECT
  USING (is_admin());

-- A new table in `public` inherits the default table ACL, which grants `anon`
-- AND `authenticated` full DML (`arwdDxtm`). A GRANT is additive and removes
-- nothing, so revoking `anon` alone leaves `authenticated` holding
-- UPDATE/DELETE/TRUNCATE that only RLS happens to refuse — and the privilege
-- layer must not depend on RLS. Both roles are revoked explicitly; the two
-- grants below are the entire permission set this table needs.
REVOKE ALL ON public.acquisition FROM anon, authenticated;
GRANT SELECT, INSERT ON public.acquisition TO authenticated;

-- Anonymous traffic has no user to attribute, so it never writes here. The
-- company-wide numbers come from the funnel built on page_visits + records.
NOTIFY pgrst, 'reload schema';
