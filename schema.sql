-- ============================================================================
--  Collide — reconstructed schema (reverse-engineered from the compiled PWA,
--  2026-08-12). The original DB was inaccessible; this recreates the data model
--  the client expects. Types/RLS are best-effort inferences — review before
--  onboarding real users. Run once in the new project's SQL editor.
-- ============================================================================

-- ---------- helpers ----------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------- profiles (1:1 with auth.users) ----------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  connect_code text unique default encode(gen_random_bytes(4),'hex'),  -- friend-invite code
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- connections (friend graph) --------------------------------------
create table if not exists connections (
  a          uuid not null references profiles(id) on delete cascade,
  b          uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b)
);

-- ---------- communities ------------------------------------------------------
create table if not exists communities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid references profiles(id) on delete set null,
  image_path text,
  created_at timestamptz not null default now()
);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  status       text not null default 'member',   -- 'member' | 'pending' | 'owner'
  joined_at    timestamptz not null default now(),
  primary key (community_id, profile_id)
);

-- ---------- activities (plans / events) -------------------------------------
create table if not exists activities (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid references profiles(id) on delete set null,
  community_id uuid references communities(id) on delete set null,  -- null = personal
  title      text not null,
  date       date,
  itinerary  jsonb not null default '[]'::jsonb,
  status     text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists rsvps (
  activity_id uuid not null references activities(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  status      text not null default 'going',       -- 'going' | 'maybe' | 'out'
  created_at  timestamptz not null default now(),
  primary key (activity_id, profile_id)
);

create table if not exists event_kicks (
  activity_id uuid not null references activities(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, profile_id)
);

-- ---------- messages (shared shape for events & communities) ----------------
create table if not exists event_messages (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references activities(id) on delete cascade,
  author_id    uuid references profiles(id) on delete set null,
  kind         text not null default 'text',        -- 'text' | 'image' | 'poll' | 'audio'
  body         text,
  image_path   text,
  audio_path   text,
  poll_options jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists poll_votes (
  message_id   uuid not null references event_messages(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  option_index int  not null,
  primary key (message_id, profile_id)
);

create table if not exists community_messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  author_id    uuid references profiles(id) on delete set null,
  kind         text not null default 'text',
  body         text,
  image_path   text,
  audio_path   text,
  poll_options jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists community_poll_votes (
  message_id   uuid not null references community_messages(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  option_index int  not null,
  primary key (message_id, profile_id)
);

-- ---------- announcements ----------------------------------------------------
create table if not exists announcements (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references profiles(id) on delete set null,
  community_id uuid references communities(id) on delete cascade,  -- null = global
  body         text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);

-- ---------- map --------------------------------------------------------------
create table if not exists map_config (
  id         int primary key default 1,
  image_path text,
  updated_at timestamptz not null default now(),
  constraint map_config_singleton check (id = 1)
);

create table if not exists map_events (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  x          double precision,   -- position on the map image (inferred)
  y          double precision,
  created_by uuid references profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- invite_preview RPC (best-effort re-implementation) ---------------
-- Client calls .rpc('invite_preview', { code }) to show who a connect link is
-- from, before signing in. Returns the inviter's public profile bits.
create or replace function invite_preview(code text)
returns table(display_name text, avatar_url text)
language sql security definer set search_path = public as $$
  select display_name, avatar_url from profiles where connect_code = code limit 1;
$$;
grant execute on function invite_preview(text) to anon, authenticated;

-- ============================================================================
--  RLS — pragmatic first pass: login required; writes limited to the owner.
--  Reads are open to any authenticated user (NOT yet compartmentalized per
--  community/activity). HARDEN before real users.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','connections','communities','community_members','activities',
    'rsvps','event_kicks','event_messages','poll_votes','community_messages',
    'community_poll_votes','announcements','map_config','map_events'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists auth_read on %I;', t);
    execute format('create policy auth_read on %I for select to authenticated using (true);', t);
  end loop;
end $$;

-- ownership-based writes where an owning column exists; permissive elsewhere
create policy self_write   on profiles           for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy conn_write   on connections         for all to authenticated using (a = auth.uid() or b = auth.uid()) with check (a = auth.uid());
create policy comm_write   on communities         for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy cmem_write   on community_members   for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy act_write    on activities          for all to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy rsvp_write   on rsvps               for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy kick_write   on event_kicks         for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy emsg_write   on event_messages      for all to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy pv_write     on poll_votes          for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy cmsg_write   on community_messages  for all to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy cpv_write    on community_poll_votes for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy ann_write    on announcements       for all to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy mapcfg_write on map_config          for all to authenticated using (true) with check (true);
create policy mapev_write  on map_events          for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- ---------- auto-create a profile row on signup ----------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- storage buckets --------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('avatars','avatars', true),
  ('map','map', true),
  ('feed-media','feed-media', false)     -- private; client uses createSignedUrl
on conflict (id) do nothing;

drop policy if exists avatars_all on storage.objects;
create policy avatars_all on storage.objects for all to authenticated
  using (bucket_id in ('avatars','map','feed-media')) with check (bucket_id in ('avatars','map','feed-media'));
drop policy if exists public_read on storage.objects;
create policy public_read on storage.objects for select to anon
  using (bucket_id in ('avatars','map'));
