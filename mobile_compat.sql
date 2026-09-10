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

-- p87: Adventures. activities.itin_kind ('list'|'adventure'|'hunt'); itinerary jsonb
-- stops may now carry x,y (map fractions) and clue. itin_checkins(activity_id,stop_idx,
-- profile_id) = crew check-ins, RLS crew-only (rsvp or host), in supabase_realtime.
alter table activities add column if not exists itin_kind text not null default 'list';
-- + activities_itin_kind_ck check, itin_checkins table + itin_ck_sel/itin_ck_ins policies (see p87 apply)

-- p88: evergreen adventures. Progress is per-user (client filters checkins to own
-- uid); own-row delete policy for "start over":
create policy itin_ck_del on itin_checkins for delete to authenticated using (profile_id=auth.uid());
-- Adventure/hunt stops no longer carry times (editor hides the field; seed stripped).

-- p89: expiry integrity. act_min_expiry trigger (dated activities never expire
-- before date+1 23:59 UTC), act_pin_expiry + pin_min_expiry triggers keep
-- map_events.expires_at >= their activity's. Date-less default lifetime 7d -> 30d
-- (client ll()). Repaired dated rows; revived date-less events culled Aug 24+ (+30d).

-- p90: date-less events stay hidden. Re-expired the five date-less events revived in
-- p89; Anytime feed bucket now admits only itin_kind adventure/hunt; date-less default
-- lifetime reverted to 7d. Dated-event integrity triggers from p89 remain.

-- p91: event-chat lifecycle. Room chat stays open 3 days past expires_at (debrief
-- window; ev_msg_not_closed RESTRICTIVE insert policy enforces at the API), then the
-- room goes read-only and the event leaves "You're in" (client edEvClosed, +3d).
-- pg_cron job purge-event-chats deletes event_messages 30 days after event expiry.

-- p93: community join links. communities.join_code (unique, seeded); RPC
-- community_landing(code) anon-callable (safe public fields + counts); RPC
-- join_community(code, via) — via = a member's connect_code => instant 'member',
-- otherwise 'pending'. Edge fn qr (npm:qrcode, JWT) renders share-link QR SVGs.

-- p99: map_config is per-city (id=1 nyc, id=2 atl — rows managed by console session).
-- App now reads/writes map art by city (was hardcoded id=1). Profile city row split:
-- "browsing" chips = ed.city (shared with map dropdown via edCitySwitch), explicit
-- "make X home instead" writes profiles.home_city — never changed silently.

-- (console session, fix_city_stamp_trigger.sql in collide-admin): set_req_city()
-- redefined — header present: header wins (app path unchanged, body can't spoof);
-- headerless (console/SQL): explicit city survives, null -> 'nyc'. Earlier seeding
-- worked around the old unconditional overwrite by setting the request.headers GUC;
-- that path still behaves identically.

-- q05: community directory. communities.tags text[] (seeded); ed_comm_dir() RPC
-- (security definer, city-scoped via req_city) returns id/name/emoji/blurb/tags/members.
-- /communities page: search + tag filters; "Find your tribe" banner after Community desk;
-- landing breadcrumbs (back to search / up next); owner+staff tag editor (autocomplete
-- against existing tags, create-new, 6 max).

-- q12: yap once per CITY per day. yaps_one_per_day (author, utc-day) replaced by
-- yaps_one_per_city_day (author, city, utc-day). Client per-city "already yapped"
-- state was inherently city-scoped via the header RLS feed.
drop index if exists yaps_one_per_day;
create unique index yaps_one_per_city_day on yaps (author_id, city, (((created_at at time zone 'utc'))::date));

-- q14: community rooms. act_ins now lets any authenticated user host their own
-- events (personal, or in communities where they hold status 'member'); ann_ins lets
-- members post announcements in their communities (global announcements still staff).
-- UI: member "Plan something here" + announce composer in community feed.

-- audit fix (2026-08-30): the ATL communities predated p93's join_code backfill window
-- edge case — backfilled, and comm_joincode BEFORE INSERT trigger now auto-generates
-- join_code for every future community from any surface.

-- q31: community_messages.ref_id uuid; act_chatcard + ann_chatcard AFTER INSERT
-- triggers (security definer) post standout 'event'/'ann' cards into community chat
-- automatically from any surface. Chat renders them as centered system cards.

-- q32: Up next shows only facilitator/admin/community-owner announcements.
-- announcements.by_staff stamped by ann_stamp_staff trigger (is_any_staff() or
-- community owner at insert); backfilled. Pl() Up-next path skips !by_staff rows;
-- community feeds and chat cards still show every member announcement.

-- q36: My Communities lists every membership across cities via ed_my_comms()
-- (security definer, membership-gated) with city dividers, current city first;
-- tapping a community in another city also switches the browsing city.

-- q64 (2026-08-31): hunt reviews + finishers log
create table if not exists hunt_reviews(
 id uuid primary key default gen_random_uuid(),
 activity_id uuid not null references activities(id) on delete cascade,
 profile_id uuid not null references profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 600),
 created_at timestamptz not null default now(),
 unique(activity_id,profile_id));
