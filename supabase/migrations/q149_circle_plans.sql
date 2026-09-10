-- q149 (2026-09-10): circle plans from the map.
-- Members can create their own circle-only plans (no community) and pin them on
-- the map; 'circle' visibility is now enforced — only the host, their accepted
-- circle, and anyone already RSVP'd can see the activity or its pin.
-- Staff flows are unchanged (staff may still create public/community events).
-- Apply in the Supabase SQL editor (project pjxvvwcnjjizdtiutpxd), then append
-- to mobile_compat.sql as the migration log.

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
