import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepo } from "@/data/localRepo";
import { leftover, poolBalance } from "@/domain/budget";
import { addMonths, monthOf, todayStr } from "@/domain/dates";
import { buildSeed } from "@/seed/seed";
import {
  acceptMatch,
  advanceMonth,
  bringProvider,
  cancelAtPeriodEnd,
  createColony,
  declineMatch,
  inviteMember,
  jumpMonths,
  markVisitDone,
  renameColony,
  requestNeed,
  resetDemo,
  runMatch,
  setAvailability,
  setPersona,
  setTaskStatus,
  startMembership,
  tourDemo,
} from "@/store/actions";
import { currentPerson, currentProvider, homeById, personById, providerById, useMaps } from "@/store/selectors";
import { createStore, store } from "@/store/store";

describe("createStore", () => {
  it("gets, sets and notifies", () => {
    const s = createStore({ n: 1 });
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.set((x) => ({ n: x.n + 1 }));
    expect(s.get().n).toBe(2);
    expect(calls).toBe(1);
    s.set((x) => x);
    expect(calls).toBe(1);
    off();
    s.set((x) => ({ n: x.n + 1 }));
    expect(calls).toBe(1);
  });
});

describe("actions", () => {
  beforeEach(() => {
    resetDemo();
  });

  it("starts on the seed with the tour persona", () => {
    const s = store.get();
    expect(s.meta.onboarded).toBe(true);
    expect(currentPerson(s)?.name).toBe("Noor Haddad");
    expect(currentProvider(s)).toBeUndefined();
    expect(poolBalance(s)).toBe(184000);
  });

  it("accept match debits the pool and schedules the visit", () => {
    const before = poolBalance(store.get());
    const needId = requestNeed({ title: "Bathroom sink drains slowly", category: "plumbing", homeId: "home_dekalb", urgency: "soon" });
    expect(store.get().needs.find((n) => n.id === needId)?.status).toBe("matching");
    const matches = runMatch(needId);
    expect(matches.length).toBe(3);
    expect(store.get().needs.find((n) => n.id === needId)?.status).toBe("matched");
    const top = matches[0]!;
    acceptMatch(top.id);
    const s = store.get();
    expect(poolBalance(s)).toBe(before - top.quoteCents);
    expect(s.needs.find((n) => n.id === needId)?.status).toBe("scheduled");
    expect(s.matches.find((m) => m.id === top.id)?.status).toBe("accepted");
    expect(s.matches.filter((m) => m.needId === needId && m.status === "declined").length).toBe(2);
    const item = s.schedule.find((x) => x.needId === needId)!;
    expect(item.date).toBe(top.earliest);
    expect(item.providerId).toBe(top.providerId);
    const task = s.tasks.find((t) => t.needId === needId)!;
    expect(task.status).toBe("scheduled");
    expect(task.source).toBe("match");
    expect(task.handledBy).toBe(top.providerId);

    markVisitDone(item.id);
    const after = store.get();
    expect(after.schedule.find((x) => x.id === item.id)?.status).toBe("done");
    expect(after.tasks.find((t) => t.needId === needId)?.status).toBe("handled");
    expect(after.needs.find((n) => n.id === needId)?.status).toBe("done");
  });

  it("declines a match without touching the pool", () => {
    const needId = requestNeed({ title: "Hem a coat", category: "sewing", homeId: "home_bergen", urgency: "whenever" });
    const matches = runMatch(needId);
    declineMatch(matches[0]!.id);
    expect(store.get().matches.find((m) => m.id === matches[0]!.id)?.status).toBe("declined");
    expect(poolBalance(store.get())).toBe(184000);
  });

  it("marks a chef visit done and serves its dinners", () => {
    const s = store.get();
    const visit = s.schedule.find((x) => x.kind === "meal" && x.status === "planned")!;
    markVisitDone(visit.id);
    const meals = store.get().meals.filter((m) => m.scheduleItemId === visit.id);
    expect(meals.length).toBeGreaterThan(0);
    expect(meals.every((m) => m.status === "served")).toBe(true);
  });

  it("advances and jumps months", () => {
    const month = monthOf(store.get().meta.simToday);
    const left = leftover(store.get(), month);
    advanceMonth();
    expect(poolBalance(store.get())).toBe(184000 + left);
    expect(monthOf(store.get().meta.simToday)).toBe(addMonths(month, 1));
    jumpMonths(6);
    expect(monthOf(store.get().meta.simToday)).toBe(addMonths(month, 7));
    expect(poolBalance(store.get())).toBe(184000 + left * 7);
  });

  it("reset restores the seed", () => {
    requestNeed({ title: "Anything", category: "handyman", homeId: "home_dekalb", urgency: "soon" });
    advanceMonth();
    resetDemo();
    const s = store.get();
    const seed = buildSeed(todayStr());
    expect(s.needs.length).toBe(seed.needs.length);
    expect(s.meta.simToday).toBe(seed.meta.simToday);
    expect(s.meta.onboarded).toBe(true);
    expect(poolBalance(s)).toBe(184000);
  });

  it("flips tasks, personas, availability, membership and names", () => {
    const task = store.get().tasks.find((t) => t.status === "needs_you")!;
    setTaskStatus(task.id, "scheduled");
    expect(store.get().tasks.find((t) => t.id === task.id)?.status).toBe("scheduled");

    setPersona({ mode: "provider", providerId: "pr_marisol" });
    expect(currentProvider(store.get())?.name).toBe("Marisol Vega");
    expect(currentPerson(store.get())?.id).toBe("p_noor");

    setAvailability("pr_tomas", [{ day: 5, from: "08:00", to: "12:00" }]);
    expect(providerById(store.get()).get("pr_tomas")?.availability).toEqual([{ day: 5, from: "08:00", to: "12:00" }]);

    startMembership();
    expect(store.get().colony.membership.status).toBe("active");
    expect(store.get().colony.membership.periodEnd > store.get().meta.simToday).toBe(true);
    cancelAtPeriodEnd(true);
    expect(store.get().colony.membership.cancelAtPeriodEnd).toBe(true);

    expect(inviteMember()).toBe("HIVE-4821");
    renameColony("  Dekalb, Bergen & Friends ");
    expect(store.get().colony.name).toBe("Dekalb, Bergen & Friends");
  });

  it("brings a provider, with an engagement when they have days", () => {
    const id = bringProvider({ name: "Ola Nwosu", skill: "cleaning", rateCents: 13000, days: [1] });
    const s = store.get();
    const p = providerById(s).get(id)!;
    expect(p.broughtBy).toBe("p_noor");
    expect(p.curated).toBe(false);
    expect(s.engagements.some((e) => e.providerId === id)).toBe(true);
    expect(s.schedule.some((x) => x.providerId === id)).toBe(true);
    const specialist = bringProvider({ name: "Ola Nwosu", skill: "electrical", rateCents: 10000 });
    expect(specialist).not.toBe(id);
    expect(providerById(store.get()).get(specialist)?.kind).toBe("indirect");
  });

  it("creates a fresh colony and goes onboarded", () => {
    createColony({
      name: "Maple & Vine",
      contributionCents: 100000,
      households: [
        { name: "Maple", address: "Maple St", area: "Ditmas Park", people: ["Ada Lovelace", "Alan Turing"] },
        { name: "Vine", address: "Vine Ave", area: "Kensington", people: ["Grace Hopper", "Edsger Dijkstra"] },
      ],
    });
    const s = store.get();
    expect(s.meta.onboarded).toBe(true);
    expect(s.people.reduce((sum, p) => sum + p.contributionCents, 0)).toBe(400000);
    expect(currentPerson(s)?.name).toBe("Ada Lovelace");
    tourDemo();
    expect(currentPerson(store.get())?.id).toBe(s.colony.stewardId);
  });
});

describe("selectors", () => {
  it("memoizes per state object", () => {
    const s = buildSeed("2026-11-06");
    expect(personById(s)).toBe(personById(s));
    expect(homeById(s).get("home_dekalb")?.label).toBe("Dekalb Ave");
    expect(personById({ ...s })).not.toBe(personById(s));
    expect(typeof useMaps).toBe("function");
  });
});

describe("MemoryRepo", () => {
  it("round trips and reseeds on a version change", async () => {
    const repo = new MemoryRepo();
    expect(await repo.load()).toBeNull();
    const s = buildSeed("2026-11-06");
    await repo.save(s);
    const back = await repo.load();
    expect(back).toEqual(s);
    await repo.save({ ...s, meta: { ...s.meta, seedVersion: 999 } });
    expect(await repo.load()).toBeNull();
    await repo.clear();
    expect(await repo.load()).toBeNull();
  });
});
