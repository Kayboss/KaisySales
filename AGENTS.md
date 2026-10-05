# AGENTS.md — KaisySales

Project memory for AI coding agents. Read this before making any changes.

## Project Overview

KaisySales is a fintech/SaaS app for African (Ghanaian) entrepreneurs. Built with React + Vite on the frontend, Supabase (Postgres) on the backend, deployed on Vercel. GitHub repo: `Kayboss/KaisySales`.

Two mutually exclusive business modes (from `businessType` in settingsStore):
- **retail**: Inventory, Daily Sales, Expenses, Invoices, Reporting, Business Overview dashboard
- **services**: Income Tracking (one-time + recurring), Customers, Service Expenses, Service Invoices, Service Reporting

A user is either retail or services — never both. Components in each mode never overlap.

## Commands

- Lint: `npx eslint <file>` (must be **0 errors, 0 warnings**). The local rule `themeTokens/no-undefined-token` (in `eslint-rules/theme-tokens.js`) fails the build on any `theme.*` path absent from `themeTokens.js`; a missing token resolves to `undefined` and the style is silently dropped, which no other gate can see. Keys that `ThemeContext` adds at runtime must be listed in that rule's `RUNTIME_ALIASES`, and a test enforces they stay in sync.
- Build: `npm run build` (passes, ~1.2 MB bundle — chunk size warning is expected, not an error)
- Test: `npm test` (`node --test scripts/*.test.mjs` — unit tests for the fail-closed backend rules). Use the explicit glob; `node --test scripts/` also matches `test-authz.mjs` and will run the network suite by accident.
- **Deploy (IMPORTANT)**: `npm run release` — this is Gate 1 (lint → unit tests → prod-dep audit → secret scan → build → bundle scan) and only deploys if every check passes. Never run a bare `vercel --prod --yes`; the GitHub webhook auto-deploy does NOT fire reliably, so deploys are always manual.
- **Push before deploying.** CI cannot see unpushed commits, so a deploy that skips `git push` ships code no gate has ever seen.
- Git: `git add -A`; `git commit -m "..."`; `git push origin master` (branch is `master`). Only commit when the user explicitly asks.

## Security gates

- `npm run verify` — Gate 1 body: `lint && test && audit && secrets && build && scan:dist`.
- `npm run audit` — `npm audit --omit=dev --audit-level=high`; production deps must be clean. `npm run audit:all` includes the build toolchain (informational).
- `npm run secrets` — zero-dependency scanner (`scripts/secret-scan.mjs`). Working-tree findings **fail**; `npm run secrets:history` additionally reports git-history findings as **advisory** (history is fixed by rotating credentials, not by a code change).
- `npm run scan:dist` — inspects the built bundle. Supabase **anon** JWTs are allowed (public by design; RLS is the only protection) and are decoded to confirm `role: anon`; a `service_role` JWT, PAT, or private key fails the deploy. It also asserts the configuration-error screen is present, so the fail-closed path cannot be deleted silently.
- `npm run test:authz` — the RLS suite (`scripts/test-authz.mjs`). See "Authorization tests" below. `npm run verify:full` = Gate 1 + authz.
- `.github/workflows/ci.yml` — Gate 2: on every push/PR it runs the Gate 1 steps, CodeQL SAST, and an OWASP ZAP baseline DAST scan, plus the `authz` job; on push it also asserts the live site still serves all six hardened headers. `.github/dependabot.yml` opens grouped dependency PRs weekly.
- `vercel.json` uses `rewrites` (not legacy `routes`). Legacy `routes` silently dropped the entire `headers` block, so CSP/HSTS/X-Frame-Options were never served. Keep the two in sync and re-check headers after any routing change.

## No localStorage fallback in production

- The localStorage fallback keeps a business's real records in one browser, unencrypted and unsynced. It is enabled **only** when `import.meta.env.DEV`.
- The rules live in `src/services/backendConfig.js` (import-free so they are unit testable). `src/services/supabase.js` calls `assertBackendAvailable()` in every auth and data method, and `App.jsx` renders `ConfigError` instead of mounting routes when the backend is missing. A production build with no credentials therefore fails loudly instead of accepting a sign-in and losing the data later.
- A missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in production is a deploy error, not a demo mode. Check the Vercel environment variables before blaming the app.


## Brand Rules

