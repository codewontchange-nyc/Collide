-- ============================================================================
--  Colony schema (2026-11-06)
--  NOT WIRED: designed alongside the prototype, apply in the Supabase SQL
--  editor when the client moves off LocalRepo. Additive and re-runnable:
--  `create table if not exists`, `create index if not exists`,
--  `drop policy if exists` before every `create policy`,
--  `create or replace function`. Nothing here drops data.
--
--  Shape mirrors src/domain/types.ts one to one. Money is integer cents,
--  dates are `date`, months are text 'YYYY-MM', times are `time`.
--
--  Sections: tables, pool_balance, billing (mirrors Collide q96 with a
--  colony_ prefix), RLS helpers, policies, realtime.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- profiles --------------------------------------------------------
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now());

-- ---------- colonies --------------------------------------------------------
create table if not exists public.colonies(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  steward_id uuid not null references public.profiles(id) on delete restrict,
  invite_code text not null unique,
  contribution_cents_per_person int not null default 100000 check (contribution_cents_per_person >= 0),
  created_at timestamptz not null default now());
create index if not exists colonies_steward on public.colonies(steward_id);

-- billing columns (see the billing section below for how they are read)
alter table public.colonies add column if not exists trial_ends_at timestamptz not null default now() + interval '30 days';
alter table public.colonies add column if not exists billing_exempt boolean not null default false;
-- only the service role (billing) touches trial_ends_at and billing_exempt: a column-level
-- revoke is a no-op under a table-level grant, so narrow the grant itself
revoke update on public.colonies from authenticated;
grant update (name, steward_id, invite_code, contribution_cents_per_person) on public.colonies to authenticated;

-- ---------- households and members -----------------------------------------
create table if not exists public.households(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now());
create index if not exists households_colony on public.households(colony_id);

create table if not exists public.colony_members(
  colony_id uuid not null references public.colonies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('steward','member')),
  household_id uuid references public.households(id) on delete set null,
  contribution_cents int not null default 0 check (contribution_cents >= 0),
  joined_at timestamptz not null default now(),
  primary key (colony_id, profile_id));
create index if not exists colony_members_profile on public.colony_members(profile_id);
create index if not exists colony_members_household on public.colony_members(household_id);

-- ---------- homes -----------------------------------------------------------
create table if not exists public.homes(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  address text not null default '',
  area text not null default '',
  lat double precision not null default 0,
  lng double precision not null default 0,
  plant_count int not null default 0 check (plant_count >= 0),
  notes text not null default '',
  created_at timestamptz not null default now());
create index if not exists homes_colony on public.homes(colony_id);
create index if not exists homes_household on public.homes(household_id);

-- ---------- providers -------------------------------------------------------
-- colony_id null means marketplace-wide (curated by Colony, visible to every
-- colony). profile_id links a provider to a signed-in account for provider mode.
create table if not exists public.providers(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid references public.colonies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  avatar_url text not null default '',
  bio text not null default '',
  role_line text not null default '',
  area text not null default '',
  lat double precision not null default 0,
  lng double precision not null default 0,
  radius_km double precision not null default 10 check (radius_km >= 0),
  rate_cents int not null default 0 check (rate_cents >= 0),
  rate_unit text not null default 'visit' check (rate_unit in ('visit','hour')),
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  homes_served int not null default 0 check (homes_served >= 0),
  kind text not null check (kind in ('direct','indirect')),
  curated boolean not null default false,
  brought_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now());
create index if not exists providers_colony on public.providers(colony_id);
create index if not exists providers_profile on public.providers(profile_id) where profile_id is not null;
create index if not exists providers_kind on public.providers(kind);

create table if not exists public.provider_skills(
  provider_id uuid not null references public.providers(id) on delete cascade,
  skill text not null check (skill in (
    'cooking','cleaning','laundry','shopping','house_manager','plants',
    'handyman','plumbing','electrical','hvac','pest','sewing','seasonal')),
  is_primary boolean not null default false,
  primary key (provider_id, skill));
