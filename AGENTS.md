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
- **Deploy (IMPORTANT)**: `npm run release` — this is Gate 1 (lint → unit tests → prod-dep audit → secret scan → build → bundle scan), then the migration-ordering gate, and only deploys if every check passes. Never run a bare `vercel --prod --yes`; the GitHub webhook auto-deploy does NOT fire reliably, so deploys are always manual.
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
- `npm run check:migrations` — the deploy-ordering gate (`scripts/check-migrations.mjs`). Runs inside `npm run release` between Gate 1 and `vercel --prod`. See "Deployment ordering" below.

## Deployment ordering

A frontend and its schema have to agree, and only ordering makes that true. Gate 1 cannot help: lint, audit, SAST, DAST and the build all look at the code, never at what production actually holds, so a screen reading a column the database has not gained yet ships as a silently broken screen.

- **Rule: expand → migrate → contract.** An additive migration (new table, new column, new policy) goes out **before** the frontend that uses it; a removal goes out **after** the frontend stops using it. Never ship both halves of a rename in one release.
- **The gate compares `supabase/migrations/*.sql` with `supabase_migrations.schema_migrations` on production** (one read-only Management API query) and blocks a deploy when a file on disk has never been applied there.
- **Drift only warns, never blocks**: the same migration applied under a different version stamp, or schema applied with no file here. Blocking would trap the release behind the very inconsistency it just found — fix the drift, do not let it stop a fix.
- **Fail closed.** No token, no project ref, a 401/403, a network error or an unexpected response shape all block the deploy: shipping without having checked the ordering is the failure the gate exists to prevent.
- **Needs `SUPABASE_ACCESS_TOKEN`** — the same personal access token that applies migrations through the Management API. Put it in the gitignored `.env`; never in Vercel, never committed (`.env` is excluded from the secret scan because it walks `git ls-files --exclude-standard`). `MIGRATION_GATE=skip npm run release` is the escape hatch, for when you know the pending migration is not what the frontend depends on.
- **Apply a migration via the Management API**, per "Supabase" below: `POST https://api.supabase.com/v1/projects/<ref>/database/query` with `Authorization: Bearer <PAT>` and `{ "query": "..." }`. There is no direct DB connection, so a file in `supabase/migrations/` means nothing until it has been applied by hand.
- Pure logic lives in `scripts/migration-gate.mjs` (node-tested); `scripts/check-migrations.mjs` is the CLI around it. To exercise the gate alone, `npm run check:migrations`.

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
- **Every new table in `public` inherits the Supabase default table ACL** (`pg_default_acl`): `anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm`. A migration that merely `GRANT`s does not remove `anon` — it must `REVOKE` explicitly, or a fresh user-data table ships with `anon` holding full DML. Migration `20261010130000` fixes this for `user_actions` **and** runs `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon` so future postgres-created tables are fail-closed by default. (A table that genuinely needs `anon`, like `subscription_plans`, must `GRANT` it explicitly.) `20261010140000` then revokes anon on `services` (Service Catalog), which had escaped `20260813010000`; only `subscription_plans` may keep `anon`. Note the `ALTER DEFAULT PRIVILEGES` only fixes the `postgres` grantor — `pg_default_acl` still lists `anon=arwdDxtm` for the `supabase_admin` grantor, so a table created by `supabase_admin` (rather than by a migration running as `postgres`) would still inherit anon; check `pg_class.relacl` after adding a table.
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

