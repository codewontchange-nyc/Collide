// Builds the demo colony, anchored to today: five closed months of history and the open month.
// Deterministic for a given date, so the same day always tells the same story.
import type {
  ColonyState,
  DateStr,
  Engagement,
  Home,
  Household,
  Match,
  MonthStr,
  Need,
  Person,
  Provider,
  ScheduleItem,
  Skill,
  Task,
  Weekday,
} from "@/domain/types";
import { SKILL_LABEL } from "@/domain/types";
import { addDays, addMonths, dateInMonth, firstOfMonth, monthOf, weekdayOf } from "@/domain/dates";
import { cadenceLabel } from "@/domain/cadence";
import { COPY } from "@/domain/copy";
import { MEMBERSHIP_PRICE_CENTS } from "@/domain/membership";
import { closeMonth, openPeriod, spendFromPool } from "@/domain/budget";
import { kindForSkill, mergeMonth } from "@/domain/schedule";
import { ADJACENT, matchId } from "@/domain/match";
import { HISTORY_MONTHS, HOMES, HOUSEHOLDS, PEOPLE, avatarFor, buildColony, startMonth } from "@/seed/people";
import { PROVIDERS } from "@/seed/providers";

export const SEED_VERSION = 1;
export const TRIAL_DAYS = 20;

const BOTH_HOMES = ["home_dekalb", "home_bergen"];

/** First date on or after `from` that falls on the weekday. */
function firstWeekdayFrom(from: DateStr, day: Weekday): DateStr {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (weekdayOf(d) === day) return d;
  }
  return from;
}

export function buildEngagements(createdAt: DateStr): Engagement[] {
  const firstSat = firstWeekdayFrom(createdAt, 6);
  const firstThu = firstWeekdayFrom(createdAt, 4);
  return [
    {
      id: "eng_marisol",
      providerId: "pr_marisol",
      skill: "cooking",
      cadence: { kind: "weekly", days: [1, 4], time: "14:00" },
      homeIds: [...BOTH_HOMES],
      costCents: 20000,
      fund: "direct",
      startsOn: createdAt,
      label: "Dinners, Mon and Thu",
      durationMin: 180,
    },
    {
      id: "eng_lena_dekalb",
      providerId: "pr_lena",
      skill: "cleaning",
      cadence: { kind: "weekly", days: [2], time: "09:00" },
      homeIds: ["home_dekalb"],
      costCents: 14000,
      fund: "direct",
      startsOn: createdAt,
      label: "Cleaning, Tuesdays",
      durationMin: 180,
    },
    {
      id: "eng_lena_bergen",
      providerId: "pr_lena",
      skill: "cleaning",
      cadence: { kind: "weekly", days: [5], time: "09:00" },
      homeIds: ["home_bergen"],
      costCents: 14000,
      fund: "direct",
      startsOn: createdAt,
      label: "Cleaning, Fridays",
      durationMin: 180,
    },
    {
      id: "eng_sam",
      providerId: "pr_sam",
      skill: "laundry",
      cadence: { kind: "weekly", days: [3], time: "08:00" },
      homeIds: [...BOTH_HOMES],
      costCents: 9000,
      fund: "direct",
      startsOn: createdAt,
      label: "Laundry pickup, Wednesdays",
      durationMin: 30,
    },
    {
      id: "eng_jordan",
      providerId: "pr_jordan",
      skill: "house_manager",
      cadence: { kind: "biweekly", day: 6, time: "09:00", anchor: firstSat },
      homeIds: [...BOTH_HOMES],
      costCents: 16000,
      fund: "direct",
      startsOn: createdAt,
      label: "Restock and reset, every other Sat",
      durationMin: 240,
    },
    {
      id: "eng_wren",
      providerId: "pr_wren",
      skill: "plants",
      cadence: { kind: "biweekly", day: 4, time: "09:00", anchor: addDays(firstThu, 7) },
      homeIds: [...BOTH_HOMES],
      costCents: 6000,
      fund: "direct",
      startsOn: createdAt,
      label: "Plant care, every other Thu",
      durationMin: 90,
    },
  ];
}