create index if not exists provider_skills_skill on public.provider_skills(skill);
-- at most one primary skill per provider
create unique index if not exists provider_skills_one_primary on public.provider_skills(provider_id) where is_primary;

create table if not exists public.provider_availability(
  provider_id uuid not null references public.providers(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  from_t time not null,
  to_t time not null,
  primary key (provider_id, weekday, from_t),
  check (to_t > from_t));

-- ---------- engagements (recurring direct work) ----------------------------
-- cadence is the client's Cadence union verbatim:
--   {"kind":"weekly","days":[1,4],"time":"17:00"}
--   {"kind":"biweekly","day":2,"time":"10:00","anchor":"2026-11-03"}
--   {"kind":"monthly","dayOfMonth":1,"time":"09:00"}
--   {"kind":"once","date":"2026-11-20","time":"14:00"}
create table if not exists public.engagements(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  skill text not null check (skill in (
    'cooking','cleaning','laundry','shopping','house_manager','plants',
    'handyman','plumbing','electrical','hvac','pest','sewing','seasonal')),
  cadence jsonb not null check (cadence ? 'kind' and cadence->>'kind' in ('weekly','biweekly','monthly','once')),
  home_ids uuid[] not null default '{}',
  cost_cents int not null default 0 check (cost_cents >= 0),
  fund text not null default 'direct' check (fund in ('direct','indirect')),
  starts_on date not null default current_date,
  label text not null default '',
  duration_min int not null default 60 check (duration_min > 0),
  created_at timestamptz not null default now());
create index if not exists engagements_colony on public.engagements(colony_id);
create index if not exists engagements_provider on public.engagements(provider_id);

-- ---------- schedule --------------------------------------------------------
create table if not exists public.schedule_items(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  need_id uuid,   -- fk added below, after needs exists
  provider_id uuid not null references public.providers(id) on delete cascade,
  home_id uuid not null references public.homes(id) on delete cascade,
  on_date date not null,
  start_t time not null,
  end_t time not null,
  kind text not null check (kind in ('meal','clean','laundry','plants','maintenance','seasonal','shopping','visit')),
  title text not null default '',
  status text not null default 'planned' check (status in ('planned','done','skipped')),
  created_at timestamptz not null default now());
create index if not exists schedule_colony_date on public.schedule_items(colony_id, on_date);
create index if not exists schedule_provider_date on public.schedule_items(provider_id, on_date);
create index if not exists schedule_engagement on public.schedule_items(engagement_id);

create table if not exists public.meals(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  on_date date not null,
  title text not null,
  cuisine text not null default '',
  chef_id uuid not null references public.providers(id) on delete cascade,
  home_ids uuid[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'planned' check (status in ('planned','served')));
create index if not exists meals_colony_date on public.meals(colony_id, on_date);
create index if not exists meals_schedule_item on public.meals(schedule_item_id);

-- ---------- needs, matches, tasks ------------------------------------------
create table if not exists public.needs(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  home_id uuid not null references public.homes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  note text not null default '',
  category text not null check (category in (
    'cooking','cleaning','laundry','shopping','house_manager','plants',
    'handyman','plumbing','electrical','hvac','pest','sewing','seasonal')),
  urgency text not null default 'whenever' check (urgency in ('whenever','this_week','soon','urgent')),
  status text not null default 'open' check (status in ('open','matching','matched','scheduled','done')),
  created_at timestamptz not null default now());
create index if not exists needs_colony_status on public.needs(colony_id, status);
create index if not exists needs_created_by on public.needs(created_by);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'schedule_items_need_fk') then
    alter table public.schedule_items
      add constraint schedule_items_need_fk foreign key (need_id) references public.needs(id) on delete set null;
  end if;
end $$;

create table if not exists public.matches(
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  score int not null default 0 check (score between 0 and 100),
  reasons text[] not null default '{}',
  quote_cents int not null default 0 check (quote_cents >= 0),
  earliest date not null,
  status text not null default 'suggested' check (status in ('suggested','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (need_id, provider_id));
create index if not exists matches_need on public.matches(need_id);
create index if not exists matches_provider on public.matches(provider_id);

create table if not exists public.tasks(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  title text not null,
  category text not null check (category in (
    'cooking','cleaning','laundry','shopping','house_manager','plants',
    'handyman','plumbing','electrical','hvac','pest','sewing','seasonal')),
  home_id uuid references public.homes(id) on delete set null,
  status text not null default 'queued' check (status in ('handled','scheduled','queued','needs_you')),
  handled_by uuid references public.providers(id) on delete set null,
  due_on date not null,
  source text not null default 'member' check (source in ('seasonal','maintenance','member','provider','match')),
  need_id uuid references public.needs(id) on delete set null,
  note text,
  created_at timestamptz not null default now());
create index if not exists tasks_colony_due on public.tasks(colony_id, due_on);
create index if not exists tasks_need on public.tasks(need_id);

-- ---------- budget ----------------------------------------------------------
create table if not exists public.budget_periods(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  contribution_cents int not null default 0,
  direct_cents int not null default 0,
  leftover_cents int not null default 0,       -- contribution minus direct, can be negative (flagged, never rolled)
  rollover_in_cents int not null default 0,    -- what actually entered the pool when the month closed
  indirect_cents int not null default 0,       -- pool spend during the month
  closed_at date,
  unique (colony_id, month));

create table if not exists public.ledger(
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  on_date date not null,
  kind text not null check (kind in ('contribution','direct','indirect','rollover_in','membership')),
  cents int not null check (cents >= 0),       -- positive amounts; kind says the direction
  provider_id uuid references public.providers(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now());
create index if not exists ledger_colony_month on public.ledger(colony_id, month);
create index if not exists ledger_colony_kind on public.ledger(colony_id, kind);

-- The indirect pool: everything that rolled in minus everything spent from it.
-- The ledger is the book of record; budget_periods is the monthly summary.
create or replace function public.pool_balance(cid uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case l.kind when 'rollover_in' then l.cents when 'indirect' then -l.cents else 0 end), 0)::bigint
    from ledger l where l.colony_id = cid
$$;

-- ============================================================================
--  Billing: flat $149 per colony per month, Stripe subscription, no cut of
--  provider pay. Mirrors Collide q96 with a colony_ prefix.
-- ============================================================================

-- livemode switch (flip to `select true` at go-live)
create or replace function public.colony_billing_livemode() returns boolean
language sql immutable as $$ select false $$;

create table if not exists public.colony_billing_customers(
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  livemode boolean not null default false,
  created_at timestamptz not null default now());

create table if not exists public.colony_subscriptions(
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null unique,
  colony_id uuid not null references public.colonies(id) on delete cascade,
  payer_id uuid not null references public.profiles(id) on delete cascade,   -- the steward who checked out
  status text not null,   -- stripe verbatim
  stripe_price_id text,
  unit_amount_cents int,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index if not exists colony_subs_payer on public.colony_subscriptions(payer_id);
create index if not exists colony_subs_colony on public.colony_subscriptions(colony_id);
-- one live subscription per colony
create unique index if not exists colony_subs_one_live on public.colony_subscriptions(colony_id)
  where status not in ('canceled','incomplete_expired');

create table if not exists public.colony_webhook_events(
  id text primary key,
  type text not null,
  livemode boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  payload jsonb);

-- entitlement
create or replace function public.colony_sub_live(st text, period_end timestamptz) returns boolean
language sql immutable as $$
  select st in ('active','trialing')
      or (st in ('past_due','unpaid') and coalesce(period_end, now()) + interval '7 days' > now())
$$;

create or replace function public.colony_active(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from colonies c where c.id = cid
                   and (c.billing_exempt or c.trial_ends_at + interval '7 days' > now()))
      or exists (select 1 from colony_subscriptions s where s.colony_id = cid
                   and colony_sub_live(s.status, s.current_period_end) and s.livemode = colony_billing_livemode())
$$;

-- colony_entitlements(cid) lives after the RLS helpers below: it calls is_colony_member.

-- ============================================================================
--  RLS helpers (SECURITY DEFINER, stable, search_path pinned) so policies
--  never recurse into the tables they guard.
-- ============================================================================
create or replace function public.is_colony_member(cid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select cid is not null and uid is not null and exists(
    select 1 from colony_members m where m.colony_id=cid and m.profile_id=uid);
$$;

create or replace function public.is_colony_steward(cid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select cid is not null and uid is not null and exists(
    select 1 from colonies c where c.id=cid and c.steward_id=uid);
$$;

-- A provider account counts as "in the colony" once it has an engagement
-- there or an accepted match on one of its needs.
create or replace function public.is_colony_provider(cid uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select cid is not null and uid is not null and exists(
    select 1 from providers p
     where p.profile_id = uid
       and (exists(select 1 from engagements e where e.provider_id = p.id and e.colony_id = cid)
         or exists(select 1 from matches mt join needs n on n.id = mt.need_id
                    where mt.provider_id = p.id and mt.status = 'accepted' and n.colony_id = cid)));
$$;

-- Two profiles share at least one colony (used for profile visibility).
create or replace function public.shares_colony(other uuid, uid uuid default auth.uid())
returns boolean language sql security definer stable set search_path=public as $$
  select other is not null and uid is not null and (other = uid or exists(
    select 1 from colony_members a join colony_members b on a.colony_id = b.colony_id
     where a.profile_id = uid and b.profile_id = other));
$$;

-- Colony of a need, for policies on tables that hang off needs (matches).
create or replace function public.need_colony(nid uuid)
returns uuid language sql security definer stable set search_path=public as $$
  select colony_id from needs where id = nid;
$$;

-- Join by invite code: inserts the caller as a member and returns the colony id.
create or replace function public.join_colony(code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  select id into cid from colonies where invite_code = upper(trim(code));
  if cid is null then raise exception 'invite_code'; end if;
  insert into colony_members(colony_id, profile_id, role, contribution_cents)
    values (cid, auth.uid(), 'member', (select contribution_cents_per_person from colonies where id = cid))
    on conflict do nothing;
  return cid;
end $$;

-- Membership state for one colony as the client's Membership shape expects it.
-- Returns null when the caller is not a member of that colony.
create or replace function public.colony_entitlements(cid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_colony_member(cid) then jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'steward', c.steward_id = auth.uid(),
    'exempt', c.billing_exempt,
    'trial_ends_at', c.trial_ends_at,
    'active', colony_active(c.id),
    'plan', 'colony',
    'sub', (select jsonb_build_object('status', s.status, 'period_end', s.current_period_end,
                                      'cancel_at_period_end', s.cancel_at_period_end,
                                      'unit_amount_cents', s.unit_amount_cents, 'payer', s.payer_id = auth.uid())
              from colony_subscriptions s where s.colony_id = c.id
               and s.status not in ('canceled','incomplete_expired') and s.livemode = colony_billing_livemode()
              order by s.updated_at desc limit 1),
    'livemode', colony_billing_livemode()) end
    from colonies c where c.id = cid
$$;

grant execute on function public.pool_balance(uuid) to authenticated;
grant execute on function public.colony_active(uuid) to authenticated;
grant execute on function public.colony_entitlements(uuid) to authenticated;
grant execute on function public.is_colony_member(uuid, uuid) to authenticated;
grant execute on function public.is_colony_steward(uuid, uuid) to authenticated;
grant execute on function public.is_colony_provider(uuid, uuid) to authenticated;
grant execute on function public.shares_colony(uuid, uuid) to authenticated;
grant execute on function public.need_colony(uuid) to authenticated;
grant execute on function public.join_colony(text) to authenticated;

-- ============================================================================
--  RLS: enable on every table, then policies.
--  Members read everything in their colony. The steward writes structure and
--  budget. Any member writes needs and tasks. Providers read and update the
--  status of their own schedule items. Billing is read-only for the payer and
--  the steward. Webhook events have no policies (service role only).
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.colonies enable row level security;
alter table public.households enable row level security;
alter table public.colony_members enable row level security;
alter table public.homes enable row level security;
alter table public.providers enable row level security;
alter table public.provider_skills enable row level security;
alter table public.provider_availability enable row level security;
alter table public.engagements enable row level security;
alter table public.schedule_items enable row level security;
alter table public.meals enable row level security;
alter table public.needs enable row level security;
alter table public.matches enable row level security;
alter table public.tasks enable row level security;
alter table public.budget_periods enable row level security;
alter table public.ledger enable row level security;
alter table public.colony_billing_customers enable row level security;
alter table public.colony_subscriptions enable row level security;
alter table public.colony_webhook_events enable row level security;   -- no policies: service role only

-- ---------- profiles: you, and people who share a colony with you ----------
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select to authenticated using (shares_colony(id));
drop policy if exists profiles_ins on public.profiles;
create policy profiles_ins on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- (no delete: profiles go away with auth.users)

-- ---------- colonies: members read, anyone creates one they steward, steward updates ----------
drop policy if exists colonies_sel on public.colonies;
create policy colonies_sel on public.colonies for select to authenticated
  using (is_colony_member(id) or is_colony_provider(id));
drop policy if exists colonies_ins on public.colonies;
create policy colonies_ins on public.colonies for insert to authenticated with check (steward_id = auth.uid());
drop policy if exists colonies_upd on public.colonies;
create policy colonies_upd on public.colonies for update to authenticated
  using (is_colony_steward(id)) with check (is_colony_steward(id) and steward_id = auth.uid());
-- (no delete from the client)

-- ---------- colony_members: steward manages, members leave, join via join_colony() ----------
drop policy if exists members_sel on public.colony_members;
create policy members_sel on public.colony_members for select to authenticated using (is_colony_member(colony_id));
drop policy if exists members_ins on public.colony_members;
create policy members_ins on public.colony_members for insert to authenticated with check (is_colony_steward(colony_id));
drop policy if exists members_upd on public.colony_members;
create policy members_upd on public.colony_members for update to authenticated
  using (is_colony_steward(colony_id) or profile_id = auth.uid())
  with check (is_colony_steward(colony_id) or (profile_id = auth.uid() and role = 'member'));
drop policy if exists members_del on public.colony_members;
create policy members_del on public.colony_members for delete to authenticated
  using (is_colony_steward(colony_id) or profile_id = auth.uid());

-- ---------- households and homes: members read, steward writes ----------
drop policy if exists households_sel on public.households;
create policy households_sel on public.households for select to authenticated using (is_colony_member(colony_id));
drop policy if exists households_ins on public.households;
create policy households_ins on public.households for insert to authenticated with check (is_colony_steward(colony_id));
drop policy if exists households_upd on public.households;
create policy households_upd on public.households for update to authenticated
  using (is_colony_steward(colony_id)) with check (is_colony_steward(colony_id));
drop policy if exists households_del on public.households;
create policy households_del on public.households for delete to authenticated using (is_colony_steward(colony_id));

drop policy if exists homes_sel on public.homes;
create policy homes_sel on public.homes for select to authenticated
  using (is_colony_member(colony_id) or is_colony_provider(colony_id));
drop policy if exists homes_ins on public.homes;
create policy homes_ins on public.homes for insert to authenticated with check (is_colony_steward(colony_id));
drop policy if exists homes_upd on public.homes;
create policy homes_upd on public.homes for update to authenticated
  using (is_colony_steward(colony_id)) with check (is_colony_steward(colony_id));
drop policy if exists homes_del on public.homes;
create policy homes_del on public.homes for delete to authenticated using (is_colony_steward(colony_id));

-- ---------- providers: colony rows to members, marketplace rows to everyone signed in ----------
drop policy if exists providers_sel on public.providers;
create policy providers_sel on public.providers for select to authenticated
  using (colony_id is null or is_colony_member(colony_id) or profile_id = auth.uid());
-- any member brings someone into their colony; steward edits or removes them;
-- a provider account edits its own row
drop policy if exists providers_ins on public.providers;
create policy providers_ins on public.providers for insert to authenticated
  with check (colony_id is not null and is_colony_member(colony_id) and brought_by = auth.uid());
drop policy if exists providers_upd on public.providers;
create policy providers_upd on public.providers for update to authenticated
  using (profile_id = auth.uid() or (colony_id is not null and is_colony_steward(colony_id)))
  with check (profile_id = auth.uid() or (colony_id is not null and is_colony_steward(colony_id)));
drop policy if exists providers_del on public.providers;
create policy providers_del on public.providers for delete to authenticated
  using (colony_id is not null and is_colony_steward(colony_id));

-- skills and availability follow the provider row; the provider edits their own availability
drop policy if exists pskills_sel on public.provider_skills;
create policy pskills_sel on public.provider_skills for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id));
drop policy if exists pskills_write on public.provider_skills;
create policy pskills_write on public.provider_skills for all to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id
                  and (p.profile_id = auth.uid() or (p.colony_id is not null and is_colony_steward(p.colony_id)))))
  with check (exists (select 1 from public.providers p where p.id = provider_id
                  and (p.profile_id = auth.uid() or (p.colony_id is not null and is_colony_steward(p.colony_id)))));

drop policy if exists pavail_sel on public.provider_availability;
create policy pavail_sel on public.provider_availability for select to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id));
drop policy if exists pavail_write on public.provider_availability;
create policy pavail_write on public.provider_availability for all to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id
                  and (p.profile_id = auth.uid() or (p.colony_id is not null and is_colony_steward(p.colony_id)))))
  with check (exists (select 1 from public.providers p where p.id = provider_id
                  and (p.profile_id = auth.uid() or (p.colony_id is not null and is_colony_steward(p.colony_id)))));

-- ---------- engagements: members read, steward writes, provider sees their own ----------
drop policy if exists engagements_sel on public.engagements;
create policy engagements_sel on public.engagements for select to authenticated
  using (is_colony_member(colony_id)
      or exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()));
