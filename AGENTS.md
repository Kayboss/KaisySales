# AGENTS.md — KaisySales

Project memory for AI coding agents. Read this before making any changes.

## Project Overview

KaisySales is a fintech/SaaS app for African (Ghanaian) entrepreneurs. Built with React + Vite on the frontend, Supabase (Postgres) on the backend, deployed on Vercel. GitHub repo: `Kayboss/KaisySales`.

Two mutually exclusive business modes (from `businessType` in settingsStore):
- **retail**: Inventory, Daily Sales, Expenses, Invoices, Reporting, Business Overview dashboard
- **services**: Income Tracking (one-time + recurring), Customers, Service Expenses, Service Invoices, Service Reporting

A user is either retail or services — never both. Components in each mode never overlap.

## Commands

- Lint: `npx eslint <file>` (must be **0 errors, 0 warnings**)
- Build: `npm run build` (passes, ~1.2 MB bundle — chunk size warning is expected, not an error)
- Test: none configured
- **Deploy (IMPORTANT)**: `vercel --prod --yes` — the GitHub webhook auto-deploy does NOT fire reliably. Must always deploy manually.
- Git: `git add -A`; `git commit -m "..."`; `git push origin master` (branch is `master`). Only commit when the user explicitly asks.

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
- PAT: stored locally in the user's environment (see SECURITY.md — never commit it).
- No direct DB connection (firewall) — apply migrations via Management API:
  `POST https://api.supabase.com/v1/projects/mjrfvwtgoiukpbpdpuvq/database/query` with `Authorization: Bearer <PAT>` and `{ query: "..." }`.
- Migrations live in `supabase/migrations/` — add a new timestamped file and apply manually.

### Security state (hardened)
- Subscriptions disabled everywhere: `can_create_record` → `true`.
- Server-side password policy: min 8 chars, lowercase + uppercase + digit required.
- `anon` role has zero access to user data tables (only `SELECT` on `subscription_plans`).
- REVOKE applied on internal functions, anon DML, and EXECUTE on all 9 functions.
- Key users: admin `tripelkay@gmail.com` = `9e2b9c45-ec39-4641-a5f4-ec9b6aa4641f`; silver test user = `598e82b7-2f69-446c-b2f7-60bf6baf49c6`.
- `SECURITY.md` exists at repo root (uncommitted, personal reference — never pushed).

### Key tables
- `service_income`: id, user_id, client_name, amount, platform_fee, net_amount, platform_tag, milestone_label, payment_date, notes, **category** (TEXT, added by migration), created_at
- `recurring_income`: id, user_id, client_name, amount, frequency (monthly/quarterly/yearly), next_due_date, category (TEXT free text), active, timestamps
- `expenses`: id, user_id, title, amount (TEXT with `GH₵` prefix — must strip with `parseFloat(String(e.amount).replace(/[^\d.-]/g, ''))`), category, date, vendor, subcategory, renewal_date, is_asset, asset_lifetime_years, transaction_fee
- `categories`: id, user_id, name, type (income/expense/inventory/sales), created_at
- `profiles`: includes business_type, business_name, logo_url, avatar_color, currency

## Architecture Map

- `src/App.jsx` — routing, Layout (`height: 100vh` + `overflow: hidden`), Main (`overflow-y: auto`), sidebar (logo text only, no icon), mobile header. Renders retail vs services route trees based on `businessType`.
- `src/services/api.js` — all API functions: `fetchServiceIncome`, `createServiceIncome`, `fetchExpenses`, `createExpense`, `fetchCategories(type)`, `createCategory`, `updateCategory`, `deleteCategory`, recurring income CRUD, etc. Uses `dbService` generic CRUD wrappers scoped by `user_id`, falls back to localStorage when Supabase unconfigured.
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
- Expense `amount` is stored as TEXT with `GH₵` prefix — always strip before parseFloat.
- Recharts is the chart library (AreaChart, PieChart, BarChart) — do not hand-roll SVG charts.
- Income "Mark Paid" creates `service_income` + `sales` records; delete cascades.
- Lint must stay 0 errors / 0 warnings.