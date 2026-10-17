-- Indexes for the two reads assistant_parses actually does.
--
-- The RLS SELECT policy filters on user_id on every panel read, and the weekly
-- review filters feedback = 'down' and orders by created_at. Without these the
-- planner falls back to a sequential scan as the corpus grows.

create index if not exists assistant_parses_user_created_idx
  on public.assistant_parses (user_id, created_at desc);

create index if not exists assistant_parses_feedback_created_idx
  on public.assistant_parses (feedback, created_at desc);
