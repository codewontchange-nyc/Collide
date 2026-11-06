// Everything the app can do, as pure functions over the state, dispatched through the store.
import type {
  AvailabilityWindow,
  ColonyState,
  Match,
  Need,
  Persona,
  Provider,
  ScheduleItem,
  Skill,
  Task,
  TaskStatus,
  Urgency,
  Weekday,
} from "@/domain/types";
import { SKILL_LABEL } from "@/domain/types";
import { addDays, addMinutes, addMonths, lastOfMonth, monthOf, todayStr, weekdayOf } from "@/domain/dates";
import { cadenceLabel } from "@/domain/cadence";
import { COPY } from "@/domain/copy";
import { closeMonth, spendFromPool } from "@/domain/budget";
import { catalogItemFor, suggest } from "@/domain/match";
import { kindForSkill, mergeMonth } from "@/domain/schedule";
import { CATALOG } from "@/seed/catalog";
import { avatarFor } from "@/seed/people";
import { buildFresh, buildSeed, slug, type FreshInput } from "@/seed/seed";
import { store } from "@/store/store";
import { currentPerson } from "@/store/selectors";

export interface NeedInput {
  title: string;
  note?: string;
  category: Skill;
  homeId: string;
  urgency: Urgency;
}

export interface BringProviderInput {
  name: string;
  skill: Skill;
  rateCents: number;
  rateUnit?: Provider["rateUnit"];
  days?: Weekday[];
  area?: string;
  bio?: string;
  kind?: Provider["kind"];
  costCents?: number; // per visit when a weekly engagement is wanted
}

// ---------- pure transitions ----------

export function withOnboarded(state: ColonyState, persona: Persona): ColonyState {
  return { ...state, meta: { ...state.meta, onboarded: true, persona } };
}

export function needIdFor(state: ColonyState): string {
  return `need_${state.meta.simToday}_${state.needs.length + 1}`;
}

export function addNeed(state: ColonyState, input: NeedInput, id = needIdFor(state)): ColonyState {
  const by = currentPerson(state);
  const need: Need = {
    id,
    title: input.title.trim() || SKILL_LABEL[input.category],
    note: input.note?.trim() ?? "",
    category: input.category,
    homeId: input.homeId,
    urgency: input.urgency,
    status: "matching",
    createdBy: by?.id ?? state.colony.stewardId,
    createdAt: state.meta.simToday,
    matchIds: [],
  };
  return { ...state, needs: [...state.needs, need] };
}

export function matchNeed(state: ColonyState, needId: string): ColonyState {
  const need = state.needs.find((n) => n.id === needId);
  if (!need) return state;
  const matches = suggest(need, state, 3);
  const ids = new Set(matches.map((m) => m.id));
  return {
    ...state,
    matches: [...state.matches.filter((m) => m.needId !== needId && !ids.has(m.id)), ...matches],
    needs: state.needs.map((n) => (n.id === needId ? { ...n, status: "matched", matchIds: matches.map((m) => m.id) } : n)),
  };
}

