import { useState } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Sheet } from "@/ui/Sheet";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { Jar } from "@/ui/Jar";
import { Money } from "@/ui/Money";
import { toast } from "@/ui/Toast";
import { sheets } from "@/ui/sheetStore";
import { companion } from "@/brand/companion";
import { fmt } from "@/domain/money";
import { addMonths, fmtMonth, fmtMonthShort, fmtShort, monthOf } from "@/domain/dates";
import { canFund, directTotal, leftover, poolBalance, poolHistory, projection } from "@/domain/budget";
import { CATALOG } from "@/seed/catalog";
import { COPY } from "@/domain/copy";
import { advanceMonth } from "@/store/actions";

export function PoolSheet() {
  const state = useColonyState();
  const maps = useMaps();
  const month = monthOf(state.meta.simToday);
  const balance = poolBalance(state);
  const left = Math.max(0, leftover(state, month));
  const history = poolHistory(state);
  const proj = projection(balance, left, 6, month);
  const fundable = canFund(balance, CATALOG, left);
  return (
    <Sheet kicker="Indirect funds" title="The pool">
      <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
        <Jar cents={balance} maxCents={Math.max(balance, 300000)} />
        <div className="grow">
          <div className="hero sm" style={{ marginLeft: 0 }}>
            <Money cents={balance} animate={false} />
          </div>
          <p className="small sub" style={{ marginTop: 6 }}>
            Rolls over every month. Funds the people who manage many homes.
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
      <div className="kicker" style={{ marginTop: 22, marginBottom: 6, marginLeft: 0 }}>
        What it can fund next
      </div>
      <div className="list">
        {fundable.map((f) => (
          <button key={f.item.id} type="button" className="item press" onClick={() => sheets.swap({ kind: "request", category: f.item.skill })}>
            <div className="grow">
              <div className="t">{f.item.title}</div>
              <div className="m">
                {f.item.cadenceHint}, about {fmt(f.item.estCents)}
              </div>
            </div>
            <Chip tone={f.coveredNow ? "ok" : "paper"}>{f.coveredNow ? "Covered" : f.monthsUntil === null ? "Later" : `${f.monthsUntil} mo`}</Chip>
          </button>
        ))}
      </div>
      <div className="kicker" style={{ marginTop: 22, marginBottom: 6, marginLeft: 0 }}>
        History
      </div>
      <div className="list">
        {history.map((e) => (
          <div key={e.id} className="item">
            <div className="grow">
              <div className="t">{e.note}</div>
              <div className="m">
                {fmtShort(e.date)}
                {e.providerId ? `, ${maps.providers.get(e.providerId)?.name}` : ""}
              </div>
            </div>
            <span className={["money", e.kind === "rollover_in" ? "" : "muted"].join(" ")}>
              {e.kind === "rollover_in" ? "+" : "-"}
              {fmt(e.cents)}
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function AdvanceMonthSheet() {
  const state = useColonyState();
  const month = monthOf(state.meta.simToday);
  const left = leftover(state, month);
  const direct = directTotal(state, month);
  const [done, setDone] = useState(false);
  const [before] = useState(() => poolBalance(state));
  return (
    <Sheet
      kicker="Demo clock"
      title={done ? `Welcome to ${fmtMonth(monthOf(state.meta.simToday))}` : `Close ${fmtMonth(month)}`}
      foot={
        done ? (
          <Btn block onClick={sheets.close}>
            Done
          </Btn>
        ) : (
          <>
            <Btn variant="ghost" onClick={sheets.close}>
              Not yet
            </Btn>
            <Btn
              variant="honey"
              onClick={() => {
                advanceMonth();
                setDone(true);
                companion.say(left > 0 ? COPY.toast.monthClosed : COPY.toast.monthClosedTight);
                toast.show(left > 0 ? `${fmt(left)} rolled into the pool.` : COPY.toast.monthClosedTight);
              }}
            >
              Close the month
            </Btn>
          </>
        )
      }
    >
      {done ? (
        <div className="row" style={{ gap: 20 }}>
          <Jar cents={poolBalance(state)} maxCents={Math.max(poolBalance(state), 300000)} />
          <div className="grow">
            <div className="hero sm" style={{ marginLeft: 0 }}>
              <Money cents={poolBalance(state)} />
            </div>
            <p className="small sub" style={{ marginTop: 6 }}>
              {poolBalance(state) > before ? `Up ${fmt(poolBalance(state) - before)} from last month.` : "Held steady."}
            </p>
            <p className="small muted" style={{ marginTop: 10 }}>
              Next month's schedule is in. Dinners, cleaning, plants, the usual.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="sub">This closes the month like the 1st just arrived: contributions in, direct funds paid, leftover rolled.</p>
          <div className="list" style={{ marginTop: 14 }}>
            <div className="item">
              <div className="grow t">Contributions</div>
              <span className="money">{fmt(state.people.reduce((a, p) => a + p.contributionCents, 0))}</span>
            </div>
            <div className="item">
              <div className="grow t">Direct funds paid</div>
              <span className="money">-{fmt(direct)}</span>
            </div>
            <div className="item">
              <div className="grow t">Rolls into the pool</div>
              <span className="money" style={{ color: left > 0 ? "var(--honey-ink)" : "var(--danger)" }}>
                {left > 0 ? `+${fmt(left)}` : fmt(left)}
              </span>
            </div>
          </div>
          <p className="tiny muted" style={{ marginTop: 14 }}>
            Then {fmtMonth(addMonths(month, 1))} begins and the schedule writes itself.
          </p>
        </>
      )}
    </Sheet>
  );
}
