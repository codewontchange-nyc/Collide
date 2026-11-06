// The calendar engine: engagements become visits, chef visits become dinners,
// the season and the maintenance intervals become quiet tasks. All ids are
// deterministic so generating a month twice changes nothing.
import type {
  ColonyState,
  DateStr,
  Engagement,
  Meal,
  MonthStr,
  ScheduleItem,
  ScheduleKind,
  Skill,
  Task,
} from "@/domain/types";
import { addDays, addMinutes, dateInMonth, daysBetween, daysInMonth, isBetween, lastOfMonth, monthNumber, monthOf } from "@/domain/dates";
import { occurrences } from "@/domain/cadence";
import { MEALS } from "@/seed/meals";
import { MAINTENANCE, SEASONAL, maintenanceDue } from "@/seed/seasonal";

export const MEALS_PER_MONTH = 28;
export const MAX_DINNERS_PER_VISIT = 4;

export interface GeneratedMonth {
  schedule: ScheduleItem[];
  meals: Meal[];
  tasks: Task[];
}

export function kindForSkill(skill: Skill): ScheduleKind {
  switch (skill) {
    case "cooking":
      return "meal";
    case "cleaning":
      return "clean";
    case "laundry":
      return "laundry";
    case "plants":
      return "plants";
    case "shopping":
      return "shopping";
    case "house_manager":
      return "visit";
    case "seasonal":
      return "seasonal";
    default:
      return "maintenance";
  }
}

export function scheduleItemId(engagementId: string, date: DateStr, homeId: string): string {
  return `si_${engagementId}_${date}_${homeId}`;
}

export function mealId(engagementId: string, date: DateStr): string {
  return `meal_${engagementId}_${date}`;
}

function visitsFor(eng: Engagement, month: MonthStr): ScheduleItem[] {
  const dates = occurrences(eng.cadence, month, eng.startsOn);
  const start = eng.cadence.time;
  const end = addMinutes(start, eng.durationMin);
  const kind = kindForSkill(eng.skill);
  const out: ScheduleItem[] = [];
  for (const date of dates) {
    for (const homeId of eng.homeIds) {
      out.push({
        id: scheduleItemId(eng.id, date, homeId),
        engagementId: eng.id,
        providerId: eng.providerId,
        homeId,
        date,
        start,
        end,
        kind,
        title: eng.label,
        status: "planned",
      });
    }
  }
  return out;
}

/**
 * Each chef visit yields the dinners until the next visit, at most four, and a
 * month holds at most 28. A Monday and Thursday chef lands exactly 28 a month.
 */
function dinnersFor(eng: Engagement, month: MonthStr, visits: ScheduleItem[]): Meal[] {
  const dates = Array.from(new Set(visits.map((v) => v.date))).sort();
  const last = lastOfMonth(month);
  const offset = (monthNumber(month) * 3) % MEALS.length;
  const meals: Meal[] = [];
  for (let i = 0; i < dates.length; i++) {
    const visitDate = dates[i]!;
    const nextVisit = dates[i + 1];
    const span = nextVisit ? Math.min(MAX_DINNERS_PER_VISIT, Math.max(1, daysBetween(visitDate, nextVisit))) : MAX_DINNERS_PER_VISIT;
    const anchor = visits.find((v) => v.date === visitDate)!;
    for (let k = 0; k < span; k++) {
      if (meals.length >= MEALS_PER_MONTH) return meals;
      const date = addDays(visitDate, k);
      if (date > last) break;
      const seed = MEALS[(meals.length + offset) % MEALS.length]!;
      meals.push({
        id: mealId(eng.id, date),
        date,
        title: seed.title,
        cuisine: seed.cuisine,
        chefId: eng.providerId,
        homeIds: [...eng.homeIds],
        tags: [...seed.tags],
        scheduleItemId: anchor.id,
        status: "planned",
      });
    }
  }
  return meals;
}

function passiveTasks(state: ColonyState, month: MonthStr): Task[] {
  const mn = monthNumber(month);
  const due = dateInMonth(month, Math.min(15, daysInMonth(month)));
  const tasks: Task[] = [];
  for (const sea of SEASONAL) {
    if (!sea.months.includes(mn)) continue;
    if (sea.perHome) {
      for (const home of state.homes) {
        tasks.push({ id: `task_${sea.id}_${month}_${home.id}`, title: sea.title, category: sea.skill, homeId: home.id, status: "queued", dueOn: due, source: "seasonal" });
      }
    } else {
      tasks.push({ id: `task_${sea.id}_${month}`, title: sea.title, category: sea.skill, status: "queued", dueOn: due, source: "seasonal" });
    }
  }
  for (const mnt of MAINTENANCE) {
    if (!maintenanceDue(mnt, mn)) continue;
    if (mnt.perHome) {
      for (const home of state.homes) {
        tasks.push({ id: `task_${mnt.id}_${month}_${home.id}`, title: mnt.title, category: mnt.skill, homeId: home.id, status: "queued", dueOn: due, source: "maintenance" });
      }
    } else {
      tasks.push({ id: `task_${mnt.id}_${month}`, title: mnt.title, category: mnt.skill, status: "queued", dueOn: due, source: "maintenance" });
    }
  }
  return tasks;
}

/** Everything a month holds, from the engagements, the season and the maintenance intervals. */
export function generateMonth(state: ColonyState, month: MonthStr): GeneratedMonth {
  const schedule: ScheduleItem[] = [];
  const meals: Meal[] = [];
  for (const eng of state.engagements) {
    const visits = visitsFor(eng, month);
    schedule.push(...visits);
    if (eng.skill === "cooking" && visits.length) meals.push(...dinnersFor(eng, month, visits));
  }
  return { schedule, meals, tasks: passiveTasks(state, month) };
}

/** Adds a month's generated items to the state, keeping anything already there with the same id. */
export function mergeMonth(state: ColonyState, month: MonthStr): ColonyState {
  const gen = generateMonth(state, month);
  const have = (ids: Iterable<{ id: string }>) => new Set(Array.from(ids, (x) => x.id));
  const s = have(state.schedule);
  const m = have(state.meals);
  const t = have(state.tasks);
  return {
    ...state,
    schedule: [...state.schedule, ...gen.schedule.filter((x) => !s.has(x.id))],
    meals: [...state.meals, ...gen.meals.filter((x) => !m.has(x.id))],
    tasks: [...state.tasks, ...gen.tasks.filter((x) => !t.has(x.id))],
  };
}

function byDateTime(a: ScheduleItem, b: ScheduleItem): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : 1;
}

/** Schedule items in [from, from + days), sorted by date and time. */
export function whoIsComing(state: ColonyState, from: DateStr, days: number): ScheduleItem[] {
  const to = addDays(from, days);
  return state.schedule.filter((x) => isBetween(x.date, from, to)).sort(byDateTime);
}

export function weekItems(state: ColonyState, weekStart: DateStr): ScheduleItem[] {
  return whoIsComing(state, weekStart, 7);
}

export function monthMeals(state: ColonyState, month: MonthStr): Meal[] {
  return state.meals.filter((m) => monthOf(m.date) === month).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Done visits plus handled tasks in the week starting on weekStart. */
export function handledThisWeek(state: ColonyState, weekStart: DateStr): number {
  const to = addDays(weekStart, 7);
  const visits = state.schedule.filter((x) => x.status === "done" && isBetween(x.date, weekStart, to)).length;
  const tasks = state.tasks.filter((t) => t.status === "handled" && isBetween(t.dueOn, weekStart, to)).length;
  return visits + tasks;
}
