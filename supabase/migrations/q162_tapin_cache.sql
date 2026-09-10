-- q162 (2026-09-10): Tap in — server-side cache for nearby-places pools and per-user throttle.
-- Service role only (no policies). Rows expire by age inside the tapin function.
create table if not exists tapin_cache (
  key     text primary key,
  payload jsonb not null default '{}'::jsonb,
  at      timestamptz not null default now()
);
alter table tapin_cache enable row level security;
select 'q162 tapin cache migrated';
