// SupabaseRepo: the ColonyRepo that reads a colony out of Postgres (see supabase/schema.sql).
// NOT WIRED: the app runs on LocalRepo until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
// load() is real: it fetches every table for the colony and maps rows to ColonyState.
// save() throws on purpose: writes go through actions calling edge functions and row updates,
// never by replaying a whole state blob.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BudgetPeriod, Cadence, Colony, ColonyState, Engagement, Home, Household, LedgerEntry, Match, Meal, Membership,
  MembershipStatus, Need, Person, Provider, ScheduleItem, Skill, Task, Weekday,
} from "@/domain/types";
import type { ColonyRepo } from "./repo";
import type {
  BudgetPeriodRow, ColonyMemberRow, ColonyRow, ColonySubscriptionRow, Database, EngagementRow, HomeRow, HouseholdRow,
  LedgerRow, MatchRow, MealRow, NeedRow, ProfileRow, ProviderAvailabilityRow, ProviderRow, ProviderSkillRow,
  ScheduleItemRow, TaskRow,
} from "./supabase.types";

export type Client = SupabaseClient<Database>;

/** Flat membership per colony. Kept here so this file does not depend on the engine's constants. */
const COLONY_PRICE_CENTS = 14900;

export interface SupabaseEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export function supabaseConfig(env: SupabaseEnv = import.meta.env as SupabaseEnv): { url: string; anonKey: string } | null {
  const url = (env.VITE_SUPABASE_URL ?? "").trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function supabaseConfigured(env: SupabaseEnv = import.meta.env as SupabaseEnv): boolean {
  return supabaseConfig(env) !== null;
}

let shared: Client | null = null;
/** One client per page; null when Supabase is not configured. */
export function getClient(env?: SupabaseEnv): Client | null {
  const cfg = supabaseConfig(env);
  if (!cfg) return null;
  if (!shared) shared = createClient<Database>(cfg.url, cfg.anonKey);
  return shared;
}

/** SupabaseRepo when configured, else null (the caller falls back to LocalRepo). */
export function makeRepo(colonyId?: string): SupabaseRepo | null {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  return new SupabaseRepo(cfg.url, cfg.anonKey, colonyId ?? null);
}

// ---------- row mappers (snake_case rows to the client's camelCase shapes) ----------

const day = (ts: string) => ts.slice(0, 10); // timestamptz or date to YYYY-MM-DD
const hm = (t: string) => t.slice(0, 5); // HH:MM:SS to HH:MM
const todayStr = () => new Date().toISOString().slice(0, 10);

function membershipStatus(sub: ColonySubscriptionRow | null, trialEndsAt: string, today: string): MembershipStatus {
  if (sub) {
    if (sub.status === "active") return "active";
    if (sub.status === "trialing") return "trialing";
    if (sub.status === "past_due" || sub.status === "unpaid") return "past_due";
    return "canceled";
  }
  return day(trialEndsAt) >= today ? "trialing" : "canceled";
}

export function mapMembership(colony: ColonyRow, sub: ColonySubscriptionRow | null, today = todayStr()): Membership {
  const trialEndsAt = day(colony.trial_ends_at);
  return {
    plan: "colony",
    priceCents: sub?.unit_amount_cents ?? COLONY_PRICE_CENTS,
    status: membershipStatus(sub, colony.trial_ends_at, today),
    trialEndsAt,
    periodEnd: sub?.current_period_end ? day(sub.current_period_end) : trialEndsAt,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
  };
}

export function mapColony(row: ColonyRow, sub: ColonySubscriptionRow | null): Colony {
  return {
    id: row.id,
    name: row.name,
    createdAt: day(row.created_at),
    stewardId: row.steward_id,
    inviteCode: row.invite_code,
    contributionCentsPerPerson: row.contribution_cents_per_person,
    membership: mapMembership(row, sub),
  };
}

export function mapPerson(m: ColonyMemberRow, p: ProfileRow | undefined, fallbackHousehold: string): Person {
  return {
    id: m.profile_id,
    name: p?.display_name || "Member",
    avatar: p?.avatar_url ?? "",
    householdId: m.household_id ?? fallbackHousehold,
    role: m.role,
    contributionCents: m.contribution_cents,
  };
}

export function mapHousehold(h: HouseholdRow, homes: HomeRow[], members: ColonyMemberRow[]): Household {
  return {
    id: h.id,
    name: h.name,
    homeId: homes.find((x) => x.household_id === h.id)?.id ?? "",
    personIds: members.filter((m) => m.household_id === h.id).map((m) => m.profile_id),
  };
}

export function mapHome(r: HomeRow): Home {
  return {
    id: r.id,
    householdId: r.household_id,
    label: r.label,
    address: r.address,
    area: r.area,
    lat: Number(r.lat),
    lng: Number(r.lng),
    plantCount: r.plant_count,
    notes: r.notes,
  };
}

export function mapProvider(r: ProviderRow, skills: ProviderSkillRow[], avail: ProviderAvailabilityRow[]): Provider {
  const mine = skills.filter((s) => s.provider_id === r.id);
  const list = mine.map((s) => s.skill as Skill);
  const primary = (mine.find((s) => s.is_primary)?.skill ?? list[0] ?? "handyman") as Skill;
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar_url,
    skills: list.length ? list : [primary],
    primary,
    kind: r.kind,
    bio: r.bio,
    roleLine: r.role_line,
    area: r.area,
    lat: Number(r.lat),
    lng: Number(r.lng),
    radiusKm: Number(r.radius_km),
    rateCents: r.rate_cents,
    rateUnit: r.rate_unit,
    rating: Number(r.rating),
    homesServed: r.homes_served,
    availability: avail
      .filter((a) => a.provider_id === r.id)
      .map((a) => ({ day: a.weekday as Weekday, from: hm(a.from_t), to: hm(a.to_t) })),
    broughtBy: r.brought_by ?? undefined,
    curated: r.curated,
  };
}

