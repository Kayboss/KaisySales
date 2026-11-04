-- ============================================================
-- M8: Define is_admin() function (was missing from migrations).
--
-- is_admin() is referenced by RLS policies and SECURITY DEFINER
-- RPCs (set_user_status, delete_user_account, mark_support_notes_read)
-- but was never created via a migration. Without it, admin actions
-- fail silently with "Admin access required" from the RPCs.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

notify pgrst, 'reload schema';
