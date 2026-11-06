// Shared Stripe client + helpers for the colony-billing and colony-stripe-webhook functions.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_COLONY,
// APP_URL (optional), BILLING_CRON_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// NOT WIRED: designed alongside the prototype. Deploy together with
// supabase/schema.sql when the client moves off LocalRepo.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

export const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
export const stripe = new Stripe(STRIPE_KEY || "sk_test_missing", {
  httpClient: Stripe.createFetchHttpClient(),
});
export const APP_URL = (Deno.env.get("APP_URL") ?? "https://colony.vercel.app/").replace(/\/?$/, "/");

/** One plan: a flat membership per colony. Colony takes no cut of provider pay. */
export const PRICES: Record<string, string> = {
  colony: Deno.env.get("STRIPE_PRICE_COLONY") ?? "",
};

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-billing-secret",
};
export const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

export const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const svc = () => createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
export const userClient = (req: Request) =>
  createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
  });

export async function requireUser(req: Request) {
  const { data } = await userClient(req).auth.getUser();
  return data.user;
}

/** Statuses that count as "in the paper": Stripe's own vocabulary. */
export const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);
export const TERMINAL = new Set(["canceled", "incomplete_expired"]);

/**
 * Mirror a Stripe subscription into public.colony_subscriptions (idempotent).
 * Keyed by metadata.colony_id; the payer is metadata.profile_id, falling back
 * to the customer's colony_billing_customers row.
 */
export async function upsertSubscription(sub: Stripe.Subscription, sb = svc()) {
  const md = sub.metadata ?? {};
  const colony_id = uuidRe.test(md.colony_id ?? "") ? md.colony_id : null;
  let payer_id = uuidRe.test(md.profile_id ?? "") ? md.profile_id : null;
  if (!payer_id) {
    const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    const { data } = await sb.from("colony_billing_customers").select("profile_id").eq("stripe_customer_id", cust ?? "").maybeSingle();
    payer_id = data?.profile_id ?? null;
  }
  if (!colony_id) return { skipped: "no_colony" };
  if (!payer_id) return { skipped: "no_payer" };
  const item = sub.items?.data?.[0];
  const row = {
    stripe_subscription_id: sub.id,
    colony_id,
    payer_id,
    status: sub.status,
    stripe_price_id: item?.price?.id ?? null,
    unit_amount_cents: item?.price?.unit_amount ?? null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    livemode: !!sub.livemode,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("colony_subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) throw new Error("colony_subscriptions upsert: " + error.message);
  return { ok: true };
}
