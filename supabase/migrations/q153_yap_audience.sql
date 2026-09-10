-- q153 (2026-09-10): yap audience — circle (default) / communities / public.
-- Existing yaps keep today's reach (circle + shared communities); new ones default to circle.
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