drop policy if exists engagements_ins on public.engagements;
create policy engagements_ins on public.engagements for insert to authenticated with check (is_colony_steward(colony_id));
drop policy if exists engagements_upd on public.engagements;
create policy engagements_upd on public.engagements for update to authenticated
  using (is_colony_steward(colony_id)) with check (is_colony_steward(colony_id));
drop policy if exists engagements_del on public.engagements;
create policy engagements_del on public.engagements for delete to authenticated using (is_colony_steward(colony_id));

-- ---------- schedule_items: members read; providers read their own and update status only ----------
-- The engine (service role) generates the month. From the client only `status`
-- is updatable: the column grant below narrows every policy on this table.
drop policy if exists sched_sel on public.schedule_items;
create policy sched_sel on public.schedule_items for select to authenticated
  using (is_colony_member(colony_id)
      or exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()));
drop policy if exists sched_ins on public.schedule_items;
create policy sched_ins on public.schedule_items for insert to authenticated with check (is_colony_steward(colony_id));
drop policy if exists sched_upd on public.schedule_items;
create policy sched_upd on public.schedule_items for update to authenticated
  using (is_colony_member(colony_id)
      or exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()))
  with check (is_colony_member(colony_id)
      or exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()));
drop policy if exists sched_del on public.schedule_items;
create policy sched_del on public.schedule_items for delete to authenticated using (is_colony_steward(colony_id));
revoke update on public.schedule_items from authenticated;
grant update (status) on public.schedule_items to authenticated;

