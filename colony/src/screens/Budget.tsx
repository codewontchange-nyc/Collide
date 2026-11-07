import { useMemo } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise, PageIntro, MetaLine, Companion, StatTile, Figure, Meter, Notice, MetricStrip, Panel, PanelHead, List, ListRow, Avatar, Tag, StatusWord, QuietButton, Jar, Glyph, sheets } from "@/system";
import { fmt } from "@/domain/money";
import { fmtMonth, fmtMonthShort, fmtShort, monthOf } from "@/domain/dates";
import { cadenceLabel } from "@/domain/cadence";
import { canFund, contributions, directAllocations, directTotal, householdTotals, leftover, periodFor, poolBalance, poolHistory, projection } from "@/domain/budget";
import { CATALOG } from "@/seed/catalog";
import "./Budget.css";

export function Budget() {
  const state = useColonyState();
  const maps = useMaps();
  const month = monthOf(state.meta.simToday);

  const total = contributions(state);
  const allocs = useMemo(() => directAllocations(state, month), [state, month]);
  const direct = directTotal(state, month);
  const left = leftover(state, month);
  const rolls = Math.max(0, left);
  const balance = poolBalance(state);
  const period = periodFor(state, month);
  const history = useMemo(() => poolHistory(state).slice(0, 5), [state]);
  const proj = useMemo(() => projection(balance, rolls, 3, month), [balance, rolls, month]);
  const fundable = useMemo(() => canFund(balance, CATALOG, rolls).slice(0, 6), [balance, rolls]);
  const homes = useMemo(() => householdTotals(state), [state]);
  const jarMax = Math.max(balance, 300000);
  const percent = Math.round((balance / jarMax) * 100);

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

  const rollNote = left > 0 ? `+${fmt(left)} on the 1st` : "Nothing rolls this month";

  return (
    <Screen title="Budget">
      <Rise index={0}>
        <PageIntro
          eyebrow={<MetaLine facts={[fmtMonth(month).toUpperCase()]} />}
          aside={<Companion />}
          title="One budget,"
          titleMuted="well kept"
          intro={`${state.people.length} people put in ${fmt(state.colony.contributionCentsPerPerson)} each across ${state.homes.length} homes. The people who come every week are paid first, and what is left rolls into the pool.`}
          editorial
        />
      </Rise>

      <Rise index={1}>
        <div className="budget-hero">
          <dl>
            <StatTile label="A month, all together" value={<Figure value={total} format={fmt} size="lg" countUp />} unit="A MONTH" />
          </dl>
          <Meter
            parts={[
              { key: "direct", value: direct, label: `DIRECT ${fmt(direct)}` },
              { key: "pool", value: rolls, label: `TO THE POOL ${fmt(rolls)}` },
            ]}
            label={`Direct ${fmt(direct)}, to the pool ${fmt(rolls)}`}
          />
          {left < 0 && (
            <Notice kind="error" placement="inline" title={`Over by ${fmt(-left)}`}>
              Direct funds run over this month. Nothing rolls into the pool until that is settled.
            </Notice>
          )}
        </div>
      </Rise>

      <Rise index={2}>
        <MetricStrip
          columns={2}
          items={[
            { label: "IN THE POOL", value: <Figure value={balance} format={fmt} size="md" countUp data-testid="pool-balance" />, note: left > 0 ? `+${fmt(left)} on the 1st` : "nothing rolls this month" },
            { label: "FROM THE POOL", value: period ? <Figure value={period.indirectCents} format={fmt} size="md" /> : "-", note: "spent this month" },
          ]}
        />
      </Rise>

      <Rise index={3}>
        <Panel>
          <PanelHead title="Direct funds" meta={fmt(direct)} rule="ink" description="The people who come on a normal basis. Paid in full, no cut." />
          <List>
            {byProvider.map((g, i) => {
              const p = maps.providers.get(g.providerId);
              const first = g.rows[0];
              const eng = first ? maps.engagements.get(first.engagementId) : undefined;
              return (
                <ListRow
                  key={g.providerId}
                  leading={<Avatar size="md" name={p?.name ?? ""} src={p?.avatar} />}
                  title={p?.name ?? ""}
                  facts={[eng ? cadenceLabel(eng.cadence).toUpperCase() : undefined, `${g.rows.reduce((a, r) => a + r.occurrences, 0)} VISITS`]}
                  trailing={<Figure value={g.cents} format={fmt} size="sm" tone={i === 0 ? "ink" : "secondary"} />}
                  onPress={first ? () => sheets.open({ kind: "allocation", engagementId: first.engagementId }) : undefined}
                />
              );
            })}
          </List>
        </Panel>
      </Rise>

      <Rise index={4}>
        <Panel>
          <PanelHead title="Households" meta="FOR YOUR EYES ONLY" />
          <List>
            {homes.map((h) => {
              const hh = maps.households.get(h.householdId);
              const home = hh ? maps.homes.get(hh.homeId) : undefined;
              const names = (hh?.personIds ?? []).map((id) => (maps.people.get(id)?.name ?? "").split(" ")[0]?.toUpperCase() ?? "");
              return (
                <ListRow
                  key={h.householdId}
                  title={home?.label ?? hh?.name ?? ""}
                  facts={[names.join(" AND ")]}
                  trailing={<Figure value={h.contributionCents} format={fmt} size="sm" />}
                  trailingMeta={`${fmt(h.spendCents)} AT HOME`}
                  onPress={hh ? () => sheets.open({ kind: "household", id: hh.id }) : undefined}
                />
              );
            })}
          </List>
          <p className="paragraph-x-small budget-note">Colony never settles between households.</p>
        </Panel>
      </Rise>

      <Rise index={5}>
        <Panel>
          <PanelHead title="The pool" meta="ROLLS ON THE 1ST" rule="ink" />
          <button type="button" className="ig-pool" onClick={() => sheets.open({ kind: "pool" })}>
            <Jar cents={balance} maxCents={jarMax} size="lg" label={`Pool at ${percent} percent of ${fmt(jarMax)}`} />
            <span className="ig-pool__main">
              <Figure value={balance} format={fmt} size="md" />
              <span className="paragraph-x-small ig-pool__note">{rollNote}</span>
              <span className="ig-tags">
                {proj.map((p) => (
                  <Tag key={p.month} tone="outlined">
                    {fmtMonthShort(p.month).toUpperCase()} {fmt(p.balanceCents)}
                  </Tag>
                ))}
              </span>
            </span>
            <Glyph name="chevron-right" className="ig-pool__chevron" />
          </button>
          <p className="paragraph-x-small budget-note">Leftover rolls here. It funds the specialists we match you with: plumber, handyman, exterminator, seamstress.</p>
          <div>
            <QuietButton aria-label="Advance a month" onClick={() => sheets.open({ kind: "advance" })}>
              CLOSE THE MONTH
            </QuietButton>
          </div>
          {history.length > 0 && (
            <List density="dense">
              {history.map((e) => (
                <ListRow
                  key={e.id}
                  title={e.note}
                  facts={[fmtShort(e.date).toUpperCase()]}
                  trailing={<Figure value={e.cents} format={fmt} size="sm" signed sign={e.kind === "rollover_in" ? "+" : "-"} tone={e.kind === "rollover_in" ? "ink" : "secondary"} />}
                />
              ))}
            </List>
          )}
        </Panel>
      </Rise>

      <Rise index={6}>
        <Panel>
          <PanelHead title="What the pool can fund next" />
          <List>
            {fundable.map((f) => (
              <ListRow
                key={f.item.id}
                title={f.item.title}
                facts={[f.item.cadenceHint.toUpperCase(), `ABOUT ${fmt(f.item.estCents)}`]}
                trailing={
                  f.coveredNow ? (
                    <StatusWord state="success">COVERED NOW</StatusWord>
                  ) : f.monthsUntil === null ? (
                    <StatusWord state="inactive">OUT OF REACH</StatusWord>
                  ) : (
                    <StatusWord state="default">
                      IN {f.monthsUntil} MONTH{f.monthsUntil === 1 ? "" : "S"}
                    </StatusWord>
                  )
                }
                onPress={() => sheets.open({ kind: "request", category: f.item.skill })}
              />
            ))}
          </List>
        </Panel>
      </Rise>
    </Screen>
  );
}