alter table hunt_reviews enable row level security;
create or replace function hunt_completed(aid uuid,uid uuid) returns boolean language sql security definer stable set search_path=public as $f$
 select exists(select 1 from activities a where a.id=aid and a.itin_kind='hunt' and jsonb_array_length(coalesce(a.itinerary,'[]'::jsonb))>0
  and (select count(distinct c.stop_idx) from itin_checkins c where c.activity_id=aid and c.profile_id=uid)>=jsonb_array_length(a.itinerary))
$f$;
drop policy if exists hr_sel on hunt_reviews;
drop policy if exists hr_ins on hunt_reviews;
drop policy if exists hr_upd on hunt_reviews;
drop policy if exists hr_del on hunt_reviews;
create policy hr_sel on hunt_reviews for select using (exists(select 1 from activities a where a.id=activity_id));
create policy hr_ins on hunt_reviews for insert with check (profile_id=auth.uid() and hunt_completed(activity_id,auth.uid()));
create policy hr_upd on hunt_reviews for update using (profile_id=auth.uid());
create policy hr_del on hunt_reviews for delete using (profile_id=auth.uid());
create or replace function ed_hunt_log(aid uuid) returns jsonb language sql security definer stable set search_path=public as $f$
 select case when ed_act_city(aid) is null then null else jsonb_build_object(
  'done',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'av',p.avatar_url,'at',x.done_at,'review',hr.body) order by x.done_at desc)
    from (select c.profile_id,max(c.created_at) done_at,count(distinct c.stop_idx) n from itin_checkins c where c.activity_id=aid group by c.profile_id) x
    join profiles p on p.id=x.profile_id
    left join hunt_reviews hr on hr.activity_id=aid and hr.profile_id=x.profile_id
    where x.n>=(select jsonb_array_length(coalesce(itinerary,'[]'::jsonb)) from activities where id=aid)),'[]'::jsonb),
  'me_done',hunt_completed(aid,auth.uid()),
  'me_rev',exists(select 1 from hunt_reviews where activity_id=aid and profile_id=auth.uid())) end
$f$;
grant execute on function hunt_completed(uuid,uuid) to authenticated;
grant execute on function ed_hunt_log(uuid) to authenticated;
select 'migrated';

-- q65 (2026-09-07): classifieds categories - facilitators table, poi profile fields, directory_listings v2
create table if not exists facilitators(
 profile_id uuid primary key references profiles(id) on delete cascade,
 community_id uuid not null references communities(id) on delete cascade,
 headline text, offers text[] default '{}', bio text, contact text,
 links jsonb default '[]'::jsonb, gallery text[] default '{}',
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now());
alter table facilitators enable row level security;
create or replace function ed_can_facilitate(cid uuid) returns boolean language sql security definer stable set search_path=public as $f$
 select exists(select 1 from communities c where c.id=cid and c.owner_id=auth.uid())
     or exists(select 1 from staff s where s.profile_id=auth.uid() and s.role in ('owner','facilitator') and (s.community_id is null or s.community_id=cid))
$f$;
grant execute on function ed_can_facilitate(uuid) to authenticated;
drop policy if exists fac_sel on facilitators;
drop policy if exists fac_ins on facilitators;
drop policy if exists fac_upd on facilitators;
drop policy if exists fac_del on facilitators;
create policy fac_sel on facilitators for select to authenticated using (true);
create policy fac_ins on facilitators for insert with check (profile_id=auth.uid() and ed_can_facilitate(community_id));
create policy fac_upd on facilitators for update using (profile_id=auth.uid()) with check (profile_id=auth.uid() and ed_can_facilitate(community_id));
create policy fac_del on facilitators for delete using (profile_id=auth.uid());
alter table pois
 add column if not exists blurb text,
 add column if not exists story text,
 add column if not exists tier text default 'standard',
 add column if not exists sponsored boolean not null default false;
do $d$ begin
 alter table pois add constraint pois_tier_ck check (tier in ('standard','feature','spotlight'));
exception when duplicate_object then null; end $d$;
drop function if exists public.directory_listings();
create function public.directory_listings()
 returns table(profile_id uuid, display_name text, avatar_url text, kind text, headline text, offers text[], bio text, rate text, booking_url text, community_name text, booking_mode text, price_cents integer, deposit_cents integer, payment_handle text, has_windows boolean, contact text, links jsonb, gallery text[], socials jsonb, community_id uuid)
 language sql security definer set search_path=public as $f$
  select p.id, p.display_name, p.avatar_url, 'maker'::text,
         m.headline, m.offers, m.bio, m.rate, m.booking_url, null::text,
         m.booking_mode, m.price_cents, m.deposit_cents, m.payment_handle,
         exists (select 1 from maker_windows w where w.maker_id = m.profile_id),
         m.contact, m.links, m.gallery, p.socials, null::uuid
    from makers m join profiles p on p.id = m.profile_id
   where m.active and (m.trial_ends_at is null or m.trial_ends_at > now())
     and m.city = req_city()
  union all
  select * from (
    select distinct on (p.id)
         p.id, p.display_name, p.avatar_url, 'facilitator'::text,
         coalesce(f.headline,'Facilitator of '||c.name), f.offers, coalesce(f.bio,c.blurb), null::text, null::text, c.name,
         null::text, null::integer, null::integer, null::text, false,
         f.contact, coalesce(f.links,'[]'::jsonb), coalesce(f.gallery,'{}'::text[]), p.socials, c.id
    from (
      select s.profile_id pid, s.community_id cid from staff s where s.role='facilitator' and s.community_id is not null
      union
      select f2.profile_id, f2.community_id from facilitators f2 where f2.active
    ) src
    join profiles p on p.id=src.pid
    join communities c on c.id=src.cid
    left join facilitators f on f.profile_id=p.id and f.community_id=c.id and f.active
    where c.city=req_city() and c.archived_at is null
      and not exists(select 1 from facilitators fx where fx.profile_id=p.id and fx.community_id=c.id and not fx.active)
    order by p.id, (f.profile_id is null)
  ) fac
