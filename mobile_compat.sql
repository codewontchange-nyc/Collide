-- ============================================================================
--  Collide — mobile-compat columns + shared-map staff powers (2026-08-14)
--  Deeper bundle analysis surfaced fields the mobile app reads/writes that the
--  reconstructed schema lacked. All additive. Without these, posting a plan or
--  a map pin from the app 400s on unknown columns.
-- ============================================================================

-- activities: the app's create-plan form posts these directly
alter table activities add column if not exists category    text;
alter table activities add column if not exists when_bucket text;
alter table activities add column if not exists at_time     text;
alter table activities add column if not exists place       text;
alter table activities add column if not exists note        text;
alter table activities add column if not exists capacity    text;          -- form sends '' — keep text
alter table activities add column if not exists link        text;
alter table activities add column if not exists visibility  text not null default 'public';
alter table activities add column if not exists expires_at  timestamptz;   -- when_bucket → +N days

-- map_events: the shared-map pin editor's full field set
alter table map_events add column if not exists emoji   text not null default '🎉';
alter table map_events add column if not exists at_time text;
alter table map_events add column if not exists place   text;
alter table map_events add column if not exists note    text;
alter table map_events add column if not exists link    text;
alter table map_events add column if not exists venue   text not null default '';

-- communities live ON the map too: emoji + blurb + fractional position
alter table communities add column if not exists emoji text not null default '🏘️';
alter table communities add column if not exists blurb text;
alter table communities add column if not exists x double precision;
alter table communities add column if not exists y double precision;

-- staff manage every map pin (members' own-pin policies stay as they are)
drop policy if exists staff_all on map_events;
create policy staff_all on map_events for all to authenticated
  using (is_any_staff()) with check (is_any_staff());

-- (2026-08-14) profile editor saves display_name + socials (jsonb of handles)
alter table profiles add column if not exists socials jsonb;
-- 1) Onboarding integrity: new profiles start UNNAMED (the app's Welcome-in
--    gate checks display_name) — this also gives the circle its "signing up…"
--    pending signal. connect_code still auto-generates.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

-- 2) Community events mirror to the shared map automatically.
alter table map_events add column if not exists activity_id uuid unique references activities(id) on delete cascade;

create or replace function sync_activity_pin() returns trigger
language plpgsql security definer set search_path = public as $$
declare cx double precision; cy double precision;
begin
  if (tg_op = 'DELETE') then return old; end if;
  if new.community_id is null then
    delete from map_events where activity_id = new.id;
    return new;
  end if;
  select x, y into cx, cy from communities where id = new.community_id;
  insert into map_events (activity_id, title, emoji, at_time, place, venue, x, y, expires_at, created_by)
  values (new.id, new.title, '🎉', new.at_time, coalesce(new.place, new.location), '',
          coalesce(cx, 0.5) + (random()-0.5)*0.06, coalesce(cy, 0.45) - 0.045 - random()*0.02,
          coalesce(new.expires_at, now() + interval '7 days'), new.host_id)
  on conflict (activity_id) do update
    set title = excluded.title, at_time = excluded.at_time, place = excluded.place,
        expires_at = excluded.expires_at;
  return new;
end $$;
drop trigger if exists activities_pin_sync on activities;
create trigger activities_pin_sync after insert or update on activities
  for each row execute function sync_activity_pin();

-- 3) Backfill pins for existing community events
insert into map_events (activity_id, title, emoji, at_time, place, venue, x, y, expires_at, created_by)
select a.id, a.title, '🎉', a.at_time, coalesce(a.place, a.location), '',
       coalesce(c.x, 0.5) + (random()-0.5)*0.06, coalesce(c.y, 0.45) - 0.05,
       coalesce(a.expires_at, now() + interval '7 days'), a.host_id
from activities a join communities c on c.id = a.community_id
where a.community_id is not null
on conflict (activity_id) do nothing;
select title, x, y, activity_id is not null as bridged from map_events order by created_at;
