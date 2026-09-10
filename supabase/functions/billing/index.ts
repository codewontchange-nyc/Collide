// billing — Collide's own Stripe account: Maker $5/mo (per profile) and
// Facilitator $25/mo (per community, billed to the room's owner).
// No Connect, no tickets, no bookings: communities keep their own payment tools.
//
// POST { mode, ... }  — every mode except `reconcile` needs a signed-in user.
//   checkout-subscription { plan:'maker' } | { plan:'facilitator', community_id } -> { url }
//   portal {}                                                            -> { url }
//   status {}                                                            -> ed_entitlements() for the caller
//   reconcile {}   (x-billing-secret header, or an owner-role staff JWT)  -> { synced, errors }
//
// Deployed with: supabase functions deploy billing --no-verify-jwt --project-ref pjxvvwcnjjizdtiutpxd
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_MAKER, STRIPE_PRICE_FACILITATOR, APP_URL,
//          BILLING_CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import {
  APP_URL, CORS, json, PRICES, requireUser, STRIPE_KEY, stripe, svc, TERMINAL, upsertSubscription, userClient, uuidRe,
} from "../_shared/stripe.ts";

type Sb = ReturnType<typeof svc>;

async function ensureCustomer(sb: Sb, user: { id: string; email?: string }, livemode: boolean) {
  const { data } = await sb.from("billing_customers").select("stripe_customer_id").eq("profile_id", user.id).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const { data: p } = await sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const cust = await stripe.customers.create({
    email: user.email ?? undefined,
    name: p?.display_name ?? undefined,
    metadata: { profile_id: user.id },
  });
  const { error } = await sb.from("billing_customers").upsert(
    { profile_id: user.id, stripe_customer_id: cust.id, email: user.email ?? null, livemode },
    { onConflict: "profile_id" },
  );
  if (error) throw new Error("billing_customers: " + error.message);
  return cust.id;
}

async function ownsCommunity(sb: Sb, user: { id: string; email?: string }, cid: string) {
  const { data: c } = await sb.from("communities").select("id,owner_id,billing_exempt,facilitator_trial_ends_at,name").eq("id", cid).maybeSingle();
  if (!c) return { c: null, ok: false };
  if (c.owner_id === user.id) return { c, ok: true };
  const { data: st } = await sb.from("staff").select("id").eq("email", user.email ?? "").eq("role", "owner")
    .or(`community_id.is.null,community_id.eq.${cid}`).limit(1);
  return { c, ok: !!st?.length };
}

async function liveSub(sb: Sb, where: Record<string, string>) {
  let q = sb.from("subscriptions").select("stripe_subscription_id,status").not("status", "in", "(canceled,incomplete_expired)");
  for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
  const { data } = await q.limit(1);
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

    // ---- reconcile: cron secret or owner-role staff ----
    if (mode === "reconcile") {
      const secret = Deno.env.get("BILLING_CRON_SECRET") ?? "";
      let allowed = !!secret && req.headers.get("x-billing-secret") === secret;
      if (!allowed) {
        const user = await requireUser(req);
        if (user) {
          const { data: st } = await sb.from("staff").select("id").eq("email", user.email ?? "").eq("role", "owner").limit(1);
          allowed = !!st?.length;
        }
      }
      if (!allowed) return json({ error: "forbidden" }, 403);
      if (!STRIPE_KEY) return json({ error: "no_key" }, 500);
      const { data: subs } = await sb.from("subscriptions").select("stripe_subscription_id,status,updated_at")
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

    // ---- status: entitlements for the caller (RPC runs as the user) ----
    if (mode === "status") {
      const { data, error } = await userClient(req).rpc("ed_entitlements");
      if (error) return json({ error: "not_ready", detail: error.message }, 503);
      return json({ ok: true, configured: !!STRIPE_KEY, ...(data ?? {}) });
    }

    if (!STRIPE_KEY) return json({ error: "no_key" }, 500);

    // ---- portal ----
    if (mode === "portal") {
      const { data } = await sb.from("billing_customers").select("stripe_customer_id").eq("profile_id", user.id).maybeSingle();
      if (!data) return json({ error: "not_found" }, 404);
      const s = await stripe.billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: APP_URL + "?billing=portal" });
      return json({ url: s.url });
    }

    // ---- checkout-subscription ----
    if (mode === "checkout-subscription") {
      const plan = b.plan === "facilitator" ? "facilitator" : b.plan === "maker" ? "maker" : null;
      if (!plan) return json({ error: "bad_request" }, 400);
      if (!PRICES[plan]) return json({ error: "no_price" }, 500);

      let trialIso: string | null = null;
      let community_id: string | null = null;
      let success = `${APP_URL}?billing=success&plan=${plan}&sid={CHECKOUT_SESSION_ID}`;
      if (plan === "maker") {
        const { data: m } = await sb.from("makers").select("profile_id,trial_ends_at").eq("profile_id", user.id).maybeSingle();
        if (!m) return json({ error: "not_found" }, 404);
        if (await liveSub(sb, { plan: "maker", profile_id: user.id })) return json({ error: "already" }, 409);
        trialIso = m.trial_ends_at;
      } else {
        community_id = String(b.community_id ?? "");
        if (!uuidRe.test(community_id)) return json({ error: "bad_request" }, 400);
        const { c, ok } = await ownsCommunity(sb, user, community_id);
        if (!c) return json({ error: "not_found" }, 404);
        if (!ok) return json({ error: "forbidden" }, 403);
        if (c.billing_exempt) return json({ error: "exempt" }, 409);
        if (await liveSub(sb, { plan: "facilitator", community_id })) return json({ error: "already" }, 409);
        trialIso = c.facilitator_trial_ends_at;
        success += `&cid=${community_id}`;
      }

      const customer = await ensureCustomer(sb, user, livemode);
      const meta: Record<string, string> = { plan, profile_id: user.id };
      if (community_id) meta.community_id = community_id;
      const trial_end = trialEndFor(trialIso);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer,
        line_items: [{ price: PRICES[plan], quantity: 1 }],
        subscription_data: { metadata: meta, ...(trial_end ? { trial_end } : {}) },
        metadata: meta,
        client_reference_id: user.id,
        allow_promotion_codes: true,
        success_url: success,
        cancel_url: `${APP_URL}?billing=cancel`,
      });
      return json({ url: session.url });
    }

    return json({ error: "mode" }, 400);
  } catch (e) {
    console.error("billing", e);
    return json({ error: "internal", detail: String(e).slice(0, 200) }, 500);
  }
});

// keep TERMINAL referenced for callers that import it (documentation of statuses)
void TERMINAL;
