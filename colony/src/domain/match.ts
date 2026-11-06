// Smart match: who should come, scored on skill, distance, availability, budget and trust.
// Deterministic: the same need and state always suggest the same people in the same order.
import type { CatalogItem, ColonyState, DateStr, Home, Match, Need, Person, Provider, ScheduleItem, Skill, Urgency } from "@/domain/types";
import { WEEKDAY_LONG, addDays, daysBetween, monthOf, partOfDay, weekdayOf } from "@/domain/dates";
import { fmt } from "@/domain/money";
import { leftover, poolBalance } from "@/domain/budget";
import { CATALOG } from "@/seed/catalog";

export interface MatchContext {
  home: Home;
  people: Person[];
  schedule: ScheduleItem[];
  catalog: CatalogItem[];
  poolBalanceCents: number;
  monthlyLeftoverCents: number;
  today: DateStr;
}

export interface ScoreBreakdown {
  total: number;
  skill: number;
  distance: number;
  availability: number;
  budget: number;
  trust: number;
  distanceKm: number;
  quoteCents: number;
  earliest: DateStr;
}

/** A primary skill that reasonably covers a neighbouring need. */
export const ADJACENT: Partial<Record<Skill, Skill[]>> = {
  handyman: ["plumbing", "electrical", "seasonal"],
  seasonal: ["handyman"],
};

export const URGENCY_WINDOW_DAYS: Record<Urgency, number> = {
  urgent: 2,
  soon: 7,
  this_week: 7,
  whenever: 30,
};

const FALLBACK_EARLIEST_DAYS = 30;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export function skillScore(need: Need, provider: Provider): number {
  if (provider.primary === need.category) return 40;
  if (provider.skills.includes(need.category)) return 20;
  if (ADJACENT[provider.primary]?.includes(need.category)) return 20;
  return 0;
}

export function catalogItemFor(category: Skill, catalog: CatalogItem[], title?: string): CatalogItem | undefined {
  const same = catalog.filter((c) => c.skill === category);
  if (!same.length) return undefined;
  if (title) {
    const words = title.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const hit = same.find((c) => words.some((w) => c.title.toLowerCase().includes(w)));
    if (hit) return hit;
  }
  return same[0];
}

/** Rate times the typical hours of the matching catalog item, or two hours, or one visit. */
export function quoteFor(need: Need, provider: Provider, catalog: CatalogItem[] = CATALOG): number {
  if (provider.rateUnit === "visit") return provider.rateCents;
  const item = catalogItemFor(need.category, catalog, need.title);
  const hours = item ? item.typicalHours : 2;
  return Math.round(provider.rateCents * hours);
}

/** The next day after `from` the provider has a window. Falls back to a month out when they list none. */
export function earliestFor(_need: Need, provider: Provider, from: DateStr): DateStr {
  if (!provider.availability.length) return addDays(from, FALLBACK_EARLIEST_DAYS);
  for (let i = 1; i <= 62; i++) {
    const d = addDays(from, i);
    const wd = weekdayOf(d);
    if (provider.availability.some((w) => w.day === wd)) return d;
  }
  return addDays(from, FALLBACK_EARLIEST_DAYS);
}

export function servesColony(provider: Provider, schedule: ScheduleItem[]): boolean {
  return schedule.some((x) => x.providerId === provider.id);
}

