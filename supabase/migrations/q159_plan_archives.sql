-- q159 (2026-09-10): "Save & archive" a hunt — per-person archive of a plan.
-- Archived plans leave the person's lists but keep their check-ins; the found
-- stops are recorded as visited places on their profile (device-local, like POIs).
create table if not exists plan_archives (
  activity_id uuid not null references activities(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (activity_id, profile_id)
);
alter table plan_archives enable row level security;
drop policy if exists pa_own on plan_archives;
create policy pa_own on plan_archives for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
select 'q159 plan archives migrated';
