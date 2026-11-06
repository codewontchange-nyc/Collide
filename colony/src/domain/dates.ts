// Pure date helpers. No library, all string math on "YYYY-MM-DD" and "YYYY-MM", UTC underneath.
import type { DateStr, MonthStr, TimeStr, Weekday } from "@/domain/types";

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parts(d: DateStr): { y: number; m: number; day: number } {
  return { y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)), day: Number(d.slice(8, 10)) };
}

function toUtc(d: DateStr): number {
  const p = parts(d);
  return Date.UTC(p.y, p.m - 1, p.day);
}

function fromUtc(ms: number): DateStr {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's calendar date on the device, as YYYY-MM-DD. */
export function todayStr(): DateStr {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: DateStr, n: number): DateStr {
  return fromUtc(toUtc(d) + n * DAY_MS);
}

export function addMonths(month: MonthStr, n: number): MonthStr {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${pad(mm + 1)}`;
}

export function monthOf(date: DateStr): MonthStr {
  return date.slice(0, 7);
}

/** 1..12 */
export function monthNumber(month: MonthStr): number {
  return Number(month.slice(5, 7));
}

export function daysInMonth(month: MonthStr): number {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function firstOfMonth(month: MonthStr): DateStr {
  return `${month}-01`;
}

export function lastOfMonth(month: MonthStr): DateStr {
  return `${month}-${pad(daysInMonth(month))}`;
}

export function dayOfMonth(date: DateStr): number {
  return parts(date).day;
}

/** The date for a day number in a month, clamped to the month's length. */
export function dateInMonth(month: MonthStr, day: number): DateStr {
  const clamped = Math.max(1, Math.min(day, daysInMonth(month)));
  return `${month}-${pad(clamped)}`;
}

export function weekdayOf(date: DateStr): Weekday {
  return new Date(toUtc(date)).getUTCDay() as Weekday;
}

/** Monday of the week that holds the date. */
export function startOfWeek(date: DateStr): DateStr {
  const wd = weekdayOf(date);
  const back = wd === 0 ? 6 : wd - 1;
  return addDays(date, -back);
}

export function isSameMonth(a: DateStr, b: DateStr): boolean {
  return monthOf(a) === monthOf(b);
}

export function compareDates(a: DateStr, b: DateStr): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Whole days from a to b, positive when b is later. */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function isBetween(date: DateStr, from: DateStr, toExclusive: DateStr): boolean {
  return date >= from && date < toExclusive;
}

/** All dates of a month, first to last. */
export function datesOfMonth(month: MonthStr): DateStr[] {
  const n = daysInMonth(month);
  const out: DateStr[] = [];
  for (let d = 1; d <= n; d++) out.push(`${month}-${pad(d)}`);
  return out;
}

/** "November 2026" */
export function fmtMonth(month: MonthStr): string {
  return `${MONTH_LONG[monthNumber(month) - 1]} ${month.slice(0, 4)}`;
}

/** "Nov" */
export function fmtMonthShort(month: MonthStr): string {
  return MONTH_SHORT[monthNumber(month) - 1] ?? month;
}

/** "Thu 14" */
export function fmtDay(date: DateStr): string {
  return `${WEEKDAY_SHORT[weekdayOf(date)]} ${parts(date).day}`;
}

/** "Thu, Nov 14" */
export function fmtDate(date: DateStr): string {
  const p = parts(date);
  return `${WEEKDAY_SHORT[weekdayOf(date)]}, ${MONTH_SHORT[p.m - 1]} ${p.day}`;
}

/** "Nov 14" */
export function fmtShort(date: DateStr): string {
  const p = parts(date);
  return `${MONTH_SHORT[p.m - 1]} ${p.day}`;
}

/** "14:00" -> "2:00 pm" */
export function fmtTime(time: TimeStr): string {
  const [hh, mm] = time.split(":").map(Number);
  const h = hh ?? 0;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(mm ?? 0)} ${suffix}`;
}

export function addMinutes(time: TimeStr, minutes: number): TimeStr {
  const [hh, mm] = time.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, (hh ?? 0) * 60 + (mm ?? 0) + minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function compareTimes(a: TimeStr, b: TimeStr): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "morning" before noon, "afternoon" until 17:00, "evening" after. */
export function partOfDay(time: TimeStr): "morning" | "afternoon" | "evening" {
  const h = Number(time.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
