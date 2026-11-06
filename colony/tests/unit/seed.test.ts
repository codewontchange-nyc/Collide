import { describe, expect, it } from "vitest";
import type { ColonyState } from "@/domain/types";
import { directTotal, poolBalance } from "@/domain/budget";
import { addMonths, monthOf } from "@/domain/dates";
import { monthMeals } from "@/domain/schedule";
import { SEED_VERSION, buildFresh, buildSeed } from "@/seed/seed";
import { CATALOG } from "@/seed/catalog";
import { SEASONAL } from "@/seed/seasonal";
import { MEALS } from "@/seed/meals";

const TODAY = "2026-11-06";

function allIds(s: ColonyState): string[] {
  return [
    s.colony.id,
    ...s.people.map((x) => x.id),
    ...s.households.map((x) => x.id),
    ...s.homes.map((x) => x.id),
    ...s.providers.map((x) => x.id),
    ...s.engagements.map((x) => x.id),
    ...s.schedule.map((x) => x.id),
    ...s.meals.map((x) => x.id),
    ...s.tasks.map((x) => x.id),
    ...s.needs.map((x) => x.id),
    ...s.matches.map((x) => x.id),
    ...s.periods.map((x) => x.id),
    ...s.ledger.map((x) => x.id),
  ];
}

function expectReferencesResolve(s: ColonyState) {
  const people = new Set(s.people.map((x) => x.id));
  const homes = new Set(s.homes.map((x) => x.id));
  const households = new Set(s.households.map((x) => x.id));
  const providers = new Set(s.providers.map((x) => x.id));
  const engagements = new Set(s.engagements.map((x) => x.id));
  const needs = new Set(s.needs.map((x) => x.id));
  const items = new Set(s.schedule.map((x) => x.id));
  const matches = new Set(s.matches.map((x) => x.id));

  expect(people.has(s.colony.stewardId)).toBe(true);
  for (const p of s.people) expect(households.has(p.householdId), p.id).toBe(true);
  for (const h of s.households) {
    expect(homes.has(h.homeId), h.id).toBe(true);
    for (const pid of h.personIds) expect(people.has(pid)).toBe(true);
  }
  for (const h of s.homes) expect(households.has(h.householdId)).toBe(true);
  for (const p of s.providers) if (p.broughtBy) expect(people.has(p.broughtBy), p.id).toBe(true);
  for (const e of s.engagements) {
    expect(providers.has(e.providerId), e.id).toBe(true);
    for (const hid of e.homeIds) expect(homes.has(hid)).toBe(true);
  }
  for (const x of s.schedule) {
    expect(providers.has(x.providerId), x.id).toBe(true);
    expect(homes.has(x.homeId), x.id).toBe(true);
    if (x.engagementId) expect(engagements.has(x.engagementId)).toBe(true);
    if (x.needId) expect(needs.has(x.needId)).toBe(true);
  }
  for (const m of s.meals) {
    expect(providers.has(m.chefId)).toBe(true);
    expect(items.has(m.scheduleItemId), m.id).toBe(true);
    for (const hid of m.homeIds) expect(homes.has(hid)).toBe(true);
  }
  for (const t of s.tasks) {
    if (t.homeId) expect(homes.has(t.homeId), t.id).toBe(true);
    if (t.handledBy) expect(providers.has(t.handledBy), t.id).toBe(true);
    if (t.needId) expect(needs.has(t.needId)).toBe(true);
  }
  for (const n of s.needs) {
    expect(homes.has(n.homeId)).toBe(true);
    expect(people.has(n.createdBy)).toBe(true);
    for (const mid of n.matchIds) expect(matches.has(mid)).toBe(true);
  }
  for (const m of s.matches) {
    expect(needs.has(m.needId)).toBe(true);
    expect(providers.has(m.providerId)).toBe(true);
  }
  for (const e of s.ledger) {
    if (e.providerId) expect(providers.has(e.providerId), e.id).toBe(true);
    if (e.personId) expect(people.has(e.personId), e.id).toBe(true);
  }
  if (s.meta.persona.mode === "member") expect(people.has(s.meta.persona.personId)).toBe(true);
  else expect(providers.has(s.meta.persona.providerId)).toBe(true);
}

