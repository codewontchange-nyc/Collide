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
-- Circle requests (2026-08-15): chat is the main path to meeting people.
-- Connections gain a pending→accepted flow. QR/link connects stay instant
-- (status defaults to accepted); chat requests insert as pending and only
-- the RECIPIENT can accept. Content visibility counts accepted only.
alter table connections add column if not exists status text not null default 'accepted'
  check (status in ('pending','accepted'));
alter table connections add column if not exists requested_by uuid references profiles(id) on delete set null;

create or replace function are_connected(u1 uuid, u2 uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select u1 = u2 or exists(
    select 1 from connections c
    where ((c.a=u1 and c.b=u2) or (c.a=u2 and c.b=u1)) and c.status = 'accepted');
$$;

drop policy if exists conn_upd on connections;
create policy conn_upd on connections for update to authenticated
  using (status = 'pending' and (a = auth.uid() or b = auth.uid())
         and requested_by is not null and requested_by <> auth.uid())
  with check ((a = auth.uid() or b = auth.uid()) and status = 'accepted');
-- p35: chats gated on being IN (rsvp for events, membership for communities)
-- + community landing preview for non-members
drop policy if exists emsg_sel on event_messages;
create policy emsg_sel on event_messages for select to authenticated
  using (has_rsvp(activity_id, auth.uid()) or is_activity_host(activity_id, auth.uid()) or staff_sees_activity(activity_id));
drop policy if exists emsg_ins on event_messages;
create policy emsg_ins on event_messages for insert to authenticated
  with check (author_id = auth.uid() and (has_rsvp(activity_id, auth.uid()) or is_activity_host(activity_id, auth.uid()) or staff_sees_activity(activity_id)));
create or replace function can_see_event_message(mid uuid, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from event_messages m where m.id = mid
    and (has_rsvp(m.activity_id, uid) or is_activity_host(m.activity_id, uid) or staff_sees_activity(m.activity_id)));
$$;

create or replace function community_landing(cid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'member_count', (select count(*) from community_members m where m.community_id = cid and m.status = 'member'),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object(
        'title', a.title, 'date', a.date, 'at_time', a.at_time,
        'place', coalesce(a.place, a.location), 'category', a.category))
      from (select * from activities x where x.community_id = cid
            and (x.expires_at is null or x.expires_at > now())
            order by coalesce(x.date, '9999-12-31'), x.created_at desc limit 3) a), '[]'::jsonb),
    'ann', (select jsonb_build_object('body', left(an.body, 200), 'created_at', an.created_at)
      from announcements an where an.community_id = cid order by an.created_at desc limit 1));
$$;
grant execute on function community_landing(uuid) to authenticated;
-- p42: facilitators keep ONE live announcement (posting replaces it); owner keeps many
create or replace function enforce_one_live_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from staff s join auth.users u on u.email = s.email
             where u.id = new.author_id and s.role = 'facilitator')
     and not exists (select 1 from staff s join auth.users u on u.email = s.email
             where u.id = new.author_id and s.role = 'owner') then
    delete from announcements a
      where a.author_id = new.author_id
        and a.id is distinct from new.id
        and (a.expires_at is null or a.expires_at > now());
  end if;
  return new;
end $$;
drop trigger if exists ann_one_live on announcements;
create trigger ann_one_live before insert on announcements
for each row execute function enforce_one_live_announcement();

-- bring existing data in line: each facilitator keeps only their newest live announcement
with fac as (
  select u.id uid from staff s join auth.users u on u.email = s.email
  where s.role = 'facilitator'
    and not exists (select 1 from staff s2 join auth.users u2 on u2.email = s2.email
                    where u2.id = u.id and s2.role = 'owner')
), ranked as (
  select a.id, row_number() over (partition by a.author_id order by a.created_at desc) rn
  from announcements a join fac on fac.uid = a.author_id
  where a.expires_at is null or a.expires_at > now()
)
delete from announcements where id in (select id from ranked where rn > 1);
-- p47: staff see ALL POIs on the shared map (facilitators were scoped to their memberships)
create policy pois_staff_sel on pois for select to authenticated using (is_any_staff());
-- p49: passive invites between circle members + mutual "let's collide" availability
create table if not exists event_invites (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(activity_id, from_id, to_id)
);
alter table event_invites enable row level security;
create policy evinv_ins on event_invites for insert to authenticated
  with check (from_id = auth.uid() and has_rsvp(activity_id, auth.uid()) and are_connected(from_id, to_id));
