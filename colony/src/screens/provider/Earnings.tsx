import { useMemo } from "react";
import { useColonyState } from "@/store/store";
import { currentProvider } from "@/store/selectors";
import { Screen, Rise, PageIntro, MetaLine, StatTile, Figure, Panel, PanelHead, List, ListRow, Meter, EmptyState } from "@/system";
import { BackToMember } from "./Today";
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

  if (!me) {
    return (
      <Screen title="Earnings">
        <EmptyState body="No provider selected." />
      </Screen>
    );
  }

  return (
    <Screen title="Earnings">
      <Rise index={0}>
        <PageIntro
          eyebrow={<MetaLine facts={["Provider view", fmtMonth(month)]} />}
          aside={<BackToMember />}
          title="Earnings"
          titleMuted={fmtMonth(month)}
          intro="Paid in full by the colony, straight to you. Colony takes no cut."
          editorial
        />
      </Rise>
      <Rise index={1}>
        <StatTile label="This month" value={<Figure value={total} format={fmt} size="lg" countUp />} unit="So far" />
      </Rise>
      <Rise index={2}>
        <Panel>
          <PanelHead title="By week" rule="ink" />
          {weeks.length === 0 ? (
            <EmptyState body="Nothing booked this month yet." />
          ) : (
            <List rule="none" density="dense">
              {weeks.map(([w, c]) => (
                <ListRow
                  key={w}
                  index={`${fmtDay(w)} to ${fmtDay(addDays(w, 6)).split(" ")[1]}`}
                  indexWidth="9ch"
                  title={<Meter parts={[{ key: "one", value: c }]} max={max} highlight={c === max} label={`${fmt(c)} of ${fmt(max)}`} />}
                  trailing={<Figure value={c} format={fmt} size="sm" />}
                />
              ))}
            </List>
          )}
        </Panel>
      </Rise>
      <Rise index={3}>
        <Panel>
          <PanelHead title="Visits" meta={`${fmtDay(firstOfMonth(month))} to ${fmtDay(lastOfMonth(month))}`} rule="ink" />
          <List rule="none" density="dense">
            {rows.map((r, i) => (
              <ListRow key={i} index={fmtDay(r.date)} indexWidth="6ch" title={r.label} trailing={<Figure value={r.cents} format={fmt} size="sm" />} />
            ))}
          </List>
        </Panel>
      </Rise>
    </Screen>
  );
}