$f$;
grant execute on function public.directory_listings() to authenticated;
select 'q65 migrated';

-- q65 addendum (2026-09-07): all POIs are public feed content now (Cam: Local Business feed shows every POI)
drop policy if exists pois_sel on pois;
create policy pois_sel on pois for select to authenticated using (true);

-- q71 (2026-09-08): event recap cards RPC
create or replace function ed_event_recap(aid uuid) returns jsonb language sql security definer stable set search_path=public as $f$
 select case when not exists(select 1 from activities a where a.id=aid and (a.host_id=auth.uid() or has_rsvp(a.id,auth.uid()))) then null else
 (select jsonb_build_object(
  'msgs',(select count(*) from event_messages m where m.activity_id=aid and coalesce(m.kind,'text')<>'poll'),
  'votes',(select count(*) from poll_votes v join event_messages m on m.id=v.message_id where m.activity_id=aid),
  'inn',(select count(*) from rsvps r where r.activity_id=aid),
  'faces',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'av',p.avatar_url))
    from connections c
    join activities a on a.id=aid
    join profiles p on p.id=(case when c.a=auth.uid() then c.b else c.a end)
    where c.status='accepted' and auth.uid() in (c.a,c.b)
      and exists(select 1 from rsvps r2 where r2.activity_id=aid and r2.profile_id=(case when c.a=auth.uid() then c.b else c.a end))
      and c.created_at >= coalesce((a.date::timestamp at time zone 'America/New_York'), a.expires_at) - interval '2 days'
   ),'[]'::jsonb))) end
$f$;
grant execute on function ed_event_recap(uuid) to authenticated;
select 'q69 rpc ok';

-- q72 (2026-09-08): global communities (city='global'), Homeplate seed
-- (also: cities_status_check widened with 'hidden'; cities row global/Everywhere/hidden)
-- global communities: city='global' is visible from every city
drop policy if exists communities_city_r on communities;
create policy communities_city_r on communities as restrictive for select
 using (city = req_city() or city = 'global' or (req_city_raw() is null and is_any_staff()));
drop policy if exists announcements_city_r on announcements;
create policy announcements_city_r on announcements as restrictive for select
 using (city = req_city() or city = 'global' or (req_city_raw() is null and is_any_staff()));
drop policy if exists activities_city_r on activities;
create policy activities_city_r on activities as restrictive for select
 using (city = req_city() or city = 'global' or (req_city_raw() is null and is_any_staff()));
create or replace function set_req_city() returns trigger language plpgsql as $f$
begin
  if tg_table_name in ('announcements','activities') then
    begin
      if new.community_id is not null and exists(select 1 from communities c where c.id=new.community_id and c.city='global') then
        new.city := 'global'; return new;
      end if;
    exception when undefined_column then null; end;
  end if;
  if req_city_raw() is not null then
    new.city := req_city();
  elsif new.city is null then
    new.city := 'nyc';
  end if;
  return new;
end $f$;
create or replace function ed_comm_dir() returns json language sql stable security definer as $f$
 select coalesce(json_agg(row order by (row->>'city')='global' desc, row->>'name'),'[]'::json) from (
  select json_build_object('id',c.id,'name',c.name,'emoji',c.emoji,
   'blurb',coalesce(c.blurb,c.description),'tags',coalesce(c.tags,'{}'),'city',c.city,
   'members',(select count(*) from community_members m where m.community_id=c.id and m.status='member')) as row
  from communities c where c.archived_at is null and (c.city=req_city() or c.city='global')) t
$f$;
create or replace function ed_join_global(cid uuid) returns json language plpgsql security definer as $f$
declare uid uuid:=auth.uid(); st text;
begin
 if uid is null then return json_build_object('error','auth'); end if;
 if not exists(select 1 from communities c where c.id=cid and c.city='global' and c.archived_at is null) then
  return json_build_object('error','not_global'); end if;
 select status into st from community_members where community_id=cid and profile_id=uid;
 if st is not null then return json_build_object('status',st,'already',true); end if;
 insert into community_members(community_id,profile_id,status) values(cid,uid,'member') on conflict do nothing;
 return json_build_object('status','member');
end $f$;
grant execute on function ed_join_global(uuid) to authenticated;
create or replace function join_community(code text, via text default null) returns json language plpgsql security definer as $f$
declare c record; uid uuid:=auth.uid(); st text; inv uuid;
begin
  if uid is null then return json_build_object('error','auth'); end if;
  select id,name,emoji,city into c from communities where join_code=code and archived_at is null;
  if c.id is null then return json_build_object('error','not_found'); end if;
  select status into st from community_members where community_id=c.id and profile_id=uid;
  if st is not null then
    return json_build_object('community_id',c.id,'status',st,'name',c.name,'emoji',c.emoji,'already',true);
  end if;
  if via is not null and length(via)>0 then
    select p.id into inv from profiles p
      join community_members m on m.profile_id=p.id and m.community_id=c.id and m.status='member'
     where p.connect_code=via limit 1;
  end if;
  st := case when c.city='global' or inv is not null then 'member' else 'pending' end;
  insert into community_members(community_id,profile_id,status) values (c.id,uid,st)
    on conflict do nothing;
  return json_build_object('community_id',c.id,'status',st,'name',c.name,'emoji',c.emoji);
