-- ============================================================
-- Public contact form submissions.
--
-- The landing site posts to the `contact` edge function, which validates the
-- fields, throttles repeats and inserts with the service role. There is
-- deliberately no anon policy and no anon grant: the public key must not be
-- able to read, write or enumerate an enquiry. Only an admin may read or
-- triage them, and the admin Inbox is the only place they are shown.
--
-- `ip_hash` is an HMAC of the sender's address keyed with a secret the
-- function already holds. It exists to throttle a flood; it is not a stored IP
-- address and cannot be reversed from this table alone.
--
-- No email is sent: this project has no SMTP host and its built-in mailer is
-- capped at two messages an hour for the whole project. Collection is the
-- point; delivery would be a separate change.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'general'
    CHECK (subject IN ('general', 'account', 'billing', 'technical', 'privacy', 'data')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'read', 'closed')),
  source_page TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON public.contact_messages (created_at DESC);

-- The throttle reads "how many from this address in the last hour".
CREATE INDEX IF NOT EXISTS contact_messages_email_created_at_idx
  ON public.contact_messages (email, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_messages_ip_hash_created_at_idx
  ON public.contact_messages (ip_hash, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- A new table inherits the default ACL (anon and authenticated hold full DML).
-- RLS would refuse anon anyway, but the privilege layer must not depend on it:
-- REVOKE explicitly, then grant authenticated only what the admin screens use.
REVOKE ALL ON public.contact_messages FROM anon;
REVOKE ALL ON public.contact_messages FROM authenticated;
GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;

DROP POLICY IF EXISTS "Admins can read contact messages" ON public.contact_messages;
CREATE POLICY "Admins can read contact messages" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;
CREATE POLICY "Admins can update contact messages" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- The edge function inserts as service_role, which bypasses RLS. No INSERT
-- policy is defined on purpose: no client role may write here directly.
NOTIFY pgrst, 'reload schema';
