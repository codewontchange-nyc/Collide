// The budget engine. Contributions pay the direct regulars; what is left rolls
// into the indirect pool at the end of each month and funds the specialists.
import type { BudgetPeriod, CatalogItem, ColonyState, DateStr, LedgerEntry, MonthStr } from "@/domain/types";
import { addMonths, firstOfMonth, lastOfMonth, monthOf } from "@/domain/dates";
import { nominalOccurrences } from "@/domain/cadence";
import { mergeMonth } from "@/domain/schedule";

export interface HouseholdTotal {
  householdId: string;
  contributionCents: number;
  spendCents: number;
}

export interface DirectAllocation {
  engagementId: string;
  providerId: string;
  occurrences: number;
  cents: number;
}

export interface FundingLine {
  item: CatalogItem;
  coveredNow: boolean;
  monthsUntil: number; // 0 when covered now, Infinity when nothing rolls in
}

export interface ProjectionPoint {
  month: MonthStr;
  balanceCents: number;
}

export function contributions(state: ColonyState): number {
  return state.people.reduce((sum, p) => sum + p.contributionCents, 0);
}

/** What each engagement costs in a month: budgeted occurrences times the per-visit cost. */
export function directAllocations(state: ColonyState, month: MonthStr): DirectAllocation[] {
  return state.engagements
    .filter((e) => e.fund === "direct")
    .map((e) => {
      const occ = nominalOccurrences(e.cadence, month, e.startsOn);
      return { engagementId: e.id, providerId: e.providerId, occurrences: occ, cents: occ * e.costCents };
    });
}

export function directTotal(state: ColonyState, month: MonthStr): number {
  return directAllocations(state, month).reduce((sum, a) => sum + a.cents, 0);
}

export function leftover(state: ColonyState, month: MonthStr): number {
  return contributions(state) - directTotal(state, month);
}

/** Contribution per household, and the share of direct spend its home receives this month. */
export function householdTotals(state: ColonyState): HouseholdTotal[] {
  const month = monthOf(state.meta.simToday);
  const homeToHousehold = new Map(state.homes.map((h) => [h.id, h.householdId]));
  const spend = new Map<string, number>();
  for (const e of state.engagements) {
    if (e.fund !== "direct" || e.homeIds.length === 0) continue;
    const share = (nominalOccurrences(e.cadence, month, e.startsOn) * e.costCents) / e.homeIds.length;
    for (const homeId of e.homeIds) {
      const hh = homeToHousehold.get(homeId);
      if (hh) spend.set(hh, (spend.get(hh) ?? 0) + share);
    }
  }
  return state.households.map((hh) => ({
    householdId: hh.id,
    contributionCents: state.people.filter((p) => p.householdId === hh.id).reduce((s, p) => s + p.contributionCents, 0),
    spendCents: Math.round(spend.get(hh.id) ?? 0),
  }));
}

/** Rollovers in minus indirect spend, through the month inclusive (all time when omitted). */
export function poolBalance(state: ColonyState, throughMonth?: MonthStr): number {
  let bal = 0;
  for (const e of state.ledger) {
    if (throughMonth && e.month > throughMonth) continue;
    if (e.kind === "rollover_in") bal += e.cents;
    else if (e.kind === "indirect") bal -= e.cents;
  }
  return bal;
}

/** Pool movements, newest first. */
export function poolHistory(state: ColonyState): LedgerEntry[] {
  return state.ledger
    .filter((e) => e.kind === "rollover_in" || e.kind === "indirect")
    .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
}

export function canFund(balanceCents: number, catalog: CatalogItem[], monthlyLeftoverCents: number): FundingLine[] {
  return catalog.map((item) => {
    const coveredNow = item.estCents <= balanceCents;
    let monthsUntil = 0;
    if (!coveredNow) {
      monthsUntil = monthlyLeftoverCents > 0 ? Math.ceil((item.estCents - balanceCents) / monthlyLeftoverCents) : Number.POSITIVE_INFINITY;
    }
    return { item, coveredNow, monthsUntil };
  });
}

export function projection(balanceCents: number, monthlyLeftoverCents: number, months: number, fromMonth: MonthStr): ProjectionPoint[] {
  const step = Math.max(0, monthlyLeftoverCents);
  const out: ProjectionPoint[] = [];
  for (let i = 1; i <= months; i++) out.push({ month: addMonths(fromMonth, i), balanceCents: balanceCents + step * i });
  return out;
}

export function periodId(month: MonthStr): string {
  return `bp_${month}`;
}

