// inkify v3 — draw the user into the world, repeatably.
// Claude (vision) reads the uploaded photo ONCE and picks from LABELED style
// menus (hair silhouette, glasses shape, expression, clothing); a deterministic
// renderer maps each label to a hand-audited notionists part. Same photo ->
// same traits -> identical avatar, every time. The full 64-variant hair
// catalog was visually labeled by hand — likeness in line art is mostly hair
// silhouette, so that menu carries the resemblance.
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

// ---- hand-audited label -> part maps (from the variant contact sheets) ----
const HAIR_STYLES: Record<string, string> = {
  "bald-or-shaved": "variant60",
  "buzz-very-short": "variant15",
  "short-neat-side-part": "variant05",
  "short-textured-crop": "variant31",
  "short-curly": "variant01",
  "big-curly-mop": "variant20",
  "afro-round": "variant43",
  "quiff-pompadour": "variant13",
  "slicked-back": "variant29",
  "flat-top": "variant44",
  "spiky": "variant42",
  "mohawk": "variant51",
  "side-shave-swept-over": "variant54",
  "pixie-with-bangs": "variant47",
  "chin-bob-straight": "variant10",
  "chin-bob-wavy": "variant11",
  "bob-with-headband": "variant08",
  "shoulder-length-straight": "variant23",
  "shoulder-length-waves": "variant28",
  "shoulder-shag-layered": "variant37",
  "long-straight-center-part": "variant41",
  "long-voluminous-curls": "variant58",
  "high-ponytail": "variant45",
  "top-bun": "variant48",
  "double-buns": "variant59",
  "braids-or-pigtails": "variant39",
  "curly-top-knot": "variant40",
  "silver-updo": "variant61",
  "headscarf": "variant63",
};
const GLASSES: Record<string, string> = {
  "clear-rectangular": "variant03",
  "clear-round": "variant11",
  "sunglasses": "variant09",
};
const LIPS: Record<string, string> = {
  "big-open-smile": "variant16",
  "soft-closed-smile": "variant05",
  "neutral": "variant02",
};
const BODIES: Record<string, string> = {
  "tank-or-sleeveless": "variant10",
  "tshirt-or-crew": "variant02",
  "open-jacket-or-hoodie": "variant09",
  "collared-shirt-or-blazer": "variant06",
  "other": "variant08",
};
const BEARDS: Record<string, string> = {
  "full-beard": "variant02",
  "medium-beard": "variant01",
  "stubble": "variant06",
  "goatee": "variant08",
  "goatee-with-mustache": "variant11",
  "mustache": "variant10",
  "thin-mustache": "variant04",
  "soul-patch": "variant12",
};
const NOSES: Record<string, string> = {
  "small-button": "variant09",
  "straight-average": "variant03",
  "long-pointed": "variant06",
  "broad-rounded": "variant19",
};
const BROWS: Record<string, string> = {
  "thick-bold": "variant03",
  "thin-arched": "variant06",
  "thin-straight": "variant02",
};

// ---- trait sheet Claude must fill (the whole "model contract") ----
const TRAIT_TOOL = {
  name: "set_traits",
  description: "Record the person's visual traits for avatar generation. Pick the CLOSEST option in each menu; the hair silhouette (length, volume, parting, texture) is the most important likeness signal, so weigh it carefully.",
  input_schema: {
    type: "object",
    properties: {
      headwear: { type: "string", enum: ["none", "beanie", "cap"] },
      hair_style: { type: "string", enum: Object.keys(HAIR_STYLES), description: "Closest hair silhouette. Ignored if headwear is worn." },
      beard: { type: "string", enum: ["none", ...Object.keys(BEARDS)] },
      glasses: { type: "string", enum: ["none", ...Object.keys(GLASSES)] },
      expression: { type: "string", enum: Object.keys(LIPS) },
      nose: { type: "string", enum: Object.keys(NOSES) },
      brows: { type: "string", enum: Object.keys(BROWS) },
      clothing: { type: "string", enum: Object.keys(BODIES), description: "What the visible top half is wearing (rendered in the app's ink black)." },
    },
    required: ["headwear", "hair_style", "beard", "glasses", "expression", "clothing", "nose", "brows"],
  },
} as const;

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
        max_tokens: 400,
        tools: [TRAIT_TOOL],
        tool_choice: { type: "tool", name: "set_traits" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: b64(await photo.arrayBuffer()) } },
            { type: "text", text: "Fill in the visual trait sheet for this person's profile photo. Judge only what is clearly visible. The hair_style menu describes silhouettes — pick the one a caricature artist would choose to make this person instantly recognizable." },
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
    p.set("seed", user.id); // stable per-user fallback features (eyes only now)
    p.set("body", BODIES[traits.clothing] ?? "variant08");
    p.set("beardProbability", traits.beard === "none" ? "0" : "100");
    if (traits.beard !== "none") p.set("beard", BEARDS[traits.beard] ?? "variant02");
    p.set("nose", NOSES[traits.nose] ?? "variant03");
    p.set("brows", BROWS[traits.brows] ?? "variant02");
    p.set("glassesProbability", traits.glasses === "none" ? "0" : "100");
    if (traits.glasses !== "none") p.set("glasses", GLASSES[traits.glasses] ?? "variant03");
    p.set("lips", LIPS[traits.expression] ?? "variant02");
    p.set("hair", (traits.headwear === "none")
      ? (HAIR_STYLES[traits.hair_style] ?? "variant05")
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
