-- Fix RLS policies for mixed user_id column types.
-- metrics.user_id is text, reflections.user_id is uuid.

alter table public.metrics enable row level security;
alter table public.reflections enable row level security;

drop policy if exists "Allow all operations" on public.metrics;
drop policy if exists "metrics: own rows only" on public.metrics;
create policy "metrics: own rows only"
  on public.metrics
  for all
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "reflections: own rows only" on public.reflections;
create policy "reflections: own rows only"
  on public.reflections
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
