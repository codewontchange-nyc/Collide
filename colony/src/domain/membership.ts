// Membership: one flat price per colony. Mirrors Collide's sub_live grace of 7 days.
import type { DateStr, Membership } from "@/domain/types";
import { addDays, daysBetween, fmtShort } from "@/domain/dates";
import { fmt } from "@/domain/money";

export const MEMBERSHIP_PRICE_CENTS = 14900;
export const PAST_DUE_GRACE_DAYS = 7;

/** Active or trialing, or past due within the grace window after the period end. */
export function isLive(m: Membership, today: DateStr): boolean {
  if (m.status === "active" || m.status === "trialing") return true;
  if (m.status === "past_due") return today <= addDays(m.periodEnd, PAST_DUE_GRACE_DAYS);
  return false;
}

export function statusLabel(m: Membership, today: DateStr): string {
  switch (m.status) {
    case "trialing": {
      const left = daysBetween(today, m.trialEndsAt);
      if (left <= 0) return "Trial ending";
      return left === 1 ? "Trial, 1 day left" : `Trial, ${left} days left`;
    }
    case "active":
      return m.cancelAtPeriodEnd ? `Ends ${fmtShort(m.periodEnd)}` : "Active";
    case "past_due":
      return isLive(m, today) ? "Past due, still on" : "Past due";
    case "canceled":
      return "Canceled";
  }
}

export function nextChargeLine(m: Membership): string {
  switch (m.status) {
    case "trialing":
      return `Trial ends ${fmtShort(m.trialEndsAt)}, then ${fmt(m.priceCents)} a month`;
    case "active":
      return m.cancelAtPeriodEnd
        ? `No further charges after ${fmtShort(m.periodEnd)}`
        : `${fmt(m.priceCents)} on ${fmtShort(m.periodEnd)}`;
    case "past_due":
      return `We will retry ${fmt(m.priceCents)} soon`;
    case "canceled":
      return "No further charges";
  }
}
