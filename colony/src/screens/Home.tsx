import { useEffect, useMemo } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise, PageIntro, MetaLine, Companion, WeekStrip, MetricStrip, Figure, Panel, PanelHead, List, ListRow, Avatar, Tag, StatusWord, EmptyState, sheets, companion } from "@/system";
import type { WeekDay } from "@/system";
import { addDays, compareDates, fmtDate, fmtDay, fmtShort, fmtTime, startOfWeek, WEEKDAY_SHORT, weekdayOf, monthOf, isBetween } from "@/domain/dates";
import { handledThisWeek, monthMeals, whoIsComing } from "@/domain/schedule";
import { COPY } from "@/domain/copy";
import type { Task } from "@/domain/types";
import { VERB, firstName, ledeForWeek, nextPlanned } from "@/screens/home/lede";
import "./Home.css";

const MEAL28_KEY = "colony.meal28.";

export function Home() {
  const state = useColonyState();
  const maps = useMaps();
  const today = state.meta.simToday;
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 7);
  const month = monthOf(today);

  const week = useMemo(() => whoIsComing(state, weekStart, 7), [state, weekStart]);
  const upcoming = useMemo(() => whoIsComing(state, today, 10).filter((i) => i.status === "planned"), [state, today]);
  const next = useMemo(() => nextPlanned(state), [state]);
  const lede = useMemo(() => ledeForWeek(state), [state]);
  const meals = useMemo(() => state.meals.filter((m) => isBetween(m.date, weekStart, weekEnd)).sort((a, b) => compareDates(a.date, b.date)), [state.meals, weekStart, weekEnd]);
  const mealsOfMonth = useMemo(() => state.meals.filter((m) => monthOf(m.date) === month).sort((a, b) => a.date.localeCompare(b.date)), [state.meals, month]);
  const monthMealCount = useMemo(() => monthMeals(state, month).length, [state, month]);
  const servedThisMonth = useMemo(() => monthMeals(state, month).filter((m) => m.status === "served").length, [state, month]);
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

  const busy = new Set(week.map((i) => i.date));
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const cmp = compareDates(d, today);
    return { date: d, weekday: WEEKDAY_SHORT[weekdayOf(d)], number: Number(d.slice(8)), relation: cmp === 0 ? "today" : cmp < 0 ? "past" : "future", busy: busy.has(d) };
  });

  /* The 28th dinner: the companion says the line once per month. */
  useEffect(() => {
    if (servedThisMonth !== 28) return;
    try {
      if (sessionStorage.getItem(MEAL28_KEY + month)) return;
      sessionStorage.setItem(MEAL28_KEY + month, "1");
    } catch {
      /* storage can be unavailable; the line is a delight, not a record */
    }
    companion.say(COPY.meal28);
  }, [servedThisMonth, month]);

  const nextProvider = next ? maps.providers.get(next.providerId) : undefined;
  const nextHome = next ? maps.homes.get(next.homeId) : undefined;

  return (
    <Screen title="Home">
      <Rise index={0}>
        <PageIntro eyebrow={<MetaLine facts={[state.colony.name, `WEEK OF ${fmtShort(weekStart)}`]} />} aside={<Companion />} title="Your colony" titleMuted="this week" intro={lede} editorial>
          <WeekStrip days={days} label="This week" />
        </PageIntro>
      </Rise>

      <Rise index={1}>
        <MetricStrip
          columns={2}
          items={[
            { label: "HANDLED THIS WEEK", value: <Figure value={handled} size="md" countUp />, note: "things you never had to ask for" },
            { label: "DINNERS", value: <Figure value={servedThisMonth} size="md" />, note: `of ${monthMealCount} this month` },
          ]}
        />
      </Rise>

      <Rise index={2}>
        <Panel>
          <PanelHead title="Next up" meta={next ? (next.date === today ? "TODAY" : fmtDate(next.date)) : undefined} />
          {next ? (
            <List>
              <ListRow
                leading={<Avatar size="md" name={nextProvider?.name ?? ""} src={nextProvider?.avatar} />}
                title={`${firstName(nextProvider?.name)} ${VERB[next.kind]} ${nextHome?.label ?? ""}`}
                facts={[next.date === today ? "TODAY" : fmtDate(next.date), fmtTime(next.start)]}
                chevron
                onPress={() => sheets.open({ kind: "visit", id: next.id })}
              />
            </List>
          ) : (
            <EmptyState compact title="A quiet week." body="Enjoy it." />
          )}
        </Panel>
      </Rise>

      <Rise index={3}>
        <Panel>
          <PanelHead title="Dinners" meta={`${servedThisMonth} OF ${monthMealCount} THIS MONTH`} />
          {meals.length === 0 ? (
            <EmptyState body="No dinners planned this week." />
          ) : (
            <List>
              {meals.map((m) => {
                const idx = mealsOfMonth.findIndex((x) => x.id === m.id) + 1;
                const chef = maps.providers.get(m.chefId);
                return (
                  <ListRow
                    key={m.id}
                    index={String(idx).padStart(2, "0")}
                    indexWidth="2ch"
                    className={idx === 28 ? "home-dinner--28" : undefined}
                    title={m.title}
                    ellipsis
                    facts={[fmtDay(m.date).split(" ")[0], m.cuisine, m.status === "served" && "SERVED"]}
                    trailing={<Avatar size="sm" name={chef?.name ?? ""} src={chef?.avatar} />}
                    onPress={() => sheets.open({ kind: "meal", id: m.id })}
                  />
                );
              })}
            </List>
          )}
        </Panel>
      </Rise>

      <Rise index={4}>
        <Panel>
          <PanelHead title="Cleaning" />
          <List>
            {cleans.map(({ home, item }) => {
              const who = item ? firstName(maps.providers.get(item.providerId)?.name) : "";
              return (
                <ListRow
                  key={home.id}
                  title={home.label}
                  facts={item ? [who, item.date === today ? "TODAY" : fmtDate(item.date), fmtTime(item.start)] : <span className="home-quiet">Nothing scheduled</span>}
                  trailing={item ? item.date === today ? <Tag tone="ink">TODAY</Tag> : <Tag tone="muted">{fmtDay(item.date)}</Tag> : undefined}
                  disabled={!item}
                  onPress={item ? () => sheets.open({ kind: "visit", id: item.id }) : undefined}
                />
              );
            })}
          </List>
        </Panel>
      </Rise>

      <Rise index={5}>
        <Panel>
          <PanelHead title="Plants" />
          <List>
            {plants.map(({ home, item }) => (
              <ListRow
                key={home.id}
                title={`${home.plantCount} plants at ${home.label}`}
                facts={item ? `${firstName(maps.providers.get(item.providerId)?.name)} comes ${fmtDate(item.date)}` : "Happy, as far as we know"}
                trailing={<StatusWord state="success">HAPPY</StatusWord>}
                onPress={item ? () => sheets.open({ kind: "visit", id: item.id }) : undefined}
              />
            ))}
          </List>
        </Panel>
      </Rise>

      <Rise index={6}>
        <Panel>
          <PanelHead title="Maintenance and seasonal" />
          {care.length === 0 ? (
            <EmptyState body="Nothing due. Ahead of every season." />
          ) : (
            <List>
              {care.map((t: Task) => (
                <ListRow
                  key={t.id}
                  title={t.title}
                  facts={[t.homeId ? maps.homes.get(t.homeId)?.label : undefined, fmtDate(t.dueOn)]}
                  trailing={<TaskStatus status={t.status} />}
                  onPress={() => sheets.open({ kind: "task", id: t.id })}
                />
              ))}
            </List>
          )}
        </Panel>
      </Rise>
    </Screen>
  );
}

/** The binding status map for tasks: a dot and a word. */
export function TaskStatus({ status }: { status: Task["status"] }) {
  switch (status) {
    case "needs_you":
      return (
        <StatusWord state="default" pulse>
          NEEDS YOU
        </StatusWord>
      );
    case "scheduled":
      return <StatusWord state="success">SCHEDULED</StatusWord>;
    case "queued":
      return <StatusWord state="default">QUEUED</StatusWord>;
    case "handled":
      return <StatusWord state="success">HANDLED</StatusWord>;
  }
}
