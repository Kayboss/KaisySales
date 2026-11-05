-- ============================================================
-- Admin: restore a deactivated account, and permanently delete one.
--
-- `delete_user_account` (20261104190000) only sets `profiles.deleted_at`: the
-- admin screen called that "Delete", so a deleted account still held its email
-- address and every record, and there was no way to bring one back.
--
-- This migration adds both halves:
--   * `restore_user_account` clears `deleted_at`;
--   * `purge_user_account` removes the login for good (the address becomes
--     available again, and the business it owned goes with it).
--
-- A hard delete was impossible before this file, for two reasons, both fixed
-- below:
--   1. `user_actions.user_id` is NOT NULL and cascades from `auth.users`. The
--      `log_user_action` trigger fires on the cascaded `profiles` delete and
--      inserts an audit row naming the account that is already gone, so the
--      whole statement aborts with `23503` (`key is not present in table
--      "users"`). Reproduced against production before writing this.
--   2. `businesses.owner_id` is ON DELETE RESTRICT, so an owner's login cannot
--      be removed while their business exists.
-- `business_invites.used_by` had no delete action at all, which blocked the
-- purge of any staff member who had redeemed an invite code.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. The audit trail outlives the account it describes.
--
--    A purge must not fail because history names the person being removed, and
--    deleting the history with them would erase exactly the evidence an admin
--    needs afterwards. The actor is therefore nullable and set to NULL when the
--    account goes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_actions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.user_actions
  DROP CONSTRAINT IF EXISTS user_actions_user_id_fkey;

ALTER TABLE public.user_actions
  ADD CONSTRAINT user_actions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. A spent invite must not survive its redeemer.
--
--    `used_by` is the database's "this code has been used" flag (`redeem_invite`
--    refuses a code whose `used_by` is not null). Setting it to NULL would make
--    an old code look unused and reusable, so the row is deleted with the
--    person instead. `business_id` already cascades when the business goes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_invites
  DROP CONSTRAINT IF EXISTS business_invites_used_by_fkey;

ALTER TABLE public.business_invites
  ADD CONSTRAINT business_invites_used_by_fkey
  FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Audit trigger: record a deleted actor as NULL instead of aborting.
--
--    During a purge the `auth.users` row is already deleted when the cascaded
--    deletes fire, so any audit row naming that id is refused by the foreign
--    key and rolls the purge back. Everything else about the trigger is
--    unchanged (owner read out of the row snapshot, because `profiles` has no
--    `user_id`; SECURITY DEFINER so a signed-in write is allowed to reach
--    `user_actions` at all — see 20261005153000).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_user_action()
RETURNS TRIGGER SET search_path = '' AS $$
DECLARE
  new_row jsonb;
  old_row jsonb;
  actor uuid;
BEGIN
  new_row := to_jsonb(NEW);
  old_row := to_jsonb(OLD);
  actor := COALESCE(
    NULLIF(new_row->>'user_id', '')::uuid,
    NULLIF(old_row->>'user_id', '')::uuid,
    CASE WHEN new_row->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}$' THEN (new_row->>'id')::uuid END,
    CASE WHEN old_row->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}$' THEN (old_row->>'id')::uuid END,
    auth.uid()
  );

  -- An account that no longer exists cannot be an actor. `actor` stays a real
  -- person for every ordinary write; only a cascade triggered by the deletion
  -- of the account itself reaches this branch.
  IF actor IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = actor) THEN
    actor := NULL;
  END IF;

  INSERT INTO public.user_actions (user_id, action, entity, entity_id, details)
  VALUES (
    actor,
    lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(new_row->>'id', old_row->>'id'),
    CASE WHEN TG_OP = 'DELETE' THEN old_row ELSE new_row END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.log_user_action() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Restore a deactivated account (admin only).
--
--    The login was never removed, so clearing `deleted_at` is the whole job.
--    `CheckAuth` refuses a profile with `deleted_at` set, which is why this is
--    enough to give the person their access back.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING errcode = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user id is required' USING errcode = '22004';
  END IF;

  UPDATE public.profiles
  SET deleted_at = NULL, updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such account' USING errcode = 'P0002';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permanently delete an account (admin only).
--
--    Irreversible by design: it is the only way to free an email address that
--    belongs to a business someone has closed. The UI asks twice.
--
--    A business outlives the login that created it, so an owner is refused
--    while other people still work in their shop — the admin must remove or
--    transfer those staff first, instead of silently taking the shop and its
--    sales history down with one person.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_user_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid;
  v_other_members integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING errcode = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user id is required' USING errcode = '22004';
  END IF;

  -- An admin deleting themselves would take the last way into this screen with
  -- it. Require a second admin.
  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'You cannot permanently delete your own account' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'No such account' USING errcode = 'P0002';
  END IF;

  FOR v_business IN
    SELECT b.id FROM public.businesses b WHERE b.owner_id = p_user_id
  LOOP
    SELECT count(*) INTO v_other_members
    FROM public.business_members m
    WHERE m.business_id = v_business
      AND m.user_id <> p_user_id
      AND m.status = 'active';

    IF v_other_members > 0 THEN
      RAISE EXCEPTION
        'This owner still has % active team member(s). Remove or transfer them before deleting the account.',
        v_other_members
        USING errcode = '23503';
    END IF;
  END LOOP;

  -- Deleting the business cascades to its branches, products, stock, sales,
  -- invoices, expenses, customers, categories and invites. Deleting the login
  -- then cascades to the profile, membership, audit rows and support notes.
  DELETE FROM public.businesses WHERE owner_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such account' USING errcode = 'P0002';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants — fail-closed: nothing for anon, callable by a signed-in user and
--    refused inside the function unless `is_admin()`.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.restore_user_account(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_user_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_user_account(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