/** Null when the provider is out of the running: no fitting skill, or too far. */
export function scoreMatch(need: Need, provider: Provider, ctx: MatchContext): ScoreBreakdown | null {
  const skill = skillScore(need, provider);
  if (skill === 0) return null;

  const distanceKm = haversineKm(provider, ctx.home);
  let distance: number;
  if (distanceKm < 3) distance = 20;
  else if (distanceKm < 8) distance = 12;
  else if (distanceKm <= provider.radiusKm) distance = 4;
  else return null;

  const earliest = earliestFor(need, provider, ctx.today);
  const availability = daysBetween(ctx.today, earliest) <= URGENCY_WINDOW_DAYS[need.urgency] ? 15 : 0;

  const quoteCents = quoteFor(need, provider, ctx.catalog);
  const budget = quoteCents <= ctx.poolBalanceCents ? 15 : quoteCents <= ctx.poolBalanceCents + ctx.monthlyLeftoverCents ? 8 : 0;

  let trust = Math.round((provider.rating / 5) * 6);
  if (provider.broughtBy && ctx.people.some((p) => p.id === provider.broughtBy)) trust += 2;
  if (servesColony(provider, ctx.schedule)) trust += 2;
  trust = Math.min(trust, 10);

  return { total: skill + distance + availability + budget + trust, skill, distance, availability, budget, trust, distanceKm, quoteCents, earliest };
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** Two or three short reasons, the strongest first. */
export function reasonsFor(need: Need, provider: Provider, ctx: MatchContext, score: ScoreBreakdown): string[] {
  const out: string[] = [];
  const by = provider.broughtBy ? ctx.people.find((p) => p.id === provider.broughtBy) : undefined;
  if (by) out.push(`Brought in by ${firstName(by.name)}`);
  else if (servesColony(provider, ctx.schedule)) out.push(`Already comes to ${ctx.home.label}`);
  else out.push(`Serves ${provider.homesServed} homes in ${provider.area}`);

  const wd = weekdayOf(score.earliest);
  const window = provider.availability.find((w) => w.day === wd);
  if (window) {
    const within = daysBetween(ctx.today, score.earliest) <= URGENCY_WINDOW_DAYS[need.urgency];
    out.push(within ? `Free ${WEEKDAY_LONG[wd]} ${partOfDay(window.from)}` : `Next free ${WEEKDAY_LONG[wd]} ${partOfDay(window.from)}`);
  }

  if (score.budget === 15) out.push(`Pool covers it with ${fmt(ctx.poolBalanceCents - score.quoteCents)} to spare`);
  else if (score.budget === 8) out.push("Pool covers it next month");
  else out.push("A stretch for the pool right now");

  if (out.length < 3 && score.distanceKm < 3) out.push(`Minutes from ${ctx.home.label}`);
  if (out.length < 3 && by) out.push(`Serves ${provider.homesServed} homes in ${provider.area}`);
  return out.slice(0, 3);
}

export function contextFor(need: Need, state: ColonyState, catalog: CatalogItem[] = CATALOG): MatchContext {
  const home = state.homes.find((h) => h.id === need.homeId) ?? state.homes[0];
  if (!home) throw new Error("A need must point at a home");
  const month = monthOf(state.meta.simToday);
  return {
    home,
    people: state.people,
    schedule: state.schedule,
    catalog,
    poolBalanceCents: poolBalance(state),
    monthlyLeftoverCents: leftover(state, month),
    today: state.meta.simToday,
  };
}

export function matchId(needId: string, providerId: string): string {
  return `m_${needId}_${providerId}`;
}

/** The top n providers for a need, best first. Ties break on rating, then id. */
export function suggest(need: Need, state: ColonyState, n = 3, catalog: CatalogItem[] = CATALOG): Match[] {
  const ctx = contextFor(need, state, catalog);
  const scored: { provider: Provider; score: ScoreBreakdown }[] = [];
  for (const provider of state.providers) {
    const score = scoreMatch(need, provider, ctx);
    if (score) scored.push({ provider, score });
  }
  scored.sort((a, b) => b.score.total - a.score.total || b.provider.rating - a.provider.rating || (a.provider.id < b.provider.id ? -1 : 1));
  return scored.slice(0, n).map(({ provider, score }) => ({
    id: matchId(need.id, provider.id),
    needId: need.id,
    providerId: provider.id,
    score: score.total,
    reasons: reasonsFor(need, provider, ctx, score),
    quoteCents: score.quoteCents,
    earliest: score.earliest,
    status: "suggested",
  }));
}
