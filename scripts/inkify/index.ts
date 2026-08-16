// inkify v2 — draw the user into the world, repeatably.
// Claude (vision) reads the uploaded photo ONCE and outputs a small trait
// sheet; a deterministic renderer then assembles the avatar from the same
// notionists parts library the whole cast uses. Same traits -> identical
// avatar, every time. The style lives in the parts library, not in an
// image model's mood — that's what makes it uniform and ownable.
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
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

// ---- trait sheet Claude must fill (the whole "model contract") ----
const TRAIT_TOOL = {
  name: "set_traits",
  description: "Record the person's visual traits for avatar generation.",
  input_schema: {
    type: "object",
    properties: {
      headwear: { type: "string", enum: ["none", "beanie", "cap"] },
      beard: { type: "string", enum: ["none", "mustache", "goatee", "full"] },
      glasses: { type: "boolean" },
      hair_length: { type: "string", enum: ["bald", "short", "medium", "long"] },
      hair_texture: { type: "string", enum: ["straight", "wavy", "coily"] },
    },
    required: ["headwear", "beard", "glasses", "hair_length", "hair_texture"],
  },
} as const;

// ---- deterministic trait -> parts mapping (extend over time; NEVER random) ----
const BEARDS: Record<string, string> = { full: "variant02", goatee: "variant01", mustache: "variant10" };
// Coarse v1 hair buckets — variants chosen once, fixed forever. Likeness at
// avatar size comes mostly from beard/headwear/glasses; refine labels later.
const HAIR: Record<string, Record<string, string>> = {
  bald: { straight: "variant01", wavy: "variant01", coily: "variant01" },
  short: { straight: "variant02", wavy: "variant14", coily: "variant27" },
  medium: { straight: "variant05", wavy: "variant19", coily: "variant33" },
  long: { straight: "variant10", wavy: "variant22", coily: "variant40" },
};

// Cuffed-beanie parts drawn in the library's own ink language (flat black,
// paper seams, label patch, temple tuck) — swapped in for the cap asset.
const BEANIE_GROUP = '<g transform="translate(266 207)">'
  + '<path d="M228 350 C200 148 322 38 476 30 C562 26 650 40 710 72 C812 122 862 210 854 344 C802 322 700 312 554 312 C400 312 286 328 228 350 Z" fill="#000"/>'
  + '<path d="M196 352 C196 306 224 284 266 282 L812 282 C852 284 876 306 876 348 C876 392 850 414 808 414 L272 418 C228 418 196 396 196 352 Z" fill="#000" stroke="#f6f1ea" stroke-width="10"/>'
  + '<path d="M204 414 C222 460 254 482 288 474 C264 446 246 428 234 412 Z" fill="#000"/>'
  + '<path d="M330 298 L330 406 M424 292 L424 412 M678 290 L678 408 M764 296 L764 404" stroke="#f6f1ea" stroke-width="7" opacity=".55"/>'
  + '<rect x="520" y="312" width="78" height="64" rx="10" fill="#f6f1ea"/>'
  + '<path d="M538 338 q20 -14 44 0 M540 358 q20 12 40 -4" stroke="#000" stroke-width="7" fill="none" stroke-linecap="round"/>'
  + "</g>";

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

    let body: { photo_path?: string; dry_run?: boolean } = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }

    // source photo: caller's current avatar upload (or explicit path for tests)
    const { data: prof } = await svc.from("profiles").select("avatar_url").eq("id", user.id).single();
    const photoPath = body.photo_path ?? prof?.avatar_url;
    if (!photoPath) return json({ error: "no photo uploaded yet" }, 400);
    const { data: photo, error: dlErr } = await svc.storage.from("avatars").download(photoPath);
    if (dlErr || !photo) return json({ error: "photo not readable" }, 400);
    const mime = photoPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    // ---- Claude reads the photo, fills the trait sheet ----
    const cr = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        tools: [TRAIT_TOOL],
        tool_choice: { type: "tool", name: "set_traits" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: b64(await photo.arrayBuffer()) } },
            { type: "text", text: "Fill in the visual trait sheet for this person's profile photo. Judge only what is clearly visible." },
          ],
        }],
      }),
    });
    const cj = await cr.json();
    if (!cr.ok) return json({ error: "trait extraction failed: " + (cj?.error?.message ?? cr.status) }, 502);
    const traits = cj?.content?.find((c: { type: string }) => c.type === "tool_use")?.input;
    if (!traits) return json({ error: "no traits returned" }, 502);

    // ---- deterministic render from the parts library ----
    const p = new URLSearchParams({ size: "512", backgroundColor: "f6f1ea", gestureProbability: "0" });
    p.set("seed", user.id); // stable per-user fallback features (eyes/nose/lips/brows)
    p.set("body", "variant08"); // uniform Collide black layers — everyone wears the town's colors
    p.set("beardProbability", traits.beard === "none" ? "0" : "100");
    if (traits.beard !== "none") p.set("beard", BEARDS[traits.beard]);
    p.set("glassesProbability", traits.glasses ? "100" : "0");
    p.set("hair", (traits.headwear === "none")
      ? (HAIR[traits.hair_length]?.[traits.hair_texture] ?? "variant02")
      : "hat");
    const dr = await fetch("https://api.dicebear.com/9.x/notionists/svg?" + p.toString());
    if (!dr.ok) return json({ error: "renderer failed: " + dr.status }, 502);
    let svg = await dr.text();
    if (traits.headwear === "beanie") {
      // swap the cap asset for our beanie part (cap group holds only paths)
      svg = svg.replace(/<g transform="translate\(266 207\)">[\s\S]*?<\/g>/, BEANIE_GROUP);
    }

    if (body.dry_run) return json({ ok: true, traits, svg_bytes: svg.length, applied: false });

    const path = `${user.id}/inked-${Date.now()}.svg`;
    const up = await svc.storage.from("avatars").upload(path, new Blob([svg], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml", upsert: true,
    });
    if (up.error) return json({ error: up.error.message }, 500);
    await svc.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    return json({ ok: true, traits, avatar_url: path });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
