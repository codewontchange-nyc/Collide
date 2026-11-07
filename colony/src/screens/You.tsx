import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { useColonyState } from "@/store/store";
import { currentPerson, useMaps } from "@/store/selectors";
import { Screen, Rise, PageIntro, MetaLine, Avatar, Panel, PanelHead, List, ListRow, StatusWord, QuietButton, toast, sheets, appear, useReducedMotion } from "@/system";
import { InstallRow } from "@/shell/InstallRow";
import { statusLabel } from "@/domain/membership";
import { COPY } from "@/domain/copy";
import { fmtDate } from "@/domain/dates";
import { jumpMonths, resetDemo, setPersona } from "@/store/actions";
import { MEMBERSHIP_STATE, MEMBERSHIP_WORD } from "./you/status";
import "./You.css";

const VERSION = "0.1.0";
const UNLOCK_TAPS = 5;

/** You: my name over my home, the colony rows, the manifesto line, and the demo controls with the folio line at the foot. */
export function You() {
  const state = useColonyState();
  const maps = useMaps();
  const nav = useNavigate();
  const reduced = useReducedMotion();
  const me = currentPerson(state);
  const home = me ? maps.homes.get(maps.households.get(me.householdId)?.homeId ?? "") : undefined;
  const chef = state.providers.find((p) => p.primary === "cooking") ?? state.providers[0];
  const m = state.colony.membership;
  const today = state.meta.simToday;
  const taps = useRef(0);
  const [timeTravel, setTimeTravel] = useState(false);

  return (
    <Screen title="You">
      <Rise index={0}>
        <PageIntro
          eyebrow={<MetaLine facts={[me?.role === "steward" ? "STEWARD" : "MEMBER", home?.label.toUpperCase()]} />}
          aside={me ? <Avatar size="md" name={me.name} src={me.avatar} /> : undefined}
          title={me?.name ?? "You"}
          titleMuted={home ? `${home.label}, ${home.area}` : undefined}
          intro={COPY.manifesto[1]}
          editorial
        />
      </Rise>

      <Rise index={1}>
        <Panel>
          <PanelHead title="Colony" />
          <List>
            <ListRow
              title="Membership"
              facts={[statusLabel(m, today).toUpperCase()]}
              trailing={
                <StatusWord state={MEMBERSHIP_STATE[m.status]}>{MEMBERSHIP_WORD[m.status]}</StatusWord>
              }
              chevron
              href="/you/membership"
            />
            {chef && (
              <ListRow
                title={`Open provider view as ${chef.name.split(" ")[0]}`}
                facts="See the colony the way the people who show up see it"
                chevron
                onPress={() => {
                  setPersona({ mode: "provider", providerId: chef.id });
                  nav("/provider");
                }}
              />
            )}
            <InstallRow />
          </List>
        </Panel>
      </Rise>

      <Rise index={2}>
        <Panel>
          <PanelHead title="About" />
          <p className="paragraph-small secondary">{COPY.noCut}</p>
          <div>
            <QuietButton onClick={() => sheets.open({ kind: "manifesto" })}>READ THE WHOLE THING</QuietButton>
          </div>
        </Panel>
      </Rise>

      <Rise index={3}>
        <Panel>
          <PanelHead title="Demo" meta={`TODAY IS ${fmtDate(today).toUpperCase()}`} />
          <List as="div">
            <ListRow title="Advance a month" facts="Close the month and watch the pool grow." onPress={() => sheets.open({ kind: "advance" })} />
            {timeTravel && (
              <motion.div variants={reduced ? undefined : appear()} initial={reduced ? false : "hidden"} animate="show">
                <ListRow
                  title="Jump 6 months"
                  facts="Time travel, for the rollover story."
                  onPress={() => {
                    jumpMonths(6);
                    toast.show("Six months later.");
                  }}
                />
              </motion.div>
            )}
            <ListRow
              title="Reset the demo"
              facts="Back to the seeded colony"
              onPress={() => {
                resetDemo();
                toast.show(COPY.toast.reset);
              }}
            />
            <ListRow title="System library" facts="Every component, every variant." chevron href="/system" />
          </List>
          <button
            type="button"
            className="you-folio label-small"
            onClick={() => {
              taps.current += 1;
              if (taps.current >= UNLOCK_TAPS && !timeTravel) {
                setTimeTravel(true);
                toast.show("Time travel unlocked.");
              }
            }}
          >
            COLONY {VERSION}
          </button>
        </Panel>
      </Rise>
    </Screen>
  );
}
