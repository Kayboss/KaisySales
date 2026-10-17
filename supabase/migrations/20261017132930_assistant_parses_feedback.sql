-- assistant_parses: the weekly-review corpus for the "talk to record" assistant.
--
-- One row per sentence the parser was asked about, whether or not a record was
-- saved. `feedback` carries the user's verdict from the confirmation card
-- (up = saved, down = "not right"), so a misparse is exactly the rows with
-- feedback = 'down'. The fix for those is a hand-corrected FEW_SHOT example in
-- supabase/functions/parse-record/index.ts, not a data change here.
--
-- The client inserts and updates its own rows only; there is no DELETE policy, so
-- the corpus cannot be erased from the app. anon is revoked outright: this table
-- holds a user's raw sentences.

create table if not exists public.assistant_parses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input text not null,
  kind text not null default 'record' check (kind in ('record', 'question', 'unknown')),
  record_type text check (record_type in ('expense', 'sale', 'service_income')),
  parsed jsonb not null default '{}'::jsonb,
  saved boolean not null default false,
  feedback text check (feedback in ('up', 'down')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assistant_parses enable row level security;

-- A user sees and edits only their own attempts. `is_admin()` opens a read path
-- for the weekly review; there is deliberately no admin UPDATE or DELETE.
drop policy if exists assistant_parses_select_own on public.assistant_parses;
create policy assistant_parses_select_own on public.assistant_parses
  for select to authenticated using (user_id = auth.uid());

drop policy if exists assistant_parses_insert_own on public.assistant_parses;
create policy assistant_parses_insert_own on public.assistant_parses
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists assistant_parses_update_own on public.assistant_parses;
create policy assistant_parses_update_own on public.assistant_parses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists assistant_parses_admin_select on public.assistant_parses;
create policy assistant_parses_admin_select on public.assistant_parses
  for select to authenticated using (is_admin());

-- The default table ACL would have handed anon full DML; revoke it explicitly
-- (a bare GRANT does not remove it). Nothing but subscription_plans keeps anon.
revoke all on public.assistant_parses from anon;
revoke all on public.assistant_parses from public;
grant select, insert, update on public.assistant_parses to authenticated;
