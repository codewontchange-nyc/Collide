// colony-billing: Colony's own Stripe account. One plan, a flat membership per
// colony ($149/mo, STRIPE_PRICE_COLONY), billed to the steward who checks out.
// Colony takes no cut of provider pay and never touches tips or bonuses.
//
// POST { mode, ... }  (every mode except `reconcile` needs a signed-in user)
//   checkout-subscription { colony_id }  (steward only)                   -> { url }
//   portal {}                                                             -> { url }
//   status { colony_id }                                                  -> colony_entitlements(colony_id)
//   reconcile {}   (x-billing-secret header)                              -> { synced, errors }
//
// Deployed with: supabase functions deploy colony-billing --no-verify-jwt --project-ref <ref>
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_COLONY, APP_URL, BILLING_CRON_SECRET,
//          SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//
// NOT WIRED: designed alongside the prototype. The client's SupabaseBilling
// (src/data/billing.ts) posts { mode, ... } here once Supabase is configured.

import {
  APP_URL, CORS, json, PRICES, requireUser, STRIPE_KEY, stripe, svc, TERMINAL, upsertSubscription, userClient, uuidRe,
} from "../_shared/stripe.ts";

type Sb = ReturnType<typeof svc>;
type User = { id: string; email?: string };

async function ensureCustomer(sb: Sb, user: User, livemode: boolean) {
  const { data } = await sb.from("colony_billing_customers").select("stripe_customer_id").eq("profile_id", user.id).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const { data: p } = await sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const cust = await stripe.customers.create({
    email: user.email ?? undefined,
    name: p?.display_name ?? undefined,
    metadata: { profile_id: user.id },
  });
  const { error } = await sb.from("colony_billing_customers").upsert(
    { profile_id: user.id, stripe_customer_id: cust.id, email: user.email ?? null, livemode },
    { onConflict: "profile_id" },
  );
  if (error) throw new Error("colony_billing_customers: " + error.message);
  return cust.id;
}

async function stewardOf(sb: Sb, user: User, cid: string) {
  const { data: c } = await sb.from("colonies").select("id,name,steward_id,billing_exempt,trial_ends_at").eq("id", cid).maybeSingle();
  if (!c) return { c: null, ok: false };
  return { c, ok: c.steward_id === user.id };
}

async function liveSub(sb: Sb, colony_id: string) {
  const { data } = await sb.from("colony_subscriptions").select("stripe_subscription_id,status")
    .eq("colony_id", colony_id).not("status", "in", "(canceled,incomplete_expired)").limit(1);
  return data?.[0] ?? null;
}

/** Stripe wants trial_end at least 48h out; otherwise let billing start now. */
function trialEndFor(iso: string | null) {
  if (!iso) return undefined;
  const t = Math.floor(new Date(iso).getTime() / 1000);
  return t > Math.floor(Date.now() / 1000) + 48 * 3600 ? t : undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const mode = String(b.mode ?? "");
    const sb = svc();
    const livemode = STRIPE_KEY.startsWith("sk_live_");

    // ---- reconcile: cron secret only ----
    if (mode === "reconcile") {
      const secret = Deno.env.get("BILLING_CRON_SECRET") ?? "";
      const allowed = !!secret && req.headers.get("x-billing-secret") === secret;
      if (!allowed) return json({ error: "forbidden" }, 403);
      if (!STRIPE_KEY) return json({ error: "no_key" }, 500);
      const { data: subs } = await sb.from("colony_subscriptions").select("stripe_subscription_id,status,updated_at")
        .or("status.not.in.(canceled,incomplete_expired),updated_at.lt." + new Date(Date.now() - 30 * 864e5).toISOString());
      let synced = 0; const errors: string[] = [];
      for (const s of subs ?? []) {
        try { await upsertSubscription(await stripe.subscriptions.retrieve(s.stripe_subscription_id), sb); synced++; }
        catch (e) { errors.push(s.stripe_subscription_id + ": " + String(e).slice(0, 120)); }
      }
      return json({ synced, errors });
    }

    const user = await requireUser(req);
    if (!user) return json({ error: "auth" }, 401);

    // ---- status: entitlements for one colony (RPC runs as the user, null when not a member) ----
    if (mode === "status") {
      const colony_id = String(b.colony_id ?? "");
      if (!uuidRe.test(colony_id)) return json({ error: "bad_request" }, 400);
      const { data, error } = await userClient(req).rpc("colony_entitlements", { cid: colony_id });
      if (error) return json({ error: "not_ready", detail: error.message }, 503);
      if (!data) return json({ error: "forbidden" }, 403);
      return json({ ok: true, configured: !!STRIPE_KEY, price_cents: 14900, ...(data as Record<string, unknown>) });
    }

    if (!STRIPE_KEY) return json({ error: "no_key" }, 500);

    // ---- portal ----
    if (mode === "portal") {
      const { data } = await sb.from("colony_billing_customers").select("stripe_customer_id").eq("profile_id", user.id).maybeSingle();
      if (!data) return json({ error: "not_found" }, 404);
      const s = await stripe.billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: APP_URL + "you/membership?billing=portal" });
      return json({ url: s.url });
    }

    // ---- checkout-subscription ----
    if (mode === "checkout-subscription") {
      if (!PRICES.colony) return json({ error: "no_price" }, 500);
      const colony_id = String(b.colony_id ?? "");
      if (!uuidRe.test(colony_id)) return json({ error: "bad_request" }, 400);
      const { c, ok } = await stewardOf(sb, user, colony_id);
      if (!c) return json({ error: "not_found" }, 404);
      if (!ok) return json({ error: "forbidden" }, 403);
      if (c.billing_exempt) return json({ error: "exempt" }, 409);
      if (await liveSub(sb, colony_id)) return json({ error: "already" }, 409);

      const customer = await ensureCustomer(sb, user, livemode);
      const meta: Record<string, string> = { plan: "colony", profile_id: user.id, colony_id };
      const trial_end = trialEndFor(c.trial_ends_at);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer,
        line_items: [{ price: PRICES.colony, quantity: 1 }],
        subscription_data: { metadata: meta, ...(trial_end ? { trial_end } : {}) },
        metadata: meta,
        client_reference_id: user.id,
        allow_promotion_codes: true,
        success_url: `${APP_URL}you/membership?billing=success&plan=colony&cid=${colony_id}&sid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}you/membership?billing=cancel`,
      });
      return json({ url: session.url });
    }

    return json({ error: "mode" }, 400);
  } catch (e) {
    console.error("colony-billing", e);
    return json({ error: "internal", detail: String(e).slice(0, 200) }, 500);
  }
});

// keep TERMINAL referenced for callers that import it (documentation of statuses)
void TERMINAL;