export function openPeriod(month: MonthStr): BudgetPeriod {
  return { id: periodId(month), month, contributionCents: 0, directCents: 0, leftoverCents: 0, rolloverInCents: 0, indirectCents: 0 };
}

export function periodFor(state: ColonyState, month: MonthStr): BudgetPeriod | undefined {
  return state.periods.find((p) => p.month === month);
}

/** The open period for the demo clock's month. */
export function currentPeriod(state: ColonyState): BudgetPeriod | undefined {
  const month = monthOf(state.meta.simToday);
  return state.periods.find((p) => p.month === month && !p.closedAt);
}

/** Makes sure a period exists for the month, open and empty when new. */
export function ensurePeriod(state: ColonyState, month: MonthStr): ColonyState {
  if (periodFor(state, month)) return state;
  return { ...state, periods: [...state.periods, openPeriod(month)].sort((a, b) => (a.month < b.month ? -1 : 1)) };
}

/**
 * Closes the clock's month: writes contributions, direct spend and the rollover to the ledger,
 * marks the month's visits done, opens the next month and moves the clock to its first day.
 * A negative leftover is kept on the period as a flag and nothing rolls.
 */
export function closeMonth(state: ColonyState): ColonyState {
  const month = monthOf(state.meta.simToday);
  const next = addMonths(month, 1);
  const closeDate = lastOfMonth(month);
  const withPeriod = ensurePeriod(state, month);
  const period = periodFor(withPeriod, month)!;
  if (period.closedAt) return state;

  const contrib = contributions(withPeriod);
  const allocations = directAllocations(withPeriod, month);
  const direct = allocations.reduce((s, a) => s + a.cents, 0);
  const left = contrib - direct;
  const rollover = Math.max(left, 0);

  const entries: LedgerEntry[] = [];
  for (const p of withPeriod.people) {
    entries.push({ id: `led_${month}_contrib_${p.id}`, month, date: closeDate, kind: "contribution", cents: p.contributionCents, personId: p.id, note: `${p.name} contributed` });
  }
  for (const a of allocations) {
    const eng = withPeriod.engagements.find((e) => e.id === a.engagementId)!;
    entries.push({ id: `led_${month}_direct_${a.engagementId}`, month, date: closeDate, kind: "direct", cents: a.cents, providerId: a.providerId, note: `${eng.label}, ${a.occurrences} visits` });
  }
  if (rollover > 0) {
    entries.push({ id: `led_${month}_rollover`, month, date: closeDate, kind: "rollover_in", cents: rollover, note: "Leftover rolled into the pool" });
  }
  const known = new Set(withPeriod.ledger.map((e) => e.id));

  const closed: BudgetPeriod = {
    ...period,
    contributionCents: contrib,
    directCents: direct,
    leftoverCents: left,
    rolloverInCents: rollover,
    closedAt: closeDate,
  };

  const afterClose: ColonyState = {
    ...withPeriod,
    periods: withPeriod.periods.map((p) => (p.id === closed.id ? closed : p)),
    ledger: [...withPeriod.ledger, ...entries.filter((e) => !known.has(e.id))],
    schedule: withPeriod.schedule.map((x) => (monthOf(x.date) === month && x.status === "planned" ? { ...x, status: "done" } : x)),
    meals: withPeriod.meals.map((m) => (monthOf(m.date) === month && m.status === "planned" ? { ...m, status: "served" } : m)),
    tasks: withPeriod.tasks.map((t) => (monthOf(t.dueOn) === month && t.status === "scheduled" ? { ...t, status: "handled" } : t)),
    meta: { ...withPeriod.meta, simToday: firstOfMonth(next) },
  };
  return mergeMonth(ensurePeriod(afterClose, next), next);
}

/** Spends from the pool: an indirect ledger entry, and the month's period takes the hit. */
export function spendFromPool(state: ColonyState, cents: number, providerId: string, note: string, date: DateStr): ColonyState {
  const month = monthOf(date);
  const withPeriod = ensurePeriod(state, month);
  const n = withPeriod.ledger.filter((e) => e.kind === "indirect" && e.month === month).length + 1;
  const entry: LedgerEntry = { id: `led_${month}_ind_${providerId}_${n}`, month, date, kind: "indirect", cents, providerId, note };
  return {
    ...withPeriod,
    ledger: [...withPeriod.ledger, entry],
    periods: withPeriod.periods.map((p) => (p.month === month ? { ...p, indirectCents: p.indirectCents + cents } : p)),
  };
}
