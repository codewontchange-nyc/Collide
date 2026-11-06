import { describe, expect, it } from "vitest";
import type { Need } from "@/domain/types";
import { contextFor, earliestFor, haversineKm, quoteFor, scoreMatch, suggest } from "@/domain/match";
import { weekdayOf } from "@/domain/dates";
import { CATALOG } from "@/seed/catalog";
import { buildSeed } from "@/seed/seed";

const TODAY = "2026-11-06";

function need(partial: Partial<Need> = {}): Need {
  return {
    id: "need_test",
    title: "Bathroom sink drains slowly",
    note: "",
    category: "plumbing",
    homeId: "home_dekalb",
    urgency: "soon",
    status: "matching",
    createdBy: "p_noor",
    createdAt: TODAY,
    matchIds: [],
    ...partial,
  };
}

describe("match", () => {
  const state = buildSeed(TODAY);

  it("measures distance", () => {
    expect(haversineKm({ lat: 40.6897, lng: -73.966 }, { lat: 40.6897, lng: -73.966 })).toBe(0);
    const km = haversineKm({ lat: 40.6897, lng: -73.966 }, { lat: 40.6733, lng: -73.9903 });
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(3.5);
  });

  it("ranks the plumber first for a plumbing need", () => {
    const matches = suggest(need(), state, 3);
    expect(matches.length).toBe(3);
    expect(matches[0]?.providerId).toBe("pr_tomas");
    expect(matches[0]!.score).toBeGreaterThan(matches[1]!.score);
    expect(matches.every((m) => m.reasons.length >= 2 && m.reasons.length <= 3)).toBe(true);
    expect(matches.every((m) => m.id === `m_need_test_${m.providerId}`)).toBe(true);
    expect(matches.every((m) => m.status === "suggested")).toBe(true);
    // handymen are adjacent, the chef is not
    expect(matches.map((m) => m.providerId)).not.toContain("pr_marisol");
  });

  it("quotes from the catalog's typical hours", () => {
    const tomas = state.providers.find((p) => p.id === "pr_tomas")!;
    expect(quoteFor(need({ title: "Kitchen faucet drips" }), tomas, CATALOG)).toBe(18000);
    const gail = state.providers.find((p) => p.id === "pr_gail")!;
    expect(quoteFor(need({ category: "pest" }), gail, CATALOG)).toBe(16000);
  });

  it("scores skill, distance, availability, budget and trust", () => {
    const tomas = state.providers.find((p) => p.id === "pr_tomas")!;
    const ctx = contextFor(need(), state);
    const s = scoreMatch(need(), tomas, ctx)!;
    expect(s.skill).toBe(40);
    expect(s.distance).toBe(20);
    expect(s.availability).toBe(15);
    expect(s.budget).toBe(15);
    expect(s.trust).toBeGreaterThanOrEqual(6);
    expect(s.total).toBe(s.skill + s.distance + s.availability + s.budget + s.trust);
    const marisol = state.providers.find((p) => p.id === "pr_marisol")!;
    expect(scoreMatch(need(), marisol, ctx)).toBeNull();
  });

  it("lets availability change the earliest date", () => {
    const tomas = state.providers.find((p) => p.id === "pr_tomas")!;
    const normal = earliestFor(need(), tomas, TODAY);
    expect(normal).toBe("2026-11-09");
    const fridaysOnly = { ...tomas, availability: [{ day: 5 as const, from: "08:00", to: "12:00" }] };
    const friday = earliestFor(need(), fridaysOnly, TODAY);
    expect(weekdayOf(friday)).toBe(5);
    expect(friday).toBe("2026-11-13");
    const altered = { ...state, providers: state.providers.map((p) => (p.id === "pr_tomas" ? fridaysOnly : p)) };
    const urgent = suggest(need({ urgency: "urgent" }), altered, 3);
    const tomasMatch = urgent.find((m) => m.providerId === "pr_tomas")!;
    expect(tomasMatch.earliest).toBe("2026-11-13");
    expect(tomasMatch.reasons.some((r) => r.startsWith("Next free Friday"))).toBe(true);
  });

  it("is deterministic", () => {
    const a = suggest(need(), state, 3);
    const b = suggest(need(), buildSeed(TODAY), 3);
    expect(a).toEqual(b);
  });

  it("mentions who brought someone in", () => {
    const sewing = suggest(need({ category: "sewing", title: "Hem two pairs of trousers" }), state, 3);
    expect(sewing[0]?.providerId).toBe("pr_ines");
    expect(sewing[0]?.reasons[0]).toBe("Brought in by Priya");
  });
});