### Audit trail & in-app support
- Migration `20261010120000_audit_trail_and_support_triage.sql` adds: `user_actions` (append-only audit; `authenticated` has **SELECT only** — the `log_user_action()` `SECURITY DEFINER` trigger on 12 tables is the sole writer), `support_notes.{category,url,status,resolved_at}` plus an admin UPDATE policy, and `error_logs.details` (JSONB: stack + user agent + viewport). Migration `20261010130000` then revokes `anon` and tightens `authenticated` to SELECT-only on `user_actions` — 20261010120000 only added a grant and so left the default table ACL's `anon`/full-DML `authenticated` in place (RLS still refused the writes, but the privilege layer must not depend on RLS).
- The audit trigger reads the owner out of `to_jsonb(NEW/OLD)` instead of `NEW.user_id`, because `profiles` has no `user_id` column — a direct `NEW.user_id` reference raises `record "new" has no field "user_id"` and would break signup and every settings save. `profiles` falls back to its uuid `id`.
- Users file reports from **Get Help** (`/help` → `createSupportRequest` / `fetchMySupportNotes`, no admin gate) and the ErrorBoundary "Report this problem" button. The admin area is a **user-centric inbox**: the default **Inbox** tab (`AdminInbox`) aggregates open reports (`fetchOpenSupportRequests`), users with recent errors (`fetchErrorLogs`), and never-signed-in users; clicking any row opens the **`AdminUserDetail`** slide-over drawer, which consolidates that user's Support / Activity / Audit / Errors plus suspend + switch-type actions (`fetchSupportNotes`, `fetchRecentActivity(limit, userId)`, `fetchUserActions(limit, userId)`, `fetchErrorLogs(limit, userId)` — all now accept an optional `userId`). Mark resolved via `updateSupportNoteStatus`. There is no standalone Support or Errors tab. RLS scopes users to their own notes and the user INSERT policy forbids `is_from_admin = true`.
- **Apply this migration before deploying the frontend** — the report insert and the Audit tab need the new columns/table. `scripts/test-authz.mjs` auto-discovers `user_actions`; its `writeProbes` gained `entity` so the E check runs against it rather than skipping.
- **Admin performance**: the dashboard keeps every visited tab mounted and hides inactive ones with CSS (`AdminDashboard`), so switching back does not re-fetch. `requireAdmin()` memoizes the verify-admin edge-function call per access token for 60 s (single-flight, so a tab's concurrent fetches share one call). `src/services/adminCache.js` (`cached`) backs the shared feeds (`fetchAllProfiles`, `fetchUsersWithStats`) with a 60 s TTL + in-flight dedupe; admin writes call `invalidateAdminCache()`, which clears data keys but preserves `admin:verify:*`. The Inbox fetches `fetchNeverSignedInUsers` (a filtered query) instead of scanning all profiles, and `fetchErrorLogs` no longer runs its 30-day cleanup `DELETE` (error_logs has no DELETE policy, so it was a no-op round-trip). A global **Refresh** button remounts visited tabs.

### Key tables
- `service_income`: id, user_id, client_name, amount, platform_fee, net_amount, platform_tag, milestone_label, payment_date, notes, **category** (TEXT, added by migration), created_at
- `recurring_income`: id, user_id, client_name, amount, frequency (monthly/quarterly/yearly), next_due_date, category (TEXT free text), active, timestamps
- `expenses`: id, user_id, title, amount (TEXT with a `GHS ` prefix — read it with `parseAmount()` from `src/utils/currency.js`, never `parseFloat` on the raw string), category, date, vendor, subcategory, renewal_date, is_asset, asset_lifetime_years, transaction_fee
- `categories`: id, user_id, name, type (income/expense/inventory/sales), created_at
- `profiles`: includes business_type, business_name, logo_url, avatar_color, currency
- `assistant_parses`: id, user_id, input, kind (record/question/unknown), record_type (expense/sale/service_income), parsed (JSONB), saved, feedback (up/down), error, created_at, updated_at — telemetry for the retired extractor (see the Assistant section; it now has no writer).

## Architecture Map

- `src/App.jsx` — routing, Layout (`height: 100vh` + `overflow: hidden`), Main (`overflow-y: auto`), sidebar (logo text only, no icon), mobile header. Renders retail vs services route trees based on `businessType`.
- `src/services/api.js` — all API functions: `fetchServiceIncome`, `createServiceIncome`, `fetchExpenses`, `createExpense`, `fetchCategories(type)`, `createCategory`, `updateCategory`, `deleteCategory`, recurring income CRUD, etc. Uses `dbService` generic CRUD wrappers scoped by `user_id`; the localStorage fallback is dev-only (see above).
- `src/services/supabase.js` — dbService (generic user-record CRUD, camelCase↔snake_case conversion).
- `src/store/settingsStore.js` — zustand store; `businessType`, `businessName`, `currency`, `logoUrl`, `avatarColor`, `loadSettings(uid)`, `updateSettings`.
- `src/store/authStore.js` — auth state, login/logout.
- `src/middleware/CheckAuth.jsx` — auth gate + loading screen (logo removed; text "KaisySales" in Tango Sans).
- `src/features/auth/WelcomePage.jsx` — login/signup. Logo `<img>` + "KaisySales" name in white. "Know your Business" heading in Tango Sans.
- `src/features/services/IncomeTracking.jsx` — Dashboard: tabs income/recurring, stat cards (Gross, Expenses, Net, Monthly Recurring), Recharts AreaChart (income solid green line vs dashed red expenses), income + recurring tables, category dropdowns from `fetchCategories('income')`, and an **Add Income** button on the income tab (`openAddIncome`) — before it, new income only ever arrived via a customer's Mark Paid.
- `src/features/services/ServiceExpenses.jsx` — Expenses, hardcoded SUBCATEGORIES (general/saas/subcontractor/hardware/platform_fee) + category dropdown from `fetchCategories('expense')`. Platform fees from service_income shown as read-only rows (`_isFee`).
- `src/features/services/ServiceReporting.jsx` — Reports: P&L + Customers tabs, Recharts charts (AreaChart cash flow, 2× PieChart donuts, BarChart top clients). Parse fee amounts with the `/[^\d.-]/g` strip regex.
- `src/features/services/Customers.jsx` — customer management.
- `src/features/services/ServiceInvoices.jsx` — invoices (edit handlers must filter out `_saleId`/`_incomeId` metadata).
- `src/features/settings/SettingsPage.jsx` — Business Profile form + subscription tab + **Manage Categories** (income/expense tabs, add/delete inline, uses `createCategory({ name, type })`).
- `src/features/settings/SubscriptionSettings.jsx` — subscription UI.
- `src/components/invoice/InvoicePreview.jsx` — invoice render, business logo via `logo_url` with `<img src="/logo.svg">` fallback.
- `public/landing/` — static landing pages: `index.html`, `pages/help.html`, `pages/privacy.html`, `pages/terms.html`, `css/style.css`, `js/main.js`. Navbar scroll toggles `.nav--scrolled` (swaps logo.svg ↔ logo2.svg). "Know your Business, Stay in Control" in Tango Sans.
- `src/styles/themeTokens.js` — theme colors, Tango Sans display font.

### Assistant (feature-flagged)

`VITE_ASSISTANT` in `src/utils/features.js` gates the whole thing (`ASSISTANT_ENABLED`, default on). The panel is a **reading surface, not an input method**: recording is left to the screens, which already do it well and validate what they are told, so a spoken sentence was a slower, blurrier way to fill the same form. The assistant instead does what no single screen can — it reads across every record and says what needs attention, then answers questions about the numbers. **All of it is computed on-device from the same stats the reports use; no model is in the loop and nothing leaves the device.** The `parse-record` Edge Function and Gemini are no longer called by the client (they remain deployed, unused).

- `src/utils/assistant/stats.js` — the only number source. `buildStatsByScope()` returns `statsByScope` keyed by `today / this week / this month / last month / this year / all time` (UTC ISO windows) by reusing the SAME pure helpers the dashboards use (`serviceProfit`, `buildOutstandingRows`, `summariseByCustomer`, `isOverdue`, inventory helpers), so the assistant can never disagree with a report. Sales only in retail; customers/outstanding/recurring only in services. `unpricedCount` (`countItemsMissingCost`) rides along so the insights list can flag a margin it cannot work out.
- `src/utils/assistant/engine.js` — `answer(question, context)` words those numbers deterministically (`classifyIntent` + scope regexes); import-light so it unit-tests in plain Node. Never recomputes a figure — it only formats what it was handed. **An intention to record is not a stats question**: `RECORDING_INTENT_RE` (from `recordingIntent.js`) gives `classifyIntent` a `recordGuide` intent for sentences like "I want to record an expenses", answered with the same walkthrough as `howto` instead of the empty-stats line "You haven't recorded any expenses this month yet". `HOWTO_TOPICS` carries a `modes` list — a services business has no Sales or Inventory screen, so its topics are filtered out and the income topic absorbs "record a sale" instead.
- `src/utils/assistant/insights.js` — the "needs attention" builder. Pure, import-light (only `formatCurrency`), node-tested (`scripts/assistant-insights.test.mjs`). `buildInsights({ mode, currency, statsByScope, todayIso })` turns the SAME stats the engine consumes into a ranked list of `{ id, severity, title, body, route, action }`, sorted `high → medium → low → info`. It never recomputes a figure and never compares incomparable windows: a month-to-date against a whole previous month would show a fall that has not happened, so that comparison is deliberately absent. A business with nothing recorded gets exactly one insight (where the first record goes) rather than a pile of empty ones.
- `src/utils/assistant/recordingIntent.js` — the single regex that recognises a statement of intent to record ("I want to log a sale"), kept separate so the intent can be tested on its own.
- `src/services/assistantContext.js` — loads every record in one `Promise.all` (api.js fetchers fail soft) and packages `{ mode, currency, businessName, statsByScope, projection }`. Insights and answers both come from this one context, so the panel cannot hold two different pictures of the business.
- `src/store/assistantStore.js` — zustand: `open`, `initialQuestion`, `openAssistant(question?)`, `closeAssistant`, `clearInitial`.
- `src/components/assistant/AssistantPanel.jsx` — floating FAB + panel, mounted in `App.jsx` inside the signed-in `Layout`. The landing view is the insights list (`InsightCard`, left border coloured by severity); tapping one navigates to the owning screen and closes the panel. Asking a question swaps the landing view for chat bubbles, with a chip back to the insights. A doorway question is auto-answered once context loads via the React-sanctioned setState-during-render pattern (not an effect — the lint rule `react-hooks/set-state-in-effect` forbids the naive version). Nothing is persisted; history resets on reload. **`Messages` carries `min-height: 0` and it is load-bearing**: without it the flex item's automatic minimum size makes the scroll area grow to fit a tall message instead of scrolling it, the panel (`overflow: hidden`) clips the excess, and on a phone the composer slides out of reach — the scroll "stops working". Every non-scroll sibling (`Header`, `Suggestions`, `Composer`) is `flex-shrink: 0` so only `Messages` yields.
- `src/components/assistant/AssistantDoorway.jsx` — renders `<Sparkles>…</Sparkles>` dashed button on empty states (Inventory, Daily Sales no-inventory, Sales History, Income Tracking, Customers) and opens the panel pre-primed with that screen's question. Returns `null` when `ASSISTANT_ENABLED` is off.
- Tests: `scripts/assistant.test.mjs` (engine), `scripts/assistant-stats.test.mjs` (stats), `scripts/assistant-insights.test.mjs` (insights) and `scripts/assistant-store.test.mjs` (store) run under the standard `npm test` glob. The store test pins down an anon-invisible bug class: `openAssistant` must reject non-strings (a React SyntheticEvent was once passed by the FAB's `onClick={openAssistant}` and rendered as a message child, tripping the global ErrorBoundary on every open).

#### Needs attention (deterministic, no model in the path)

Deciding what needs attention is a reading job, and it is the one thing the dashboards do not do: each screen shows its own records, none of them looks across all of them and says "this is what is wrong". The list is computed once when the panel opens, from `statsByScope`, ordered by severity, and every entry routes to the screen that fixes it.

- **What it says today**: overdue invoices and unpaid balances (services), out-of-stock and running-low items plus items with no cost price (retail), a month running at a loss, a month that has gone quiet, a recurring payment due within seven days (services). A business with nothing recorded gets one entry — where the first record goes — and nothing else.
- **Severity drives the order** (`high → medium → low → info`) and the `InsightCard` left border; `topSeverity(insights)` names the worst level present so a future badge can be driven from it without rendering the list.
- **It deliberately does not compare a partial window with a finished one.** "This month" ends today, so setting it against last month would report a fall that has not happened; that comparison is absent until it can be made honestly.
- **What replaced it**: the old "talk to open" path — `fastParse.js`, `openForms.js`, `recordHandoff.js` and the per-screen `consumeHandoff()` effects — was **deleted**. A spoken sentence had to match a known shape to beat the form, and the form already had the better error margin. The one piece kept is `IncomeTracking`'s **"Add Income" button** (`openAddIncome`), which closed a real gap: new income previously only ever arrived through a customer's "Mark Paid".
- `supabase/functions/parse-record/index.ts` **remains deployed but nothing references it.** It verifies the caller's JWT (`getUser`) and calls Gemini (`gemini-3.5-flash-lite`, override `GEMINI_MODEL`). Keep it byte-identical to what is deployed; `GEMINI_API_KEY` is still set (a function secret whose *name* is the contract — `npm run secrets` cannot verify it). No feature depends on the model being reachable, configured or unretired. If the client is ever pointed back at it, note the model string is the part that rots (`gemini-2.5-flash` was retired for new keys and answered `404`, which surfaces as a `502 model_error`), so read `function_logs` before touching the client.
- Table `assistant_parses` (migration `20261017132930`) now has **no writer** — `logParse` went with the record path. Policies remain (select/insert/update own via `user_id = auth.uid()`, admin SELECT via `is_admin()`, **no DELETE**); `anon` is revoked explicitly and `authenticated` holds SELECT/INSERT/UPDATE only. The column is `not null` with no default, so anything that inserts must set `user_id` itself. `scripts/test-authz.mjs` still auto-discovers the table from the migration, which is the point of leaving it in place.

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