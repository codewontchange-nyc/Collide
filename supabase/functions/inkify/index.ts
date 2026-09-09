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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collide-city",
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
  "clear-rectangular": "variant03", "clear-round": "variant11", "clear-thin-metal": "variant01",
  "bold-black-frame": "variant05", "half-rim": "variant07", "sunglasses": "variant09",
};
const LIPS: Record<string, string> = {
  "big-open-smile": "variant30", "wide-grin": "variant28", "soft-closed-smile": "variant05",
  "slight-smile": "variant10", "neutral": "variant02", "pursed": "variant14",
  "smirk": "variant07", "open-talking": "variant25", "small-frown": "variant22", "relaxed-parted": "variant18",
};
const BODIES: Record<string, string> = {
  "tank-or-sleeveless": "variant10", "tshirt-or-crew": "variant02", "v-neck": "variant04",
  "sweater-or-knit": "variant13", "hoodie": "variant09", "open-jacket": "variant17",
  "collared-shirt": "variant06", "blazer-or-suit": "variant21", "dress-or-blouse": "variant23", "other": "variant08",
};
const BEARDS: Record<string, string> = {
  "full-beard": "variant02", "full-long-beard": "variant03", "medium-beard": "variant01",
  "short-boxed": "variant05", "stubble": "variant06", "heavy-stubble": "variant07",
  "goatee": "variant08", "circle-beard": "variant09", "goatee-with-mustache": "variant11",
  "mustache": "variant10", "thin-mustache": "variant04", "soul-patch": "variant12",
};
const NOSES: Record<string, string> = {
  "small-button": "variant09", "straight-average": "variant03", "narrow-straight": "variant01",
  "long-pointed": "variant06", "hooked-or-aquiline": "variant08", "upturned": "variant12",
  "wide-flat": "variant15", "broad-rounded": "variant19",
};
const BROWS: Record<string, string> = {
  "thick-bold": "variant03", "thick-straight": "variant01", "thin-arched": "variant05",
  "thin-straight": "variant04", "rounded": "variant07", "angled-sharp": "variant09", "bushy": "variant11",
};
const EYES: Record<string, string> = {
  "open-direct": "variant05", "bright-wide": "variant04", "soft-closed-lashes": "variant01",
  "side-glance": "variant03", "relaxed-narrow": "variant02",
};