- **"KaisySales" is NEVER written in full uppercase** — always proper case. Never apply `text-transform: uppercase` to it.
- Do not stretch logo text with `letter-spacing`.
- **Fonts**: Tango Sans (display/headings, from Google Fonts), Manrope (secondary display), Work Sans (body/data).
- **Colors**: Terracotta `#6F240A` (primary), Deep Terracotta `#8E3A1F`, Forest Green `#25432F`, Ochre `#875200`, Harvest Gold `#D4AF37`, Warm Cream `#FCF9F3`, Charcoal `#1C1C18`, Muted `#55423D`.
- **Logo**: `public/logo.svg` (gold `#d4af37` + white abstract curved mark, viewBox `403.98 x 372.06`). Used as `<img src="/logo.svg">` with `width: auto` to preserve aspect ratio. `public/logo2.svg` for sticky-nav variant.
- Landing page: logo name text stays **white** on the warm cream background; scrolled (sticky) navbar shows **dark** text for readability.

## Supabase

- Live project ref: `mjrfvwtgoiukpbpdpuvq`
- anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcmZ2d3Rnb2l1a3BicGRwdXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzQ5OTksImV4cCI6MjA5NTA1MDk5OX0.Yk4ePMBZti2suZH7giGb1hNuJ-MRWWT6qwTdRwHsyzc`
- PAT: stored locally in the user's environment (see SECURITY.md — never commit it). Verified absent from git history as of 2026-09-30 by `npm run secrets:history`.
- No direct DB connection (firewall) — apply migrations via Management API:
  `POST https://api.supabase.com/v1/projects/mjrfvwtgoiukpbpdpuvq/database/query` with `Authorization: Bearer <PAT>` and `{ query: "..." }`.
- Migrations live in `supabase/migrations/` — add a new timestamped file and apply manually.

### Security state (hardened)
- Subscriptions disabled everywhere: `can_create_record` → `true`.
- Server-side password policy: min 8 chars, lowercase + uppercase + digit required.
- `anon` role has zero access to user data tables (only `SELECT` on `subscription_plans`).
- REVOKE applied on internal functions, anon DML, and EXECUTE on all 9 functions.
- Key users: admin `tripelkay@gmail.com` = `9e2b9c45-ec39-4641-a5f4-ec9b6aa4641f`; silver test user = `598e82b7-2f69-446c-b2f7-60bf6baf49c6`.
- `SECURITY.md` is gitignored and untracked (local personal reference, never pushed). The one committed version in history (`9d2a343`, 107 bytes) was a stub — `npm run secrets:history` reports 0 findings.

