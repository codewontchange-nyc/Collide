-- q163 (2026-09-10): Tap in presence — "also tapped in nearby". One row per person,
-- coarse location (3 decimals ≈ 100 m), overwritten on each tap-in, treated as
-- expired after 45 minutes. Visible only to the person's circle and shared communities.
create table if not exists tapin_presence (
  profile_id uuid primary key references profiles(id) on delete cascade,
  cell  text not null,
  area  text,
  lat   double precision not null,
  lng   double precision not null,
  picks jsonb not null default '[]'::jsonb,
  at    timestamptz not null default now()
);
alter table tapin_presence enable row level security;
drop policy if exists tp_sel on tapin_presence;
create policy tp_sel on tapin_presence for select to authenticated
  using (profile_id = auth.uid() or are_connected(profile_id, auth.uid()) or shares_community(profile_id, auth.uid()));
drop policy if exists tp_own on tapin_presence;
create policy tp_own on tapin_presence for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
select 'q163 tapin presence migrated';

-- q163 addendum (applied live 2026-09-10): presence streams over realtime
alter publication supabase_realtime add table tapin_presence;
alter table tapin_presence replica identity full;

-- q163 addendum (applied live 2026-09-10): a tapped-in person can propose a meet spot
alter table tapin_presence add column if not exists meet jsonb;

-- q163 addendum (applied live 2026-09-10): presence audience — circle (default) or public
alter table tapin_presence add column if not exists audience text not null default 'circle' check (audience in ('circle','public'));
drop policy if exists tp_sel on tapin_presence;
create policy tp_sel on tapin_presence for select to authenticated
  using (profile_id = auth.uid() or audience = 'public' or are_connected(profile_id, auth.uid()) or shares_community(profile_id, auth.uid()));
