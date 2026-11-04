-- ============================================================
-- M7: Support note read tracking.
--
-- Adds read_at to support_notes so the admin inbox can distinguish
-- unread reports from ones that have already been viewed.
--
-- fetchOpenSupportRequests will exclude read notes (read_at IS NULL),
-- so the inbox count drops once an admin opens a user's support thread.
-- mark_support_notes_read() SECURITY DEFINER RPC marks all of a user's
-- unread notes as read in one call.
-- ============================================================

-- 1. Add read_at column
ALTER TABLE public.support_notes ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. RPC to mark all of a user's unread support notes as read (admin only)
CREATE OR REPLACE FUNCTION public.mark_support_notes_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.support_notes
  SET read_at = now()
  WHERE user_id = p_user_id
    AND read_at IS NULL;
END;
$$;

-- 3. Grants — fail-closed
REVOKE ALL ON FUNCTION public.mark_support_notes_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_support_notes_read(uuid) TO authenticated;

notify pgrst, 'reload schema';
