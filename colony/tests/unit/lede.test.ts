import { describe, expect, it } from "vitest";
import type { ColonyState } from "@/domain/types";
import { COPY } from "@/domain/copy";
import { buildSeed } from "@/seed/seed";
import { askSentence, ledeForWeek, nextPlanned, nextSentence, youCount } from "@/screens/home/lede";

const TODAY = "2026-11-06";

describe("ledeForWeek", () => {
  const seed = buildSeed(TODAY);

  it("composes two sentences from the seed", () => {
    const lede = ledeForWeek(seed);
    const next = nextPlanned(seed);
    expect(next).toBeDefined();
    expect(lede.startsWith(nextSentence(seed, next))).toBe(true);
    expect(lede.endsWith(askSentence(youCount(seed)))).toBe(true);
    for (const code of [0x2014, 0x2013, 0x21]) expect(lede.includes(String.fromCharCode(code))).toBe(false);
  });

  it("names the person, the home and the time", () => {
    const next = nextPlanned(seed);
    const who = seed.providers.find((p) => p.id === next?.providerId)?.name.split(" ")[0] ?? "";
    const home = seed.homes.find((h) => h.id === next?.homeId)?.label ?? "";
    const s = nextSentence(seed, next);
    expect(s).toContain(who);
    expect(s).toContain(home);
    expect(s).toMatch(/ at \d{1,2}:\d{2} (am|pm)\.$/);
    expect(s).toMatch(next?.date === TODAY ? / today at / : / on \w{3}, \w{3} \d{1,2} at /);
  });

  it("falls back to the quiet week line with nothing planned", () => {
    const quiet: ColonyState = { ...seed, schedule: [] };
    expect(ledeForWeek(quiet).startsWith(COPY.empty.week)).toBe(true);
  });

  it("counts what waits on you", () => {
    const none: ColonyState = { ...seed, tasks: seed.tasks.filter((t) => t.status !== "needs_you"), needs: seed.needs.filter((n) => n.status !== "matched") };
    expect(youCount(none)).toBe(0);
    expect(ledeForWeek(none).endsWith("Nothing is waiting on you.")).toBe(true);
    expect(askSentence(1)).toBe("One thing is waiting on you.");
    expect(askSentence(3)).toBe("3 things are waiting on you.");
  });
});
