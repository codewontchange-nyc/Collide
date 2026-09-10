// Shared Stripe client + helpers for the billing and stripe-webhook functions.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MAKER,
// STRIPE_PRICE_FACILITATOR, APP_URL (optional), BILLING_CRON_SECRET.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

export const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
export const stripe = new Stripe(STRIPE_KEY || "sk_test_missing", {
  httpClient: Stripe.createFetchHttpClient(),
});
export const APP_URL = (Deno.env.get("APP_URL") ?? "https://codewontchange-nyc.github.io/Collide/").replace(/\/?$/, "/");
export const PRICES: Record<string, string> = {
  maker: Deno.env.get("STRIPE_PRICE_MAKER") ?? "",
  facilitator: Deno.env.get("STRIPE_PRICE_FACILITATOR") ?? "",
};

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collide-city, x-billing-secret",
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

/** Statuses that count as "in the paper" — Stripe's own vocabulary. */
export const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);
export const TERMINAL = new Set(["canceled", "incomplete_expired"]);

/** Mirror a Stripe subscription into public.subscriptions (idempotent). */
export async function upsertSubscription(sub: Stripe.Subscription, sb = svc()) {
  const md = sub.metadata ?? {};
  let profile_id = uuidRe.test(md.profile_id ?? "") ? md.profile_id : null;
  const community_id = uuidRe.test(md.community_id ?? "") ? md.community_id : null;
  let plan = md.plan === "facilitator" ? "facilitator" : md.plan === "maker" ? "maker" : null;
  if (!profile_id) {
    const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    const { data } = await sb.from("billing_customers").select("profile_id").eq("stripe_customer_id", cust ?? "").maybeSingle();
    profile_id = data?.profile_id ?? null;
  }
  if (!plan) plan = community_id ? "facilitator" : "maker";
  if (!profile_id) return { skipped: "no_profile" };
  const item = sub.items?.data?.[0];
  const row = {
    stripe_subscription_id: sub.id,
    profile_id,
    plan,
    community_id: plan === "facilitator" ? community_id : null,
    status: sub.status,
    stripe_price_id: item?.price?.id ?? null,
    unit_amount_cents: item?.price?.unit_amount ?? null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    livemode: !!sub.livemode,
    updated_at: new Date().toISOString(),
  };
  if (plan === "facilitator" && !row.community_id) return { skipped: "no_community" };
  const { error } = await sb.from("subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) throw new Error("subscriptions upsert: " + error.message);
  return { ok: true };
}
