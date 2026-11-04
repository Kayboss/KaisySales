-- ============================================================
-- M6: Admin user management — suspend/delete via SECURITY DEFINER RPCs.
--
-- Replaces the edge-function-gated `updateUserStatus` (which depends on
-- `VITE_VERIFY_ADMIN_FUNCTION_URL` being set in Vercel) with database-level
-- SECURITY DEFINER functions that check `is_admin()` directly. No network hop,
-- no env var dependency, fail-closed.
--
-- Also adds `deleted_at` to `profiles` for soft deletion of inactive accounts.
-- Accounts with `deleted_at IS NOT NULL` are blocked from signing in.
-- ============================================================

-- 1. Add deleted_at column to profiles (soft delete)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. SECURITY DEFINER function to set user status (admin only)
--    Replaces direct table update + requireAdmin edge-function gate.
CREATE OR REPLACE FUNCTION public.set_user_status(p_user_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET status = p_status, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- 3. SECURITY DEFINER function to soft-delete a user account (admin only)
--    Sets deleted_at so the account cannot sign in. Hard deletion from
--    auth.users requires the Supabase Admin API (edge function) — soft delete
--    is the safe, immediate option.
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET deleted_at = now(), updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- 4. Grants — fail-closed: revoke everything, grant only to authenticated
REVOKE ALL ON FUNCTION public.set_user_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

notify pgrst, 'reload schema';
