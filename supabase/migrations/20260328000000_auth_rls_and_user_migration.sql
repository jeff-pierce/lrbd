-- Auth + RLS migration for multi-user safety
-- Run after enabling Supabase Auth.

-- 1) Protect metrics and reflections by authenticated user.
alter table public.metrics enable row level security;
alter table public.reflections enable row level security;

drop policy if exists "metrics: own rows only" on public.metrics;
create policy "metrics: own rows only"
  on public.metrics
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reflections: own rows only" on public.reflections;
create policy "reflections: own rows only"
  on public.reflections
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2) Optional one-time migration from legacy hardcoded user ID.
-- Replace placeholders before running.
-- update public.metrics
-- set user_id = 'REPLACE_NEW_AUTH_USER_UUID'
-- where user_id = 'd37bd602-65bb-4c95-b1fd-9a42ff87a6b3';
--
-- update public.reflections
-- set user_id = 'REPLACE_NEW_AUTH_USER_UUID'
-- where user_id = 'd37bd602-65bb-4c95-b1fd-9a42ff87a6b3';
