-- q96 (2026-09-10): Collide's own Stripe account — Maker $5/mo + Facilitator $25/mo.
-- Additive. Trial defaults + exempt backfill mean nothing disappears on apply.
-- Apply in the Supabase SQL editor (project pjxvvwcnjjizdtiutpxd), then append
-- this block to mobile_compat.sql as the migration log.

-- ---------- livemode switch (flip to `select true` at go-live) ----------
create or replace function public.billing_livemode() returns boolean
language sql immutable as $$ select false $$;

-- ---------- tables ----------
create table if not exists public.billing_customers(
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  livemode boolean not null default false,
  created_at timestamptz not null default now());

create table if not exists public.subscriptions(
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,      -- payer
  plan text not null check (plan in ('maker','facilitator')),
  community_id uuid references public.communities(id) on delete cascade,          -- facilitator only
  status text not null,   -- stripe verbatim
  stripe_price_id text,
  unit_amount_cents int,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((plan = 'maker' and community_id is null) or (plan = 'facilitator' and community_id is not null)));
create index if not exists subs_profile on public.subscriptions(profile_id);
create index if not exists subs_comm on public.subscriptions(community_id) where community_id is not null;
create unique index if not exists subs_one_maker on public.subscriptions(profile_id)
  where plan = 'maker' and status not in ('canceled','incomplete_expired');
create unique index if not exists subs_one_fac on public.subscriptions(community_id)
  where plan = 'facilitator' and status not in ('canceled','incomplete_expired');

create table if not exists public.webhook_events(
  id text primary key,
  type text not null,
  livemode boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  payload jsonb);

alter table public.communities add column if not exists facilitator_trial_ends_at timestamptz not null default now() + interval '3 months';
alter table public.communities add column if not exists billing_exempt boolean not null default false;
update public.communities set billing_exempt = true
 where city = 'global'
    or owner_id in (select s.profile_id from public.staff s where s.role = 'owner' and s.community_id is null and s.profile_id is not null);
revoke update (facilitator_trial_ends_at, billing_exempt) on public.communities from authenticated;

-- ---------- RLS: read-only for users; only the service role writes ----------
alter table public.billing_customers enable row level security;
drop policy if exists bc_sel on public.billing_customers;
create policy bc_sel on public.billing_customers for select to authenticated using (profile_id = auth.uid());

alter table public.subscriptions enable row level security;
drop policy if exists subs_sel on public.subscriptions;
create policy subs_sel on public.subscriptions for select to authenticated
  using (profile_id = auth.uid()
      or (community_id is not null and (
            exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid())
            or public.is_staff(community_id))));

alter table public.webhook_events enable row level security;   -- no policies: service role only

-- ---------- entitlement ----------
create or replace function public.sub_live(st text, period_end timestamptz) returns boolean
language sql immutable as $$
  select st in ('active','trialing')
      or (st in ('past_due','unpaid') and coalesce(period_end, now()) + interval '7 days' > now())
$$;

create or replace function public.ed_maker_active(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from makers m where m.profile_id = pid and m.active
                   and (m.trial_ends_at is null or m.trial_ends_at + interval '7 days' > now()))
      or exists (select 1 from subscriptions s where s.plan = 'maker' and s.profile_id = pid
                   and sub_live(s.status, s.current_period_end) and s.livemode = billing_livemode())
$$;

create or replace function public.ed_facilitator_active(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from communities c where c.id = cid
                   and (c.billing_exempt or c.facilitator_trial_ends_at + interval '7 days' > now()))
      or exists (select 1 from subscriptions s where s.plan = 'facilitator' and s.community_id = cid
                   and sub_live(s.status, s.current_period_end) and s.livemode = billing_livemode())
$$;

