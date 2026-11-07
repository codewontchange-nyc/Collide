import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Variants } from "motion/react";
import { useColonyState } from "@/store/store";
import { useMaps } from "@/store/selectors";
import { Screen, Rise, PageIntro, MetaLine, Companion, Tabs, Panel, List, ListRow, Avatar, StatusWord, EmptyState, Button, sheets, screen, useReducedMotion } from "@/system";
import { compareDates, fmtDate } from "@/domain/dates";
import { COPY } from "@/domain/copy";
import { SKILL_LABEL } from "@/domain/types";
import { TaskStatus } from "@/screens/Home";
import "./Needs.css";

const TABS = [
  { label: "Handled for you", id: "handled" },
  { label: "Needs you", id: "you" },
] as const;

const WORDS = ["Nothing", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

const still: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

export function Needs() {
  const state = useColonyState();
  const maps = useMaps();
  const reduced = useReducedMotion();
  const [tab, setTab] = useState(0);

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
  const ask = youCount > 0 ? ` ${WORDS[youCount] ?? youCount} ${youCount === 1 ? "is" : "are"} waiting on a choice only you can make.` : "";
  const current = TABS[tab] ?? TABS[0];

  return (
    <Screen title="Needs">
      <Rise index={0}>
        <PageIntro eyebrow={<MetaLine facts={["PASSIVE TODOS"]} />} aside={<Companion />} title="Needs" titleMuted="most of them handled" intro={`Most of these you never have to ask for.${ask}`} editorial>
          <Tabs label="Needs" fill value={tab} onChange={setTab} tabs={[{ ...TABS[0] }, { ...TABS[1], count: youCount || undefined }]} />
        </PageIntro>
      </Rise>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={current.id} variants={reduced ? still : screen} initial="hidden" animate="show" exit="exit">
          <Panel role="tabpanel" id={`${current.id}-panel`} aria-labelledby={current.id}>
            {current.id === "you" ? (
              youCount === 0 ? (
                <EmptyState compact title={COPY.empty.needs} body="We will tap you when a choice is yours to make." />
              ) : (
                <List>
                  {openNeeds.map((n) => (
                    <ListRow
                      key={n.id}
                      title={n.title}
                      facts={[maps.homes.get(n.homeId)?.label, COPY.urgencyLabel[n.urgency].toUpperCase()]}
                      trailing={
                        <StatusWord state="default" pulse>
                          {n.status === "matched" ? "PICK SOMEONE" : "FINDING PEOPLE"}
                        </StatusWord>
                      }
                      disabled={n.status !== "matched"}
                      onPress={n.status === "matched" ? () => sheets.open({ kind: "match", needId: n.id }) : undefined}
                    />
                  ))}
                  {needsYou.map((t) => (
                    <ListRow
                      key={t.id}
                      title={t.title}
                      facts={[t.homeId ? maps.homes.get(t.homeId)?.label : undefined, fmtDate(t.dueOn)]}
                      trailing={<TaskStatus status={t.status} />}
                      onPress={() => sheets.open({ kind: "task", id: t.id })}
                    />
                  ))}
                </List>
              )
            ) : handled.length === 0 ? (
              <EmptyState compact title="Nothing handled yet." body="Give it a week." />
            ) : (
              <List>
                {handled.map((t) => {
                  const p = t.handledBy ? maps.providers.get(t.handledBy) : undefined;
                  return (
                    <ListRow
                      key={t.id}
                      leading={
                        p ? (
                          <Avatar size="md" name={p.name} src={p.avatar} />
                        ) : (
                          <span className="needs-tile headline-small" aria-hidden="true">
                            {SKILL_LABEL[t.category][0]}
                          </span>
                        )
                      }
                      title={t.title}
                      facts={[p ? p.name.split(" ")[0] : undefined, t.homeId ? maps.homes.get(t.homeId)?.label : undefined, fmtDate(t.dueOn)]}
                      trailing={<TaskStatus status={t.status} />}
                      onPress={() => sheets.open({ kind: "task", id: t.id })}
                    />
                  );
                })}
              </List>
            )}
          </Panel>
        </motion.div>
      </AnimatePresence>

      <Button fab icon="plus" onClick={() => sheets.open({ kind: "request" })}>
        Request something
      </Button>
    </Screen>
  );
}
