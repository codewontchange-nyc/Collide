/* The membership status on the kit's dot and word map (contract 7.3): a yes is green, a pending thing is the default dot,
   a failure is red, a no is the inactive ring. Shared by You and Membership so the two screens never disagree. */
import type { Membership } from "@/domain/types";
import type { DotState } from "@/system";

export const MEMBERSHIP_STATE: Record<Membership["status"], DotState> = {
  active: "success",
  trialing: "default",
  past_due: "error",
  canceled: "inactive",
};

export const MEMBERSHIP_WORD: Record<Membership["status"], string> = {
  active: "ACTIVE",
  trialing: "TRIAL",
  past_due: "PAST DUE",
  canceled: "CANCELED",
};