-- ---------- meals: members read, steward writes, chef sees their own ----------
drop policy if exists meals_sel on public.meals;
create policy meals_sel on public.meals for select to authenticated
  using (is_colony_member(colony_id)
      or exists (select 1 from public.providers p where p.id = chef_id and p.profile_id = auth.uid()));
drop policy if exists meals_write on public.meals;
create policy meals_write on public.meals for all to authenticated
  using (is_colony_steward(colony_id)) with check (is_colony_steward(colony_id));

-- ---------- needs: members read; any member asks; you edit your own; steward closes any ----------
drop policy if exists needs_sel on public.needs;
create policy needs_sel on public.needs for select to authenticated using (is_colony_member(colony_id));
drop policy if exists needs_ins on public.needs;
create policy needs_ins on public.needs for insert to authenticated
  with check (is_colony_member(colony_id) and created_by = auth.uid());
drop policy if exists needs_upd on public.needs;
create policy needs_upd on public.needs for update to authenticated
  using (is_colony_member(colony_id) and (created_by = auth.uid() or is_colony_steward(colony_id)))
  with check (is_colony_member(colony_id));
drop policy if exists needs_del on public.needs;
create policy needs_del on public.needs for delete to authenticated
  using (created_by = auth.uid() or is_colony_steward(colony_id));