interface HistorySpend {
  monthIndex: number; // 0 = the first month of history
  day: number;
  providerId: string;
  skill: Skill;
  homeId: string;
  title: string;
  note: string;
  cents: number;
  createdBy: string;
}

const HISTORY_SPENDS: HistorySpend[] = [
  { monthIndex: 1, day: 12, providerId: "pr_gail", skill: "pest", homeId: "home_bergen", title: "Mice in the garden level", note: "Heard them in the wall by the back door.", cents: 16000, createdBy: "p_priya" },
  { monthIndex: 2, day: 9, providerId: "pr_tomas", skill: "plumbing", homeId: "home_dekalb", title: "Kitchen faucet drips", note: "Slow drip, worse with hot water.", cents: 18000, createdBy: "p_noor" },
  { monthIndex: 3, day: 20, providerId: "pr_dev", skill: "handyman", homeId: "home_dekalb", title: "Gutters before the leaves", note: "Back gutter overflowed in the last storm.", cents: 22000, createdBy: "p_elias" },
];

function providerForSkill(providers: Provider[], skill: Skill): Provider | undefined {
  return (
    providers.find((p) => p.primary === skill) ??
    providers.find((p) => p.skills.includes(skill)) ??
    providers.find((p) => ADJACENT[p.primary]?.includes(skill))
  );
}

/** A need that was requested, matched, visited and paid in a closed month. */
function applyHistorySpend(state: ColonyState, spend: HistorySpend, month: MonthStr): ColonyState {
  const date = dateInMonth(month, spend.day);
  const needId = `need_${spend.providerId.replace("pr_", "")}_${month}`;
  const mId = matchId(needId, spend.providerId);
  const provider = state.providers.find((p) => p.id === spend.providerId)!;
  const need: Need = {
    id: needId,
    title: spend.title,
    note: spend.note,
    category: spend.skill,
    homeId: spend.homeId,
    urgency: "soon",
    status: "done",
    createdBy: spend.createdBy,
    createdAt: addDays(date, -4),
    matchIds: [mId],
  };
  const match: Match = {
    id: mId,
    needId,
    providerId: spend.providerId,
    score: 92,
    reasons: [`Serves ${provider.homesServed} homes in ${provider.area}`, "Pool covered it"],
    quoteCents: spend.cents,
    earliest: date,
    status: "accepted",
  };
  const window = provider.availability[0];
  const start = window ? window.from : "09:00";
  const item: ScheduleItem = {
    id: `si_need_${needId}`,
    needId,
    providerId: spend.providerId,
    homeId: spend.homeId,
    date,
    start,
    end: window ? window.to : "11:00",
    kind: kindForSkill(spend.skill),
    title: spend.title,
    status: "done",
  };
  const task: Task = {
    id: `task_need_${needId}`,
    title: spend.title,
    category: spend.skill,
    homeId: spend.homeId,
    status: "handled",
    handledBy: spend.providerId,
    dueOn: date,
    source: "match",
    needId,
  };
  const next: ColonyState = {
    ...state,
    needs: [...state.needs, need],
    matches: [...state.matches, match],
    schedule: [...state.schedule, item],
    tasks: [...state.tasks, task],
  };
  return spendFromPool(next, spend.cents, spend.providerId, spend.title, date);
}

function settleHistory(state: ColonyState, currentMonth: MonthStr): ColonyState {
  let doneCount = 0;
  return {
    ...state,
    schedule: state.schedule.map((x) => {
      if (monthOf(x.date) >= currentMonth || x.status !== "done") return x;
      doneCount += 1;
      return doneCount % 17 === 0 ? { ...x, status: "skipped" } : x;
    }),
    tasks: state.tasks.map((t) => {
      if (monthOf(t.dueOn) >= currentMonth || t.status === "handled") return t;
      const by = providerForSkill(state.providers, t.category);
      return { ...t, status: "handled", handledBy: by?.id };
    }),
  };
}

