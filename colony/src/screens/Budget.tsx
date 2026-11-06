import { useMemo } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Card } from "@/ui/Card";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { Meter } from "@/ui/Meter";
import { Money } from "@/ui/Money";
import { Jar } from "@/ui/Jar";
import { Icon } from "@/ui/Icon";
import { sheets } from "@/ui/sheetStore";
import { fmt } from "@/domain/money";
import { fmtMonth, fmtMonthShort, fmtShort, monthOf } from "@/domain/dates";
import { cadenceLabel } from "@/domain/cadence";
import { canFund, contributions, directAllocations, directTotal, householdTotals, leftover, poolBalance, poolHistory, projection } from "@/domain/budget";
import { CATALOG } from "@/seed/catalog";
import { Companion } from "@/brand/Companion";

export function Budget() {
  const state = useColonyState();
  const maps = useMaps();
  const month = monthOf(state.meta.simToday);

  const total = contributions(state);
  const allocs = useMemo(() => directAllocations(state, month), [state, month]);
  const direct = directTotal(state, month);
  const left = leftover(state, month);
  const balance = poolBalance(state);
  const history = useMemo(() => poolHistory(state).slice(0, 5), [state]);
  const proj = useMemo(() => projection(balance, Math.max(0, left), 3, month), [balance, left, month]);
  const fundable = useMemo(() => canFund(balance, CATALOG, Math.max(0, left)).slice(0, 6), [balance, left]);
  const homes = useMemo(() => householdTotals(state), [state]);
  const jarMax = Math.max(balance, 300000);

  const byProvider = useMemo(() => {
    const m = new Map<string, { providerId: string; cents: number; rows: typeof allocs }>();
    for (const a of allocs) {
      const g = m.get(a.providerId) ?? { providerId: a.providerId, cents: 0, rows: [] };
      g.cents += a.cents;
      g.rows.push(a);
      m.set(a.providerId, g);
    }
    return [...m.values()].sort((a, b) => b.cents - a.cents);
  }, [allocs]);

  return (
    <Screen>
      <Rise>
        <PageHead
          kicker={fmtMonth(month)}
          title="One budget, well kept"
          right={
            <div className="row" style={{ gap: 4 }}>
              <button type="button" className="iconbtn" aria-label="Advance a month" onClick={() => sheets.open({ kind: "advance" })}>
                <Icon name="clock" />
              </button>
              <Companion />
            </div>
          }
        />
        <div className="hero">
          <Money cents={total} />
          <span className="unit">a month</span>
        </div>
        <p className="sub" style={{ marginTop: 10 }}>
          {state.people.length} people, {fmt(state.colony.contributionCentsPerPerson)} each. {state.homes.length} homes.
        </p>
        <div style={{ marginTop: 22 }}>
          <Meter parts={[{ cls: "direct", value: direct }, { cls: "pool", value: Math.max(0, left) }]} />
          <div className="legend">
            <span>
              <i style={{ background: "var(--ink)" }} />
              Direct {fmt(direct)}
            </span>
            <span>
              <i style={{ background: "var(--honey)" }} />
              To the pool {fmt(Math.max(0, left))}
            </span>
          </div>
          {left < 0 && (
            <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>
              Direct funds run {fmt(-left)} over this month. Nothing rolls into the pool until that is settled.
            </p>
          )}
        </div>
      </Rise>

      <Rise className="section">
        <Kicker>Direct funds</Kicker>
        <p className="small muted" style={{ marginBottom: 6 }}>
          The people who come on a normal basis. Paid in full, no cut.
        </p>
        <div className="list">
          {byProvider.map((g) => {
            const p = maps.providers.get(g.providerId);
            const first = g.rows[0];
            const eng = first ? maps.engagements.get(first.engagementId) : undefined;
            return (
              <button key={g.providerId} type="button" className="item press" onClick={() => first && sheets.open({ kind: "allocation", engagementId: first.engagementId })}>
                <Avatar name={p?.name ?? ""} src={p?.avatar} />
                <div className="grow">
                  <div className="t">{p?.name}</div>
                  <div className="m">
                    {eng ? cadenceLabel(eng.cadence) : ""}, {g.rows.reduce((a, r) => a + r.occurrences, 0)} visits
                  </div>
                </div>
                <span className="money r">{fmt(g.cents)}</span>
              </button>
            );
          })}
        </div>
      </Rise>

      <Rise className="section off">
        <Kicker>Households</Kicker>
        <div className="stack">
          {homes.map((h) => {
            const hh = maps.households.get(h.householdId);
            const home = hh ? maps.homes.get(hh.homeId) : undefined;
            return (
              <Card key={h.householdId} flat press onClick={() => hh && sheets.open({ kind: "household", id: hh.id })} role="button" tabIndex={0}>
                <div className="row between">
                  <div>
                    <div style={{ fontWeight: 400 }}>{home?.label ?? hh?.name}</div>
                    <div className="small muted">
                      {hh?.personIds.map((id) => maps.people.get(id)?.name.split(" ")[0]).join(" and ")}
                    </div>
                  </div>
                  <div className="right">
                    <div className="money">{fmt(h.contributionCents)}</div>
                    <div className="tiny muted">in, {fmt(h.spendCents)} at home</div>
                  </div>
                </div>
              </Card>
            );
          })}
          <p className="tiny muted">For your eyes only. Colony never settles between households.</p>
        </div>
      </Rise>

      <Rise className="section">
        <Kicker honey>The pool</Kicker>
        <Card press onClick={() => sheets.open({ kind: "pool" })} role="button" tabIndex={0}>
          <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
            <Jar cents={balance} maxCents={jarMax} />
            <div className="grow">
              <div className="hero sm" style={{ marginLeft: 0 }} data-testid="pool-balance">
                <Money cents={balance} />
              </div>
              <p className="small sub" style={{ marginTop: 6 }}>
                {left > 0 ? `+${fmt(left)} on the 1st` : "Nothing rolls this month"}
              </p>
              <p className="tiny muted" style={{ marginTop: 10 }}>
                Leftover rolls here. It funds the specialists we match you with: plumber, handyman, exterminator, seamstress.
              </p>
              <div className="chips" style={{ marginTop: 12 }}>
                {proj.map((p) => (
                  <Chip key={p.month} tone="line">
                    {fmtMonthShort(p.month)} {fmt(p.balanceCents)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <div className="list" style={{ marginTop: 8 }}>
          {history.map((e) => (
            <div key={e.id} className="item">
              <div className="grow">
                <div className="t">{e.note}</div>
                <div className="m">{fmtShort(e.date)}</div>
              </div>
              <span className={["money", "r", e.kind === "rollover_in" ? "" : "muted"].join(" ")}>
                {e.kind === "rollover_in" ? "+" : "-"}
                {fmt(e.cents)}
              </span>
            </div>
          ))}
        </div>
      </Rise>

      <Rise className="section off">
        <Kicker>What the pool can fund next</Kicker>
        <div className="list">
          {fundable.map((f) => (
            <button key={f.item.id} type="button" className="item press" onClick={() => sheets.open({ kind: "request", category: f.item.skill })}>
              <div className="grow">
                <div className="t">{f.item.title}</div>
                <div className="m">
                  {f.item.cadenceHint}, about {fmt(f.item.estCents)}
                </div>
              </div>
              <Chip tone={f.coveredNow ? "ok" : "paper"}>{f.coveredNow ? "Covered now" : f.monthsUntil === null ? "Out of reach" : `In ${f.monthsUntil} month${f.monthsUntil === 1 ? "" : "s"}`}</Chip>
            </button>
          ))}
        </div>
      </Rise>
    </Screen>
  );
}
