-- ============================================================
-- Reactivating a deactivated team member.
--
-- `remove_member` (20261103150000) never deleted anything: it set
-- business_members.status = 'removed'. Nothing could undo it, so a
-- deactivated teammate was invisible in Team settings and unreachable
-- from the app — the interface promised a delete it deliberately did not
-- perform.
--
-- This adds the owner-only inverse. The auth user is untouched, so a
-- reactivated teammate signs in with the same email and password and
-- finds every record they had.
--
-- One active business per login (index business_members_one_active) is
-- still enforced: if they joined another business while they were away,
-- the reactivation is refused with a readable reason instead of a raw
-- 23505.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reactivate_member(
  p_user_id uuid,
  p_branch_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member public.business_members;
  v_target public.business_members;
  v_branch bigint;
  v_branch_name text;
BEGIN
  SELECT * INTO v_member FROM public.my_membership();
  IF NOT FOUND OR v_member.role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can reactivate members' USING errcode = '42501';
  END IF;

  -- Scope the target to the caller's own business: a UUID from another
  -- business must read as "not found", never as a reactivation.
  SELECT * INTO v_target
  FROM public.business_members
  WHERE business_id = v_member.business_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found' USING errcode = 'P0002';
  END IF;
  IF v_target.role = 'owner' THEN
    RAISE EXCEPTION 'The owner cannot be deactivated' USING errcode = '22023';
  END IF;
  IF v_target.status = 'active' THEN
    RAISE EXCEPTION 'That person is already active' USING errcode = '22023';
  END IF;

  -- A staff row must name a live branch (constraint staff_needs_branch), so
  -- never reactivate onto an archived or vanished one.
  v_branch := COALESCE(p_branch_id, v_target.branch_id);
  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'Choose a branch for this teammate' USING errcode = '22023';
  END IF;

  SELECT br.name INTO v_branch_name
  FROM public.branches br
  WHERE br.id = v_branch
    AND br.business_id = v_member.business_id
    AND br.archived_at IS NULL;
  IF v_branch_name IS NULL THEN
    RAISE EXCEPTION 'Choose a live branch for this teammate' USING errcode = '22023';
  END IF;

  BEGIN
    UPDATE public.business_members
    SET status = 'active', branch_id = v_branch
    WHERE business_id = v_member.business_id AND user_id = p_user_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This person is already active in another business' USING errcode = '23505';
  END;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'branch_id', v_branch,
    'branch_name', v_branch_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reactivate_member(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_member(uuid, bigint) TO authenticated;

notify pgrst, 'reload schema';