end $f$;
alter table communities add column if not exists feature text;
insert into communities(name,owner_id,city,feature,blurb,description,tags)
select 'Homeplate','308abd7b-e52e-4945-8c1f-e0c86e221e6a','global','meals',
 'The city feeds itself. Post a plate or claim one — everyday people cooking for each other.',
 'Homeplate is Collide''s first everywhere-community: a standing table for the whole app. Cook when you can, eat when you need, pay each other directly.',
 '{food}'
where not exists(select 1 from communities where name='Homeplate' and city='global');
insert into community_members(community_id,profile_id,status)
select id,'308abd7b-e52e-4945-8c1f-e0c86e221e6a','member' from communities where name='Homeplate' and city='global'
on conflict do nothing;
select id, join_code from communities where name='Homeplate';

-- q73 (2026-09-08): Homeplate meals - schema, RPCs, claims, allergies
create table if not exists meals(
 id uuid primary key default gen_random_uuid(),
 community_id uuid not null references communities(id) on delete cascade,
 cook_id uuid not null references profiles(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 80),
 photos text[] not null check(coalesce(array_length(photos,1),0)>=1),
 ingredients text[] not null check(coalesce(array_length(ingredients,1),0)>=1),
 allergens text[] not null default '{}',
 cuisines text[] not null default '{}',
 price_cents int not null default 0 check(price_cents>=0),
 portions int not null default 4 check(portions between 1 and 50),
 pay_method text check(pay_method in ('venmo','cashapp','zelle','paypal','other')),
 pay_handle text not null,
 pickup_address text not null,
 pickup_lat double precision, pickup_lng double precision, pickup_area text,
 pickup_start timestamptz not null, pickup_end timestamptz not null,
 status text not null default 'open' check(status in ('open','sold_out','closed')),
 city text, created_at timestamptz not null default now());
create table if not exists meal_claims(
 meal_id uuid not null references meals(id) on delete cascade,
 profile_id uuid not null references profiles(id) on delete cascade,
 qty int not null default 1 check(qty between 1 and 4),
 created_at timestamptz not null default now(),
 primary key(meal_id,profile_id));
alter table profiles add column if not exists allergies text[] not null default '{}';
alter table meals enable row level security;
alter table meal_claims enable row level security;
create or replace function meal_seats_left(mid uuid) returns int language sql security definer stable set search_path=public as $f$
 select greatest(m.portions - coalesce((select sum(c.qty) from meal_claims c where c.meal_id=m.id),0),0)::int
 from meals m where m.id=mid
$f$;
grant execute on function meal_seats_left(uuid) to authenticated;
drop policy if exists meals_sel on meals;
drop policy if exists meals_ins on meals;
drop policy if exists meals_upd on meals;
drop policy if exists meals_del on meals;
create policy meals_sel on meals for select using (is_community_member(community_id));
create policy meals_ins on meals for insert with check (cook_id=auth.uid() and is_community_member(community_id));
create policy meals_upd on meals for update using (cook_id=auth.uid() or community_owner(community_id)=auth.uid() or is_staff(community_id));
create policy meals_del on meals for delete using (cook_id=auth.uid() or community_owner(community_id)=auth.uid() or is_staff(community_id));
drop policy if exists mclaims_sel on meal_claims;
drop policy if exists mclaims_ins on meal_claims;
drop policy if exists mclaims_del on meal_claims;
create policy mclaims_sel on meal_claims for select using (exists(select 1 from meals m where m.id=meal_id and is_community_member(m.community_id)));
create policy mclaims_ins on meal_claims for insert with check (profile_id=auth.uid()
 and exists(select 1 from meals m where m.id=meal_id and m.status='open' and now()<m.pickup_end and is_community_member(m.community_id))
 and meal_seats_left(meal_id)>=qty);
