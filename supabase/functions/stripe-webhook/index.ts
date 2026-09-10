// stripe-webhook — source of truth for platform subscriptions.
// Verifies the Stripe signature, records every event in webhook_events
// (idempotent), mirrors subscription state into public.subscriptions.
//
// Events to enable on the endpoint: checkout.session.completed,
// customer.subscription.created / updated / deleted, invoice.paid, invoice.payment_failed
//
// Deployed with: supabase functions deploy stripe-webhook --no-verify-jwt --project-ref pjxvvwcnjjizdtiutpxd
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "npm:stripe@17";
import { json, stripe, svc, upsertSubscription } from "../_shared/stripe.ts";

const SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SECRET) return json({ error: "no_secret" }, 500);

  let evt: Stripe.Event;
  try {
    evt = await stripe.webhooks.constructEventAsync(
      await req.text(),
      req.headers.get("stripe-signature") ?? "",
      SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (e) {
    return json({ error: "signature", detail: String(e).slice(0, 120) }, 400);
  }

  const sb = svc();
  // idempotency: first writer wins; a fully processed event is acknowledged without re-running
  const { data: ins } = await sb.from("webhook_events")
    .upsert({ id: evt.id, type: evt.type, livemode: evt.livemode, payload: evt as unknown as Record<string, unknown> }, { onConflict: "id", ignoreDuplicates: true })
    .select("id");
  if (!ins?.length) {
    const { data: prev } = await sb.from("webhook_events").select("processed_at").eq("id", evt.id).maybeSingle();
    if (prev?.processed_at) return json({ received: true, duplicate: true });
  }

  try {
    switch (evt.type) {
      case "checkout.session.completed": {
        const s = evt.data.object as Stripe.Checkout.Session;
        if (s.mode === "subscription" && s.subscription) {
          const id = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          await upsertSubscription(await stripe.subscriptions.retrieve(id), sb);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = evt.data.object as Stripe.Subscription;
        await upsertSubscription(evt.type.endsWith("deleted") ? { ...sub, status: "canceled" } as Stripe.Subscription : sub, sb);
        break;
      }
      case "invoice.payment_failed": {
        const inv = evt.data.object as Stripe.Invoice;
        const id = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (id) await sb.from("subscriptions").update({ status: "past_due", updated_at: new Date().toISOString() }).eq("stripe_subscription_id", id);
        break;
      }
      case "invoice.paid": {
        // Stripe is the book of record for platform plans; the subscription.updated event carries the new period.
        break;
      }
      default:
        break;
    }
    await sb.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", evt.id);
    return json({ received: true });
  } catch (e) {
    await sb.from("webhook_events").update({ error: String(e).slice(0, 400) }).eq("id", evt.id);
    return json({ error: "handler", detail: String(e).slice(0, 200) }, 500); // Stripe retries
  }
});
