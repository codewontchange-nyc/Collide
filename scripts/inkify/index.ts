// inkify — draw the user into the world.
// Takes the user's freshly-uploaded profile photo and redraws it as a
// Collide ink avatar (notionists-style) via Gemini image generation.
// Deployed as a Supabase Edge Function; GEMINI_API_KEY comes from secrets.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
};

const PROMPT = `Redraw the person in the FIRST image as an avatar in the EXACT illustration style of the reference avatars that follow: thin black ink linework, flat solid-black shapes for hair and clothing, uncolored line-art face (no skin fill, no shading, no gradients), cream #f6f1ea background, minimal hand-drawn wobble, head-and-shoulders crop.

Faithfully keep the person's recognizable traits from the photo: hairstyle or headwear (render headwear as a flat black ink mass with light seam details), facial hair, glasses if any, expression, and clothing neckline.

Square avatar, centered, no text, no watermark, no border.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "not signed in" }, 401);

    const { data: prof } = await svc.from("profiles").select("avatar_url").eq("id", user.id).single();
    if (!prof?.avatar_url) return json({ error: "no photo uploaded yet" }, 400);
    const { data: photo, error: dlErr } = await svc.storage.from("avatars").download(prof.avatar_url);
    if (dlErr || !photo) return json({ error: "photo not readable" }, 400);
    const mime = prof.avatar_url.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const photoB64 = b64(await photo.arrayBuffer());

    // style anchors: three cast avatars, deterministic
    const refs: string[] = [];
    for (const seed of ["KofiMensah", "LenaBrooks", "JulesRivera"]) {
      const r = await fetch(
        `https://api.dicebear.com/9.x/notionists/png?seed=${seed}&size=512&backgroundColor=f6f1ea`,
      );
      refs.push(b64(await r.arrayBuffer()));
    }

    const parts = [
      { text: PROMPT },
      { inline_data: { mime_type: mime, data: photoB64 } },
      ...refs.map((d) => ({ inline_data: { mime_type: "image/png", data: d } })),
    ];

    let img: string | null = null;
    let lastErr = "";
    for (const model of ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]) {
      const gr = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } }),
        },
      );
      const jr = await gr.json();
      if (!gr.ok) { lastErr = jr?.error?.message ?? String(gr.status); continue; }
      const p = jr?.candidates?.[0]?.content?.parts?.find((x: { inlineData?: { data: string } }) => x.inlineData);
      if (p) { img = p.inlineData.data; break; }
      lastErr = "model returned no image";
    }
    if (!img) return json({ error: "generation failed: " + lastErr }, 502);

    const path = `${user.id}/inked-${Date.now()}.png`;
    const bytes = Uint8Array.from(atob(img), (c) => c.charCodeAt(0));
    const up = await svc.storage.from("avatars").upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) return json({ error: up.error.message }, 500);
    await svc.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    return json({ ok: true, avatar_url: path });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