create policy mclaims_del on meal_claims for delete using (profile_id=auth.uid() or exists(select 1 from meals m where m.id=meal_id and m.cook_id=auth.uid()));
revoke select on meals from authenticated, anon;
grant select(id,community_id,cook_id,title,photos,ingredients,allergens,cuisines,price_cents,portions,pay_method,pay_handle,pickup_area,pickup_start,pickup_end,status,city,created_at) on meals to authenticated;
create or replace function ed_meals(cid uuid) returns jsonb language sql stable security definer set search_path=public as $f$
 select case when not is_community_member(cid) then null else coalesce((select jsonb_agg(jsonb_build_object(
  'id',m.id,'title',m.title,'photos',m.photos,'ingredients',m.ingredients,'allergens',m.allergens,
  'cuisines',m.cuisines,'price_cents',m.price_cents,'portions',m.portions,
  'pay_method',m.pay_method,'pay_handle',m.pay_handle,
  'area',m.pickup_area,'lat',round(m.pickup_lat::numeric,3),'lng',round(m.pickup_lng::numeric,3),
  'start',m.pickup_start,'end',m.pickup_end,'status',m.status,'created_at',m.created_at,
  'cook',jsonb_build_object('id',p.id,'name',p.display_name,'av',p.avatar_url),
  'left',greatest(m.portions-coalesce((select sum(c2.qty) from meal_claims c2 where c2.meal_id=m.id),0),0),
  'mine',m.cook_id=auth.uid(),
  'my_claim',coalesce((select c3.qty from meal_claims c3 where c3.meal_id=m.id and c3.profile_id=auth.uid()),0),
  'claims',case when m.cook_id=auth.uid() then (select coalesce(jsonb_agg(jsonb_build_object('id',pp.id,'name',pp.display_name,'av',pp.avatar_url,'qty',cc.qty)),'[]'::jsonb) from meal_claims cc join profiles pp on pp.id=cc.profile_id where cc.meal_id=m.id) else null end
  ) order by (m.status='open' and now()<m.pickup_end) desc, m.pickup_end asc)
  from meals m join profiles p on p.id=m.cook_id where m.community_id=cid),'[]'::jsonb) end
$f$;
grant execute on function ed_meals(uuid) to authenticated;
create or replace function ed_meal_addr(mid uuid) returns jsonb language sql stable security definer set search_path=public as $f$
 select case when exists(select 1 from meals m where m.id=mid and (m.cook_id=auth.uid()
   or exists(select 1 from meal_claims c where c.meal_id=mid and c.profile_id=auth.uid())))
 then (select jsonb_build_object('address',m.pickup_address,'lat',m.pickup_lat,'lng',m.pickup_lng) from meals m where m.id=mid) end
$f$;
grant execute on function ed_meal_addr(uuid) to authenticated;
alter publication supabase_realtime add table meal_claims;
select 'q73 schema ok';

-- q81 (2026-09-08): meal_cooks registry; posting gated on apron
create table if not exists meal_cooks(
 community_id uuid not null references communities(id) on delete cascade,
 profile_id uuid not null references profiles(id) on delete cascade,
 pay_method text check(pay_method in ('venmo','cashapp','zelle','paypal','other')),
 pay_handle text,
 pickup_address text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(community_id,profile_id));
alter table meal_cooks enable row level security;
drop policy if exists mcook_sel on meal_cooks;
drop policy if exists mcook_ins on meal_cooks;
drop policy if exists mcook_upd on meal_cooks;
drop policy if exists mcook_del on meal_cooks;
create policy mcook_sel on meal_cooks for select using (profile_id=auth.uid() or is_community_member(community_id));
create policy mcook_ins on meal_cooks for insert with check (profile_id=auth.uid() and is_community_member(community_id));
create policy mcook_upd on meal_cooks for update using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy mcook_del on meal_cooks for delete using (profile_id=auth.uid());
drop policy if exists meals_ins on meals;
create policy meals_ins on meals for insert with check (cook_id=auth.uid() and is_community_member(community_id)
 and exists(select 1 from meal_cooks k where k.community_id=meals.community_id and k.profile_id=auth.uid() and k.active));
insert into meal_cooks(community_id,profile_id,pay_method,pay_handle)
select m.community_id,m.cook_id,m.pay_method,m.pay_handle from meals m
on conflict do nothing;
select count(*) cooks from meal_cooks;

-- q84 (2026-09-08): claim approval flow + fed counter
alter table meal_claims add column if not exists status text not null default 'pending' check(status in ('pending','approved','declined'));
alter table meal_claims add column if not exists decided_at timestamptz;
update meal_claims set status='approved', decided_at=now() where status='pending';
create or replace function meal_seats_left(mid uuid) returns int language sql security definer stable set search_path=public as $f$
 select greatest(m.portions - coalesce((select sum(c.qty) from meal_claims c where c.meal_id=m.id and c.status<>'declined'),0),0)::int
 from meals m where m.id=mid
$f$;
drop policy if exists mclaims_ins on meal_claims;
create policy mclaims_ins on meal_claims for insert with check (profile_id=auth.uid() and status='pending'
 and exists(select 1 from meals m where m.id=meal_id and m.status='open' and now()<m.pickup_end and is_community_member(m.community_id))
 and meal_seats_left(meal_id)>=qty);
drop policy if exists mclaims_upd on meal_claims;
create policy mclaims_upd on meal_claims for update
 using (exists(select 1 from meals m where m.id=meal_id and m.cook_id=auth.uid()))
 with check (status in ('approved','declined') and exists(select 1 from meals m where m.id=meal_id and m.cook_id=auth.uid()));
create or replace function ed_meal_addr(mid uuid) returns jsonb language sql stable security definer set search_path=public as $f$
 select case when exists(select 1 from meals m where m.id=mid and (m.cook_id=auth.uid()
   or exists(select 1 from meal_claims c where c.meal_id=mid and c.profile_id=auth.uid() and c.status='approved')))
 then (select jsonb_build_object('address',m.pickup_address,'lat',m.pickup_lat,'lng',m.pickup_lng) from meals m where m.id=mid) end