-- ---------- matches: members read; written by the service role (colony-match); accept by status update ----------
drop policy if exists matches_sel on public.matches;
create policy matches_sel on public.matches for select to authenticated
  using (is_colony_member(need_colony(need_id))
      or exists (select 1 from public.providers p where p.id = provider_id and p.profile_id = auth.uid()));
drop policy if exists matches_upd on public.matches;
create policy matches_upd on public.matches for update to authenticated
  using (is_colony_member(need_colony(need_id))) with check (is_colony_member(need_colony(need_id)));
revoke update on public.matches from authenticated;
grant update (status) on public.matches to authenticated;
-- (no insert or delete from the client)

-- ---------- tasks: members read and write; steward deletes ----------
drop policy if exists tasks_sel on public.tasks;
create policy tasks_sel on public.tasks for select to authenticated
  using (is_colony_member(colony_id)
      or exists (select 1 from public.providers p where p.id = handled_by and p.profile_id = auth.uid()));
drop policy if exists tasks_ins on public.tasks;
create policy tasks_ins on public.tasks for insert to authenticated with check (is_colony_member(colony_id));
drop policy if exists tasks_upd on public.tasks;
create policy tasks_upd on public.tasks for update to authenticated
  using (is_colony_member(colony_id)) with check (is_colony_member(colony_id));
