/* The Home lede, composed from the engine. Pure: state in, one or two sentences out. */
import type { ColonyState, ScheduleItem } from "@/domain/types";
import { fmtDate, fmtTime } from "@/domain/dates";
import { whoIsComing } from "@/domain/schedule";
import { COPY } from "@/domain/copy";

export const VERB: Record<ScheduleItem["kind"], string> = {
  meal: "cooks at",
  clean: "cleans",
  laundry: "picks up laundry at",
  plants: "tends the plants at",
  maintenance: "handles maintenance at",
  seasonal: "preps",
  shopping: "stocks",
  visit: "visits",
};

/** Tasks that need a choice plus needs with people picked and waiting. */
export function youCount(state: ColonyState): number {
  return state.tasks.filter((t) => t.status === "needs_you").length + state.needs.filter((n) => n.status === "matched").length;
}

/** The next planned visit from the sim today, looking ten days out. */
export function nextPlanned(state: ColonyState): ScheduleItem | undefined {
  return whoIsComing(state, state.meta.simToday, 10).find((i) => i.status === "planned");
}

export function firstName(name: string | undefined): string {
  return (name ?? "").split(" ")[0] ?? "";
}

/** "{First} {verb} {home} today at {time}." or "... on {date} at {time}." */
export function nextSentence(state: ColonyState, next: ScheduleItem | undefined): string {
  if (!next) return COPY.empty.week;
  const who = firstName(state.providers.find((p) => p.id === next.providerId)?.name);
  const home = state.homes.find((h) => h.id === next.homeId)?.label ?? "";
  const when = next.date === state.meta.simToday ? "today" : `on ${fmtDate(next.date)}`;
  return `${who} ${VERB[next.kind]} ${home} ${when} at ${fmtTime(next.start)}.`;
}

export function askSentence(count: number): string {
  if (count === 0) return "Nothing is waiting on you.";
  if (count === 1) return "One thing is waiting on you.";
  return `${count} things are waiting on you.`;
}

export function ledeForWeek(state: ColonyState): string {
  return `${nextSentence(state, nextPlanned(state))} ${askSentence(youCount(state))}`;
}
