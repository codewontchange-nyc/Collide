import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useColonyState } from "@/store/store";
import { currentProvider, useMaps } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Avatar } from "@/ui/Avatar";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { Empty } from "@/ui/Empty";
import { Stamp } from "@/ui/Stamp";
import { toast } from "@/ui/Toast";
import { addDays, compareDates, compareTimes, fmtDate, fmtTime } from "@/domain/dates";
import { COPY } from "@/domain/copy";
import { markVisitDone, setPersona } from "@/store/actions";
import { companion } from "@/brand/companion";

export function ModeBar() {
  const nav = useNavigate();
  const state = useColonyState();
  const me = state.people.find((p) => p.role === "steward") ?? state.people[0];
  return (
    <div className="mode-bar">
      <Chip tone="honey">Provider view</Chip>
      <button
        type="button"
        className="btn text sm"
        onClick={() => {
          if (me) setPersona({ mode: "member", personId: me.id });
          nav("/");
        }}
      >
        Back to member
      </button>
    </div>
  );
}

export function Today() {
  const state = useColonyState();
  const maps = useMaps();
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

  if (!me) return <Screen><Empty line="No provider selected." /></Screen>;

  return (
    <Screen>
      <Rise>
        <ModeBar />
        <PageHead kicker={fmtDate(today)} title={`Today, ${me.name.split(" ")[0]}`} sub={<em>{me.roleLine}</em>} companion={false} right={<Avatar name={me.name} src={me.avatar} size="lg" />} />
      </Rise>
      {byDate.length === 0 && (
        <Rise>
          <Empty line="A quiet week." hint="Nothing on the schedule for the next seven days." />
        </Rise>
      )}
      {byDate.map(([date, list]) => (
        <Rise key={date} className="section" style={{ marginTop: 28 }}>
          <Kicker honey={date === today}>{date === today ? "Today" : fmtDate(date)}</Kicker>
          <div className="list">
            {list.map((i) => {
              const home = maps.homes.get(i.homeId);
              return (
                <div key={i.id} className="item">
                  <div className="grow">
                    <div className="t">{i.title}</div>
                    <div className="m">
                      {home?.address}. {fmtTime(i.start)} to {fmtTime(i.end)}
                    </div>
                  </div>
                  {i.status === "done" ? (
                    <Stamp animate={false}>Done</Stamp>
                  ) : (
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        markVisitDone(i.id);
                        companion.nod();
                        toast.show(COPY.toast.visitDone);
                      }}
                    >
                      Mark done
                    </Btn>
                  )}
                </div>
              );
            })}
          </div>
        </Rise>
      ))}
    </Screen>
  );
}
