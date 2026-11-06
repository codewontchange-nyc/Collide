import { describe, expect, it } from "vitest";
import {
  canFund,
  closeMonth,
  contributions,
  currentPeriod,
  directTotal,
  householdTotals,
  leftover,
  poolBalance,
  poolHistory,
  projection,
  spendFromPool,
} from "@/domain/budget";
import { addMonths, monthOf } from "@/domain/dates";
import { CATALOG } from "@/seed/catalog";
import { buildSeed } from "@/seed/seed";

const TODAY = "2026-11-06";

describe("budget on the seed", () => {
  const state = buildSeed(TODAY);
  const month = monthOf(TODAY);

  it("adds up the colony", () => {
    expect(contributions(state)).toBe(400000);
    expect(directTotal(state, month)).toBe(352000);
    expect(leftover(state, month)).toBe(48000);
  });

  it("holds five rollovers minus three spends", () => {
    expect(poolBalance(state)).toBe(184000);
    expect(poolBalance(state, addMonths(month, -1))).toBe(184000);
    expect(poolBalance(state, addMonths(month, -5))).toBe(48000);
    const history = poolHistory(state);
    expect(history.length).toBe(8);
    expect(history[0]!.date >= history[history.length - 1]!.date).toBe(true);
    expect(history.filter((e) => e.kind === "indirect").map((e) => e.cents).sort()).toEqual([16000, 18000, 22000]);
  });

  it("splits households evenly", () => {
    const totals = householdTotals(state);
    expect(totals.map((t) => t.contributionCents)).toEqual([200000, 200000]);
    expect(totals.reduce((s, t) => s + t.spendCents, 0)).toBe(352000);
  });

  it("has an open period for the clock's month", () => {
    const period = currentPeriod(state);
    expect(period?.month).toBe(month);
    expect(period?.closedAt).toBeUndefined();
    expect(state.periods.filter((p) => p.closedAt).length).toBe(5);
  });
});

describe("closeMonth", () => {
  it("rolls the leftover into the pool and opens the next month", () => {
    const before = buildSeed(TODAY);
    const after = closeMonth(before);
    const month = monthOf(TODAY);
    const next = addMonths(month, 1);
    expect(poolBalance(after)).toBe(184000 + 48000);
    expect(after.meta.simToday).toBe(`${next}-01`);
    expect(after.periods.find((p) => p.month === month)?.closedAt).toBe("2026-11-30");
    expect(after.periods.find((p) => p.month === month)?.rolloverInCents).toBe(48000);
    expect(currentPeriod(after)?.month).toBe(next);
    expect(after.schedule.some((x) => monthOf(x.date) === next)).toBe(true);
    expect(after.meals.filter((m) => monthOf(m.date) === next).length).toBe(28);
    expect(after.ledger.filter((e) => e.month === month && e.kind === "contribution").length).toBe(4);
    expect(after.ledger.filter((e) => e.month === month && e.kind === "direct").length).toBe(6);
  });

  it("marks the closed month done", () => {
    const after = closeMonth(buildSeed(TODAY));
    const month = monthOf(TODAY);
    expect(after.schedule.filter((x) => monthOf(x.date) === month && x.status === "planned").length).toBe(0);
    expect(after.meals.filter((m) => monthOf(m.date) === month && m.status === "planned").length).toBe(0);
  });

  it("is idempotent on ids when closed twice in a row", () => {
    const once = closeMonth(buildSeed(TODAY));
    const twice = closeMonth(once);
    const ids = twice.schedule.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    const ledgerIds = twice.ledger.map((x) => x.id);
    expect(new Set(ledgerIds).size).toBe(ledgerIds.length);
  });

  it("does not roll a negative leftover", () => {
    const seed = buildSeed(TODAY);
    const pricey = {
      ...seed,
      engagements: seed.engagements.map((e) => (e.id === "eng_marisol" ? { ...e, costCents: 30000 } : e)),
    };
    const month = monthOf(TODAY);
    expect(leftover(pricey, month)).toBe(-32000);
    const after = closeMonth(pricey);
    const period = after.periods.find((p) => p.month === month)!;
    expect(period.leftoverCents).toBe(-32000);
    expect(period.rolloverInCents).toBe(0);
    expect(poolBalance(after)).toBe(184000);
    expect(after.ledger.some((e) => e.month === month && e.kind === "rollover_in")).toBe(false);
  });
});

describe("pool math", () => {
  it("knows what it can fund and when", () => {
    const lines = canFund(184000, CATALOG, 48000);
    const gutters = lines.find((l) => l.item.id === "cat_gutters")!;
    expect(gutters.coveredNow).toBe(true);
    expect(gutters.monthsUntil).toBe(0);
    const tight = canFund(10000, CATALOG, 48000);
    const grout = tight.find((l) => l.item.id === "cat_grout")!;
    expect(grout.coveredNow).toBe(false);
    expect(grout.monthsUntil).toBe(1);
    expect(canFund(10000, CATALOG, 3000).find((l) => l.item.id === "cat_grout")!.monthsUntil).toBe(6);
    const stuck = canFund(10000, CATALOG, 0);
    expect(stuck.find((l) => l.item.id === "cat_grout")!.monthsUntil).toBe(Number.POSITIVE_INFINITY);
  });

  it("projects forward", () => {
    expect(projection(184000, 48000, 3, "2026-11")).toEqual([
      { month: "2026-12", balanceCents: 232000 },
      { month: "2027-01", balanceCents: 280000 },
      { month: "2027-02", balanceCents: 328000 },
    ]);
    expect(projection(1000, -500, 2, "2026-11").map((p) => p.balanceCents)).toEqual([1000, 1000]);
  });

  it("spends from the pool", () => {
    const state = buildSeed(TODAY);
    const after = spendFromPool(state, 12000, "pr_lou", "Radiator check", TODAY);
    expect(poolBalance(after)).toBe(172000);
    expect(currentPeriod(after)?.indirectCents).toBe(12000);
    expect(poolHistory(after)[0]?.note).toBe("Radiator check");
  });
});