create policy evinv_sel on event_invites for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy evinv_del on event_invites for delete to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

create table if not exists collide_pairs (
  a uuid not null references profiles(id) on delete cascade,
  b uuid not null references profiles(id) on delete cascade,
  a_in boolean not null default false,
  b_in boolean not null default false,
  a_avail text[] not null default '{}',
  b_avail text[] not null default '{}',
  updated_at timestamptz default now(),
  primary key (a, b),
  check (a < b)
);
alter table collide_pairs enable row level security;
create policy cp_all on collide_pairs for all to authenticated
  using (a = auth.uid() or b = auth.uid())
  with check ((a = auth.uid() or b = auth.uid()) and are_connected(a, b));

alter publication supabase_realtime add table event_invites;
alter publication supabase_realtime add table collide_pairs;
-- p54: POIs are public curation — visible to every signed-in user, with richer data
create policy pois_public_sel on pois for select to authenticated using (true);
alter table pois add column if not exists address text;
alter table pois add column if not exists hours text;
alter table pois add column if not exists link text;
alter table pois add column if not exists images text[] not null default '{}';

-- p59: manual face editor — persisted part choices (seeded by inkify, edited in-app)
alter table profiles add column if not exists avatar_parts jsonb;
-- ============ p61: Makers — profile upgrade + directory ============
create table if not exists makers (
  profile_id uuid primary key references profiles(id) on delete cascade,
  headline text not null default '',
  offers text[] not null default '{}',
  bio text,
  rate text,
  booking_url text,
  active boolean not null default true,
  trial_ends_at timestamptz default now() + interval '3 months',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table makers enable row level security;
drop policy if exists makers_sel on makers;
create policy makers_sel on makers for select to authenticated using (true);
drop policy if exists makers_ins on makers;
create policy makers_ins on makers for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists makers_upd on makers;
create policy makers_upd on makers for update to authenticated using (profile_id = auth.uid());
drop policy if exists makers_del on makers;
create policy makers_del on makers for delete to authenticated using (profile_id = auth.uid());

-- one call returns the whole classifieds page: paying/trial makers + facilitators
create or replace function directory_listings()
returns table(profile_id uuid, display_name text, avatar_url text, kind text,
              headline text, offers text[], bio text, rate text, booking_url text, community_name text)
language sql security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, 'maker'::text,
         m.headline, m.offers, m.bio, m.rate, m.booking_url, null::text
    from makers m join profiles p on p.id = m.profile_id
   where m.active and (m.trial_ends_at is null or m.trial_ends_at > now())
  union all
  select p.id, p.display_name, p.avatar_url, 'facilitator'::text,
         'Facilitator of ' || c.name, null, c.blurb, null, null, c.name
    from staff s
    join profiles p on p.id = s.profile_id
    join communities c on c.id = s.community_id
   where s.role = 'facilitator';
$$;
grant execute on function directory_listings() to authenticated;

-- seed makers (3-month free trial applies via default)
insert into makers (profile_id, headline, offers, bio, rate, booking_url) values
('615cd0ad-d2f4-410d-83da-3d282f6377cb','Record curation & vinyl appraisal',
 array['Collection curation','Pressing appraisals','DJ-ready crates'],
 'I find the pressing worth owning. Strong opinions, gently delivered.','$45/hr',null),
('308abd7b-e52e-4945-8c1f-e0c86e221e6a','Creative tech & app building',
 array['App prototypes','Creative automation','Website tune-ups'],
 'I build small software that feels hand-made. This app, for instance.','ask',null),
('a31882fd-ea14-4363-9ce4-6746eb58f3fd','Vintage sourcing & estate-sale scouting',
 array['Personal sourcing','Estate-sale runs','Resale coaching'],
 'Your grandmother''s taste, my alarm clock. I get there first.','$60/find',null),
('c2b3cf76-ef83-4e48-95de-013c26fb8dcf','Supper-club styling & tablescapes',
 array['Dinner styling','Tablescapes','Small-event design'],
 'Twelve strangers deserve a beautiful table. I make the room do half the talking.','$150/event',null),
('f66da730-3a82-494f-99e7-eb8c32f2daf0','Run coaching for reluctant runners',
 array['Couch-to-5k plans','Form check-ins','Race-day pacing'],
 '5am club president. I will make it weirdly fun.','$30/session',null),
('c88fc704-0bc3-4a83-bb84-95710c6af9af','Private chef — long-table dinners',
 array['Private dinners','Menu design','Wine pairing'],
 'The person behind Dinner No. 7. Your table next?','from $80/head',null)
on conflict (profile_id) do nothing;
-- ============ p62: in-house booking — windows, slots, pay modes ============
alter table makers add column if not exists booking_mode text not null default 'free'
  check (booking_mode in ('free','deposit','prepaid'));
alter table makers add column if not exists price_cents int not null default 0;
alter table makers add column if not exists deposit_cents int not null default 0;
alter table makers add column if not exists payment_handle text;

-- recurring weekly availability windows (gig-style, several per day)
create table if not exists maker_windows (
  id uuid primary key default gen_random_uuid(),
  maker_id uuid not null references makers(profile_id) on delete cascade,
  dow int not null check (dow between 0 and 6),        -- 0 = Sunday
  start_min int not null check (start_min between 0 and 1439),
  end_min int not null check (end_min between 1 and 1440),
  slot_min int not null default 60 check (slot_min in (15,30,45,60,90,120)),
  created_at timestamptz not null default now(),
  check (end_min > start_min)
);
alter table maker_windows enable row level security;
drop policy if exists mw_sel on maker_windows;
create policy mw_sel on maker_windows for select to authenticated using (true);
drop policy if exists mw_ins on maker_windows;
create policy mw_ins on maker_windows for insert to authenticated with check (maker_id = auth.uid());
drop policy if exists mw_del on maker_windows;
create policy mw_del on maker_windows for delete to authenticated using (maker_id = auth.uid());

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  maker_id uuid not null references makers(profile_id) on delete cascade,
  booker_id uuid not null references profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  status text not null default 'pending' check (status in ('pending','confirmed','declined','canceled')),
  pay_mode text not null default 'free',
  amount_cents int not null default 0,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists bookings_no_double on bookings (maker_id, starts_at)
  where status in ('pending','confirmed');
alter table bookings enable row level security;
drop policy if exists bk_sel on bookings;
create policy bk_sel on bookings for select to authenticated
  using (booker_id = auth.uid() or maker_id = auth.uid());
drop policy if exists bk_ins on bookings;
create policy bk_ins on bookings for insert to authenticated
  with check (booker_id = auth.uid() and booker_id <> maker_id);
drop policy if exists bk_upd on bookings;
create policy bk_upd on bookings for update to authenticated
  using (maker_id = auth.uid() or booker_id = auth.uid());

-- busy times only — lets any member compute open slots without seeing who booked
create or replace function maker_busy(mid uuid)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql security definer set search_path = public as $$
  select b.starts_at, b.ends_at from bookings b
   where b.maker_id = mid and b.status in ('pending','confirmed') and b.ends_at > now();
$$;
grant execute on function maker_busy(uuid) to authenticated;

-- directory rows now carry booking config
drop function if exists directory_listings();
create or replace function directory_listings()
returns table(profile_id uuid, display_name text, avatar_url text, kind text,
              headline text, offers text[], bio text, rate text, booking_url text, community_name text,
              booking_mode text, price_cents int, deposit_cents int, payment_handle text, has_windows boolean)
language sql security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, 'maker'::text,
         m.headline, m.offers, m.bio, m.rate, m.booking_url, null::text,
         m.booking_mode, m.price_cents, m.deposit_cents, m.payment_handle,
         exists (select 1 from maker_windows w where w.maker_id = m.profile_id)
    from makers m join profiles p on p.id = m.profile_id
   where m.active and (m.trial_ends_at is null or m.trial_ends_at > now())
  union all
  select p.id, p.display_name, p.avatar_url, 'facilitator'::text,
         'Facilitator of ' || c.name, null, c.blurb, null, null, c.name,
         null, null, null, null, false
    from staff s
    join profiles p on p.id = s.profile_id
    join communities c on c.id = s.community_id
   where s.role = 'facilitator';
$$;
grant execute on function directory_listings() to authenticated;

-- demo config: Kathleen prepaid $45, windows Tue/Thu evenings + Sat morning;
-- Andre deposit $10 of $30, early runs; Zoe stays free-to-book inquiry style
update makers set booking_mode='prepaid', price_cents=4500, payment_handle='@kathleen-reid'
 where profile_id='615cd0ad-d2f4-410d-83da-3d282f6377cb';
update makers set booking_mode='deposit', price_cents=3000, deposit_cents=1000, payment_handle='@andre-runs'
 where profile_id='f66da730-3a82-494f-99e7-eb8c32f2daf0';
insert into maker_windows (maker_id, dow, start_min, end_min, slot_min) values
('615cd0ad-d2f4-410d-83da-3d282f6377cb', 2, 18*60, 21*60, 60),
('615cd0ad-d2f4-410d-83da-3d282f6377cb', 4, 18*60, 21*60, 60),
('615cd0ad-d2f4-410d-83da-3d282f6377cb', 6, 10*60, 13*60, 60),
('f66da730-3a82-494f-99e7-eb8c32f2daf0', 1, 6*60, 8*60, 30),
('f66da730-3a82-494f-99e7-eb8c32f2daf0', 3, 6*60, 8*60, 30),
('f66da730-3a82-494f-99e7-eb8c32f2daf0', 6, 7*60, 9*60+30, 30)
on conflict do nothing;
-- ============ p63: rich maker profiles — gallery, links, contact ============
alter table makers add column if not exists contact text;
alter table makers add column if not exists links jsonb not null default '[]';
alter table makers add column if not exists gallery text[] not null default '{}';

-- members may manage gallery images under event-media/mk/<their uid>/
drop policy if exists mk_gallery_ins on storage.objects;
create policy mk_gallery_ins on storage.objects for insert to authenticated
  with check (bucket_id='event-media' and (storage.foldername(name))[1]='mk'
              and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists mk_gallery_del on storage.objects;
create policy mk_gallery_del on storage.objects for delete to authenticated
  using (bucket_id='event-media' and (storage.foldername(name))[1]='mk'
         and (storage.foldername(name))[2]=auth.uid()::text);

drop function if exists directory_listings();
create or replace function directory_listings()
returns table(profile_id uuid, display_name text, avatar_url text, kind text,
              headline text, offers text[], bio text, rate text, booking_url text, community_name text,
              booking_mode text, price_cents int, deposit_cents int, payment_handle text, has_windows boolean,
              contact text, links jsonb, gallery text[], socials jsonb)
language sql security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, 'maker'::text,
         m.headline, m.offers, m.bio, m.rate, m.booking_url, null::text,
         m.booking_mode, m.price_cents, m.deposit_cents, m.payment_handle,
         exists (select 1 from maker_windows w where w.maker_id = m.profile_id),
         m.contact, m.links, m.gallery, p.socials
    from makers m join profiles p on p.id = m.profile_id
   where m.active and (m.trial_ends_at is null or m.trial_ends_at > now())
  union all
  select p.id, p.display_name, p.avatar_url, 'facilitator'::text,
         'Facilitator of ' || c.name, null, c.blurb, null, null, c.name,
         null, null, null, null, false,
         null, '[]'::jsonb, '{}'::text[], p.socials
    from staff s
    join profiles p on p.id = s.profile_id
    join communities c on c.id = s.community_id
   where s.role = 'facilitator';
$$;
grant execute on function directory_listings() to authenticated;

-- ---- Kathleen books as DJ Leah Rose ----
update makers set
  headline='DJ Leah Rose — all-vinyl sets',
  offers=array['Club & rooftop sets','Wedding selections','Listening-bar takeovers'],
  bio='Kathleen by day, Leah Rose after dark. Strictly vinyl, strictly feeling.',
  rate='$45/hr', booking_mode='prepaid', price_cents=4500, payment_handle='@kathleen-reid',
  links='[{"label":"Mixcloud","url":"https://mixcloud.com/djleahrose"},{"label":"Instagram","url":"https://instagram.com/djleahrose"}]'::jsonb,
  gallery=array['mk/demo/leah-1.jpg','mk/demo/leah-2.jpg','mk/demo/leah-3.jpg']
 where profile_id='615cd0ad-d2f4-410d-83da-3d282f6377cb';

-- ---- Code books for hacking ----
update makers set
  headline='Hacking, kindly — apps & automations',
  offers=array['App prototypes','Automation spells','Debug exorcisms'],
  bio='Bring me the thing that "should be simple." I build small software that feels hand-made.',
  rate='$90/hr', booking_mode='deposit', price_cents=9000, deposit_cents=3000, payment_handle='@codewontchange',
  links='[{"label":"GitHub","url":"https://github.com/codewontchange-nyc"}]'::jsonb,
  gallery=array['mk/demo/code-1.jpg','mk/demo/code-2.jpg']
 where profile_id='308abd7b-e52e-4945-8c1f-e0c86e221e6a';

-- ---- everyone else gets a listing ----
insert into makers (profile_id, headline, offers, bio, rate, booking_mode, price_cents, deposit_cents, payment_handle, contact, links, gallery) values
('464dab6e-24db-484c-a9c1-f2415d5bf5cf','Live sound & party sets',array['DJ sets','Live-sound runs','Playlist doctoring'],'I make rooms feel like the good part of the night.','$60/hr','prepaid',6000,0,'@jules-riv',null,'[{"label":"SoundCloud","url":"https://soundcloud.com/julesriv"}]'::jsonb,array['mk/demo/jules-1.jpg','mk/demo/jules-2.jpg']),
('a54e1d9e-4d71-432e-ad1b-88c16c4472d6','Crate-digging tours & record hunts',array['Shop crawls','Wantlist hunting','Collection triage'],'Three shops, two hours, one record you didn''t know you needed.','$40/tour','deposit',4000,1500,'@kofi-digs',null,'[]'::jsonb,array['mk/demo/kofi-1.jpg']),
('66bf4b26-272f-4e93-b7a8-04921a539726','Food tours & pop-up consulting',array['Neighborhood eats tours','Pop-up menus','Vendor scouting'],'I know where the line is worth it.','$50/tour','deposit',5000,2000,'@marcus-eats',null,'[]'::jsonb,array['mk/demo/marcus-1.jpg','mk/demo/marcus-2.jpg']),
('41432059-cf6f-4f06-a6cb-cb6f043cca7e','Personal training — kind but relentless',array['1:1 sessions','Small-group runs','Program design'],'Your future self called. She''s stronger.','$55/session','prepaid',5500,0,'@maya-flows',null,'[]'::jsonb,array['mk/demo/maya-1.jpg']),
('71db2f36-47ad-4f45-be97-a9bd08f37e85','Event & street photography',array['Event coverage','Portraits on film','Photo walks'],'I shoot the in-between moments — that''s where the party lives.','$120/event','deposit',12000,4000,'@tommy-shoots',null,'[{"label":"Portfolio","url":"https://tommynguyen.pics"}]'::jsonb,array['mk/demo/tommy-1.jpg','mk/demo/tommy-2.jpg']),
('83650c46-a97a-4997-8e87-aed5fe23dec6','Web dev tutoring & code review',array['1:1 tutoring','Code reviews','Interview prep'],'Gentle with beginners, ruthless with bugs.','$45/hr','free',0,0,null,null,'[]'::jsonb,'{}'),
('c9dee35c-dbec-4c50-a078-178fe945138e','Illustration & show flyers',array['Gig posters','Logo sketches','Zine layouts'],'Hand-drawn, slightly weird, exactly right.','from $80','free',0,0,null,'DM @sofia.draws on IG — commissions open monthly','[{"label":"Instagram","url":"https://instagram.com/sofia.draws"}]'::jsonb,array['mk/demo/sofia-1.jpg','mk/demo/sofia-2.jpg'])
on conflict (profile_id) do nothing;

-- Zoe: contact-instead-of-booking example
update makers set contact='Text for tables: (917) 555-0707 · tastings by invitation'
 where profile_id='c88fc704-0bc3-4a83-bb84-95710c6af9af';

-- windows so the rest are actually bookable
insert into maker_windows (maker_id, dow, start_min, end_min, slot_min) values
('308abd7b-e52e-4945-8c1f-e0c86e221e6a', 5, 13*60, 17*60, 90),
('308abd7b-e52e-4945-8c1f-e0c86e221e6a', 3, 18*60, 21*60, 90),
('464dab6e-24db-484c-a9c1-f2415d5bf5cf', 5, 19*60, 23*60, 120),
('464dab6e-24db-484c-a9c1-f2415d5bf5cf', 6, 19*60, 23*60, 120),
('a54e1d9e-4d71-432e-ad1b-88c16c4472d6', 6, 11*60, 15*60, 120),
('66bf4b26-272f-4e93-b7a8-04921a539726', 0, 11*60, 15*60, 120),
('66bf4b26-272f-4e93-b7a8-04921a539726', 6, 17*60, 21*60, 120),
('41432059-cf6f-4f06-a6cb-cb6f043cca7e', 1, 7*60, 10*60, 60),
('41432059-cf6f-4f06-a6cb-cb6f043cca7e', 4, 7*60, 10*60, 60),
('41432059-cf6f-4f06-a6cb-cb6f043cca7e', 6, 8*60, 11*60, 60),
('71db2f36-47ad-4f45-be97-a9bd08f37e85', 5, 16*60, 20*60, 120),
('71db2f36-47ad-4f45-be97-a9bd08f37e85', 0, 10*60, 14*60, 120),
('83650c46-a97a-4997-8e87-aed5fe23dec6', 2, 19*60, 21*60, 60),
('83650c46-a97a-4997-8e87-aed5fe23dec6', 0, 15*60, 18*60, 60),
('a31882fd-ea14-4363-9ce4-6746eb58f3fd', 6, 8*60, 12*60, 120),
('c2b3cf76-ef83-4e48-95de-013c26fb8dcf', 6, 14*60, 18*60, 120)
on conflict do nothing;

-- p72: madlib onboarding — phone on profiles
alter table profiles add column if not exists phone text;
-- ============ p73: cities — multi-city groundwork ============
create table if not exists cities (
  code text primary key,
  name text not null,
  short text not null,
  status text not null default 'coming_soon' check (status in ('live','inking','coming_soon')),
  map_image_path text,
  sort int not null default 100
);
alter table cities enable row level security;
drop policy if exists cities_sel on cities;
create policy cities_sel on cities for select to authenticated using (true);
insert into cities (code, name, short, status, sort) values
 ('nyc','New York','NYC','live',1),
 ('atl','Atlanta','ATL','inking',2),
 ('chi','Chicago','CHI','coming_soon',3),
 ('la','Los Angeles','LA','coming_soon',4),
 ('sf','San Francisco','SF','coming_soon',5),
 ('nola','New Orleans','NOLA','coming_soon',6),
 ('dc','Washington, D.C.','DC','coming_soon',7)
on conflict (code) do nothing;

-- p75: LA/CHI inking; homebase groundwork
update cities set status='inking' where code in ('la','chi');
alter table profiles add column if not exists home_city text not null default 'nyc' references cities(code);

-- p76: 'inked' status (map done, launch pending); atl=inked
alter table cities drop constraint if exists cities_status_check;
alter table cities add constraint cities_status_check check (status in ('live','inked','inking','coming_soon'));
update cities set status='inked' where code='atl';
-- ============ p77: full city scoping via request header ============
create or replace function req_city() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.headers', true)::json->>'x-collide-city',''),'nyc')
$$;

alter table activities   add column if not exists city text not null default 'nyc' references cities(code);
alter table map_events   add column if not exists city text not null default 'nyc' references cities(code);
alter table pois         add column if not exists city text not null default 'nyc' references cities(code);
alter table yaps         add column if not exists city text not null default 'nyc' references cities(code);
alter table communities  add column if not exists city text not null default 'nyc' references cities(code);
alter table announcements add column if not exists city text not null default 'nyc' references cities(code);
alter table makers       add column if not exists city text not null default 'nyc' references cities(code);

create or replace function set_req_city() returns trigger
language plpgsql as $$ begin new.city := req_city(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['activities','map_events','pois','yaps','communities','announcements','makers'] loop
    execute format('drop trigger if exists %I_city_tg on %I', t, t);
    execute format('create trigger %I_city_tg before insert on %I for each row execute function set_req_city()', t, t);
    execute format('drop policy if exists %I_city_r on %I', t, t);
    execute format('create policy %I_city_r on %I as restrictive for select to authenticated using (city = req_city())', t, t);
  end loop;
end $$;

-- classifieds RPC runs as definer (bypasses RLS) — filter explicitly
drop function if exists directory_listings();
create or replace function directory_listings()
returns table(profile_id uuid, display_name text, avatar_url text, kind text,
              headline text, offers text[], bio text, rate text, booking_url text, community_name text,
              booking_mode text, price_cents int, deposit_cents int, payment_handle text, has_windows boolean,
              contact text, links jsonb, gallery text[], socials jsonb)
language sql security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url, 'maker'::text,
         m.headline, m.offers, m.bio, m.rate, m.booking_url, null::text,
         m.booking_mode, m.price_cents, m.deposit_cents, m.payment_handle,
         exists (select 1 from maker_windows w where w.maker_id = m.profile_id),
         m.contact, m.links, m.gallery, p.socials
    from makers m join profiles p on p.id = m.profile_id
   where m.active and (m.trial_ends_at is null or m.trial_ends_at > now())
     and m.city = req_city()
  union all
  select p.id, p.display_name, p.avatar_url, 'facilitator'::text,
         'Facilitator of ' || c.name, null, c.blurb, null, null, c.name,
         null, null, null, null, false,
         null, '[]'::jsonb, '{}'::text[], p.socials
    from staff s
    join profiles p on p.id = s.profile_id
    join communities c on c.id = s.community_id
   where s.role = 'facilitator' and c.city = req_city();
$$;
grant execute on function directory_listings() to authenticated;

-- p79b: own maker listing always visible regardless of current city
drop policy if exists makers_city_r on makers;
create policy makers_city_r on makers as restrictive for select to authenticated
  using (city = req_city() or profile_id = auth.uid());

-- p82: announcements — globals live 7 days (client rule), community anns stack (last 5 shown);
-- one-live-per-facilitator trigger retired to allow stacking
drop trigger if exists ann_one_live on announcements;
drop function if exists ann_one_live() cascade;
-- ============ p83: storage hardening for beta ============
-- old avatars_all allowed ANY authenticated user to write/delete ANY object
-- in avatars/map/feed-media (incl. other users' avatars and the map artwork).
drop policy if exists avatars_all on storage.objects;
-- avatars: public read stays (public_read policy); write/delete only within your own folder
create policy avatars_own_write on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_update on storage.objects for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- map artwork: staff only
create policy map_staff_write on storage.objects for all to authenticated
  using (bucket_id='map' and is_any_staff())
  with check (bucket_id='map' and is_any_staff());
-- feed-media: members can add (insert-only) and read; no overwrites/deletes
create policy feed_media_ins on storage.objects for insert to authenticated
  with check (bucket_id='feed-media');
create policy feed_media_read on storage.objects for select to authenticated
  using (bucket_id='feed-media');
-- ============ p84: client error telemetry ============
create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid,
  city text,
  url text,
  message text,
  stack text,
  source text,
  ua text,
  ver text
);
alter table client_errors enable row level security;
drop policy if exists ce_ins on client_errors;
create policy ce_ins on client_errors for insert to authenticated with check (true);
drop policy if exists ce_sel on client_errors;
create policy ce_sel on client_errors for select to authenticated using (is_any_staff());

-- p85: web push — push_subs + notify_push (secret redacted) + 4 triggers (booking new/confirmed, circle req, event invite); see session notes

-- p86: restore authenticated READ on storage (avatars/map/event-media).
-- p83 dropped the old catch-all policy; its SELECT half was what let the app's
-- createSignedUrl avatar loads work for signed-in users. Read-only — the p83
-- own-folder write hardening stays as-is.
create policy storage_authed_read on storage.objects for select to authenticated
using (bucket_id in ('avatars','map','event-media'));
