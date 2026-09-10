-- q160 (2026-09-10): an invite grants visibility. Someone invited to a circle plan
-- by a member (not the host) can see the plan and its pin, so "I'm in" works.
create or replace function has_invite(aid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from event_invites i where i.activity_id = aid and i.to_id = uid);
$$;

create or replace function can_see_activity(aid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists(
    select 1 from activities a where a.id = aid and (
      a.host_id = uid
      or exists(select 1 from rsvps r where r.activity_id = a.id and r.profile_id = uid)
      or exists(select 1 from event_invites i where i.activity_id = a.id and i.to_id = uid)
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
  or has_invite(id, auth.uid())
  or (visibility = 'circle' and are_connected(host_id, auth.uid()))
  or (visibility <> 'circle' and (
        are_connected(host_id, auth.uid())
        or (community_id is not null and is_community_member(community_id))
        or (community_id is null and on_shared_map(id))))
);

-- RSVP from an invite
drop policy if exists rsvp_ins on rsvps;
create policy rsvp_ins on rsvps for insert to authenticated
  with check (profile_id = auth.uid() and can_see_activity(activity_id));
select 'q160 invite visibility migrated';
