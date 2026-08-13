-- ============================================================================
--  Collide — RLS hardening (2026-08-12)
--  Replaces the permissive "any authenticated user can read everything" pass
--  with per-user scoping:
--    • you see your own plans, plans from people you're connected to,
--      plans you've RSVP'd to, and plans in communities you've joined
--    • community content is visible only to that community's members
--    • connections/votes/messages scoped accordingly
--    • writes remain owner-only
--  Membership checks use SECURITY DEFINER helpers so policies never recurse.
-- ============================================================================

-- ---------- membership helper functions -------------------------------------
create or replace function are_connected(u1 uuid, u2 uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select u1 = u2 or exists(
    select 1 from connections c where (c.a=u1 and c.b=u2) or (c.a=u2 and c.b=u1));
$$;

create or replace function is_community_member(cid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select cid is not null and exists(
    select 1 from community_members m where m.community_id=cid and m.profile_id=uid);
$$;

create or replace function community_owner(cid uuid)
returns uuid language sql security definer stable set search_path=public as $$
  select owner_id from communities where id=cid;
$$;

create or replace function is_activity_host(aid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from activities a where a.id=aid and a.host_id=uid);
$$;

create or replace function can_see_activity(aid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from activities a where a.id=aid and (
      a.host_id = uid
      or are_connected(a.host_id, uid)
      or exists(select 1 from rsvps r where r.activity_id=a.id and r.profile_id=uid)
      or (a.community_id is not null and is_community_member(a.community_id, uid))
    ));
$$;

create or replace function can_see_event_message(mid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from event_messages m where m.id=mid and can_see_activity(m.activity_id, uid));
$$;

create or replace function can_see_community_message(mid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from community_messages m where m.id=mid and is_community_member(m.community_id, uid));
$$;

-- ---------- drop every existing policy on our tables ------------------------
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname='public' and tablename = any(array[
      'profiles','connections','communities','community_members','activities',
      'rsvps','event_kicks','event_messages','poll_votes','community_messages',
      'community_poll_votes','announcements','map_config','map_events'])
  loop
    execute format('drop policy if exists %I on %I;', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------- profiles: names/avatars discoverable to logged-in users ---------
create policy profiles_sel on profiles for select to authenticated using (true);
create policy profiles_ins on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_upd on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- (no delete — profiles removed via auth.users cascade)
revoke select (connect_code) on profiles from anon;

-- ---------- connections: only the two people involved -----------------------
create policy conn_sel on connections for select to authenticated using (a = auth.uid() or b = auth.uid());
create policy conn_ins on connections for insert to authenticated with check (a = auth.uid());
create policy conn_del on connections for delete to authenticated using (a = auth.uid() or b = auth.uid());

-- ---------- communities: members (and owner) --------------------------------
create policy comm_sel on communities for select to authenticated using (owner_id = auth.uid() or is_community_member(id));
create policy comm_ins on communities for insert to authenticated with check (owner_id = auth.uid());
create policy comm_upd on communities for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy comm_del on communities for delete to authenticated using (owner_id = auth.uid());

-- ---------- community_members: members see the roster; self/owner manage -----
create policy cmem_sel on community_members for select to authenticated using (is_community_member(community_id));
create policy cmem_ins on community_members for insert to authenticated with check (profile_id = auth.uid() or community_owner(community_id) = auth.uid());
create policy cmem_upd on community_members for update to authenticated using (profile_id = auth.uid() or community_owner(community_id) = auth.uid()) with check (profile_id = auth.uid() or community_owner(community_id) = auth.uid());
create policy cmem_del on community_members for delete to authenticated using (profile_id = auth.uid() or community_owner(community_id) = auth.uid());

-- ---------- activities: host, friends of host, RSVPs, community members ------
create policy act_sel on activities for select to authenticated using (can_see_activity(id));
create policy act_ins on activities for insert to authenticated with check (host_id = auth.uid() and (community_id is null or is_community_member(community_id)));
create policy act_upd on activities for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy act_del on activities for delete to authenticated using (host_id = auth.uid());

-- ---------- rsvps: visible to activity viewers; you manage your own ----------
create policy rsvp_sel on rsvps for select to authenticated using (can_see_activity(activity_id));
create policy rsvp_ins on rsvps for insert to authenticated with check (profile_id = auth.uid() and can_see_activity(activity_id));
create policy rsvp_upd on rsvps for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy rsvp_del on rsvps for delete to authenticated using (profile_id = auth.uid() or is_activity_host(activity_id));

-- ---------- event_kicks: host manages; viewers can see -----------------------
create policy kick_sel on event_kicks for select to authenticated using (can_see_activity(activity_id));
create policy kick_ins on event_kicks for insert to authenticated with check (is_activity_host(activity_id));
create policy kick_del on event_kicks for delete to authenticated using (is_activity_host(activity_id));

-- ---------- event_messages: activity viewers read; authors write ------------
create policy emsg_sel on event_messages for select to authenticated using (can_see_activity(activity_id));
create policy emsg_ins on event_messages for insert to authenticated with check (author_id = auth.uid() and can_see_activity(activity_id));
create policy emsg_upd on event_messages for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy emsg_del on event_messages for delete to authenticated using (author_id = auth.uid() or is_activity_host(activity_id));

-- ---------- poll_votes (event) ----------------------------------------------
create policy pv_sel on poll_votes for select to authenticated using (can_see_event_message(message_id));
create policy pv_ins on poll_votes for insert to authenticated with check (profile_id = auth.uid() and can_see_event_message(message_id));
create policy pv_upd on poll_votes for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy pv_del on poll_votes for delete to authenticated using (profile_id = auth.uid());

-- ---------- community_messages ----------------------------------------------
create policy cmsg_sel on community_messages for select to authenticated using (is_community_member(community_id));
create policy cmsg_ins on community_messages for insert to authenticated with check (author_id = auth.uid() and is_community_member(community_id));
create policy cmsg_upd on community_messages for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy cmsg_del on community_messages for delete to authenticated using (author_id = auth.uid() or community_owner(community_id) = auth.uid());

-- ---------- community_poll_votes --------------------------------------------
create policy cpv_sel on community_poll_votes for select to authenticated using (can_see_community_message(message_id));
create policy cpv_ins on community_poll_votes for insert to authenticated with check (profile_id = auth.uid() and can_see_community_message(message_id));
create policy cpv_upd on community_poll_votes for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy cpv_del on community_poll_votes for delete to authenticated using (profile_id = auth.uid());

-- ---------- announcements: global (community_id null) or community members ---
create policy ann_sel on announcements for select to authenticated using (community_id is null or is_community_member(community_id));
create policy ann_ins on announcements for insert to authenticated with check (author_id = auth.uid() and (community_id is null or is_community_member(community_id)));
create policy ann_upd on announcements for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy ann_del on announcements for delete to authenticated using (author_id = auth.uid() or community_owner(community_id) = auth.uid());

-- ---------- map: shared board, visible to all logged-in users ---------------
create policy mapcfg_sel on map_config for select to authenticated using (true);
create policy mapcfg_ins on map_config for insert to authenticated with check (true);
create policy mapcfg_upd on map_config for update to authenticated using (true) with check (true);

create policy mapev_sel on map_events for select to authenticated using (true);
create policy mapev_ins on map_events for insert to authenticated with check (created_by = auth.uid());
create policy mapev_upd on map_events for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy mapev_del on map_events for delete to authenticated using (created_by = auth.uid());
-- RLS-bypassing rsvp check (avoids recursion)
create or replace function has_rsvp(aid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from rsvps r where r.activity_id=aid and r.profile_id=uid);
$$;

-- activities: reference the row's OWN columns (no self-requery via id)
drop policy if exists act_sel on activities;
create policy act_sel on activities for select to authenticated using (
  host_id = auth.uid()
  or are_connected(host_id, auth.uid())
  or has_rsvp(id, auth.uid())
  or (community_id is not null and is_community_member(community_id))
);

-- community_members: self always sees own row; members see roster
drop policy if exists cmem_sel on community_members;
create policy cmem_sel on community_members for select to authenticated using (
  profile_id = auth.uid() or is_community_member(community_id)
);

-- own-row shortcuts so insert().select() works for the creator
drop policy if exists rsvp_sel on rsvps;
create policy rsvp_sel on rsvps for select to authenticated using (
  profile_id = auth.uid() or can_see_activity(activity_id)
);
drop policy if exists pv_sel on poll_votes;
create policy pv_sel on poll_votes for select to authenticated using (
  profile_id = auth.uid() or can_see_event_message(message_id)
);
drop policy if exists cpv_sel on community_poll_votes;
create policy cpv_sel on community_poll_votes for select to authenticated using (
  profile_id = auth.uid() or can_see_community_message(message_id)
);

-- cleanup debug fns
drop function if exists whoami();
drop function if exists whoami_invoker();
drop function if exists whoami_definer();
