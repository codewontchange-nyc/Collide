import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { SheetContent, Button, Jar, Figure, StatusWord, MetaLine, Kicker, Panel, PanelHead, List, ListRow, toast, sheets, companion, appear, useReducedMotion } from "@/system";
import { fmt } from "@/domain/money";
import { addMonths, fmtMonth, fmtMonthShort, fmtShort, monthOf } from "@/domain/dates";
import { canFund, directTotal, leftover, poolBalance, poolHistory, projection } from "@/domain/budget";
import { CATALOG } from "@/seed/catalog";
import { COPY } from "@/domain/copy";
import { advanceMonth } from "@/store/actions";

const JAR_MAX = 300000;

export function PoolSheet() {
  const state = useColonyState();
  const maps = useMaps();
  const month = monthOf(state.meta.simToday);
  const balance = poolBalance(state);
  const left = Math.max(0, leftover(state, month));
  const history = poolHistory(state);
  const proj = projection(balance, left, 6, month);
  const fundable = canFund(balance, CATALOG, left);
  const max = Math.max(balance, JAR_MAX);
  return (
    <SheetContent eyebrow={<MetaLine facts={["Indirect funds", "Rolls on the 1st"]} />} title="The pool">
      <div className="sheet-head-block">
        <Jar size="lg" cents={balance} maxCents={max} animate={false} label={`Pool at ${Math.round((balance / max) * 100)} percent of ${fmt(max)}`} />
        <div className="sheet-head-block__main">
          <Figure value={balance} format={fmt} size="md" />
          <p className="sheet-note paragraph-x-small">Rolls over every month. Funds the people who manage many homes.</p>
        </div>
      </div>
      <Panel>
        <PanelHead title="If nothing is spent" meta="6 months" />
        <List rule="none" density="dense">
          {proj.map((p, i) => (
            <ListRow
              key={p.month}
              index={fmtMonthShort(p.month)}
              indexWidth="3ch"
              title=""
              facts={i === 0 ? ["If nothing is spent"] : undefined}
              trailing={<Figure value={p.balanceCents} format={fmt} size="sm" tone="secondary" />}
            />
          ))}
        </List>
      </Panel>
      <Panel>
        <PanelHead title="What it can fund next" />
        <List rule="none">
          {fundable.map((f) => {
            const months = f.monthsUntil;
            const trailing = f.coveredNow ? (
              <StatusWord state="success">Covered now</StatusWord>
            ) : months === null || !Number.isFinite(months) ? (
              <StatusWord state="inactive">Out of reach</StatusWord>
            ) : (
              <StatusWord state="default">
                In {months} {months === 1 ? "month" : "months"}
              </StatusWord>
            );
            return (
              <ListRow
                key={f.item.id}
                title={f.item.title}
                facts={[f.item.cadenceHint, `About ${fmt(f.item.estCents)}`]}
                trailing={trailing}
                onPress={() => sheets.swap({ kind: "request", category: f.item.skill })}
              />
            );
          })}
        </List>
      </Panel>
      {history.length > 0 && (
        <Panel>
          <PanelHead title="History" rule="ink" />
          <List rule="none">
            {history.map((e) => {
              const incoming = e.kind === "rollover_in";
              return (
                <ListRow
                  key={e.id}
                  title={e.note}
                  facts={[fmtShort(e.date), e.providerId ? maps.providers.get(e.providerId)?.name : undefined]}
                  trailing={<Figure value={e.cents} format={fmt} size="sm" signed sign={incoming ? "+" : "-"} tone={incoming ? "ink" : "secondary"} />}
                />
              );
            })}
          </List>
        </Panel>
      )}
    </SheetContent>
  );
}

export function AdvanceMonthSheet() {
  const state = useColonyState();
  const reduced = useReducedMotion();
  const month = monthOf(state.meta.simToday);
  const left = leftover(state, month);
  const direct = directTotal(state, month);
  const contributions = state.people.reduce((a, p) => a + p.contributionCents, 0);
  const [done, setDone] = useState(false);
  const [before] = useState(() => poolBalance(state));
  const balance = poolBalance(state);
  const max = Math.max(balance, JAR_MAX);
  const delta = balance - before;

  if (done) {
    return (
      <SheetContent
        eyebrow={<MetaLine facts={["Demo clock", fmtMonth(month)]} />}
        title={`Welcome to ${fmtMonth(month)}`}
        actions={
          <Button block hideIcon onClick={sheets.close}>
            Done
          </Button>
        }
      >
        <AnimatePresence initial={!reduced}>
          <motion.div key="after" className="sheet-head-block" variants={appear()} initial="hidden" animate="show" custom={0}>
            <Jar size="lg" cents={balance} maxCents={max} label={`Pool at ${Math.round((balance / max) * 100)} percent of ${fmt(max)}`} />
            <div className="sheet-head-block__main">
              <Figure value={balance} format={fmt} size="md" countUp />
              <p className="sheet-note paragraph-x-small">{delta > 0 ? `Up ${fmt(delta)} from last month.` : "Held steady."}</p>
              <p className="sheet-note paragraph-x-small">Next month's schedule is in. Dinners, cleaning, plants, the usual.</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </SheetContent>
    );
  }

  return (
    <SheetContent
      eyebrow={<Kicker tone="meta">Demo clock</Kicker>}
      title={`Close ${fmtMonth(month)}`}
      description="This closes the month like the 1st just arrived: contributions in, direct funds paid, leftover rolled."
      actions={
        <>
          <Button variant="grey" hideIcon onClick={sheets.close}>
            Not yet
          </Button>
          <Button
            onClick={() => {
              advanceMonth();
              setDone(true);
              companion.say(left > 0 ? COPY.toast.monthClosed : COPY.toast.monthClosedTight);
              toast.show(left > 0 ? `${fmt(left)} rolled into the pool.` : COPY.toast.monthClosedTight);
            }}
          >
            Close the month
          </Button>
        </>
      }
    >
      <List rule="ink" density="dense">
        <ListRow title="Contributions" trailing={<Figure value={contributions} format={fmt} size="sm" signed sign="+" />} />
        <ListRow title="Direct funds paid" trailing={<Figure value={direct} format={fmt} size="sm" signed sign="-" tone="secondary" />} />
        <ListRow
          rule="ink"
          title="Rolls into the pool"
          trailing={
            left > 0 ? (
              <Figure value={left} format={fmt} size="sm" signed sign="+" />
            ) : (
              <span className="advance-short">
                <StatusWord state="error">Short</StatusWord>
                <Figure value={left} format={fmt} size="sm" />
              </span>
            )
          }
        />
      </List>
      <p className="sheet-note paragraph-x-small">Then {fmtMonth(addMonths(month, 1))} begins and the schedule writes itself.</p>
    </SheetContent>
  );
}