function dressOpenMonth(state: ColonyState, today: DateStr): ColonyState {
  const month = monthOf(today);
  let scheduledLeft = 3;
  const tasks: Task[] = state.tasks.map((t) => {
    if (monthOf(t.dueOn) !== month || t.status !== "queued") return t;
    if (scheduledLeft > 0) {
      const by = providerForSkill(state.providers, t.category);
      if (by) {
        scheduledLeft -= 1;
        return { ...t, status: "scheduled", handledBy: by.id };
      }
    }
    return t;
  });
  const needsYou: Task[] = [
    {
      id: "task_needs_radiator",
      title: "Approve a date for the radiator check",
      category: "hvac",
      homeId: "home_dekalb",
      status: "needs_you",
      dueOn: addDays(today, 5),
      source: "provider",
      handledBy: "pr_lou",
      note: "Lou can come Tuesday or Friday morning.",
    },
    {
      id: "task_needs_closet",
      title: "Pick a weekend for the closet swap",
      category: "house_manager",
      homeId: "home_bergen",
      status: "needs_you",
      dueOn: addDays(today, 9),
      source: "provider",
      handledBy: "pr_jordan",
      note: "Jordan needs about four hours and the bins from the basement.",
    },
  ];
  const known = new Set(tasks.map((t) => t.id));
  return {
    ...state,
    schedule: state.schedule.map((x) => (x.date < today && x.status === "planned" ? { ...x, status: "done" } : x)),
    meals: state.meals.map((m) => (m.date < today && m.status === "planned" ? { ...m, status: "served" } : m)),
    tasks: [...tasks, ...needsYou.filter((t) => !known.has(t.id))],
  };
}

/** The demo colony as of `today`: five closed months behind it, the current month open. */
export function buildSeed(today: DateStr): ColonyState {
  const start = startMonth(today);
  const createdAt = firstOfMonth(start);
  const colony = buildColony(today);
  colony.membership.trialEndsAt = addDays(today, TRIAL_DAYS);
  colony.membership.periodEnd = addDays(today, TRIAL_DAYS);

  let state: ColonyState = {
    colony,
    people: PEOPLE.map((p) => ({ ...p })),
    households: HOUSEHOLDS.map((h) => ({ ...h, personIds: [...h.personIds] })),
    homes: HOMES.map((h) => ({ ...h })),
    providers: PROVIDERS.map((p) => ({ ...p, skills: [...p.skills], availability: p.availability.map((w) => ({ ...w })) })),
    engagements: buildEngagements(createdAt),
    schedule: [],
    meals: [],
    tasks: [],
    needs: [],
    matches: [],
    periods: [openPeriod(start)],
    ledger: [],
    meta: { seedVersion: SEED_VERSION, onboarded: false, simToday: createdAt, persona: { mode: "member", personId: "p_noor" } },
  };
  state = mergeMonth(state, start);

  for (let i = 0; i < HISTORY_MONTHS; i++) {
    const month = addMonths(start, i);
    for (const spend of HISTORY_SPENDS) {
      if (spend.monthIndex === i) state = applyHistorySpend(state, spend, month);
    }
    state = closeMonth(state);
  }

  const currentMonth = monthOf(today);
  state = settleHistory(state, currentMonth);
  state = { ...state, meta: { ...state.meta, simToday: today } };
  return dressOpenMonth(state, today);
}

export interface FreshHousehold {
  name: string;
  address: string;
  area: string;
  people: string[];
}

export interface FreshProvider {
  name: string;
  skill: Skill;
  rateCents: number;
  days: Weekday[];
}

export interface FreshInput {
  name: string;
  contributionCents: number;
  households: FreshHousehold[];
  providers?: FreshProvider[];
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "x";
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h >>> 0);
}