/** The cadence column is the client's Cadence union stored verbatim; anything unreadable becomes a one-off. */
export function mapCadence(json: unknown, startsOn: string): Cadence {
  const c = (json ?? {}) as Partial<Record<string, unknown>>;
  const time = typeof c.time === "string" ? c.time : "09:00";
  switch (c.kind) {
    case "weekly":
      return { kind: "weekly", days: (Array.isArray(c.days) ? c.days : []).map((d) => Number(d) as Weekday), time };
    case "biweekly":
      return { kind: "biweekly", day: Number(c.day ?? 1) as Weekday, time, anchor: typeof c.anchor === "string" ? c.anchor : startsOn };
    case "monthly":
      return { kind: "monthly", dayOfMonth: Number(c.dayOfMonth ?? 1), time };
    default:
      return { kind: "once", date: typeof c.date === "string" ? c.date : startsOn, time };
  }
}

export function mapEngagement(r: EngagementRow): Engagement {
  return {
    id: r.id,
    providerId: r.provider_id,
    skill: r.skill,
    cadence: mapCadence(r.cadence, r.starts_on),
    homeIds: r.home_ids,
    costCents: r.cost_cents,
    fund: r.fund,
    startsOn: r.starts_on,
    label: r.label,
    durationMin: r.duration_min,
  };
}

export function mapScheduleItem(r: ScheduleItemRow): ScheduleItem {
  return {
    id: r.id,
    engagementId: r.engagement_id ?? undefined,
    needId: r.need_id ?? undefined,
    providerId: r.provider_id,
    homeId: r.home_id,
    date: r.on_date,
    start: hm(r.start_t),
    end: hm(r.end_t),
    kind: r.kind,
    title: r.title,
    status: r.status,
  };
}

export function mapMeal(r: MealRow): Meal {
  return {
    id: r.id,
    date: r.on_date,
    title: r.title,
    cuisine: r.cuisine,
    chefId: r.chef_id,
    homeIds: r.home_ids,
    tags: r.tags,
    scheduleItemId: r.schedule_item_id,
    status: r.status,
  };
}

export function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    homeId: r.home_id ?? undefined,
    status: r.status,
    handledBy: r.handled_by ?? undefined,
    dueOn: r.due_on,
    source: r.source,
    needId: r.need_id ?? undefined,
    note: r.note ?? undefined,
  };
}

export function mapNeed(r: NeedRow, matches: MatchRow[]): Need {
  return {
    id: r.id,
    title: r.title,
    note: r.note,
    category: r.category,
    homeId: r.home_id,
    urgency: r.urgency,
    status: r.status,
    createdBy: r.created_by,
    createdAt: day(r.created_at),
    matchIds: matches.filter((m) => m.need_id === r.id).map((m) => m.id),
  };
}

export function mapMatch(r: MatchRow): Match {
  return {
    id: r.id,
    needId: r.need_id,
    providerId: r.provider_id,
    score: r.score,
    reasons: r.reasons,
    quoteCents: r.quote_cents,
    earliest: r.earliest,
    status: r.status,
  };
}

export function mapPeriod(r: BudgetPeriodRow): BudgetPeriod {
  return {
    id: r.id,
    month: r.month,
    contributionCents: r.contribution_cents,
    directCents: r.direct_cents,
    leftoverCents: r.leftover_cents,
    rolloverInCents: r.rollover_in_cents,
    indirectCents: r.indirect_cents,
    closedAt: r.closed_at ?? undefined,
  };
}

export function mapLedger(r: LedgerRow): LedgerEntry {
  return {
    id: r.id,
    month: r.month,
    date: r.on_date,
    kind: r.kind,
    cents: r.cents,
    providerId: r.provider_id ?? undefined,
    personId: r.profile_id ?? undefined,
    note: r.note,
  };
}

// ---------- the repo ----------

export class SupabaseRepo implements ColonyRepo {
  readonly client: Client;
  private colonyId: string | null;

  constructor(url: string, anonKey: string, colonyId: string | null = null) {
    this.client = createClient<Database>(url, anonKey);
    this.colonyId = colonyId;
  }

