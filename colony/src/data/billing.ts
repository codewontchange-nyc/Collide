// Billing client: one plan, a flat membership per colony, billed through Stripe.
// LocalBilling runs the demo with no network. SupabaseBilling posts { mode, ... } to the
// colony-billing edge function (supabase/functions/colony-billing) once Supabase is configured.
// NOT WIRED: makeBilling() returns LocalBilling until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.

import type { ColonyEntitlements } from "./supabase.types";
import type { Client } from "./supabaseRepo";

function configured(): boolean {
  const env = import.meta.env as { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
  return !!(env.VITE_SUPABASE_URL ?? "").trim() && !!(env.VITE_SUPABASE_ANON_KEY ?? "").trim();
}

export type BillingLink = { url: string } | { error: string };

export interface BillingClient {
  /** Stripe Checkout for a colony's membership (steward only). */
  checkout(colonyId: string): Promise<BillingLink>;
  /** Stripe customer portal for the signed-in payer. */
  portal(): Promise<BillingLink>;
  /** Membership state for one colony: colony_entitlements(colony_id) plus `configured`. */
  status(colonyId: string): Promise<unknown>;
}

export type BillingStatus = Partial<ColonyEntitlements> & {
  ok?: boolean;
  configured?: boolean;
  price_cents?: number;
  stub?: boolean;
  error?: string;
};

/** The demo: resolves at once with stub payloads and never touches the network. */
export class LocalBilling implements BillingClient {
  async checkout(_colonyId: string): Promise<BillingLink> {
    return { error: "stub" };
  }
  async portal(): Promise<BillingLink> {
    return { error: "stub" };
  }
  async status(colonyId: string): Promise<BillingStatus> {
    return { stub: true, ok: true, configured: false, id: colonyId, plan: "colony", price_cents: 14900 };
  }
}

type Mode = "checkout-subscription" | "portal" | "status";

/** Talks to the colony-billing edge function with the signed-in user's JWT. */
export class SupabaseBilling implements BillingClient {
  constructor(private readonly client: Client) {}

  private async invoke<T>(mode: Mode, body: Record<string, unknown> = {}): Promise<T | { error: string }> {
    const { data, error } = await this.client.functions.invoke<T>("colony-billing", { body: { mode, ...body } });
    if (error) return { error: error.message };
    return (data ?? { error: "empty" }) as T | { error: string };
  }

  checkout(colonyId: string): Promise<BillingLink> {
    return this.invoke<{ url: string }>("checkout-subscription", { colony_id: colonyId });
  }

  portal(): Promise<BillingLink> {
    return this.invoke<{ url: string }>("portal");
  }

  status(colonyId: string): Promise<BillingStatus> {
    return this.invoke<BillingStatus>("status", { colony_id: colonyId });
  }
}

/** Loads supabase-js only when Supabase is configured, so the demo bundle stays light. */
class LazySupabaseBilling implements BillingClient {
  private inner: Promise<BillingClient> | null = null;
  private get(): Promise<BillingClient> {
    if (!this.inner)
      this.inner = import("./supabaseRepo").then((m) => {
        const client = m.getClient();
        return client ? new SupabaseBilling(client) : new LocalBilling();
      });
    return this.inner;
  }
  checkout(colonyId: string) {
    return this.get().then((b) => b.checkout(colonyId));
  }
  portal() {
    return this.get().then((b) => b.portal());
  }
  status(colonyId: string) {
    return this.get().then((b) => b.status(colonyId));
  }
}

/** SupabaseBilling when the client is configured, else the local stub. */
export function makeBilling(): BillingClient {
  return configured() ? new LazySupabaseBilling() : new LocalBilling();
}
