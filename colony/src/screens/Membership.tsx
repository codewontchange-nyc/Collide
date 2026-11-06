import { useNavigate } from "react-router";
import { useColonyState } from "@/store/store";
import { Screen, Rise } from "@/ui/Screen";
import { PageHead, Kicker } from "@/ui/PageHead";
import { Btn } from "@/ui/Btn";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { Icon } from "@/ui/Icon";
import { Toggle } from "@/ui/Toggle";
import { Money } from "@/ui/Money";
import { toast } from "@/ui/Toast";
import { fmt } from "@/domain/money";
import { fmtDate } from "@/domain/dates";
import { isLive, nextChargeLine, statusLabel } from "@/domain/membership";
import { COPY } from "@/domain/copy";
import { cancelAtPeriodEnd, startMembership } from "@/store/actions";
import { contributions } from "@/domain/budget";
import { makeBilling } from "@/data/billing";

const INCLUDED = [
  "Planning, needs and passive todos for every home",
  "Direct funds organized, indirect funds rolled and matched",
  "Curated people for your streets and your lifestyle",
  "Bring your own team, they stay yours",
  "No cut of anyone's pay. Tips and bonuses are between you",
];

export function Membership() {
  const state = useColonyState();
  const nav = useNavigate();
  const m = state.colony.membership;
  const live = isLive(m, state.meta.simToday);
  const billing = makeBilling();

  return (
    <Screen>
      <Rise>
        <div className="row" style={{ marginBottom: 12 }}>
          <button type="button" className="iconbtn" style={{ marginLeft: -10 }} onClick={() => nav(-1)} aria-label="Back">
            <Icon name="back" />
          </button>
        </div>
        <PageHead kicker="Membership" title="One flat fee per colony" companion={false} right={<Chip tone={m.status === "active" ? "ok" : m.status === "trialing" ? "honey" : "danger"}>{statusLabel(m, state.meta.simToday)}</Chip>} />
        <div className="hero">
          <Money cents={m.priceCents} animate={false} />
          <span className="unit">a month</span>
        </div>
        <p className="sub" style={{ marginTop: 10 }}>
          {COPY.noCut} Your {fmt(contributions(state))} goes to the people who show up.
        </p>
      </Rise>

      <Rise className="section">
        <Kicker>What is included</Kicker>
        <div className="list">
          {INCLUDED.map((line) => (
            <div key={line} className="item">
              <Icon name="check" size={18} />
              <div className="t">{line}</div>
            </div>
          ))}
        </div>
      </Rise>

      <Rise className="section off">
        <Card flat>
          <div className="row between">
            <div>
              <div style={{ fontWeight: 400 }}>{nextChargeLine(m)}</div>
              <div className="small muted">
                {m.status === "trialing" ? `Trial ends ${fmtDate(m.trialEndsAt)}` : `Period ends ${fmtDate(m.periodEnd)}`}
              </div>
            </div>
          </div>
        </Card>
      </Rise>

      <Rise className="section stack">
        {!live || m.status === "trialing" ? (
          <Btn
            variant="honey"
            block
            onClick={async () => {
              const r = await billing.checkout(state.colony.id);
              startMembership();
              toast.show("url" in r ? "Opening checkout." : "Checkout would open Stripe here. Marked active for the demo.", { ms: 3600 });
            }}
          >
            Start membership
          </Btn>
        ) : null}
        <Btn
          variant="ghost"
          block
          onClick={async () => {
            await billing.portal();
            toast.show("Billing portal would open Stripe here.", { ms: 3200 });
          }}
        >
          Manage billing
        </Btn>
        {live && m.status !== "trialing" && (
          <div className="item" style={{ borderBottom: 0 }}>
            <div className="grow">
              <div className="t">Cancel at period end</div>
              <div className="m">We will keep everything running until {fmtDate(m.periodEnd)}.</div>
            </div>
            <Toggle
              on={m.cancelAtPeriodEnd}
              label="Cancel at period end"
              onChange={(v) => {
                cancelAtPeriodEnd(v);
                toast.show(v ? COPY.toast.membershipCanceling : COPY.toast.membershipKept);
              }}
            />
          </div>
        )}
      </Rise>
    </Screen>
  );
}