export function acceptMatchIn(state: ColonyState, matchId: string): ColonyState {
  const match = state.matches.find((m) => m.id === matchId);
  if (!match || match.status === "accepted") return state;
  const need = state.needs.find((n) => n.id === match.needId);
  const provider = state.providers.find((p) => p.id === match.providerId);
  if (!need || !provider) return state;

  const wd = weekdayOf(match.earliest);
  const window = provider.availability.find((w) => w.day === wd);
  const start = window ? window.from : "09:00";
  const item = catalogItemFor(need.category, CATALOG, need.title);
  const end = addMinutes(start, Math.round((item ? item.typicalHours : 2) * 60));
  const itemId = `si_need_${need.id}`;
  const taskId = `task_need_${need.id}`;

  const scheduleItem: ScheduleItem = {
    id: itemId,
    needId: need.id,
    providerId: provider.id,
    homeId: need.homeId,
    date: match.earliest,
    start,
    end,
    kind: kindForSkill(need.category),
    title: need.title,
    status: "planned",
  };
  const task: Task = {
    id: taskId,
    title: need.title,
    category: need.category,
    homeId: need.homeId,
    status: "scheduled",
    handledBy: provider.id,
    dueOn: match.earliest,
    source: "match",
    needId: need.id,
    note: need.note || undefined,
  };

  const next: ColonyState = {
    ...state,
    matches: state.matches.map((m) =>
      m.needId !== need.id ? m : m.id === matchId ? { ...m, status: "accepted" } : { ...m, status: "declined" },
    ),
    needs: state.needs.map((n) => (n.id === need.id ? { ...n, status: "scheduled" } : n)),
    schedule: [...state.schedule.filter((x) => x.id !== itemId), scheduleItem],
    tasks: [...state.tasks.filter((t) => t.id !== taskId), task],
  };
  return spendFromPool(next, match.quoteCents, provider.id, `${need.title}, ${provider.name}`, state.meta.simToday);
}

export function declineMatchIn(state: ColonyState, matchId: string): ColonyState {
  return { ...state, matches: state.matches.map((m) => (m.id === matchId ? { ...m, status: "declined" } : m)) };
}

export function visitDone(state: ColonyState, scheduleItemId: string): ColonyState {
  const item = state.schedule.find((x) => x.id === scheduleItemId);
  if (!item) return state;
  const needId = item.needId;
  return {
    ...state,
    schedule: state.schedule.map((x) => (x.id === scheduleItemId ? { ...x, status: "done" } : x)),
    meals: item.kind === "meal" ? state.meals.map((m) => (m.scheduleItemId === scheduleItemId ? { ...m, status: "served" } : m)) : state.meals,
    tasks: needId ? state.tasks.map((t) => (t.needId === needId ? { ...t, status: "handled" } : t)) : state.tasks,
    needs: needId ? state.needs.map((n) => (n.id === needId ? { ...n, status: "done" } : n)) : state.needs,
  };
}

export function taskStatus(state: ColonyState, taskId: string, status: TaskStatus): ColonyState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) };
}

export function addProvider(state: ColonyState, input: BringProviderInput): { state: ColonyState; providerId: string } {
  const by = currentPerson(state);
  const home = state.homes[0];
  const base = `pr_${slug(input.name)}`;
  let id = base;
  for (let n = 2; state.providers.some((p) => p.id === id); n++) id = `${base}_${n}`;
  const days = input.days ?? [];
  const kind = input.kind ?? (days.length ? "direct" : "indirect");
  const provider: Provider = {
    id,
    name: input.name.trim(),
    avatar: avatarFor(input.name.trim()),
    skills: [input.skill],
    primary: input.skill,
    kind,
    bio: input.bio?.trim() || (by ? `Brought in by ${by.name.split(" ")[0]}.` : "Brought in by a member."),
    roleLine: COPY.roleLines[input.skill],
    area: input.area?.trim() || home?.area || "Brooklyn",
    lat: home?.lat ?? 40.68,
    lng: home?.lng ?? -73.97,
    radiusKm: 10,
    rateCents: input.rateCents,
    rateUnit: input.rateUnit ?? (kind === "direct" ? "visit" : "hour"),
    rating: 5,
    homesServed: 1,
    availability: days.map((day) => ({ day, from: "10:00", to: "14:00" })),
    broughtBy: by?.id,
    curated: false,
  };
  let next: ColonyState = { ...state, providers: [...state.providers, provider] };
  if (kind === "direct" && days.length) {
    const cadence = { kind: "weekly" as const, days: [...days].sort((a, b) => a - b), time: "10:00" };
    const month = monthOf(state.meta.simToday);
    next = {
      ...next,
      engagements: [
        ...next.engagements,
        {
          id: `eng_${id}`,
          providerId: id,
          skill: input.skill,
          cadence,
          homeIds: state.homes.map((h) => h.id),
          costCents: input.costCents ?? input.rateCents,
          fund: "direct",
          startsOn: state.meta.simToday,
          label: `${SKILL_LABEL[input.skill]}, ${cadenceLabel(cadence)}`,
          durationMin: 120,
        },
      ],
    };
    next = mergeMonth(next, month);
  }
  return { state: next, providerId: id };
}