### Authorization tests (`npm run test:authz`)
- The anon key is public, so **database permissions are the only thing** protecting customer data. No linter, audit, SAST or DAST tool can prove that, so `scripts/test-authz.mjs` asks the live database over PostgREST exactly like an attacker would, using only the public anon key.
- It discovers tables and functions from `supabase/migrations/*.sql` and `src/**` (`.from('x')`, `UserRecords(…, 'x')`, `.rpc('x')`), so a table added in a future migration is covered automatically.
- Checks: **A** anon reads nothing, **B** anon inserts nothing, **F** anon executes no function (probed with 4 argument shapes), **C** user A cannot read user B's rows, **D** user A can read their own (liveness), **E** user A cannot update/delete user B's, **G** user A **can** update an audited column on their own row.
- A skip is reported as SKIP, never PASS. `subscription_plans` is the one intentional exception (public pricing catalogue) and the suite fails if it ever gains a `user_id`.
- **G exists because A/B/C/D/E/F could not see a real outage.** The audit triggers (`audit_profile_changes`, `audit_payment_changes`) were `SECURITY INVOKER` and called `log_admin_action`, whose ACL is `postgres` + `service_role` only — so every write by a signed-in user that touched an audited column died with `42501 permission denied for function log_admin_action` and rolled back, breaking `ensureFreeTrial`, `assignSubscription`, `cancelSubscription` and `confirmPayment`. A–F probe the **anon** key, which is refused either way, so the suite stayed green at 102 passed while the admin subscription screen was dead. **Any check that only ever uses the anon key cannot see a bug that only a signed-in user hits — G is the signed-in-user liveness probe.**
- **Do not "fix" that class of bug by granting EXECUTE.** `log_admin_action` is `SECURITY DEFINER`, so `GRANT EXECUTE ... TO authenticated` would let any user forge audit rows through `POST /rest/v1/rpc/log_admin_action`. Fix the *caller* instead: make the trigger function `SECURITY DEFINER` (owned by `postgres`, which already holds EXECUTE). `auth.uid()` reads the request's JWT claim, not the current role, so `actor_id` is still the real acting user and the trail stays honest. Migration `20261005153000`.
- The PostgREST schema endpoint is **service_role-only**, so the suite must never depend on it.
- The live database carries a **default ACL** (`pg_default_acl`) granting `EXECUTE` on every new function in `public` to `anon` and `authenticated`. `REVOKE ... FROM PUBLIC` is therefore **never sufficient** — name `anon, authenticated` explicitly, or the function stays callable with the public anon key. Migration `20261004010000` fixes this and sets `ALTER DEFAULT PRIVILEGES` for future functions.
- The **current** default ACL for new `public` functions is the inverse: `postgres` + `service_role` only, never `anon` or `authenticated` (`postgres=X/postgres,service_role=X/postgres`). That is fail-closed and correct, but it means a new function is **not** callable by a signed-in user until someone grants it. If app code needs to reach it, grant `EXECUTE` to `authenticated` deliberately — or route through a trigger as above. Check `has_function_privilege('authenticated', oid, 'EXECUTE')` before assuming a function is reachable from the client.
- `profiles.status` is `CHECK (status IN ('active','suspended'))`, so a probe value outside that set returns `23514`, not a permission error. Probe privileged columns with legal values or the result will mislead you.
- The authz suite probes each function with the **declared parameter names** parsed from the migration. This matters: PostgREST resolves a call by argument name and answers **404** to a name it does not recognise, so a probe that sends only `user_id` gets 404 for a function with any other parameter and would misreport it as "not exposed". `normalize_amount(text)` was reachable (HTTP 200) while the suite reported PASS. If you add a function with parameters, confirm the suite reports a real permission decision (42501), never a bare 404.
- Needs `SUPABASE_URL` + `SUPABASE_ANON_KEY` for A/B/F. C/D/E need two disposable test accounts; the write probe aims only at user B — **never point it at a customer's account.**
- The two disposable accounts are `authz-a-kbpff4u8xq@example.com` / `authz-b-kbpff4u8xq@example.com`. Passwords live in the gitignored `.env.authz`, and in CI as the `AUTHZ_USER_A_PASSWORD` / `AUTHZ_USER_B_PASSWORD` secrets. The suite signs in and resolves the UUIDs itself, so no ID variables are needed in CI. If a password is ever reset, **the matching GitHub secret must be reset too**, or C/D/E silently degrade to SKIP while the job stays green.
- CI reads the URL, anon key and both emails from repository **variables** (`gh variable`), but the two passwords from **secrets** (`gh secret`). CI has always run the full suite (100 passed / 3 skipped); the 34 skips seen locally are what you get when you run `npm run test:authz` without `.env.authz` loaded, because a skip is reported as SKIP rather than PASS. Always `npm run verify:full` with `.env.authz` sourced before believing a local tenant-check result.
- Self-signup through the anon key is rate-limited enough to be unusable for setup, and the Management API PAT cannot create auth users (`/auth/v1/admin` answers 401 — it wants a `service_role` key). To re-provision an account, run `update auth.users set encrypted_password = extensions.crypt('<pw>', extensions.gen_salt('bf'))` in the SQL editor. An `update` does not re-fire `handle_new_user`, so the existing profile row survives.
- Two checks skip by design, both because the table has no per-user RLS and so no cross-tenant question to ask: `subscription_plans` (public pricing catalogue) and `admin_audit_log` (policy is `using: is_admin()`, so `actor_id` is not an owner column — both fixture accounts are non-admin). Everything else must pass — a rising skip count means a table gained or lost an owner column.

### Key tables
- `service_income`: id, user_id, client_name, amount, platform_fee, net_amount, platform_tag, milestone_label, payment_date, notes, **category** (TEXT, added by migration), created_at
- `recurring_income`: id, user_id, client_name, amount, frequency (monthly/quarterly/yearly), next_due_date, category (TEXT free text), active, timestamps
- `expenses`: id, user_id, title, amount (TEXT with a `GHS ` prefix — read it with `parseAmount()` from `src/utils/currency.js`, never `parseFloat` on the raw string), category, date, vendor, subcategory, renewal_date, is_asset, asset_lifetime_years, transaction_fee
- `categories`: id, user_id, name, type (income/expense/inventory/sales), created_at
- `profiles`: includes business_type, business_name, logo_url, avatar_color, currency

## Architecture Map