describe("buildSeed", () => {
  const state = buildSeed(TODAY);

  it("is the Dekalb & Bergen colony", () => {
    expect(state.colony.id).toBe("col_dekalb");
    expect(state.colony.name).toBe("Dekalb & Bergen");
    expect(state.colony.inviteCode).toBe("HIVE-4821");
    expect(state.colony.createdAt).toBe("2026-06-01");
    expect(state.people.length).toBe(4);
    expect(state.households.length).toBe(2);
    expect(state.providers.length).toBe(12);
    expect(state.providers.filter((p) => p.kind === "direct").length).toBe(5);
    expect(state.meta).toEqual({ seedVersion: SEED_VERSION, onboarded: false, simToday: TODAY, persona: { mode: "member", personId: "p_noor" } });
    expect(state.colony.membership.status).toBe("trialing");
    expect(state.colony.membership.trialEndsAt).toBe("2026-11-26");
    expect(state.colony.membership.priceCents).toBe(14900);
  });

  it("has unique ids and resolving references", () => {
    const ids = allIds(state);
    expect(new Set(ids).size).toBe(ids.length);
    expectReferencesResolve(state);
  });

  it("keeps direct spend under contributions", () => {
    expect(directTotal(state, monthOf(TODAY))).toBe(352000);
    expect(directTotal(state, monthOf(TODAY))).toBeLessThan(400000);
    expect(poolBalance(state)).toBe(184000);
  });

  it("serves 28 dinners a month, every month so far", () => {
    for (let i = -5; i <= 0; i++) {
      const month = addMonths(monthOf(TODAY), i);
      expect(monthMeals(state, month).length, month).toBe(28);
    }
    expect(MEALS.length).toBe(28);
  });

  it("tells a story: history done, the present mixed", () => {
    const past = state.schedule.filter((x) => x.date < TODAY);
    expect(past.every((x) => x.status !== "planned")).toBe(true);
    expect(past.filter((x) => x.status === "done").length).toBeGreaterThan(past.length * 0.9);
    expect(past.some((x) => x.status === "skipped")).toBe(true);
    expect(state.schedule.filter((x) => x.date >= TODAY).every((x) => x.status === "planned")).toBe(true);
    expect(state.tasks.filter((t) => t.status === "needs_you").length).toBe(2);
    expect(state.tasks.filter((t) => t.status === "scheduled").length).toBeGreaterThan(0);
    expect(state.tasks.filter((t) => t.status === "queued").length).toBeGreaterThan(0);
    expect(state.tasks.filter((t) => t.dueOn < "2026-11-01").every((t) => t.status === "handled")).toBe(true);
    expect(state.needs.length).toBe(3);
    expect(state.needs.every((n) => n.status === "done")).toBe(true);
  });

  it("is deterministic", () => {
    expect(buildSeed(TODAY)).toEqual(state);
    expect(buildSeed("2027-03-20").colony.createdAt).toBe("2026-10-01");
  });

  it("seasonal content covers the year and points at real catalog items", () => {
    const months = new Set(SEASONAL.flatMap((s) => s.months));
    expect(months.size).toBe(12);
    const catalogIds = new Set(CATALOG.map((c) => c.id));
    for (const s of SEASONAL) if (s.catalogId) expect(catalogIds.has(s.catalogId), s.id).toBe(true);
  });
});

describe("buildFresh", () => {
  it("builds a colony from the onboarding answers", () => {
    const state = buildFresh(
      {
        name: "Maple & Vine",
        contributionCents: 100000,
        households: [
          { name: "Maple", address: "Maple St", area: "Ditmas Park", people: ["Ada Lovelace", "Alan Turing"] },
          { name: "Vine", address: "Vine Ave", area: "Kensington", people: ["Grace Hopper", "Edsger Dijkstra"] },
        ],
        providers: [{ name: "Kim Lee", skill: "cleaning", rateCents: 12000, days: [2] }],
      },
      TODAY,
    );
    expect(state.people.reduce((s, p) => s + p.contributionCents, 0)).toBe(400000);
    expect(state.people[0]?.role).toBe("steward");
    expect(state.colony.inviteCode).toMatch(/^HIVE-\d{4}$/);
    expect(state.providers.length).toBe(1);
    expect(state.engagements.length).toBe(1);
    expect(directTotal(state, monthOf(TODAY))).toBe(48000);
    expect(state.schedule.length).toBeGreaterThan(0);
    expect(poolBalance(state)).toBe(0);
    const ids = allIds(state);
    expect(new Set(ids).size).toBe(ids.length);
    expectReferencesResolve(state);
  });
});