create or replace function public.ed_entitlements() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'maker', (select jsonb_build_object(
                'has_row', m.profile_id is not null,
                'listed', coalesce(m.active, false),
                'active', ed_maker_active(auth.uid()),
                'trial_ends_at', m.trial_ends_at,
                'sub', (select jsonb_build_object('status', s.status, 'period_end', s.current_period_end,
                                                  'cancel_at_period_end', s.cancel_at_period_end)
                          from subscriptions s where s.plan = 'maker' and s.profile_id = auth.uid()
                           and s.status not in ('canceled','incomplete_expired') and s.livemode = billing_livemode()
                          order by s.updated_at desc limit 1))
              from (select auth.uid() uid) u left join makers m on m.profile_id = u.uid),
    'communities', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', c.id, 'name', c.name, 'owner', c.owner_id = auth.uid(),
                'exempt', c.billing_exempt, 'trial_ends_at', c.facilitator_trial_ends_at,
                'active', ed_facilitator_active(c.id),
                'sub', (select jsonb_build_object('status', s.status, 'period_end', s.current_period_end,
                                                  'cancel_at_period_end', s.cancel_at_period_end)
                          from subscriptions s where s.plan = 'facilitator' and s.community_id = c.id
                           and s.status not in ('canceled','incomplete_expired') and s.livemode = billing_livemode()
                          order by s.updated_at desc limit 1))), '[]'::jsonb)
              from communities c
             where c.archived_at is null and (c.owner_id = auth.uid() or is_staff(c.id))),
    'livemode', billing_livemode())
$$;
grant execute on function public.ed_entitlements() to authenticated;
grant execute on function public.ed_maker_active(uuid) to authenticated;
grant execute on function public.ed_facilitator_active(uuid) to authenticated;

-- ---------- consumers ----------
-- directory_listings v3: entitlement predicates replace the raw trial check (same signature as q65)
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
   where m.active and ed_maker_active(m.profile_id)
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
      and ed_facilitator_active(c.id)
      and not exists(select 1 from facilitators fx where fx.profile_id=p.id and fx.community_id=c.id and not fx.active)
    order by p.id, (f.profile_id is null)
  ) fac
$f$;
grant execute on function public.directory_listings() to authenticated;

-- no new facilitator listings on a lapsed room (existing ones just hide until renewed)
drop policy if exists fac_ins on public.facilitators;
create policy fac_ins on public.facilitators for insert
  with check (profile_id = auth.uid() and ed_can_facilitate(community_id) and ed_facilitator_active(community_id));

-- ---------- admin KPIs: real MRR ----------
-- Re-create platform_kpis() body from collide-admin/platform_kpis.sql with the mrr block replaced by:
--   'mrr_cents', (select coalesce(sum(unit_amount_cents),0) from subscriptions where sub_live(status,current_period_end) and livemode = billing_livemode()),
--   'active_subs', (select count(*) from subscriptions where sub_live(status,current_period_end) and livemode = billing_livemode()),
--   'trialing_makers', (select count(*) from subscriptions where plan='maker' and status='trialing' and livemode = billing_livemode()),
--   'past_due', (select count(*) from subscriptions where status in ('past_due','unpaid') and livemode = billing_livemode()),
--   'ledger_month_cents', (select coalesce(sum(amount_cents),0) from ledger where happened_on >= date_trunc('month', now())::date)
-- (kept as a comment here because platform_kpis() lives in the admin repo; see collide-admin/platform_kpis.sql)

-- ---------- nightly reconcile (fill in the secret at apply time) ----------
create extension if not exists pg_cron;
select cron.unschedule('billing-reconcile') where exists (select 1 from cron.job where jobname = 'billing-reconcile');
select cron.schedule('billing-reconcile', '10 4 * * *', $$
  select net.http_post(
    url := 'https://pjxvvwcnjjizdtiutpxd.supabase.co/functions/v1/billing',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-secret', '__BILLING_SECRET__'),
    body := '{"mode":"reconcile"}'::jsonb)
$$);

select 'q96 billing migrated';