$f$;
create or replace function ed_meals(cid uuid) returns jsonb language sql stable security definer set search_path=public as $f$
 select case when not is_community_member(cid) then null else coalesce((select jsonb_agg(jsonb_build_object(
  'id',m.id,'title',m.title,'photos',m.photos,'ingredients',m.ingredients,'allergens',m.allergens,
  'cuisines',m.cuisines,'price_cents',m.price_cents,'portions',m.portions,
  'pay_method',m.pay_method,'pay_handle',m.pay_handle,'city',m.city,
  'area',m.pickup_area,'lat',round(m.pickup_lat::numeric,3),'lng',round(m.pickup_lng::numeric,3),
  'start',m.pickup_start,'end',m.pickup_end,'status',m.status,'created_at',m.created_at,
  'cook',jsonb_build_object('id',p.id,'name',p.display_name,'av',p.avatar_url,
   'fed',coalesce((select sum(c4.qty) from meal_claims c4 join meals m4 on m4.id=c4.meal_id
     where m4.cook_id=m.cook_id and c4.status='approved' and (m4.status='closed' or m4.pickup_end<now())),0)),
  'left',greatest(m.portions-coalesce((select sum(c2.qty) from meal_claims c2 where c2.meal_id=m.id and c2.status<>'declined'),0),0),
  'mine',m.cook_id=auth.uid(),
  'my_claim',coalesce((select c3.qty from meal_claims c3 where c3.meal_id=m.id and c3.profile_id=auth.uid()),0),
  'my_status',(select c5.status from meal_claims c5 where c5.meal_id=m.id and c5.profile_id=auth.uid()),
  'claims',case when m.cook_id=auth.uid() then (select coalesce(jsonb_agg(jsonb_build_object('id',pp.id,'name',pp.display_name,'av',pp.avatar_url,'qty',cc.qty,'status',cc.status) order by cc.created_at),'[]'::jsonb) from meal_claims cc join profiles pp on pp.id=cc.profile_id where cc.meal_id=m.id) else null end
  ) order by (m.status='open' and now()<m.pickup_end) desc, m.pickup_end asc)
  from meals m join profiles p on p.id=m.cook_id where m.community_id=cid),'[]'::jsonb) end
$f$;
select 'q83 schema ok';

-- q92 (2026-09-09): announcement-reply DMs (threads, inbox, end-thread)
create table if not exists dm_threads(
 id uuid primary key default gen_random_uuid(),
 announcement_id uuid not null references announcements(id) on delete cascade,
 starter_id uuid not null references profiles(id) on delete cascade,
 owner_id uuid not null references profiles(id) on delete cascade,
 status text not null default 'open' check(status in ('open','closed')),
 closed_by uuid references profiles(id),
 starter_seen timestamptz not null default now(),
 owner_seen timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(announcement_id,starter_id));
create table if not exists dm_messages(
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references dm_threads(id) on delete cascade,
 author_id uuid not null references profiles(id) on delete cascade,
 kind text not null default 'text' check(kind in ('text','event')),
 body text not null check(char_length(body) between 1 and 2000),
 ref_id uuid,
 created_at timestamptz not null default now());
alter table dm_threads enable row level security;
alter table dm_messages enable row level security;
drop policy if exists dmt_sel on dm_threads;
drop policy if exists dmt_upd on dm_threads;
create policy dmt_sel on dm_threads for select using (auth.uid() in (starter_id,owner_id));
create policy dmt_upd on dm_threads for update using (auth.uid() in (starter_id,owner_id)) with check (auth.uid() in (starter_id,owner_id));
drop policy if exists dmm_sel on dm_messages;
drop policy if exists dmm_ins on dm_messages;
create policy dmm_sel on dm_messages for select using (exists(select 1 from dm_threads t where t.id=thread_id and auth.uid() in (t.starter_id,t.owner_id)));
create policy dmm_ins on dm_messages for insert with check (author_id=auth.uid()
 and exists(select 1 from dm_threads t where t.id=thread_id and t.status='open' and auth.uid() in (t.starter_id,t.owner_id)));
alter publication supabase_realtime add table dm_messages;
alter publication supabase_realtime add table dm_threads;
create or replace function ed_dm_start(aid uuid, body text) returns jsonb language plpgsql security definer as $f$
declare uid uuid:=auth.uid(); own uuid; tid uuid; st text;
begin
 if uid is null then return jsonb_build_object('error','auth'); end if;
 select author_id into own from announcements where id=aid;
 if own is null then return jsonb_build_object('error','gone'); end if;
 if own=uid then return jsonb_build_object('error','own'); end if;
 if body is null or char_length(trim(body))=0 then return jsonb_build_object('error','empty'); end if;
 select id,status into tid,st from dm_threads where announcement_id=aid and starter_id=uid;
 if tid is null then
  insert into dm_threads(announcement_id,starter_id,owner_id) values(aid,uid,own) returning id into tid;
 elsif st='closed' then
  update dm_threads set status='open',closed_by=null where id=tid;
 end if;
 insert into dm_messages(thread_id,author_id,body) values(tid,uid,left(trim(body),2000));
 return jsonb_build_object('id',tid);
