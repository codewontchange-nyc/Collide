import { describe, expect, it } from "vitest";
import { generateMonth, handledThisWeek, mergeMonth, monthMeals, weekItems, whoIsComing } from "@/domain/schedule";
import { startOfWeek } from "@/domain/dates";
import { buildSeed } from "@/seed/seed";

const TODAY = "2026-11-06";

describe("generateMonth", () => {
  const state = buildSeed(TODAY);

  it("lands 28 dinners in a full month with a Mon and Thu chef", () => {
    for (const month of ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]) {
      const gen = generateMonth(state, month);
      expect(gen.meals.length, month).toBe(28);
      expect(new Set(gen.meals.map((m) => m.date)).size).toBe(28);
      expect(gen.meals.every((m) => m.homeIds.length === 2)).toBe(true);
    }
  });

  it("makes one item per occurrence per home", () => {
    const gen = generateMonth(state, "2026-11");
    const marisol = gen.schedule.filter((x) => x.engagementId === "eng_marisol");
    expect(marisol.length).toBe(9 * 2);
    expect(marisol[0]?.start).toBe("14:00");
    expect(marisol[0]?.end).toBe("17:00");
    expect(marisol[0]?.kind).toBe("meal");
    const lena = gen.schedule.filter((x) => x.providerId === "pr_lena");
    expect(lena.every((x) => x.kind === "clean")).toBe(true);
  });

  it("brings the season and the maintenance intervals", () => {
    const gen = generateMonth(state, "2026-11");
    expect(gen.tasks.some((t) => t.title === "Gutter clean" && t.source === "seasonal")).toBe(true);
    expect(gen.tasks.filter((t) => t.title === "Gutter clean").length).toBe(2);
    expect(gen.tasks.some((t) => t.source === "maintenance")).toBe(true);
    expect(gen.tasks.every((t) => t.status === "queued" && t.dueOn === "2026-11-15")).toBe(true);
  });

  it("is deterministic and idempotent", () => {
    const a = generateMonth(state, "2026-12");
    const b = generateMonth(state, "2026-12");
    expect(a).toEqual(b);
    const merged = mergeMonth(state, "2026-11");
    expect(merged.schedule.length).toBe(state.schedule.length);
    expect(merged.meals.length).toBe(state.meals.length);
    expect(merged.tasks.length).toBe(state.tasks.length);
    const ids = merged.schedule.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("views", () => {
  const state = buildSeed(TODAY);

  it("lists who is coming in order", () => {
    const items = whoIsComing(state, TODAY, 7);
    expect(items.length).toBeGreaterThan(0);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1]!;
      const cur = items[i]!;
      expect(prev.date < cur.date || (prev.date === cur.date && prev.start <= cur.start)).toBe(true);
    }
    expect(items.every((x) => x.date >= TODAY && x.date < "2026-11-13")).toBe(true);
    expect(weekItems(state, startOfWeek(TODAY)).every((x) => x.date >= "2026-11-02" && x.date < "2026-11-09")).toBe(true);
  });

  it("counts the month's meals and the week's handled things", () => {
    expect(monthMeals(state, "2026-11").length).toBe(28);
    expect(monthMeals(state, "2026-11").filter((m) => m.status === "served").length).toBe(4);
    expect(handledThisWeek(state, startOfWeek(TODAY))).toBeGreaterThan(0);
  });
});
