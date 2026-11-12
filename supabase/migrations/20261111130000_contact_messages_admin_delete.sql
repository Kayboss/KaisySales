-- ============================================================
-- Let an admin delete a contact-form message.
--
-- 20261111120000 gave `authenticated` SELECT and UPDATE only, so a message
-- could be marked closed and never removed. That is a data-retention problem,
-- not just an ergonomics one: the table holds the name, email address and
-- words of people who never signed up, and the form is public, so spam is a
-- certainty. Without a DELETE path the only way to honour an erasure request
-- or clear a flood is the dashboard SQL editor.
--
-- Deleting is deliberately admin-only, and the sender cannot do it: `anon`
-- still holds no grant at all, so the public key cannot remove a message any
-- more than it can read one.
-- ============================================================

GRANT DELETE ON public.contact_messages TO authenticated;

DROP POLICY IF EXISTS "Admins can delete contact messages" ON public.contact_messages;
CREATE POLICY "Admins can delete contact messages" ON public.contact_messages
  FOR DELETE TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