end $f$;
grant execute on function ed_dm_start(uuid,text) to authenticated;
create or replace function ed_inbox() returns jsonb language sql stable security definer set search_path=public as $f$
 select coalesce(jsonb_agg(row order by coalesce(row->>'at','') desc),'[]'::jsonb) from (
  select jsonb_build_object(
   'id',t.id,'status',t.status,
   'ann',left(a.body,90),'aid',a.id,
   'mine_owner',t.owner_id=auth.uid(),
   'other',jsonb_build_object('id',p.id,'name',p.display_name,'av',p.avatar_url),
   'last',(select jsonb_build_object('body',m.body,'kind',m.kind,'author',m.author_id,'at',m.created_at) from dm_messages m where m.thread_id=t.id order by m.created_at desc limit 1),
   'at',(select max(m.created_at)::text from dm_messages m where m.thread_id=t.id),
   'unread', exists(select 1 from dm_messages m where m.thread_id=t.id and m.author_id<>auth.uid()
      and m.created_at > case when t.owner_id=auth.uid() then t.owner_seen else t.starter_seen end)
  ) as row
  from dm_threads t join announcements a on a.id=t.announcement_id
  join profiles p on p.id=case when t.owner_id=auth.uid() then t.starter_id else t.owner_id end
  where auth.uid() in (t.starter_id,t.owner_id)) z
$f$;
grant execute on function ed_inbox() to authenticated;
create or replace function ed_dm_seen(tid uuid) returns void language sql security definer set search_path=public as $f$
 update dm_threads set owner_seen=case when owner_id=auth.uid() then now() else owner_seen end,
  starter_seen=case when starter_id=auth.uid() then now() else starter_seen end
 where id=tid and auth.uid() in (starter_id,owner_id)
$f$;
grant execute on function ed_dm_seen(uuid) to authenticated;
select 'q92 dm schema ok';

-- q93 (2026-09-09): dm closed_at + 2h inbox expiry
alter table dm_threads add column if not exists closed_at timestamptz;
update dm_threads set closed_at=now() where status='closed' and closed_at is null;
create or replace function ed_dm_start(aid uuid, body text) returns jsonb language plpgsql security definer as $f$
declare uid uuid:=auth.uid(); own uuid; tid uuid; st text;
begin
 if uid is null then return jsonb_build_object('error','auth'); end if;
 select author_id into own from announcements where id=aid;
 if own is null then return jsonb_build_object('error','gone'); end if;
 if own=uid then return jsonb_build_object('error','own'); end if;
 if body is null or char_length(trim(body))=0 then return jsonb_build_object('error','empty'); end if;
 select id,status into tid,st from dm_threads where announcement_id=aid and starter_id=uid;
 if tid is null then
  insert into dm_threads(announcement_id,starter_id,owner_id) values(aid,uid,own) returning id into tid;
 elsif st='closed' then
  update dm_threads set status='open',closed_by=null,closed_at=null where id=tid;
 end if;
 insert into dm_messages(thread_id,author_id,body) values(tid,uid,left(trim(body),2000));
 return jsonb_build_object('id',tid);
end $f$;
create or replace function ed_inbox() returns jsonb language sql stable security definer set search_path=public as $f$
 select coalesce(jsonb_agg(row order by coalesce(row->>'at','') desc),'[]'::jsonb) from (
  select jsonb_build_object(
   'id',t.id,'status',t.status,
   'ann',left(a.body,90),'aid',a.id,
   'mine_owner',t.owner_id=auth.uid(),
   'other',jsonb_build_object('id',p.id,'name',p.display_name,'av',p.avatar_url),
   'last',(select jsonb_build_object('body',m.body,'kind',m.kind,'author',m.author_id,'at',m.created_at) from dm_messages m where m.thread_id=t.id order by m.created_at desc limit 1),
   'at',(select max(m.created_at)::text from dm_messages m where m.thread_id=t.id),
   'unread', exists(select 1 from dm_messages m where m.thread_id=t.id and m.author_id<>auth.uid()
      and m.created_at > case when t.owner_id=auth.uid() then t.owner_seen else t.starter_seen end)
  ) as row
  from dm_threads t join announcements a on a.id=t.announcement_id
  join profiles p on p.id=case when t.owner_id=auth.uid() then t.starter_id else t.owner_id end
  where auth.uid() in (t.starter_id,t.owner_id)
    and (t.status='open' or coalesce(t.closed_at,now()) > now()-interval '2 hours')) z
$f$;
select 'q93 dm ok';

-- q95 (2026-09-09): manual clear replaces 2h expiry
alter table dm_threads add column if not exists starter_cleared boolean not null default false;
alter table dm_threads add column if not exists owner_cleared boolean not null default false;
create or replace function ed_dm_start(aid uuid, body text) returns jsonb language plpgsql security definer as $f$
declare uid uuid:=auth.uid(); own uuid; tid uuid; st text;
begin
 if uid is null then return jsonb_build_object('error','auth'); end if;
 select author_id into own from announcements where id=aid;
 if own is null then return jsonb_build_object('error','gone'); end if;
 if own=uid then return jsonb_build_object('error','own'); end if;
 if body is null or char_length(trim(body))=0 then return jsonb_build_object('error','empty'); end if;
 select id,status into tid,st from dm_threads where announcement_id=aid and starter_id=uid;
 if tid is null then
  insert into dm_threads(announcement_id,starter_id,owner_id) values(aid,uid,own) returning id into tid;
 elsif st='closed' then
  update dm_threads set status='open',closed_by=null,closed_at=null,starter_cleared=false,owner_cleared=false where id=tid;
 end if;
 insert into dm_messages(thread_id,author_id,body) values(tid,uid,left(trim(body),2000));
 return jsonb_build_object('id',tid);
