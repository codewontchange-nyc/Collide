import { useMemo } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Card } from "@/ui/Card";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { Stamp } from "@/ui/Stamp";
import { Empty } from "@/ui/Empty";
import { sheets } from "@/ui/sheetStore";
import { addDays, compareDates, fmtDate, fmtDay, fmtShort, fmtTime, startOfWeek, WEEKDAY_SHORT, weekdayOf, monthOf, isBetween } from "@/domain/dates";
import { handledThisWeek, monthMeals, whoIsComing } from "@/domain/schedule";
import { COPY } from "@/domain/copy";
import type { ScheduleItem, Task } from "@/domain/types";

const VERB: Record<ScheduleItem["kind"], string> = {
  meal: "cooks at",
  clean: "cleans",
  laundry: "picks up laundry at",
  plants: "tends the plants at",
  maintenance: "handles maintenance at",
  seasonal: "preps",
  shopping: "stocks",
  visit: "visits",
};

export function Home() {
  const state = useColonyState();
  const maps = useMaps();
  const today = state.meta.simToday;
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 7);

  const week = useMemo(() => whoIsComing(state, weekStart, 7), [state, weekStart]);
  const upcoming = useMemo(() => whoIsComing(state, today, 10).filter((i) => i.status === "planned"), [state, today]);
  const next = upcoming[0];
  const meals = useMemo(() => state.meals.filter((m) => isBetween(m.date, weekStart, weekEnd)).sort((a, b) => compareDates(a.date, b.date)), [state.meals, weekStart, weekEnd]);
  const monthMealCount = useMemo(() => monthMeals(state, monthOf(today)).length, [state, today]);
  const servedThisMonth = useMemo(() => monthMeals(state, monthOf(today)).filter((m) => m.status === "served").length, [state, today]);
  const cleans = useMemo(() => state.homes.map((h) => ({ home: h, item: upcoming.find((i) => i.kind === "clean" && i.homeId === h.id) })), [state.homes, upcoming]);
  const plants = useMemo(() => state.homes.map((h) => ({ home: h, item: upcoming.find((i) => i.kind === "plants" && i.homeId === h.id) })), [state.homes, upcoming]);
  const care = useMemo(
    () =>
      state.tasks
        .filter((t) => (t.source === "seasonal" || t.source === "maintenance" || t.source === "match") && t.status !== "handled" && compareDates(t.dueOn, addDays(today, -7)) >= 0)
        .sort((a, b) => compareDates(a.dueOn, b.dueOn))
        .slice(0, 4),
    [state.tasks, today],
  );
  const handled = useMemo(() => handledThisWeek(state, weekStart), [state, weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const busy = new Set(week.map((i) => i.date));

  return (
    <Screen>
      <Rise>
        <PageHead kicker={`${state.colony.name}, week of ${fmtShort(weekStart)}`} title="Your colony this week" />
        <div className="week" aria-label="This week">
          {days.map((d) => (
            <div key={d} className={["d", d === today ? "today" : ""].join(" ")}>
              <span>{WEEKDAY_SHORT[weekdayOf(d)]}</span>
              <b>{Number(d.slice(8))}</b>
              <span className={["dot", busy.has(d) ? "" : "none"].join(" ")} />
            </div>
          ))}
        </div>
      </Rise>

      <Rise className="section">
        <Kicker honey>Next up</Kicker>
        {next ? (
          <Card press onClick={() => sheets.open({ kind: "visit", id: next.id })} role="button" tabIndex={0}>
            <div className="row">
              <Avatar name={maps.providers.get(next.providerId)?.name ?? ""} src={maps.providers.get(next.providerId)?.avatar} size="lg" />
              <div className="grow">
                <h3>
                  {maps.providers.get(next.providerId)?.name.split(" ")[0]} {VERB[next.kind]} {maps.homes.get(next.homeId)?.label}
                </h3>
                <p className="sub small" style={{ marginTop: 4 }}>
                  {next.date === today ? "Today" : fmtDate(next.date)}, {fmtTime(next.start)}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Empty line={COPY.empty.week} />
        )}
      </Rise>

      <Rise className="section">
        <div className="title-row">
          <Kicker>Meals</Kicker>
          <span className="small muted tnum">
            {servedThisMonth} of {monthMealCount} this month
          </span>
        </div>
        <div className="list" style={{ marginTop: 6 }}>
          {meals.length === 0 && <Empty line="No dinners planned this week." />}
          {meals.map((m) => (
            <button key={m.id} type="button" className="item press" onClick={() => sheets.open({ kind: "meal", id: m.id })}>
              <span className="small muted tnum" style={{ width: 44 }}>
                {fmtDay(m.date).split(" ")[0]}
              </span>
              <div className="grow">
                <div className="t ellipsis">{m.title}</div>
                <div className="m">
                  {m.cuisine}
                  {m.status === "served" ? ", served" : ""}
                </div>
              </div>
              <Avatar name={maps.providers.get(m.chefId)?.name ?? ""} src={maps.providers.get(m.chefId)?.avatar} size="xs" />
            </button>
          ))}
        </div>
      </Rise>

      <Rise className="section off">
        <Kicker>Cleaning</Kicker>
        <div className="list">
          {cleans.map(({ home, item }) => (
            <button key={home.id} type="button" className="item press" onClick={() => item && sheets.open({ kind: "visit", id: item.id })} disabled={!item}>
              <div className="grow">
                <div className="t">{home.label}</div>
                <div className="m">{item ? `${maps.providers.get(item.providerId)?.name.split(" ")[0]}, ${item.date === today ? "today" : fmtDate(item.date)}, ${fmtTime(item.start)}` : "Nothing scheduled"}</div>
              </div>
              {item && <Chip tone={item.date === today ? "honey" : "paper"}>{item.date === today ? "Today" : fmtDay(item.date)}</Chip>}
            </button>
          ))}
        </div>
      </Rise>

      <Rise className="section">
        <Kicker>Plants</Kicker>
        <div className="list">
          {plants.map(({ home, item }) => (
            <button key={home.id} type="button" className="item press" onClick={() => item && sheets.open({ kind: "visit", id: item.id })} disabled={!item}>
              <div className="grow">
                <div className="t">
                  {home.plantCount} plants at {home.label}
                </div>
                <div className="m">{item ? `${maps.providers.get(item.providerId)?.name.split(" ")[0]} comes ${fmtDate(item.date)}` : "Happy, as far as we know"}</div>
              </div>
              <Chip tone="ok">Happy</Chip>
            </button>
          ))}
        </div>
      </Rise>

      <Rise className="section off">
        <Kicker>Maintenance and seasonal</Kicker>
        <div className="list">
          {care.length === 0 && <Empty line="Nothing due. Ahead of every season." />}
          {care.map((t: Task) => (
            <button key={t.id} type="button" className="item press" onClick={() => sheets.open({ kind: "task", id: t.id })}>
              <div className="grow">
                <div className="t">{t.title}</div>
                <div className="m">
                  {t.homeId ? `${maps.homes.get(t.homeId)?.label}, ` : ""}
                  {fmtDate(t.dueOn)}
                </div>
              </div>
              <Chip tone={t.status === "needs_you" ? "honey" : t.status === "scheduled" ? "ok" : "paper"}>{COPY.taskStatusLabel[t.status]}</Chip>
            </button>
          ))}
        </div>
      </Rise>

      <Rise className="section">
        <div className="row between">
          <Stamp animate={false}>Handled this week</Stamp>
          <span className="hero sm tnum" style={{ marginLeft: 0 }}>
            {handled}
          </span>
        </div>
        <p className="tiny muted" style={{ marginTop: 6 }}>
          Things you never had to ask for.
        </p>
      </Rise>
    </Screen>
  );
}
