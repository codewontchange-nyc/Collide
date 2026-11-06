import { describe, expect, it } from "vitest";
import {
  WEEKDAY_SHORT,
  addDays,
  addMinutes,
  addMonths,
  compareDates,
  daysBetween,
  daysInMonth,
  firstOfMonth,
  fmtDate,
  fmtDay,
  fmtMonth,
  fmtMonthShort,
  fmtTime,
  isSameMonth,
  lastOfMonth,
  monthOf,
  startOfWeek,
  todayStr,
  weekdayOf,
} from "@/domain/dates";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("adds months with wraparound", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-06", -5)).toBe("2026-01");
    expect(addMonths("2026-06", -6)).toBe("2025-12");
  });

  it("knows month bounds", () => {
    expect(monthOf("2026-11-06")).toBe("2026-11");
    expect(daysInMonth("2026-11")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(firstOfMonth("2026-11")).toBe("2026-11-01");
    expect(lastOfMonth("2026-11")).toBe("2026-11-30");
    expect(isSameMonth("2026-11-01", "2026-11-30")).toBe(true);
    expect(isSameMonth("2026-11-30", "2026-12-01")).toBe(false);
  });

  it("knows weekdays and weeks start on Monday", () => {
    expect(weekdayOf("2026-11-01")).toBe(0);
    expect(weekdayOf("2026-11-05")).toBe(4);
    expect(WEEKDAY_SHORT[weekdayOf("2026-11-05")]).toBe("Thu");
    expect(startOfWeek("2026-11-05")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02");
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
  });

  it("compares and measures", () => {
    expect(compareDates("2026-11-01", "2026-11-02")).toBe(-1);
    expect(compareDates("2026-11-02", "2026-11-02")).toBe(0);
    expect(daysBetween("2026-11-01", "2026-11-15")).toBe(14);
    expect(daysBetween("2026-11-15", "2026-11-01")).toBe(-14);
  });

  it("formats in the product voice", () => {
    expect(fmtMonth("2026-11")).toBe("November 2026");
    expect(fmtMonthShort("2026-11")).toBe("Nov");
    expect(fmtDay("2026-11-14")).toBe("Sat 14");
    expect(fmtDate("2026-11-14")).toBe("Sat, Nov 14");
    expect(fmtTime("14:00")).toBe("2:00 pm");
    expect(fmtTime("09:30")).toBe("9:30 am");
    expect(fmtTime("00:15")).toBe("12:15 am");
    expect(fmtTime("12:00")).toBe("12:00 pm");
    expect(addMinutes("14:00", 180)).toBe("17:00");
    expect(addMinutes("09:45", 30)).toBe("10:15");
  });

  it("today is a date string", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