const SKIN_DOTS: string[] = ["", "<defs><clipPath id=\"edskinclip\"><path transform=\"translate(531 487)\" d=\"M554 727.7c-99.2 297-363.8 388.6-503.7 19.8-19.3-50.7 31-69.5 66.2-91.9 24.1-15.3 36.8-28.5 35.3-42.2-7-64.4-36.9-243.8-36.9-243.8l-3-5.8s.7-1.6-2.2 1.2c-3 3-9.9 34.2-37 34.2-24.5 0-49.2-10.9-61-86.3C7.2 285.6 9.6 214 40 201c12.5-5.3 24-7.2 35.2-.8 11.3 6.4-13-22 112-126C268.4 6.4 396.7-3.5 448.5 8 500.3 19.5 552 44.8 574.9 98.5c27.8 65-25.9 114.3-14 262.5-2.2 53.6.8 171.2-146.6 210.6-28 7.5-19.3 48.4 22.7 58.4 67 21 117 72.3 117 97.9\"/></clipPath><pattern id=\"edskinpat\" width=\"27\" height=\"27\" patternUnits=\"userSpaceOnUse\"><circle cx=\"13.5\" cy=\"13.5\" r=\"2.1\" fill=\"#241d1a\"/></pattern></defs><rect x=\"500\" y=\"600\" width=\"640\" height=\"900\" fill=\"url(#edskinpat)\" clip-path=\"url(#edskinclip)\" opacity=\"0.5\"/>", "<defs><clipPath id=\"edskinclip\"><path transform=\"translate(531 487)\" d=\"M554 727.7c-99.2 297-363.8 388.6-503.7 19.8-19.3-50.7 31-69.5 66.2-91.9 24.1-15.3 36.8-28.5 35.3-42.2-7-64.4-36.9-243.8-36.9-243.8l-3-5.8s.7-1.6-2.2 1.2c-3 3-9.9 34.2-37 34.2-24.5 0-49.2-10.9-61-86.3C7.2 285.6 9.6 214 40 201c12.5-5.3 24-7.2 35.2-.8 11.3 6.4-13-22 112-126C268.4 6.4 396.7-3.5 448.5 8 500.3 19.5 552 44.8 574.9 98.5c27.8 65-25.9 114.3-14 262.5-2.2 53.6.8 171.2-146.6 210.6-28 7.5-19.3 48.4 22.7 58.4 67 21 117 72.3 117 97.9\"/></clipPath><pattern id=\"edskinpat\" width=\"22\" height=\"22\" patternUnits=\"userSpaceOnUse\"><circle cx=\"11.0\" cy=\"11.0\" r=\"2.2\" fill=\"#241d1a\"/></pattern></defs><rect x=\"500\" y=\"600\" width=\"640\" height=\"900\" fill=\"url(#edskinpat)\" clip-path=\"url(#edskinclip)\" opacity=\"0.5\"/>", "<defs><clipPath id=\"edskinclip\"><path transform=\"translate(531 487)\" d=\"M554 727.7c-99.2 297-363.8 388.6-503.7 19.8-19.3-50.7 31-69.5 66.2-91.9 24.1-15.3 36.8-28.5 35.3-42.2-7-64.4-36.9-243.8-36.9-243.8l-3-5.8s.7-1.6-2.2 1.2c-3 3-9.9 34.2-37 34.2-24.5 0-49.2-10.9-61-86.3C7.2 285.6 9.6 214 40 201c12.5-5.3 24-7.2 35.2-.8 11.3 6.4-13-22 112-126C268.4 6.4 396.7-3.5 448.5 8 500.3 19.5 552 44.8 574.9 98.5c27.8 65-25.9 114.3-14 262.5-2.2 53.6.8 171.2-146.6 210.6-28 7.5-19.3 48.4 22.7 58.4 67 21 117 72.3 117 97.9\"/></clipPath><pattern id=\"edskinpat\" width=\"18\" height=\"18\" patternUnits=\"userSpaceOnUse\"><circle cx=\"9.0\" cy=\"9.0\" r=\"2.3\" fill=\"#241d1a\"/></pattern></defs><rect x=\"500\" y=\"600\" width=\"640\" height=\"900\" fill=\"url(#edskinpat)\" clip-path=\"url(#edskinclip)\" opacity=\"0.5\"/>", "<defs><clipPath id=\"edskinclip\"><path transform=\"translate(531 487)\" d=\"M554 727.7c-99.2 297-363.8 388.6-503.7 19.8-19.3-50.7 31-69.5 66.2-91.9 24.1-15.3 36.8-28.5 35.3-42.2-7-64.4-36.9-243.8-36.9-243.8l-3-5.8s.7-1.6-2.2 1.2c-3 3-9.9 34.2-37 34.2-24.5 0-49.2-10.9-61-86.3C7.2 285.6 9.6 214 40 201c12.5-5.3 24-7.2 35.2-.8 11.3 6.4-13-22 112-126C268.4 6.4 396.7-3.5 448.5 8 500.3 19.5 552 44.8 574.9 98.5c27.8 65-25.9 114.3-14 262.5-2.2 53.6.8 171.2-146.6 210.6-28 7.5-19.3 48.4 22.7 58.4 67 21 117 72.3 117 97.9\"/></clipPath><pattern id=\"edskinpat\" width=\"15\" height=\"15\" patternUnits=\"userSpaceOnUse\"><circle cx=\"7.5\" cy=\"7.5\" r=\"2.4\" fill=\"#241d1a\"/></pattern></defs><rect x=\"500\" y=\"600\" width=\"640\" height=\"900\" fill=\"url(#edskinpat)\" clip-path=\"url(#edskinclip)\" opacity=\"0.5\"/>", "<defs><clipPath id=\"edskinclip\"><path transform=\"translate(531 487)\" d=\"M554 727.7c-99.2 297-363.8 388.6-503.7 19.8-19.3-50.7 31-69.5 66.2-91.9 24.1-15.3 36.8-28.5 35.3-42.2-7-64.4-36.9-243.8-36.9-243.8l-3-5.8s.7-1.6-2.2 1.2c-3 3-9.9 34.2-37 34.2-24.5 0-49.2-10.9-61-86.3C7.2 285.6 9.6 214 40 201c12.5-5.3 24-7.2 35.2-.8 11.3 6.4-13-22 112-126C268.4 6.4 396.7-3.5 448.5 8 500.3 19.5 552 44.8 574.9 98.5c27.8 65-25.9 114.3-14 262.5-2.2 53.6.8 171.2-146.6 210.6-28 7.5-19.3 48.4 22.7 58.4 67 21 117 72.3 117 97.9\"/></clipPath><pattern id=\"edskinpat\" width=\"13\" height=\"13\" patternUnits=\"userSpaceOnUse\"><circle cx=\"6.5\" cy=\"6.5\" r=\"2.5\" fill=\"#241d1a\"/></pattern></defs><rect x=\"500\" y=\"600\" width=\"640\" height=\"900\" fill=\"url(#edskinpat)\" clip-path=\"url(#edskinclip)\" opacity=\"0.5\"/>", "<defs><clipPath id=\"edskinclip\"><path transform=\"translate(531 487)\" d=\"M554 727.7c-99.2 297-363.8 388.6-503.7 19.8-19.3-50.7 31-69.5 66.2-91.9 24.1-15.3 36.8-28.5 35.3-42.2-7-64.4-36.9-243.8-36.9-243.8l-3-5.8s.7-1.6-2.2 1.2c-3 3-9.9 34.2-37 34.2-24.5 0-49.2-10.9-61-86.3C7.2 285.6 9.6 214 40 201c12.5-5.3 24-7.2 35.2-.8 11.3 6.4-13-22 112-126C268.4 6.4 396.7-3.5 448.5 8 500.3 19.5 552 44.8 574.9 98.5c27.8 65-25.9 114.3-14 262.5-2.2 53.6.8 171.2-146.6 210.6-28 7.5-19.3 48.4 22.7 58.4 67 21 117 72.3 117 97.9\"/></clipPath><pattern id=\"edskinpat\" width=\"11\" height=\"11\" patternUnits=\"userSpaceOnUse\"><circle cx=\"5.5\" cy=\"5.5\" r=\"2.6\" fill=\"#241d1a\"/></pattern></defs><rect x=\"500\" y=\"600\" width=\"640\" height=\"900\" fill=\"url(#edskinpat)\" clip-path=\"url(#edskinclip)\" opacity=\"0.5\"/>"];
const SKIN_LEVEL: Record<string, number> = {
  "very-fair": 0, "fair": 1, "light": 2, "medium": 3, "tan": 4, "brown": 5, "deep": 6,
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
      eyes: { type: "string", enum: Object.keys(EYES) },
      skin_tone: { type: "string", enum: Object.keys(SKIN_LEVEL), description: "Overall complexion, mapped to an ink stipple density (very-fair = none, deep = densest). Judge the visible skin, neutral lighting." },
      hair_alternates: { type: "array", items: { type: "string", enum: Object.keys(HAIR_STYLES) }, maxItems: 2,
        description: "Second and third closest hair silhouettes, best first. Used for redraws and tie-breaking." },
      clothing: { type: "string", enum: Object.keys(BODIES), description: "What the visible top half is wearing (rendered in the app's ink black)." },
    },
    required: ["headwear", "hair_style", "beard", "glasses", "expression", "clothing", "nose", "brows", "eyes", "skin_tone", "hair_alternates"],
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

    let body: { photo_path?: string; dry_run?: boolean; redo?: boolean; alt?: number } = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }

    // source photo: caller's current avatar upload (or explicit path for tests)
    const { data: prof } = await svc.from("profiles").select("avatar_url").eq("id", user.id).single();
    let photoPath = body.photo_path ?? prof?.avatar_url;
    if (!photoPath || body.redo || photoPath.endsWith(".svg")) {
      // avatar_url points at an inked SVG after the first run — the original
      // photo is still in the user's folder; newest non-generated file wins.
      const { data: files } = await svc.storage.from("avatars").list(user.id, {
        limit: 100, sortBy: { column: "created_at", order: "desc" },
      });
      const orig = (files ?? []).find((f) => !f.name.startsWith("inked-") && !f.name.endsWith(".svg"));
      if (!orig) return json({ error: "no photo to redraw from — upload one first" }, 400);
      photoPath = `${user.id}/${orig.name}`;
    }
    const { data: photo, error: dlErr } = await svc.storage.from("avatars").download(photoPath);
    if (dlErr || !photo) return json({ error: "photo not readable" }, 400);
    const mime = photoPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const photoB64 = b64(await photo.arrayBuffer());

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
            { type: "image", source: { type: "base64", media_type: mime, data: photoB64 } },
            { type: "text", text: "Fill in the visual trait sheet for this person's profile photo. Judge only what is clearly visible. The hair_style menu describes silhouettes — pick the one a caricature artist would choose to make this person instantly recognizable." },
          ],
        }],
      }),
    });
    const cj = await cr.json();
    if (!cr.ok) return json({ error: "trait extraction failed: " + (cj?.error?.message ?? cr.status) }, 502);
    const traits = cj?.content?.find((c: { type: string }) => c.type === "tool_use")?.input;
    if (!traits) return json({ error: "no traits returned" }, 502);

    // ---- hair choice: critic pass on first run, cycling on redraws ----
    const candidates = [traits.hair_style, ...(traits.hair_alternates ?? [])]
      .filter((h: string, i: number, a: string[]) => HAIR_STYLES[h] && a.indexOf(h) === i);
    let hairLabel = candidates[0] ?? "short-neat-side-part";
    let altIndex = 0;
    const baseParams = () => {
      const q = new URLSearchParams({ size: "256", backgroundColor: "f6f1ea", gestureProbability: "0" });
      q.set("seed", user.id);
      q.set("body", BODIES[traits.clothing] ?? "variant08");
      q.set("beardProbability", traits.beard === "none" ? "0" : "100");
      if (traits.beard !== "none") q.set("beard", BEARDS[traits.beard] ?? "variant02");
      q.set("glassesProbability", traits.glasses === "none" ? "0" : "100");
      if (traits.glasses !== "none") q.set("glasses", GLASSES[traits.glasses] ?? "variant03");
      q.set("lips", LIPS[traits.expression] ?? "variant02");
      q.set("nose", NOSES[traits.nose] ?? "variant03");
      q.set("brows", BROWS[traits.brows] ?? "variant04");
      q.set("eyes", EYES[traits.eyes] ?? "variant05");
      return q;
    };
    if (traits.headwear === "none" && candidates.length > 1) {
      if (body.redo && typeof body.alt === "number") {
        altIndex = ((body.alt % candidates.length) + candidates.length) % candidates.length;
        hairLabel = candidates[altIndex];
      } else if (!body.redo) {
        // critic pass: render the top two, let vision pick the closer likeness
        try {
          const pngOf = async (label: string) => {
            const q = baseParams(); q.set("hair", HAIR_STYLES[label]);
            const r = await fetch("https://api.dicebear.com/9.x/notionists/png?" + q.toString());
            return b64(await r.arrayBuffer());
          };
          const [pa, pb] = await Promise.all([pngOf(candidates[0]), pngOf(candidates[1])]);
          const vr = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-5", max_tokens: 100,
              tools: [{ name: "pick_render", description: "Choose the avatar whose hair silhouette better matches the person in the photo.",
                input_schema: { type: "object", properties: { choice: { type: "string", enum: ["first", "second"] } }, required: ["choice"] } }],
              tool_choice: { type: "tool", name: "pick_render" },
              messages: [{ role: "user", content: [
                { type: "text", text: "The photo:" },
                { type: "image", source: { type: "base64", media_type: mime, data: photoB64 } },
                { type: "text", text: "First avatar:" },
                { type: "image", source: { type: "base64", media_type: "image/png", data: pa } },
                { type: "text", text: "Second avatar:" },
                { type: "image", source: { type: "base64", media_type: "image/png", data: pb } },
                { type: "text", text: "Which avatar's hair better matches the photo?" },
              ] }],
            }),
          });
          const vj = await vr.json();
          const pick = vj?.content?.find((c: { type: string }) => c.type === "tool_use")?.input?.choice;
          if (pick === "second") { hairLabel = candidates[1]; altIndex = 1; }
        } catch { /* critic is best-effort; primary stands */ }
      }
    }

    // ---- deterministic render from the parts library ----
    const p = baseParams();
    p.set("size", "512");
    p.set("hair", (traits.headwear === "none")
      ? (HAIR_STYLES[hairLabel] ?? "variant05")
      : "hat");
    const dr = await fetch("https://api.dicebear.com/9.x/notionists/svg?" + p.toString());
    if (!dr.ok) return json({ error: "renderer failed: " + dr.status }, 502);
    let svg = await dr.text();
    if (traits.headwear === "beanie") {
      // swap the cap asset for our beanie part (cap group holds only paths)
      svg = svg.replace(/<g transform="translate\(266 207\)">[\s\S]*?<\/g>/, BEANIE_GROUP);
    }
    const skinLvl = SKIN_LEVEL[traits.skin_tone] ?? 0;
    if (skinLvl > 0) {
      const fi = svg.indexOf("</g>", svg.indexOf('<g transform="translate(531 487)">')) + 4;
      svg = svg.slice(0, fi) + SKIN_DOTS[skinLvl] + svg.slice(fi);
    }

    if (body.dry_run) return json({ ok: true, traits, hair_used: hairLabel, alt_index: altIndex, alt_count: candidates.length, svg_bytes: svg.length, applied: false });

    const path = `${user.id}/inked-${Date.now()}.svg`;
    const up = await svc.storage.from("avatars").upload(path, new Blob([svg], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml", upsert: true,
    });
    if (up.error) return json({ error: up.error.message }, 500);
    // persist the chosen parts so the in-app face editor starts from this draft
    const parts = {
      hair: traits.headwear === "none" ? (HAIR_STYLES[hairLabel] ?? "variant05") : "hat",
      beanie: traits.headwear === "beanie",
      beard: traits.beard === "none" ? "none" : (BEARDS[traits.beard] ?? "variant02"),
      glasses: traits.glasses === "none" ? "none" : (GLASSES[traits.glasses] ?? "variant03"),
      lips: LIPS[traits.expression] ?? "variant02",
      nose: NOSES[traits.nose] ?? "variant03",
      brows: BROWS[traits.brows] ?? "variant04",
      eyes: EYES[traits.eyes] ?? "variant05",
      body: BODIES[traits.clothing] ?? "variant08",
      skin: SKIN_LEVEL[traits.skin_tone] ?? 0,
    };
    await svc.from("profiles").update({ avatar_url: path, avatar_parts: parts }).eq("id", user.id);
    return json({ ok: true, traits, hair_used: hairLabel, alt_index: altIndex, alt_count: candidates.length, avatar_url: path });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
