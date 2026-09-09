// recap — a short, nuanced recap of a wrapped plan, distilled from its chat and
// details. Generated once per event and cached on activities.recap; returns
// { recap: null } when there isn't enough material to say anything real (the
// "not always" rule), so the client falls back to its plain stats line.
//
// POST { aid }  (caller must be signed in and have been part of the plan —
// host or RSVP — since recaps quote the chat)
// Deployed with: supabase functions deploy recap --no-verify-jwt --project-ref pjxvvwcnjjizdtiutpxd
// Secrets: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collide-city",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const MIN_MSGS = 3;          // enough chat to have texture
const MIN_NOTE = 40;         // or a real note/itinerary to lean on
const MAX_MSGS = 60;         // cap what we send to the model

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("authorization") ?? "";
    const { data: { user } } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    }).auth.getUser();
    if (!user) return json({ error: "auth" }, 401);

    const { aid } = await req.json().catch(() => ({}));
    if (!aid || !/^[0-9a-f-]{36}$/.test(String(aid))) return json({ error: "aid" }, 400);
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: a } = await svc.from("activities")
      .select("id,host_id,title,date,at_time,place,location,note,itinerary,recap,expires_at,city")
      .eq("id", aid).maybeSingle();
    if (!a) return json({ error: "not_found" }, 404);

    // only people who were part of the plan get a recap (it quotes the chat)
    const mine = a.host_id === user.id || !!(await svc.from("rsvps").select("activity_id")
      .eq("activity_id", aid).eq("profile_id", user.id).maybeSingle()).data;
    if (!mine) return json({ error: "not_yours" }, 403);

    // cache hit — generated once, ever
    if (a.recap !== null && a.recap !== undefined) return json({ recap: a.recap || null, cached: true });

    // material gate: the "not always" rule
    const { data: msgs } = await svc.from("event_messages")
      .select("body,kind,created_at,author:profiles!event_messages_author_id_fkey(display_name)")
      .eq("activity_id", aid).order("created_at").limit(MAX_MSGS);
    const text = (msgs || []).filter((m) => m.kind === "text" && m.body && m.body.trim().length > 1);
    const note = [a.note, typeof a.itinerary === "string" ? a.itinerary : (a.itinerary ? JSON.stringify(a.itinerary) : "")]
      .filter(Boolean).join(" ").trim();
    if (text.length < MIN_MSGS && note.length < MIN_NOTE) {
      await svc.from("activities").update({ recap: "", recap_at: new Date().toISOString() }).eq("id", aid); // "" = checked, nothing to say
      return json({ recap: null, reason: "thin" });
    }
    const { count: went } = await svc.from("rsvps").select("*", { count: "exact", head: true }).eq("activity_id", aid);

    const transcript = text.map((m) => `${(m.author as { display_name?: string } | null)?.display_name?.split(" ")[0] || "someone"}: ${m.body.trim().slice(0, 240)}`).join("\n");
    const prompt = `You write one short, warm, specific recap line for a small social plan that already happened, for the people who were there. It goes on a card under the plan's title, so never restate the title, date, or place. Draw on what actually happened in the chat and the details — a moment, a running joke, what people said they'd do next, a texture. Be nuanced, not generic; no emoji, no exclamation marks, no "great time was had". 1–2 sentences, max 40 words. If the material is too thin to say anything real, reply with exactly: NONE.

Plan: ${a.title}
Details: ${note || "(none)"}
${went ? `${went} people were in.` : ""}
Chat:
${transcript || "(no chat)"}`;

    const cr = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 120, messages: [{ role: "user", content: prompt }] }),
    });
    const cj = await cr.json();
    if (!cr.ok) { console.error("recap model error", cj?.error?.message ?? cr.status); return json({ recap: null, reason: "model" }, 502); }
    let out = String(cj?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "").trim();
    if (!out || /^NONE\b/i.test(out) || out.length > 320) out = "";
    await svc.from("activities").update({ recap: out, recap_at: new Date().toISOString() }).eq("id", aid);
    return json({ recap: out || null });
  } catch (e) {
    console.error("recap error:", e);
    return json({ error: "internal" }, 500);
  }
});
