import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useColonyState } from "@/store/store";
import { currentPerson, useMaps } from "@/store/selectors";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Card } from "@/ui/Card";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { Icon } from "@/ui/Icon";
import { toast } from "@/ui/Toast";
import { sheets } from "@/ui/sheetStore";
import { InstallRow } from "@/shell/InstallRow";
import { statusLabel } from "@/domain/membership";
import { COPY } from "@/domain/copy";
import { fmtDate } from "@/domain/dates";
import { jumpMonths, resetDemo, setPersona } from "@/store/actions";

const VERSION = "0.1.0";

export function You() {
  const state = useColonyState();
  const maps = useMaps();
  const nav = useNavigate();
  const me = currentPerson(state);
  const home = me ? maps.homes.get(maps.households.get(me.householdId)?.homeId ?? "") : undefined;
  const chef = state.providers.find((p) => p.primary === "cooking") ?? state.providers[0];
  const taps = useRef(0);
  const [timeTravel, setTimeTravel] = useState(false);

  return (
    <Screen>
      <Rise>
        <PageHead kicker="You" title={me?.name ?? "You"} sub={home ? `${home.label}, ${home.area}` : undefined} companion={false} right={me ? <Avatar name={me.name} src={me.avatar} size="lg" /> : undefined} />
      </Rise>

      <Rise className="section">
        <Kicker>Colony</Kicker>
        <div className="list">
          <button type="button" className="item press" onClick={() => nav("/you/membership")}>
            <Icon name="colony" />
            <div className="grow">
              <div className="t">Membership</div>
              <div className="m">{statusLabel(state.colony.membership, state.meta.simToday)}</div>
            </div>
            <Chip tone={state.colony.membership.status === "active" ? "ok" : state.colony.membership.status === "trialing" ? "honey" : "danger"}>{state.colony.membership.status === "trialing" ? "Trial" : state.colony.membership.status === "active" ? "Active" : state.colony.membership.status === "past_due" ? "Past due" : "Canceled"}</Chip>
          </button>
          {chef && (
            <button
              type="button"
              className="item press"
              onClick={() => {
                setPersona({ mode: "provider", providerId: chef.id });
                nav("/provider");
              }}
            >
              <Icon name="today" />
              <div className="grow">
                <div className="t">Open provider view as {chef.name.split(" ")[0]}</div>
                <div className="m">See the colony the way the people who show up see it</div>
              </div>
              <Icon name="chev" size={16} />
            </button>
          )}
          <InstallRow />
        </div>
      </Rise>

      <Rise className="section off">
        <Kicker>About</Kicker>
        <Card flat>
          <p className="voice">{COPY.manifesto[1]}</p>
          <p className="small sub" style={{ marginTop: 12 }}>
            {COPY.noCut}
          </p>
          <button type="button" className="btn text sm" style={{ marginTop: 8, marginLeft: -10 }} onClick={() => sheets.open({ kind: "manifesto" })}>
            Read the whole thing
          </button>
        </Card>
      </Rise>

      <Rise className="section">
        <Kicker>Demo</Kicker>
        <div className="list">
          <button type="button" className="item press" onClick={() => sheets.open({ kind: "advance" })}>
            <Icon name="clock" />
            <div className="grow">
              <div className="t">Advance a month</div>
              <div className="m">Today is {fmtDate(state.meta.simToday)}. Close the month and watch the pool grow.</div>
            </div>
          </button>
          {timeTravel && (
            <button
              type="button"
              className="item press"
              onClick={() => {
                jumpMonths(6);
                toast.show("Six months later.");
              }}
            >
              <Icon name="spark" />
              <div className="grow">
                <div className="t">Jump 6 months</div>
                <div className="m">You found it. Time travel, for the rollover story.</div>
              </div>
            </button>
          )}
          <button
            type="button"
            className="item press"
            onClick={() => {
              resetDemo();
              toast.show(COPY.toast.reset);
            }}
          >
            <Icon name="back" />
            <div className="grow">
              <div className="t">Reset the demo</div>
              <div className="m">Back to the seeded colony</div>
            </div>
          </button>
          <button
            type="button"
            className="item"
            style={{ color: "var(--muted)" }}
            onClick={() => {
              taps.current += 1;
              if (taps.current >= 5 && !timeTravel) {
                setTimeTravel(true);
                toast.show("Time travel unlocked.");
              }
            }}
          >
            <div className="grow">
              <div className="m">Colony {VERSION}</div>
            </div>
          </button>
        </div>
      </Rise>
    </Screen>
  );
}
