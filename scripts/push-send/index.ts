// push-send — fan a notification out to a set of profiles' web-push subscriptions.
// Called server-side (DB triggers via pg_net) with a shared secret; never by clients.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) return json({ error: "nope" }, 401);
  let body: { profile_ids?: string[]; title?: string; body?: string; url?: string; tag?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const ids = (body.profile_ids ?? []).filter(Boolean);
  if (!ids.length) return json({ sent: 0 });

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@collide.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: subs } = await svc.from("push_subs").select("*").in("profile_id", ids);
  const payload = JSON.stringify({ title: body.title ?? "Collide", body: body.body ?? "", url: body.url ?? "/Collide/", tag: body.tag ?? "collide" });
  let sent = 0, pruned = 0, failed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await svc.from("push_subs").delete().eq("endpoint", s.endpoint); pruned++; }
      else failed++;
    }
  }
  return json({ sent, pruned, failed });
});
