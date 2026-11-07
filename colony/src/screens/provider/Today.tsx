import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router";
import { useColonyState } from "@/store/store";
import { currentProvider, useMaps } from "@/store/selectors";
import {
  Screen,
  Rise,
  PageIntro,
  MetaLine,
  Avatar,
  QuietButton,
  MetricStrip,
  Card,
  Kicker,
  Button,
  Panel,
  PanelHead,
  List,
  ListRow,
  StatusWord,
  EmptyState,
  toast,
  companion,
  appear,
  dur,
  useReducedMotion,
} from "@/system";
import { addDays, compareDates, compareTimes, fmtDate, fmtTime } from "@/domain/dates";
import { COPY } from "@/domain/copy";
import { markVisitDone, setPersona } from "@/store/actions";
import "./Today.css";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"] as const;

/** Words under ten, digits from ten on ("four", "12"). */
export function countWord(n: number): string {
  return n < WORDS.length ? WORDS[n] : String(n);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The trail's aside on the three provider screens: sets the member persona and goes home. */
export function BackToMember() {
  const nav = useNavigate();
  const state = useColonyState();
  const me = state.people.find((p) => p.role === "steward") ?? state.people[0];
  return (
    <QuietButton
      tone="ink"
      onClick={() => {
        if (me) setPersona({ mode: "member", personId: me.id });
        nav("/");
      }}
    >
      Back to member
    </QuietButton>
  );
}

export function Today() {
  const state = useColonyState();
  const maps = useMaps();
  const reduced = useReducedMotion();
  const me = currentProvider(state);
  const today = state.meta.simToday;
  const items = useMemo(
    () =>
      state.schedule
        .filter((i) => me && i.providerId === me.id && compareDates(i.date, today) >= 0 && compareDates(i.date, addDays(today, 7)) < 0)
        .sort((a, b) => compareDates(a.date, b.date) || compareTimes(a.start, b.start)),
    [state.schedule, me, today],
  );
  const byDate = useMemo(() => {
    const m = new Map<string, typeof items>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return [...m.entries()];
  }, [items]);

  if (!me) {
    return (
      <Screen title="Today">
        <EmptyState body="No provider selected." />
      </Screen>
    );
  }

  const todayItems = items.filter((i) => i.date === today);
  const next = todayItems.find((i) => i.status === "planned");
  const nextHome = next ? maps.homes.get(next.homeId) : undefined;
  const firstName = me.name.split(" ")[0] ?? me.name;
  const lede =
    items.length === 0
      ? `${me.roleLine}. A quiet week.`
      : `${me.roleLine}. ${capitalize(countWord(items.length))} ${items.length === 1 ? "visit" : "visits"} in the next seven days, ${countWord(todayItems.length)} of them today.`;

  const done = (id: string) => {
    markVisitDone(id);
    companion.nod();
    toast.show(COPY.toast.visitDone);
  };

  let rise = 2;
  return (
    <Screen title="Today">
      <Rise index={0}>
        <PageIntro
          eyebrow={<MetaLine facts={[<Avatar key="face" size="sm" name={me.name} src={me.avatar} />, "Provider view", fmtDate(today)]} />}
          aside={<BackToMember />}
          title="Today,"
          titleMuted={firstName}
          intro={lede}
          editorial
        />
      </Rise>
      <Rise index={1}>
        <MetricStrip
          columns={2}
          items={[
            { label: "Today", value: todayItems.length },
            { label: "Next 7 days", value: items.length },
          ]}
        />
      </Rise>
      <AnimatePresence mode="wait" initial={false}>
        {next && nextHome && (
          <motion.div key={next.id} variants={appear(dur.information)} initial="hidden" animate="show" exit="exit" custom={0}>
            <Card ground="inverted" className="today-next" as="section" aria-label="Next visit">
              <span className="today-next__time label-small">{fmtTime(next.start)}</span>
              <div className="today-next__main">
                <Kicker>
                  Next · {fmtTime(next.start)} to {fmtTime(next.end)}
                </Kicker>
                <h2 className="today-next__title headline-small">{next.title}</h2>
                <MetaLine facts={[nextHome.address, nextHome.area]} />
              </div>
              <Button variant="glassy" hideIcon block className="today-next__action" onClick={() => done(next.id)}>
                Mark done
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {byDate.length === 0 && (
        <Rise index={2}>
          <EmptyState compact title="A quiet week." body="Nothing on the schedule for the next seven days." />
        </Rise>
      )}
      {byDate.map(([date, list]) => {
        const rows = list.filter((i) => i.id !== next?.id);
        if (rows.length === 0) return null;
        const isToday = date === today;
        return (
          <Rise key={date} index={rise++}>
            <Panel>
              <PanelHead title={isToday ? "Today" : fmtDate(date)} meta={`${list.length} ${list.length === 1 ? "visit" : "visits"}`} rule={isToday ? "ink" : "hairline"} />
              <List rule="none">
                {rows.map((i) => {
                  const home = maps.homes.get(i.homeId);
                  return (
                    <ListRow
                      key={i.id}
                      index={fmtTime(i.start)}
                      indexWidth="7ch"
                      title={i.title}
                      facts={[home?.address, `to ${fmtTime(i.end)}`]}
                      trailing={
                        <AnimatePresence mode="wait" initial={false}>
                          {i.status === "done" ? (
                            <motion.span key="done" initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.fast }}>
                              <StatusWord state="success">Done</StatusWord>
                            </motion.span>
                          ) : (
                            <motion.span key="mark" initial={false} exit={{ opacity: 0 }} transition={{ duration: dur.fast }}>
                              <QuietButton tone="ink" onClick={() => done(i.id)}>
                                Mark done
                              </QuietButton>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      }
                    />
                  );
                })}
              </List>
            </Panel>
          </Rise>
        );
      })}
    </Screen>
  );
}
