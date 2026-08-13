-- Remove PUBLIC default EXECUTE on the new profile-insert trigger function.
REVOKE ALL ON FUNCTION public.prevent_profile_insert_escalation() FROM PUBLIC;