- `src/App.jsx` — routing, Layout (`height: 100vh` + `overflow: hidden`), Main (`overflow-y: auto`), sidebar (logo text only, no icon), mobile header. Renders retail vs services route trees based on `businessType`.
- `src/services/api.js` — all API functions: `fetchServiceIncome`, `createServiceIncome`, `fetchExpenses`, `createExpense`, `fetchCategories(type)`, `createCategory`, `updateCategory`, `deleteCategory`, recurring income CRUD, etc. Uses `dbService` generic CRUD wrappers scoped by `user_id`; the localStorage fallback is dev-only (see above).
- `src/services/supabase.js` — dbService (generic user-record CRUD, camelCase↔snake_case conversion).
- `src/store/settingsStore.js` — zustand store; `businessType`, `businessName`, `currency`, `logoUrl`, `avatarColor`, `loadSettings(uid)`, `updateSettings`.
- `src/store/authStore.js` — auth state, login/logout.
- `src/middleware/CheckAuth.jsx` — auth gate + loading screen (logo removed; text "KaisySales" in Tango Sans).
- `src/features/auth/WelcomePage.jsx` — login/signup. Logo `<img>` + "KaisySales" name in white. "Know your Business" heading in Tango Sans.
- `src/features/services/IncomeTracking.jsx` — Dashboard: tabs income/recurring, stat cards (Gross, Expenses, Net, Monthly Recurring), Recharts AreaChart (income solid green line vs dashed red expenses), income + recurring tables, category dropdowns from `fetchCategories('income')`.
- `src/features/services/ServiceExpenses.jsx` — Expenses, hardcoded SUBCATEGORIES (general/saas/subcontractor/hardware/platform_fee) + category dropdown from `fetchCategories('expense')`. Platform fees from service_income shown as read-only rows (`_isFee`).
- `src/features/services/ServiceReporting.jsx` — Reports: P&L + Customers tabs, Recharts charts (AreaChart cash flow, 2× PieChart donuts, BarChart top clients). Parse fee amounts with the `/[^\d.-]/g` strip regex.
- `src/features/services/Customers.jsx` — customer management.
- `src/features/services/ServiceInvoices.jsx` — invoices (edit handlers must filter out `_saleId`/`_incomeId` metadata).
- `src/features/settings/SettingsPage.jsx` — Business Profile form + subscription tab + **Manage Categories** (income/expense tabs, add/delete inline, uses `createCategory({ name, type })`).
- `src/features/settings/SubscriptionSettings.jsx` — subscription UI.
- `src/components/invoice/InvoicePreview.jsx` — invoice render, business logo via `logo_url` with `<img src="/logo.svg">` fallback.
- `public/landing/` — static landing pages: `index.html`, `pages/help.html`, `pages/privacy.html`, `pages/terms.html`, `css/style.css`, `js/main.js`. Navbar scroll toggles `.nav--scrolled` (swaps logo.svg ↔ logo2.svg). "Know your Business, Stay in Control" in Tango Sans.
- `src/styles/themeTokens.js` — theme colors, Tango Sans display font.

## Gotchas

- Vercel webhook auto-deploy unreliable → always `vercel --prod --yes` manually.
- Branch is `master`, not `main`.
- PowerShell environment (Windows): no `&&` chaining; use `;` or `if ($?) { }`.
- Windows CRLF warnings on git add are harmless.
- GitHub log/artifact APIs return **403** to this machine (no auth), so a red CI step must be diagnosable from its own step output. Print the evidence in the step, not just in an artifact.
- The DAST job must **not** use `docker run --network=host` for ZAP: it makes ZAP bind its own API port on the runner and the daemon dies with `Failed to start ZAP :(` (exit 3) before scanning anything. Use the default bridge plus `--add-host=host.docker.internal:host-gateway`, with the preview server bound to `0.0.0.0`, `--shm-size=2g`, and a writable workspace so the report lands in the volume.
- GitHub Actions cannot read repo `secrets.*` in an `if:` condition. The `authz` job tests for empty values in a shell step and gates the next step on an output instead.
- Expense `amount` is stored as TEXT with a `GHS ` prefix — always strip before parseFloat. Rows written before the 2026-09-30 currency switch still carry the old `GH₵` prefix; `parseAmount()` strips either, but **display must go through `formatCurrency()`/`formatCurrencyShort()`** so old and new rows render identically.
- Currency is displayed as the ISO code (`GHS`), never the `₵` glyph: `formatCurrency` uses `currencyDisplay: 'code'`. Tango Sans has no `₵` glyph, so the symbol was being drawn by Manrope inside Tango Sans figures.
- Recharts is the chart library (AreaChart, PieChart, BarChart) — do not hand-roll SVG charts.
- Income "Mark Paid" creates `service_income` + `sales` records; delete cascades.
- Lint must stay 0 errors / 0 warnings.