// ---------- dispatched actions ----------

export function tourDemo(): void {
  store.set((s) => withOnboarded(s, { mode: "member", personId: s.colony.stewardId }));
}

export function createColony(input: FreshInput): void {
  store.set(() => {
    const fresh = buildFresh(input, todayStr());
    return withOnboarded(fresh, fresh.meta.persona);
  });
}

export function requestNeed(input: NeedInput): string {
  const id = needIdFor(store.get());
  store.set((s) => addNeed(s, input, id));
  return id;
}

export function runMatch(needId: string): Match[] {
  store.set((s) => matchNeed(s, needId));
  return store.get().matches.filter((m) => m.needId === needId);
}

export function acceptMatch(matchId: string): void {
  store.set((s) => acceptMatchIn(s, matchId));
}

export function declineMatch(matchId: string): void {
  store.set((s) => declineMatchIn(s, matchId));
}

export function markVisitDone(scheduleItemId: string): void {
  store.set((s) => visitDone(s, scheduleItemId));
}

export function setTaskStatus(taskId: string, status: TaskStatus): void {
  store.set((s) => taskStatus(s, taskId, status));
}

export function advanceMonth(): void {
  store.set((s) => closeMonth(s));
}

export function jumpMonths(n: number): void {
  store.set((s) => {
    let next = s;
    for (let i = 0; i < n; i++) next = closeMonth(next);
    return next;
  });
}

export function resetDemo(): void {
  store.set(() => withOnboarded(buildSeed(todayStr()), { mode: "member", personId: "p_noor" }));
}

export function setPersona(persona: Persona): void {
  store.set((s) => ({ ...s, meta: { ...s.meta, persona } }));
}

export function setAvailability(providerId: string, windows: AvailabilityWindow[]): void {
  store.set((s) => ({
    ...s,
    providers: s.providers.map((p) => (p.id === providerId ? { ...p, availability: windows.map((w) => ({ ...w })) } : p)),
  }));
}

export function startMembership(): void {
  store.set((s) => {
    const today = s.meta.simToday;
    const periodEnd = `${addMonths(monthOf(today), 1)}-${today.slice(8, 10)}`;
    const safeEnd = periodEnd > lastOfMonth(monthOf(periodEnd)) ? lastOfMonth(monthOf(periodEnd)) : periodEnd;
    return {
      ...s,
      colony: {
        ...s.colony,
        membership: { ...s.colony.membership, status: "active", periodEnd: safeEnd, cancelAtPeriodEnd: false },
      },
    };
  });
}

export function cancelAtPeriodEnd(cancel: boolean): void {
  store.set((s) => ({ ...s, colony: { ...s.colony, membership: { ...s.colony.membership, cancelAtPeriodEnd: cancel } } }));
}

/** Nothing to send in the prototype; the code is what you share. */
export function inviteMember(): string {
  return store.get().colony.inviteCode;
}

export function bringProvider(input: BringProviderInput): string {
  let id = "";
  store.set((s) => {
    const r = addProvider(s, input);
    id = r.providerId;
    return r.state;
  });
  return id;
}

export function renameColony(name: string): void {
  const clean = name.trim();
  if (!clean) return;
  store.set((s) => ({ ...s, colony: { ...s.colony, name: clean } }));
}

/** A due date helper for UI that wants "tomorrow" without importing dates. */
export function tomorrow(): string {
  return addDays(store.get().meta.simToday, 1);
}
