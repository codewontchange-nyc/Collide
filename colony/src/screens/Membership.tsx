import { useNavigate } from "react-router";
import { useColonyState } from "@/store/store";
import { Screen, Rise, PageIntro, MetaLine, StatusWord, StatTile, Figure, Panel, PanelHead, List, ListRow, Facts, Button, Switch, toast } from "@/system";
import { fmt } from "@/domain/money";
import { fmtDate } from "@/domain/dates";
import { isLive, nextChargeLine, statusLabel } from "@/domain/membership";
import { COPY } from "@/domain/copy";
import { cancelAtPeriodEnd, startMembership } from "@/store/actions";
import { contributions } from "@/domain/budget";
import { makeBilling } from "@/data/billing";
import { MEMBERSHIP_STATE } from "./you/status";
import "./Membership.css";

const INCLUDED = [
  "Planning, needs and passive todos for every home",
  "Direct funds organized, indirect funds rolled and matched",
  "Curated people for your streets and your lifestyle",
  "Bring your own team, they stay yours",
  "No cut of anyone's pay. Tips and bonuses are between you",
];
const pad = (n: number) => String(n).padStart(2, "0");

/** Membership: one flat fee per colony. The price as the hero, five indexed reading rows, the billing facts, the actions. */
export function Membership() {
  const state = useColonyState();
  const nav = useNavigate();
  const m = state.colony.membership;
  const today = state.meta.simToday;
  const live = isLive(m, today);
  const trialing = m.status === "trialing";
  const billing = makeBilling();

  return (
    <Screen title="Membership">
      <Rise index={0}>
        <PageIntro
          back={{ label: "Back", onPress: () => nav(-1) }}
          eyebrow={<MetaLine facts={["MEMBERSHIP"]} />}
          aside={<StatusWord state={MEMBERSHIP_STATE[m.status]}>{statusLabel(m, today).toUpperCase()}</StatusWord>}
          title="One flat fee"
          titleMuted="per colony"
          intro={`${COPY.noCut} Your ${fmt(contributions(state))} goes to the people who show up.`}
          editorial
        />
      </Rise>

      <Rise index={1}>
        <dl>
          <StatTile label="A month" value={<Figure value={m.priceCents} format={fmt} size="lg" />} unit="PER COLONY" />
        </dl>
      </Rise>

      <Rise index={2}>
        <Panel>
          <PanelHead title="What is included" rule="ink" />
          <List density="reading" rule="none">
            {INCLUDED.map((line, i) => (
              <ListRow key={line} index={pad(i + 1)} title={line} />
            ))}
          </List>
        </Panel>
      </Rise>

      <Rise index={3}>
        <Panel>
          <PanelHead title="Billing" />
          <Facts
            items={[
              { label: "NEXT", value: nextChargeLine(m) },
              { label: trialing ? "TRIAL ENDS" : "PERIOD ENDS", value: fmtDate(trialing ? m.trialEndsAt : m.periodEnd) },
            ]}
          />
        </Panel>
      </Rise>

      <Rise index={4}>
        <div className="membership-actions">
          {(!live || trialing) && (
            <Button
              block
              onClick={async () => {
                const r = await billing.checkout(state.colony.id);
                startMembership();
                toast.show("url" in r ? "Opening checkout." : "Checkout would open Stripe here. Marked active for the demo.", { ms: 3600 });
              }}
            >
              Start membership
            </Button>
          )}
          <Button
            variant="outlined"
            hideIcon
            block
            onClick={async () => {
              await billing.portal();
              toast.show("Billing portal would open Stripe here.", { ms: 3200 });
            }}
          >
            Manage billing
          </Button>
          {live && !trialing && (
            <Switch
              label="Cancel at period end"
              hint={`We will keep everything running until ${fmtDate(m.periodEnd)}.`}
              checked={m.cancelAtPeriodEnd}
              onChange={(v) => {
                cancelAtPeriodEnd(v);
                toast.show(v ? COPY.toast.membershipCanceling : COPY.toast.membershipKept);
              }}
            />
          )}
        </div>
      </Rise>
    </Screen>
  );
}
