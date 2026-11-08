-- q187 (2026-11-08): private profile fields. phone, allergies, connect_code and crm_opt_out
-- were readable by every signed-in user (profiles_sel is using(true) on the whole row).
-- Step 1 (additive): profile_full = the whole row for yourself, the owner, and staff of a
-- community you're in; connect_lookup = code -> public card, for the connect flow.
-- Step 2 (after clients moved over): profiles keeps only public columns for authenticated.
-- NOTE: profiles now has column-level SELECT grants. A new public column needs
--   grant select (col) on public.profiles to authenticated;
-- and profile_full must be recreated to pick up any new column.

create or replace view public.profile_full with (security_invoker = false) as
  select p.* from public.profiles p
   where p.id = auth.uid()
      or public.is_owner()
      or exists (select 1 from public.community_members m
                  where m.profile_id = p.id and m.status <> 'pending' and public.is_staff(m.community_id));
revoke all on public.profile_full from anon, authenticated;
grant select on public.profile_full to authenticated;

create or replace function public.connect_lookup(code text)
returns table(id uuid, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url from profiles p
   where auth.uid() is not null and p.connect_code = code limit 1
$$;
revoke all on function public.connect_lookup(text) from public, anon;
grant execute on function public.connect_lookup(text) to authenticated;

select 'q187 step 1 applied';
