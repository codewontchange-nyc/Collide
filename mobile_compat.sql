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
