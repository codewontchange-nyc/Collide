import { describe, expect, it } from "vitest";
import type { Cadence } from "@/domain/types";
import { cadenceLabel, nextOccurrence, nominalOccurrences, occurrences, occurrencesPerMonthEstimate } from "@/domain/cadence";

const monThu: Cadence = { kind: "weekly", days: [1, 4], time: "14:00" };
const everyOtherSat: Cadence = { kind: "biweekly", day: 6, time: "09:00", anchor: "2026-10-03" };
const firstOfMonth: Cadence = { kind: "monthly", dayOfMonth: 1, time: "10:00" };
const thirtyFirst: Cadence = { kind: "monthly", dayOfMonth: 31, time: "10:00" };
const once: Cadence = { kind: "once", date: "2026-11-14", time: "11:00" };

describe("cadence", () => {
  it("weekly lists every listed weekday in the month", () => {
    const dates = occurrences(monThu, "2026-11");
    expect(dates).toEqual([
      "2026-11-02", "2026-11-05", "2026-11-09", "2026-11-12", "2026-11-16", "2026-11-19",
      "2026-11-23", "2026-11-26", "2026-11-30",
    ]);
  });

  it("weekly respects startsOn", () => {
    expect(occurrences(monThu, "2026-11", "2026-11-10")).toEqual([
      "2026-11-12", "2026-11-16", "2026-11-19", "2026-11-23", "2026-11-26", "2026-11-30",
    ]);
  });

  it("biweekly counts 14 days from the anchor, in both directions", () => {
    expect(occurrences(everyOtherSat, "2026-11")).toEqual(["2026-11-14", "2026-11-28"]);
    expect(occurrences(everyOtherSat, "2026-09")).toEqual(["2026-09-05", "2026-09-19"]);
  });

  it("monthly clamps the day of month", () => {
    expect(occurrences(firstOfMonth, "2026-11")).toEqual(["2026-11-01"]);
    expect(occurrences(thirtyFirst, "2026-11")).toEqual(["2026-11-30"]);
    expect(occurrences(thirtyFirst, "2026-02")).toEqual(["2026-02-28"]);
  });

  it("once lands only in its month", () => {
    expect(occurrences(once, "2026-11")).toEqual(["2026-11-14"]);
    expect(occurrences(once, "2026-12")).toEqual([]);
  });

  it("finds the next occurrence", () => {
    expect(nextOccurrence(monThu, "2026-11-06")).toBe("2026-11-09");
    expect(nextOccurrence(monThu, "2026-11-09")).toBe("2026-11-09");
    expect(nextOccurrence(everyOtherSat, "2026-11-15")).toBe("2026-11-28");
    expect(nextOccurrence(once, "2026-11-15")).toBeNull();
    expect(nextOccurrence(once, "2026-11-01")).toBe("2026-11-14");
  });

  it("labels in the product voice", () => {
    expect(cadenceLabel(monThu)).toBe("Mon and Thu");
    expect(cadenceLabel({ kind: "weekly", days: [1, 3, 5], time: "09:00" })).toBe("Mon, Wed and Fri");
    expect(cadenceLabel({ kind: "biweekly", day: 3, time: "09:00", anchor: "2026-11-04" })).toBe("Every other Wed");
    expect(cadenceLabel(firstOfMonth)).toBe("Monthly on the 1st");
    expect(cadenceLabel({ kind: "monthly", dayOfMonth: 22, time: "10:00" })).toBe("Monthly on the 22nd");
    expect(cadenceLabel({ kind: "monthly", dayOfMonth: 13, time: "10:00" })).toBe("Monthly on the 13th");
    expect(cadenceLabel(once)).toBe("Once, Nov 14");
  });

  it("estimates and budgets a month", () => {
    expect(occurrencesPerMonthEstimate(monThu)).toBeCloseTo(8.66);
    expect(occurrencesPerMonthEstimate(everyOtherSat)).toBe(2.17);
    expect(occurrencesPerMonthEstimate(firstOfMonth)).toBe(1);
    expect(occurrencesPerMonthEstimate(once)).toBe(0);
    expect(nominalOccurrences(monThu, "2026-11")).toBe(8);
    expect(nominalOccurrences(everyOtherSat, "2026-11")).toBe(2);
    expect(nominalOccurrences(once, "2026-12")).toBe(0);
  });
});
