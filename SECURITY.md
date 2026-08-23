# KaisySales — Security Audit

- **Project:** KaisySales (Supabase + React/Vite on Vercel)
- **Repo:** `Kayboss/KaisySales`
- **Audit date:** 13 August 2026
- **Scope:** Live Supabase database (project `mjrfvwtgoiukpbpdpuvq`), edge functions, client application code, build/deploy pipeline.

---

## 1. Architecture & trust model

| Layer | What it does | Notes |
|-------|--------------|-------|
| `anon` | Logged-out (anonymous) user | Must have **zero** access to user data |
| `authenticated` | Logged-in user, carries a JWT | Only sees/edits rows where `user_id = auth.uid()` |
| `service_role` | Server-only "master key" | Only used inside the `verify-admin` edge function; bypasses RLS |
| `verify-admin` edge function | Server-side admin gate | Checks `profiles.role = 'admin'` on the server; fails closed |

Key property: the admin dashboard is protected at **two** layers — the edge function (page-level gate) *and* RLS `is_admin()` policies on every data read. A bypass of either layer alone cannot expose admin data.

---

## 2. Audit findings & remediation status

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | High (latent) | `profiles` INSERT policy allowed a user to self-insert with `role = 'admin'` (the escalation trigger only guarded UPDATE). | **Fixed** — added `check_profile_insert` trigger + tightened INSERT `WITH CHECK`. |
| 2 | Medium | Internal functions (`log_admin_action`, `handle_new_user`, `prevent_privilege_escalation`, `audit_*`) had PUBLIC/anon EXECUTE, allowing forged audit-log entries and direct calls to SECURITY DEFINER functions. | **Fixed** — revoked; trigger-internal only. |
| 3 | Medium | RLS helper functions (`is_admin`, `can_create_record`, `is_subscription_active`) were callable by anon. | **Fixed** — now `authenticated`-only (required for RLS evaluation). |
| 4 | Medium | `keep_alive` fully open to anon (SELECT `true` / INSERT `WITH CHECK true`); unused by the client. | **Fixed** — anon policies dropped, all anon grants revoked. |
| 5 | Medium (future) | `subscription_payments` self-insert allowed `status = 'confirmed'` — a real vector once subscriptions are re-enabled. | **Fixed** — users may only insert `status = 'pending'`, `admin_id IS NULL`. |
| 6 | Low | `anon` had GRANT ALL (incl. UPDATE/DELETE/TRUNCATE) on all user tables (neutralized by RLS but risky). | **Fixed** — anon retains only `SELECT` on `subscription_plans`. |
| 7 | Fixed earlier | CORS: `verify-admin` returned no `Access-Control-Allow-Origin`, breaking the admin dashboard cross-origin POST. | Fixed 13 Aug 2026 — `OPTIONS` 200 + `ACAO: *` on all responses. |
| 8 | Fixed earlier | CSV formula injection in exports. | Fixed in security round 1 (`15f000d`). |
| 9 | Fixed earlier | `keep_alive` anon DELETE; `error_logs` insert not scoped to self. | Fixed in security round 1 (`15f000d`). |

---

## 3. What was verified clean

- **RLS enabled on all 17 public tables** (`relrowsecurity = true`).
- **No privilege escalation via UPDATE** — `check_profile_update` trigger live (role/subscription columns admin-only).
- **No profile deletion path** — no DELETE policy on `profiles`.
- **0 auth users missing a profile** — INSERT-escalation hole not currently reachable (PK conflict).
- **No secrets in the repo or client bundle** — only `.env.example`; no `service_role`/PAT strings in `src/`.
- **No SQL injection surface** — all queries via Supabase client (parameterized/PostgREST); column names hardcoded; no `.rpc()`/raw SQL/dynamic query strings in app or edge function.
- **XSS** — React escapes rendered strings by default; no `dangerouslySetInnerHTML` usage reviewed.
- **Edge function fails closed** — missing/blank auth header → 401; missing `SERVICE_ROLE_KEY` → error (no silent pass).

---

## 4. Open items / recommendations

1. **Lint debt** — 87 pre-existing repo-wide errors (unused imports, react-hooks). Not security issues, but reduces confidence in static analysis.
2. **Vercel env placeholders** — `POSTGRES_PASSWORD`, `SUPABASE_JWT_SECRET`, and `kaisy_*` vars are empty placeholders in Vercel. They are unused by the deployed app/edge function, but should be removed or populated to avoid confusion.
3. **When re-enabling subscriptions**: restore the `can_create_record` definition from `20260812010000_subscription_limits_rls.sql`, revert the client checks in `src/utils/subscriptionLimits.js`, and re-audit the `subscription_payments` confirm flow.
4. **Monitor** — no server-side anomaly monitoring. Consider Supabase log drains or alerts on the `verify-admin` edge function.

---

## 5. How to re-run the checks

All queries run against the live project via the Supabase Management API
(`POST /v1/projects/<ref>/database/query`, `Authorization: Bearer <PAT>`).

```sql
-- 1. RLS coverage across all public tables
SELECT t.tablename, c.relrowsecurity AS rls_on
FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
ORDER BY t.tablename;

-- 2. RLS policies on key tables
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','sales','invoices','inventory','customers')
ORDER BY tablename, cmd;

-- 3. Escalation triggers on profiles
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'profiles';

-- 4. Function execute ACLs (grep for 'anon')
SELECT p.proname,
       array_agg((x.grantee::regrole)::text) AS grantees
FROM pg_proc p,
     LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) x
WHERE p.pronamespace = 'public'::regnamespace
GROUP BY p.proname
HAVING array_agg((x.grantee::regrole)::text) @> ARRAY['anon'];

-- 5. anon table privileges (should be empty except subscription_plans)
SELECT table_name, string_agg(privilege_type, ',') AS privs
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public'
GROUP BY table_name ORDER BY table_name;

-- 6. Users without a profile (INSERT-escalation reachability)
SELECT count(*) FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

Relevant migrations (in `supabase/migrations/`):
`20260813000000_drop_projects_table.sql` · `20260812000000_security_and_invoice_fixes.sql` · `20260812010000_subscription_limits_rls.sql` · `20260812020000_admin_audit_trail.sql` · `20260812030000_admin_read_service_tables.sql` · `20260812040000_unlimited_access.sql` · `20260813010000_security_hardening.sql` · `20260813010001_revoke_anon_function_grants.sql` · `20260813010002_revoke_public_insert_guard.sql`
