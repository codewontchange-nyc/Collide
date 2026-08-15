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
-- Every map pin is an event: standalone pins get a backing activity so RSVPs
-- work through the normal system. (POIs live in their own table — not events.)

alter table map_events add column if not exists from_activity boolean not null default false;
update map_events set from_activity = true where activity_id is not null;

-- forward bridge fix: never delete pins for fresh personal plans; on update,
-- only remove pins the bridge itself created
create or replace function sync_activity_pin() returns trigger
language plpgsql security definer set search_path = public as $$
declare cx double precision; cy double precision;
begin
  if new.community_id is null then
    if tg_op = 'UPDATE' then
      delete from map_events where activity_id = new.id and from_activity;
    end if;
    return new;
  end if;
  select x, y into cx, cy from communities where id = new.community_id;
  insert into map_events (activity_id, from_activity, title, emoji, at_time, place, venue, x, y, expires_at, created_by)
  values (new.id, true, new.title, '🎉', new.at_time, coalesce(new.place, new.location), '',
          coalesce(cx, 0.5) + (random()-0.5)*0.06, coalesce(cy, 0.45) - 0.045 - random()*0.02,
          coalesce(new.expires_at, now() + interval '7 days'), new.host_id)
  on conflict (activity_id) do update
    set title = excluded.title, at_time = excluded.at_time, place = excluded.place,
        expires_at = excluded.expires_at;
  return new;
end $$;

-- reverse bridge: a user-dropped pin births its backing event
create or replace function sync_pin_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare aid uuid;
begin
  if new.activity_id is not null then return new; end if;
  insert into activities (host_id, title, at_time, place, note, link, visibility, expires_at, when_bucket)
  values (new.created_by, coalesce(new.title, 'On the map'), new.at_time, new.place, new.note, new.link,
          'public', coalesce(new.expires_at, now() + interval '7 days'), 'this_week')
  returning id into aid;
  new.activity_id := aid;
  new.from_activity := false;
  return new;
end $$;
drop trigger if exists map_events_activity_sync on map_events;
create trigger map_events_activity_sync before insert on map_events
  for each row execute function sync_pin_activity();

-- keep the pair in step when a pin is edited
create or replace function sync_pin_activity_upd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.activity_id is not null and not new.from_activity then
    update activities set title = coalesce(new.title, title), at_time = new.at_time,
      place = new.place, note = new.note, link = new.link, expires_at = new.expires_at
    where id = new.activity_id;
  end if;
  return new;
end $$;
drop trigger if exists map_events_activity_sync_upd on map_events;
create trigger map_events_activity_sync_upd after update on map_events
  for each row execute function sync_pin_activity_upd();

-- backfill: existing standalone pins get backing activities
do $$
declare p record; aid uuid;
begin
  for p in select * from map_events where activity_id is null loop
    insert into activities (host_id, title, at_time, place, note, link, visibility, expires_at, when_bucket)
    values (p.created_by, coalesce(p.title,'On the map'), p.at_time, p.place, p.note, p.link,
            'public', coalesce(p.expires_at, now() + interval '7 days'), 'this_week')
    returning id into aid;
    update map_events set activity_id = aid, from_activity = false where id = p.id;
  end loop;
end $$;

-- anything on the map is visible (and thus RSVP-able) to every signed-in user
create or replace function can_see_activity(aid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from activities a where a.id=aid and (
      a.host_id = uid
      or are_connected(a.host_id, uid)
      or exists(select 1 from rsvps r where r.activity_id=a.id and r.profile_id=uid)
      or (a.community_id is not null and is_community_member(a.community_id, uid))
      or exists(select 1 from map_events me where me.activity_id = a.id)
    ));
$$;

select m.title, m.activity_id is not null as has_event, m.from_activity from map_events m order by m.created_at;
-- ============================================================================
--  Yaps (2026-08-15): short, expiring shouts users drop on the map.
--  One per day, 4/8/24h expiry, visible to your circle + shared communities.
--  With this, announcements and plans become staff-only surfaces.
-- ============================================================================

create table if not exists yaps (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 240),
  x          double precision not null,
  y          double precision not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index if not exists yaps_one_per_day
  on yaps (author_id, ((created_at at time zone 'utc')::date));

create table if not exists yap_otw (
  yap_id     uuid not null references yaps(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (yap_id, profile_id)
);

create or replace function shares_community(u1 uuid, u2 uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from community_members m1
    join community_members m2 on m1.community_id = m2.community_id
    where m1.profile_id = u1 and m2.profile_id = u2
      and m1.status <> 'pending' and m2.status <> 'pending');
$$;

create or replace function can_see_yap(yid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from yaps y where y.id = yid and
    (y.author_id = uid or are_connected(y.author_id, uid) or shares_community(y.author_id, uid)));
$$;

alter table yaps enable row level security;
drop policy if exists yap_sel on yaps;
create policy yap_sel on yaps for select to authenticated
  using (author_id = auth.uid() or are_connected(author_id, auth.uid()) or shares_community(author_id, auth.uid()));
drop policy if exists yap_ins on yaps;
create policy yap_ins on yaps for insert to authenticated with check (author_id = auth.uid());
drop policy if exists yap_del on yaps;
create policy yap_del on yaps for delete to authenticated using (author_id = auth.uid() or is_any_staff());

alter table yap_otw enable row level security;
drop policy if exists otw_sel on yap_otw;
create policy otw_sel on yap_otw for select to authenticated
  using (profile_id = auth.uid() or exists(select 1 from yaps y where y.id = yap_id and y.author_id = auth.uid()));
drop policy if exists otw_ins on yap_otw;
create policy otw_ins on yap_otw for insert to authenticated
  with check (profile_id = auth.uid() and can_see_yap(yap_id));
drop policy if exists otw_del on yap_otw;
create policy otw_del on yap_otw for delete to authenticated using (profile_id = auth.uid());

alter publication supabase_realtime add table yaps;
alter publication supabase_realtime add table yap_otw;

-- ---- lockdowns: announcements + plans + event pins are staff surfaces ------
drop policy if exists ann_ins on announcements;
create policy ann_ins on announcements for insert to authenticated
  with check (author_id = auth.uid() and is_any_staff());

drop policy if exists act_ins on activities;
create policy act_ins on activities for insert to authenticated
  with check (host_id = auth.uid() and is_any_staff());

drop policy if exists mapev_ins on map_events;
create policy mapev_ins on map_events for insert to authenticated
  with check (created_by = auth.uid() and is_any_staff());

-- (2026-08-15) app omits author/creator on inserts — original schema defaulted
-- them to auth.uid(); without this, chat messages 403'd (NULL author vs RLS)
alter table community_messages alter column author_id set default auth.uid();
alter table event_messages     alter column author_id set default auth.uid();
alter table announcements      alter column author_id set default auth.uid();
alter table activities         alter column host_id    set default auth.uid();
alter table map_events         alter column created_by set default auth.uid();
