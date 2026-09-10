-- q166 (2026-09-10): waves — a tap-in wave lands live on the other person's screen.
-- Rows are written by the tapin function (service role); each side can read their own.
create table if not exists waves (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references profiles(id) on delete cascade,
  to_id      uuid not null references profiles(id) on delete cascade,
  from_name  text,
  area       text,
  created_at timestamptz not null default now()
);
create index if not exists waves_to on waves(to_id, created_at desc);
alter table waves enable row level security;
drop policy if exists waves_sel on waves;
create policy waves_sel on waves for select to authenticated using (to_id = auth.uid() or from_id = auth.uid());
alter publication supabase_realtime add table waves;
select 'q166 waves migrated';
