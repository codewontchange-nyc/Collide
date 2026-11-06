// Cadence math: when a recurring engagement lands on the calendar.
import type { Cadence, DateStr, MonthStr, Weekday } from "@/domain/types";
import { WEEKDAY_SHORT, addDays, dateInMonth, datesOfMonth, daysBetween, fmtShort, monthOf, weekdayOf } from "@/domain/dates";

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function onCadence(cadence: Cadence, date: DateStr): boolean {
  switch (cadence.kind) {
    case "weekly":
      return cadence.days.includes(weekdayOf(date));
    case "biweekly":
      return mod(daysBetween(cadence.anchor, date), 14) === 0;
    case "monthly":
      return dateInMonth(monthOf(date), cadence.dayOfMonth) === date;
    case "once":
      return cadence.date === date;
  }
}

/** Every date in the month the cadence lands on, on or after startsOn when given. */
export function occurrences(cadence: Cadence, month: MonthStr, startsOn?: DateStr): DateStr[] {
  return datesOfMonth(month).filter((d) => (!startsOn || d >= startsOn) && onCadence(cadence, d));
}

/** The first date on or after `from` the cadence lands on, or null when it never will. */
export function nextOccurrence(cadence: Cadence, from: DateStr): DateStr | null {
  if (cadence.kind === "once") return cadence.date >= from ? cadence.date : null;
  for (let i = 0; i < 62; i++) {
    const d = addDays(from, i);
    if (onCadence(cadence, d)) return d;
  }
  return null;
}

/**
 * Budgeted occurrences for a month. The colony plans four weeks a month, so a
 * fifth Monday is a gift of the calendar, not a line in the budget.
 */
export function nominalOccurrences(cadence: Cadence, month: MonthStr, startsOn?: DateStr): number {
  if (startsOn && monthOf(startsOn) > month) return 0;
  switch (cadence.kind) {
    case "weekly":
      return cadence.days.length * 4;
    case "biweekly":
      return 2;
    case "monthly":
      return 1;
    case "once":
      return monthOf(cadence.date) === month ? 1 : 0;
  }
}

/** Average occurrences a month, for long projections. */
export function occurrencesPerMonthEstimate(cadence: Cadence): number {
  switch (cadence.kind) {
    case "weekly":
      return cadence.days.length * 4.33;
    case "biweekly":
      return 2.17;
    case "monthly":
      return 1;
    case "once":
      return 0;
  }
}

function joinDays(days: Weekday[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

/** "Mon and Thu", "Every other Wed", "Monthly on the 1st", "Once, Nov 14". */
export function cadenceLabel(cadence: Cadence): string {
  switch (cadence.kind) {
    case "weekly":
      return joinDays(cadence.days);
    case "biweekly":
      return `Every other ${WEEKDAY_SHORT[cadence.day]}`;
    case "monthly":
      return `Monthly on the ${ordinal(cadence.dayOfMonth)}`;
    case "once":
      return `Once, ${fmtShort(cadence.date)}`;
  }
}
