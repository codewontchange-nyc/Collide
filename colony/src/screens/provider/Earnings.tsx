import { useMemo } from "react";
import { useColonyState } from "@/store/store";
import { currentProvider } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Money } from "@/ui/Money";
import { Empty } from "@/ui/Empty";
import { ModeBar } from "./Today";
import { addDays, compareDates, firstOfMonth, fmtDay, fmtMonth, lastOfMonth, monthOf, startOfWeek } from "@/domain/dates";
import { fmt } from "@/domain/money";

export function Earnings() {
  const state = useColonyState();
  const me = currentProvider(state);
  const month = monthOf(state.meta.simToday);

  const rows = useMemo(() => {
    if (!me) return [];
    const engCost = new Map(state.engagements.map((e) => [e.id, e]));
    const acceptedByNeed = new Map(state.matches.filter((m) => m.status === "accepted").map((m) => [m.needId, m]));
    const seen = new Set<string>();
    const out: { date: string; label: string; cents: number }[] = [];
    for (const i of state.schedule) {
      if (i.providerId !== me.id || monthOf(i.date) !== month) continue;
      if (i.engagementId) {
        const key = `${i.engagementId}_${i.date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const e = engCost.get(i.engagementId);
        if (e) out.push({ date: i.date, label: e.label, cents: e.costCents });
      } else if (i.needId) {
        const m = acceptedByNeed.get(i.needId);
        if (m && !seen.has(i.needId)) {
          seen.add(i.needId);
          out.push({ date: i.date, label: i.title, cents: m.quoteCents });
        }
      }
    }
    return out.sort((a, b) => compareDates(a.date, b.date));
  }, [state, me, month]);

  const total = rows.reduce((a, r) => a + r.cents, 0);
  const weeks = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(startOfWeek(r.date), (m.get(startOfWeek(r.date)) ?? 0) + r.cents);
    return [...m.entries()].sort(([a], [b]) => compareDates(a, b));
  }, [rows]);
  const max = Math.max(1, ...weeks.map(([, c]) => c));

  if (!me) return <Screen><Empty line="No provider selected." /></Screen>;

  return (
    <Screen>
      <Rise>
        <ModeBar />
        <PageHead kicker={fmtMonth(month)} title="Earnings" companion={false} />
        <div className="hero">
          <Money cents={total} />
          <span className="unit">this month</span>
        </div>
        <p className="sub" style={{ marginTop: 10 }}>
          Paid in full by the colony, straight to you. Colony takes no cut.
        </p>
      </Rise>
      <Rise className="section">
        <Kicker>By week</Kicker>
        <div className="stack" style={{ gap: 10 }}>
          {weeks.map(([w, c]) => (
            <div key={w} className="row">
              <span className="small muted tnum" style={{ width: 72 }}>
                {fmtDay(w)} to {fmtDay(addDays(w, 6)).split(" ")[1]}
              </span>
              <div className="meter grow">
                <span className="pool" style={{ width: `${(c / max) * 100}%` }} />
              </div>
              <span className="money tnum" style={{ width: 70, textAlign: "right" }}>
                {fmt(c)}
              </span>
            </div>
          ))}
          {weeks.length === 0 && <Empty line="Nothing booked this month yet." />}
        </div>
      </Rise>
      <Rise className="section off">
        <Kicker>Visits, {fmtDay(firstOfMonth(month))} to {fmtDay(lastOfMonth(month))}</Kicker>
        <div className="list">
          {rows.map((r, i) => (
            <div key={i} className="item">
              <span className="small muted tnum" style={{ width: 52 }}>
                {fmtDay(r.date)}
              </span>
              <div className="grow t">{r.label}</div>
              <span className="money r">{fmt(r.cents)}</span>
            </div>
          ))}
        </div>
      </Rise>
    </Screen>
  );
}