drop policy if exists tasks_del on public.tasks;
create policy tasks_del on public.tasks for delete to authenticated using (is_colony_steward(colony_id));

-- ---------- budget_periods and ledger: members read, steward writes ----------
drop policy if exists periods_sel on public.budget_periods;
create policy periods_sel on public.budget_periods for select to authenticated using (is_colony_member(colony_id));
drop policy if exists periods_write on public.budget_periods;
create policy periods_write on public.budget_periods for all to authenticated
  using (is_colony_steward(colony_id)) with check (is_colony_steward(colony_id));

drop policy if exists ledger_sel on public.ledger;
create policy ledger_sel on public.ledger for select to authenticated using (is_colony_member(colony_id));
drop policy if exists ledger_write on public.ledger;
create policy ledger_write on public.ledger for all to authenticated
  using (is_colony_steward(colony_id)) with check (is_colony_steward(colony_id));

-- ---------- billing: read-only for users; only the service role writes ----------
drop policy if exists colony_bc_sel on public.colony_billing_customers;
create policy colony_bc_sel on public.colony_billing_customers for select to authenticated using (profile_id = auth.uid());

drop policy if exists colony_subs_sel on public.colony_subscriptions;
create policy colony_subs_sel on public.colony_subscriptions for select to authenticated
  using (payer_id = auth.uid() or is_colony_steward(colony_id));

-- ============================================================================
--  Realtime: the tables the client watches for live updates.
-- ============================================================================
do $$ begin
  alter publication supabase_realtime add table public.schedule_items;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.needs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;

select 'colony schema applied';