  /** The colony this repo reads: the one given, else the first the signed-in user belongs to. */
  private async resolveColonyId(userId: string | null): Promise<string | null> {
    if (this.colonyId) return this.colonyId;
    if (!userId) return null;
    const { data } = await this.client
      .from("colony_members")
      .select("colony_id")
      .eq("profile_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    this.colonyId = data?.colony_id ?? null;
    return this.colonyId;
  }

  async load(): Promise<ColonyState | null> {
    const sb = this.client;
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id ?? null;
    const cid = await this.resolveColonyId(userId);
    if (!cid) return null;

    const { data: colony, error: cErr } = await sb.from("colonies").select("*").eq("id", cid).maybeSingle();
    if (cErr) throw new Error("colonies: " + cErr.message);
    if (!colony) return null;

    const first = <T>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] => {
      if (res.error) throw new Error(what + ": " + res.error.message);
      return res.data ?? [];
    };

    const [members, households, homes, providers, engagements, schedule, meals, tasks, needs, periods, ledger, subs] =
      await Promise.all([
        sb.from("colony_members").select("*").eq("colony_id", cid),
        sb.from("households").select("*").eq("colony_id", cid),
        sb.from("homes").select("*").eq("colony_id", cid),
        sb.from("providers").select("*").or(`colony_id.eq.${cid},colony_id.is.null`),
        sb.from("engagements").select("*").eq("colony_id", cid),
        sb.from("schedule_items").select("*").eq("colony_id", cid),
        sb.from("meals").select("*").eq("colony_id", cid),
        sb.from("tasks").select("*").eq("colony_id", cid),
        sb.from("needs").select("*").eq("colony_id", cid),
        sb.from("budget_periods").select("*").eq("colony_id", cid).order("month", { ascending: true }),
        sb.from("ledger").select("*").eq("colony_id", cid).order("on_date", { ascending: true }),
        sb.from("colony_subscriptions").select("*").eq("colony_id", cid).not("status", "in", "(canceled,incomplete_expired)")
          .order("updated_at", { ascending: false }).limit(1),
      ]);

    const memberRows = first(members, "colony_members");
    const householdRows = first(households, "households");
    const homeRows = first(homes, "homes");
    const providerRows = first(providers, "providers");
    const needRows = first(needs, "needs");
    const providerIds = providerRows.map((p) => p.id);
    const needIds = needRows.map((n) => n.id);

    const [profiles, skills, avail, matches] = await Promise.all([
      memberRows.length
        ? sb.from("profiles").select("*").in("id", memberRows.map((m) => m.profile_id))
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      providerIds.length
        ? sb.from("provider_skills").select("*").in("provider_id", providerIds)
        : Promise.resolve({ data: [] as ProviderSkillRow[], error: null }),
      providerIds.length
        ? sb.from("provider_availability").select("*").in("provider_id", providerIds)
        : Promise.resolve({ data: [] as ProviderAvailabilityRow[], error: null }),
      needIds.length
        ? sb.from("matches").select("*").in("need_id", needIds)
        : Promise.resolve({ data: [] as MatchRow[], error: null }),
    ]);

    const profileRows = first(profiles, "profiles");
    const skillRows = first(skills, "provider_skills");
    const availRows = first(avail, "provider_availability");
    const matchRows = first(matches, "matches");
    const subRow = first(subs, "colony_subscriptions")[0] ?? null;

    const profileById = new Map(profileRows.map((p) => [p.id, p]));
    const fallbackHousehold = householdRows[0]?.id ?? "";
    const today = todayStr();
    const personaId = userId && memberRows.some((m) => m.profile_id === userId) ? userId : colony.steward_id;

    return {
      colony: mapColony(colony, subRow),
      people: memberRows.map((m) => mapPerson(m, profileById.get(m.profile_id), fallbackHousehold)),
      households: householdRows.map((h) => mapHousehold(h, homeRows, memberRows)),
      homes: homeRows.map(mapHome),
      providers: providerRows.map((p) => mapProvider(p, skillRows, availRows)),
      engagements: first(engagements, "engagements").map(mapEngagement),
      schedule: first(schedule, "schedule_items").map(mapScheduleItem),
      meals: first(meals, "meals").map(mapMeal),
      tasks: first(tasks, "tasks").map(mapTask),
      needs: needRows.map((n) => mapNeed(n, matchRows)),
      matches: matchRows.map(mapMatch),
      periods: first(periods, "budget_periods").map(mapPeriod),
      ledger: first(ledger, "ledger").map(mapLedger),
      meta: {
        seedVersion: 0, // server data is never reseeded
        onboarded: true,
        simToday: today, // the real clock; the demo's time travel is a LocalRepo feature
        persona: { mode: "member", personId: personaId },
      },
    };
  }

  async save(_state: ColonyState): Promise<void> {
    throw new Error("SupabaseRepo.save is not wired yet: writes go through actions calling edge functions");
  }

  async clear(): Promise<void> {
    // Nothing to clear: the server owns the data. Signing out is the auth client's job.
  }
}