export function inviteCodeFor(name: string): string {
  return `HIVE-${String(1000 + (hash(name) % 9000))}`;
}

/** A brand new colony from the onboarding answers. Nothing in the pool yet, the current month open. */
export function buildFresh(input: FreshInput, today: DateStr): ColonyState {
  const month = monthOf(today);
  const createdAt = firstOfMonth(month);
  const colonySlug = slug(input.name);
  const households: Household[] = [];
  const homes: Home[] = [];
  const people: Person[] = [];

  input.households.forEach((hh, i) => {
    const hhId = `hh_${colonySlug}_${i + 1}`;
    const homeId = `home_${colonySlug}_${i + 1}`;
    const personIds: string[] = [];
    hh.people.forEach((name, j) => {
      const id = `p_${slug(name)}_${i + 1}_${j + 1}`;
      personIds.push(id);
      people.push({
        id,
        name,
        avatar: avatarFor(name),
        householdId: hhId,
        role: i === 0 && j === 0 ? "steward" : "member",
        contributionCents: input.contributionCents,
      });
    });
    households.push({ id: hhId, name: hh.name, homeId, personIds });
    homes.push({
      id: homeId,
      householdId: hhId,
      label: hh.name,
      address: hh.address,
      area: hh.area,
      lat: 40.68 + i * 0.004,
      lng: -73.97 - i * 0.006,
      plantCount: 0,
      notes: "",
    });
  });

  const steward = people[0];
  if (!steward) throw new Error("A colony needs at least one person");
  const firstHome = homes[0]!;

  const providers: Provider[] = [];
  const engagements: Engagement[] = [];
  (input.providers ?? []).forEach((p, i) => {
    const id = `pr_${slug(p.name)}_${i + 1}`;
    providers.push({
      id,
      name: p.name,
      avatar: avatarFor(p.name),
      skills: [p.skill],
      primary: p.skill,
      kind: "direct",
      bio: `Brought in by ${steward.name.split(" ")[0]}.`,
      roleLine: COPY.roleLines[p.skill],
      area: firstHome.area,
      lat: firstHome.lat,
      lng: firstHome.lng,
      radiusKm: 10,
      rateCents: p.rateCents,
      rateUnit: "visit",
      rating: 5,
      homesServed: homes.length,
      availability: p.days.map((day) => ({ day, from: "10:00", to: "14:00" })),
      broughtBy: steward.id,
      curated: false,
    });
    const cadence = { kind: "weekly" as const, days: [...p.days].sort((a, b) => a - b), time: "10:00" };
    engagements.push({
      id: `eng_${slug(p.name)}_${i + 1}`,
      providerId: id,
      skill: p.skill,
      cadence,
      homeIds: homes.map((h) => h.id),
      costCents: p.rateCents,
      fund: "direct",
      startsOn: createdAt,
      label: `${SKILL_LABEL[p.skill]}, ${cadenceLabel(cadence)}`,
      durationMin: 120,
    });
  });

  const state: ColonyState = {
    colony: {
      id: `col_${colonySlug}`,
      name: input.name,
      createdAt,
      stewardId: steward.id,
      inviteCode: inviteCodeFor(input.name),
      contributionCentsPerPerson: input.contributionCents,
      membership: {
        plan: "colony",
        priceCents: MEMBERSHIP_PRICE_CENTS,
        status: "trialing",
        trialEndsAt: addDays(today, 14),
        periodEnd: addDays(today, 14),
        cancelAtPeriodEnd: false,
      },
    },
    people,
    households,
    homes,
    providers,
    engagements,
    schedule: [],
    meals: [],
    tasks: [],
    needs: [],
    matches: [],
    periods: [openPeriod(month)],
    ledger: [],
    meta: { seedVersion: SEED_VERSION, onboarded: false, simToday: today, persona: { mode: "member", personId: steward.id } },
  };
  return mergeMonth(state, month);
}

/** Alias used by onboarding. */
export const emptyColony = buildFresh;
