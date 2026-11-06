import { useMemo, useState } from "react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead } from "@/ui/PageHead";
import { Segmented } from "@/ui/Segmented";
import { Chip } from "@/ui/Chip";
import { Avatar } from "@/ui/Avatar";
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { sheets } from "@/ui/sheetStore";
import { compareDates, fmtDate } from "@/domain/dates";
import { COPY } from "@/domain/copy";
import { SKILL_LABEL } from "@/domain/types";

type Tab = "handled" | "you";

export function Needs() {
  const state = useColonyState();
  const maps = useMaps();
  const [tab, setTab] = useState<Tab>("handled");

  const needsYou = useMemo(() => state.tasks.filter((t) => t.status === "needs_you").sort((a, b) => compareDates(a.dueOn, b.dueOn)), [state.tasks]);
  const openNeeds = useMemo(() => state.needs.filter((n) => n.status === "matched" || n.status === "matching"), [state.needs]);
  const handled = useMemo(
    () =>
      state.tasks
        .filter((t) => t.status !== "needs_you")
        .sort((a, b) => {
          const order = { scheduled: 0, queued: 1, handled: 2 } as const;
          const d = order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
          return d !== 0 ? d : compareDates(b.dueOn, a.dueOn);
        })
        .slice(0, 40),
    [state.tasks],
  );
  const youCount = needsYou.length + openNeeds.length;

  return (
    <Screen>
      <Rise>
        <PageHead kicker="Passive todos" title="Needs" sub="Most of these you never have to ask for." />
        <Segmented
          id="needs"
          value={tab}
          onChange={setTab}
          options={[
            { v: "handled", label: "Handled for you" },
            { v: "you", label: youCount ? `Needs you (${youCount})` : "Needs you" },
          ]}
        />
      </Rise>

      {tab === "you" ? (
        <Rise className="section" key="you">
          {youCount === 0 && <Empty line={COPY.empty.needs} hint="We will tap you when a choice is yours to make." />}
          <div className="list">
            {openNeeds.map((n) => (
              <button key={n.id} type="button" className="item press" onClick={() => (n.status === "matched" ? sheets.open({ kind: "match", needId: n.id }) : undefined)}>
                <div className="grow">
                  <div className="t">{n.title}</div>
                  <div className="m">
                    {maps.homes.get(n.homeId)?.label}, {COPY.urgencyLabel[n.urgency].toLowerCase()}
                  </div>
                </div>
                <Chip tone="honey">{COPY.needStatusLabel[n.status]}</Chip>
              </button>
            ))}
            {needsYou.map((t) => (
              <button key={t.id} type="button" className="item press" onClick={() => sheets.open({ kind: "task", id: t.id })}>
                <div className="grow">
                  <div className="t">{t.title}</div>
                  <div className="m">
                    {t.homeId ? `${maps.homes.get(t.homeId)?.label}, ` : ""}
                    {fmtDate(t.dueOn)}
                  </div>
                </div>
                <Chip tone="honey">Needs you</Chip>
              </button>
            ))}
          </div>
        </Rise>
      ) : (
        <Rise className="section" key="handled">
          {handled.length === 0 && <Empty line={COPY.empty.handled} />}
          <div className="list">
            {handled.map((t) => {
              const p = t.handledBy ? maps.providers.get(t.handledBy) : undefined;
              return (
                <button key={t.id} type="button" className="item press" onClick={() => sheets.open({ kind: "task", id: t.id })}>
                  {p ? <Avatar name={p.name} src={p.avatar} size="sm" /> : <span className="avatar sm">{SKILL_LABEL[t.category][0]}</span>}
                  <div className="grow">
                    <div className="t">{t.title}</div>
                    <div className="m">
                      {p ? `${p.name.split(" ")[0]}, ` : ""}
                      {t.homeId ? `${maps.homes.get(t.homeId)?.label}, ` : ""}
                      {fmtDate(t.dueOn)}
                    </div>
                  </div>
                  <Chip tone={t.status === "handled" ? "ok" : t.status === "scheduled" ? "ink" : "paper"}>{COPY.taskStatusLabel[t.status]}</Chip>
                </button>
              );
            })}
          </div>
        </Rise>
      )}

      <button type="button" className="fab" onClick={() => sheets.open({ kind: "request" })}>
        <Icon name="plus" size={18} />
        Request something
      </button>
    </Screen>
  );
}