end $f$;
create or replace function ed_inbox() returns jsonb language sql stable security definer set search_path=public as $f$
 select coalesce(jsonb_agg(row order by coalesce(row->>'at','') desc),'[]'::jsonb) from (
  select jsonb_build_object(
   'id',t.id,'status',t.status,
   'ann',left(a.body,90),'aid',a.id,
   'mine_owner',t.owner_id=auth.uid(),
   'other',jsonb_build_object('id',p.id,'name',p.display_name,'av',p.avatar_url),
   'last',(select jsonb_build_object('body',m.body,'kind',m.kind,'author',m.author_id,'at',m.created_at) from dm_messages m where m.thread_id=t.id order by m.created_at desc limit 1),
   'at',(select max(m.created_at)::text from dm_messages m where m.thread_id=t.id),
   'unread', exists(select 1 from dm_messages m where m.thread_id=t.id and m.author_id<>auth.uid()
      and m.created_at > case when t.owner_id=auth.uid() then t.owner_seen else t.starter_seen end)
  ) as row
  from dm_threads t join announcements a on a.id=t.announcement_id
  join profiles p on p.id=case when t.owner_id=auth.uid() then t.starter_id else t.owner_id end
  where auth.uid() in (t.starter_id,t.owner_id)
    and not (case when t.owner_id=auth.uid() then t.owner_cleared else t.starter_cleared end)) z
$f$;
select 'q94 ok';


-- ============================================================
-- q149 (2026-09-10): circle plans from the map. Applied live 2026-09-10 via Management API.
-- (source of truth: supabase/migrations/q149_circle_plans.sql)
-- ============================================================

-- ---------- 1 · members create circle plans ----------
drop policy if exists act_ins on activities;
create policy act_ins on activities for insert to authenticated
  with check (host_id = auth.uid()
              and (is_any_staff() or (visibility = 'circle' and community_id is null)));

-- ---------- 2 · who sees an activity ----------
-- circle  → host, accepted circle, rsvp'd
-- public  → circle, community members, or anyone once it's pinned on the map
create or replace function can_see_activity(aid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(
    select 1 from activities a where a.id = aid and (
      a.host_id = uid
      or exists(select 1 from rsvps r where r.activity_id = a.id and r.profile_id = uid)
      or (a.visibility = 'circle' and are_connected(a.host_id, uid))
      or (a.visibility <> 'circle' and (
            are_connected(a.host_id, uid)
            or (a.community_id is not null and is_community_member(a.community_id, uid))
            or (a.community_id is null and exists(select 1 from map_events me where me.activity_id = a.id))))
    ));
$$;

drop policy if exists act_sel on activities;
create policy act_sel on activities for select to authenticated using (
  host_id = auth.uid()
  or has_rsvp(id, auth.uid())
  or (visibility = 'circle' and are_connected(host_id, auth.uid()))
  or (visibility <> 'circle' and (
        are_connected(host_id, auth.uid())
        or (community_id is not null and is_community_member(community_id))
        or (community_id is null and on_shared_map(id))))
);

-- ---------- 3 · pins follow their activity ----------
-- (ad-hoc pins with no activity stay public; staff_all keeps the console god view)
drop policy if exists mapev_sel on map_events;
create policy mapev_sel on map_events for select to authenticated
  using (activity_id is null or can_see_activity(activity_id));

-- members pin (and unpin) their own circle plans; staff unchanged
drop policy if exists mapev_ins on map_events;
create policy mapev_ins on map_events for insert to authenticated
  with check (created_by = auth.uid()
              and (is_any_staff()
                   or exists(select 1 from activities a
                              where a.id = activity_id and a.host_id = auth.uid() and a.visibility = 'circle')));
drop policy if exists mapev_del on map_events;
create policy mapev_del on map_events for delete to authenticated
  using (created_by = auth.uid() or is_any_staff());

select 'q149 circle plans migrated';

-- q149 addendum (applied live 2026-09-10): staff god view stops at circle plans
-- ---------- 4 · staff god view stops at circle plans ----------
-- (facilitators of one community were seeing every circle pin on the map; the owner still sees all)
create or replace function is_circle_plan(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select aid is not null and exists(select 1 from activities a where a.id = aid and a.visibility = 'circle')
$$;
drop policy if exists staff_all on map_events;
create policy staff_all on map_events for all to authenticated
  using (is_owner() or (is_any_staff() and not is_circle_plan(activity_id)))
  with check (is_any_staff());


-- q153 (2026-09-10): yap audience. Applied live 2026-09-10 via Management API.
alter table yaps add column if not exists audience text not null default 'communities'
  check (audience in ('circle','communities','public'));
alter table yaps alter column audience set default 'circle';

create or replace function can_see_yap(yid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from yaps y where y.id = yid and (
    y.author_id = uid
    or y.audience = 'public'
    or are_connected(y.author_id, uid)
    or (y.audience = 'communities' and shares_community(y.author_id, uid))));
$$;

drop policy if exists yap_sel on yaps;
create policy yap_sel on yaps for select to authenticated using (
  author_id = auth.uid()
  or audience = 'public'
  or are_connected(author_id, auth.uid())
  or (audience = 'communities' and shares_community(author_id, auth.uid()))
);
select 'q153 yap audience migrated';


-- q159 (2026-09-10): plan archives. Applied live 2026-09-10 via Management API.
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
