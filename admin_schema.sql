-- ============================================================================
--  Collide — admin console schema (2026-08-14)
--  Adds the staff/roles layer, Points of Interest, the display-only money
--  ledger, and event fields the desktop console needs. All additive — the
--  mobile app selects * and keeps working untouched.
-- ============================================================================

-- ---------- staff: who may use the admin console -----------------------------
-- community_id NULL = global (owner-level) access to every community.
create table if not exists staff (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  profile_id   uuid references profiles(id) on delete set null,
  role         text not null default 'facilitator' check (role in ('owner','facilitator')),
  community_id uuid references communities(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique nulls not distinct (email, community_id)
);

-- SECURITY DEFINER helpers (bypass RLS; never recurse). Email comes from the
-- signed JWT — the same identity magic-link login proves.
create or replace function staff_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt()->>'email',''));
$$;

create or replace function is_any_staff()
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from staff s where lower(s.email) = staff_email());
$$;

create or replace function is_owner()
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from staff s where lower(s.email) = staff_email() and s.role = 'owner');
$$;

create or replace function is_staff(cid uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select cid is not null and exists(
    select 1 from staff s where lower(s.email) = staff_email()
      and (s.community_id is null or s.community_id = cid));
$$;

create or replace function staff_sees_activity(aid uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from activities a
    where a.id = aid and a.community_id is not null and is_staff(a.community_id));
$$;

alter table staff enable row level security;
drop policy if exists staff_sel on staff;
create policy staff_sel on staff for select to authenticated using (is_any_staff());
drop policy if exists staff_write on staff;
create policy staff_write on staff for all to authenticated using (is_owner()) with check (is_owner());

-- the owner and main admin
insert into staff (email, role, community_id)
values ('icandothatforyou@gmail.com', 'owner', null)
on conflict (email, community_id) do update set role = 'owner';

-- ---------- points of interest ----------------------------------------------
create table if not exists pois (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  name         text not null,
  category     text,
  lat          double precision,
  lng          double precision,
  notes        text,
  image_path   text,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table pois enable row level security;
drop policy if exists pois_sel on pois;
create policy pois_sel on pois for select to authenticated
  using (is_community_member(community_id) or is_staff(community_id));
drop policy if exists pois_write on pois;
create policy pois_write on pois for all to authenticated
  using (is_staff(community_id)) with check (is_staff(community_id));

-- ---------- ledger: display-only money (Phase 1, no Stripe) ------------------
create table if not exists ledger (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  kind         text not null default 'other' check (kind in ('membership','event','poi','other')),
  label        text,
  amount_cents int  not null default 0,
  happened_on  date not null default current_date,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table ledger enable row level security;
drop policy if exists ledger_all on ledger;
create policy ledger_all on ledger for all to authenticated
  using (is_staff(community_id)) with check (is_staff(community_id));

-- ---------- additive columns --------------------------------------------------
alter table communities add column if not exists membership_price_cents int not null default 0;
alter table communities add column if not exists description text;

alter table activities add column if not exists location    text;
alter table activities add column if not exists lat         double precision;
alter table activities add column if not exists lng         double precision;
alter table activities add column if not exists image_path  text;
alter table activities add column if not exists starts_at   time;
alter table activities add column if not exists price_cents int not null default 0;

-- ---------- staff overrides on existing tables --------------------------------
-- Permissive policies OR together, so these ADD staff powers without touching
-- what members can already do. Personal plans (community_id null) stay private.
drop policy if exists staff_all on communities;
create policy staff_all on communities for all to authenticated
  using (is_staff(id)) with check (is_staff(id));

drop policy if exists staff_all on community_members;
create policy staff_all on community_members for all to authenticated
  using (is_staff(community_id)) with check (is_staff(community_id));

drop policy if exists staff_all on activities;
create policy staff_all on activities for all to authenticated
  using (community_id is not null and is_staff(community_id))
  with check (community_id is not null and is_staff(community_id));

drop policy if exists staff_all on announcements;
create policy staff_all on announcements for all to authenticated
  using ((community_id is not null and is_staff(community_id)) or is_owner())
  with check ((community_id is not null and is_staff(community_id)) or is_owner());

-- facilitators see + manage RSVPs on their communities' events (roster, kicks)
drop policy if exists staff_sel on rsvps;
create policy staff_sel on rsvps for select to authenticated using (staff_sees_activity(activity_id));
drop policy if exists staff_del on rsvps;
create policy staff_del on rsvps for delete to authenticated using (staff_sees_activity(activity_id));

-- owners may create communities on behalf of the org (owner_id can be anyone)
drop policy if exists owner_ins on communities;
create policy owner_ins on communities for insert to authenticated with check (is_owner());

-- ---------- storage: event/POI images (public read, staff write) --------------
drop policy if exists event_media_write on storage.objects;
create policy event_media_write on storage.objects for all to authenticated
  using (bucket_id = 'event-media' and is_any_staff())
  with check (bucket_id = 'event-media' and is_any_staff());
drop policy if exists event_media_read on storage.objects;
create policy event_media_read on storage.objects for select to anon
  using (bucket_id = 'event-media');
