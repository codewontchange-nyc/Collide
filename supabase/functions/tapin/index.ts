// tapin — "what's good near you, right now". Builds a walkable bundle from
// Google Places (pool cached 1h per ~100 m grid cell), Collide POIs and today's
// plans, then has Claude write a short editorial around the picks.
//
// Modes: where {lat,lng} → {area}; bundle {lat,lng,city,seed,exclude} → bundle.
// Deploy: supabase functions deploy tapin --no-verify-jwt --project-ref pjxvvwcnjjizdtiutpxd
// Secrets: GOOGLE_MAPS_KEY, GOOGLE_MAPS_KEY_GEO, ANTHROPIC_API_KEY, SUPABASE_*

import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = Deno.env.get("GOOGLE_MAPS_KEY") ?? "";
const GEO_KEY = Deno.env.get("GOOGLE_MAPS_KEY_GEO") || KEY;
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collide-city",
};
function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}

const URL_ = () => Deno.env.get("SUPABASE_URL")!;
const svc = () => createClient(URL_(), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// the caller's own client: RLS (and the city header) decide what they can see
function mine(req: Request) {
  return createClient(URL_(), Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "", "x-collide-city": req.headers.get("x-collide-city") ?? "" } },
  });
}
async function requireUser(req: Request) {
  const { data } = await mine(req).auth.getUser();
  return data.user;
}

// one reverse geocode → neighborhood, else sublocality, else locality
async function whereAmI(lat: number, lng: number): Promise<{ area: string | null; locality: string | null }> {
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GEO_KEY}`).then((x) => x.json());
    let area: string | null = null, locality: string | null = null;
    for (const res of r.results ?? []) {
      for (const c of res.address_components ?? []) {
        if (!area && c.types.includes("neighborhood")) area = c.long_name;
        if (!locality && (c.types.includes("sublocality_level_1") || c.types.includes("sublocality"))) locality = c.long_name;
      }
      if (area) break;
    }
    if (!locality) {
      const c = r.results?.[0]?.address_components?.find((c: { types: string[] }) => c.types.includes("locality"));
      locality = c?.long_name ?? null;
    }
    return { area: area ?? locality, locality };
  } catch { return { area: null, locality: null }; }
}

type Place = { id: string; name: string; types: string[]; rating: number; n: number; price: number | null; open: boolean | null; lat: number; lng: number; addr: string };
const SKIP = new Set(["lodging", "gas_station", "car_repair", "car_dealer", "parking", "atm", "bank", "hospital", "doctor", "dentist", "pharmacy", "real_estate_agency", "insurance_agency", "lawyer", "storage", "moving_company", "funeral_home", "cemetery", "school", "primary_school", "secondary_school", "university", "laundry", "locksmith", "plumber", "electrician", "car_wash", "car_rental", "subway_station", "transit_station", "bus_station", "train_station", "light_rail_station", "convenience_store", "supermarket", "grocery_or_supermarket", "drugstore", "post_office", "local_government_office", "courthouse", "police", "fire_station", "embassy", "city_hall", "hair_care", "beauty_salon", "spa", "gym", "physiotherapist", "veterinary_care", "pet_store", "hardware_store", "home_goods_store", "furniture_store", "electronics_store", "department_store", "shopping_mall", "clothing_store", "shoe_store", "jewelry_store", "florist", "travel_agency", "accounting", "finance", "church", "synagogue", "mosque", "hindu_temple", "place_of_worship"]);

async function nearby(lat: number, lng: number, radius: number, extra: string): Promise<Place[]> {
  const u = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&${extra}&key=${KEY}`;
  const r = await fetch(u).then((x) => x.json());
  if (r.status && r.status !== "OK" && r.status !== "ZERO_RESULTS") console.error("nearby", r.status, r.error_message);
  return (r.results ?? [])
    .filter((p: { types?: string[]; business_status?: string; geometry?: unknown }) => p.geometry && (!p.business_status || p.business_status === "OPERATIONAL") && !(p.types ?? []).some((t) => SKIP.has(t)))
    .map((p: { place_id: string; name: string; types?: string[]; rating?: number; user_ratings_total?: number; price_level?: number; opening_hours?: { open_now?: boolean }; geometry: { location: { lat: number; lng: number } }; vicinity?: string }) => ({
      id: p.place_id, name: p.name, types: p.types ?? [], rating: p.rating ?? 0, n: p.user_ratings_total ?? 0,
      price: p.price_level ?? null, open: p.opening_hours?.open_now ?? null, lat: p.geometry.location.lat, lng: p.geometry.location.lng, addr: p.vicinity ?? "",
    }));
}

type Cat = "eat" | "coffee" | "drink" | "do";
function catOf(types: string[]): Cat | null {
  const has = (...t: string[]) => t.some((x) => types.includes(x));
  if (has("cafe", "coffee_shop")) return "coffee";
  if (has("bar", "night_club", "wine_bar", "pub")) return "drink";
  if (has("restaurant", "meal_takeaway", "bakery", "food", "ice_cream_shop", "meal_delivery")) return "eat";
  if (has("park", "tourist_attraction", "museum", "art_gallery", "book_store", "movie_theater", "bowling_alley", "amusement_park", "zoo", "aquarium", "library", "stadium", "natural_feature", "point_of_interest")) return "do";
  return null;
}
function emojiOf(cat: Cat, types: string[]): string {
  const has = (...t: string[]) => t.some((x) => types.includes(x));
  if (cat === "coffee") return "☕";
  if (cat === "drink") return has("night_club") ? "🪩" : "🍸";
  if (cat === "eat") return has("bakery") ? "🥐" : has("ice_cream_shop") ? "🍦" : "🍽️";
  if (has("park", "natural_feature")) return "🌳";
  if (has("museum", "art_gallery")) return "🖼️";
  if (has("book_store", "library")) return "📚";
  if (has("movie_theater")) return "🎬";
  if (has("bowling_alley", "amusement_park")) return "🎳";
  return "✨";
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
async function peopleMap(lat: number, lng: number, people: { lat: number; lng: number; name: string; meet?: Meet }[], myMeet: Meet = null): Promise<string | null> {
  if (!people.length && !myMeet) return null;
  let base = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&scale=2&maptype=roadmap&markers=size:mid%7Ccolor:0x18857a%7C${lat.toFixed(4)},${lng.toFixed(4)}`;
  for (const p of people.slice(0, 12)) {
    const ini = (p.name || "?").trim().charAt(0).toUpperCase().replace(/[^A-Z0-9]/, "");
    base += `&markers=size:mid%7Ccolor:0x17181a${ini ? `%7Clabel:${ini}` : ""}%7C${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    if (p.meet) base += `&markers=size:mid%7Ccolor:0xe85d75${ini ? `%7Clabel:${ini}` : ""}%7C${p.meet.lat.toFixed(4)},${p.meet.lng.toFixed(4)}`;
  }
  if (myMeet) base += `&markers=size:mid%7Ccolor:0xe85d75%7C${myMeet.lat.toFixed(4)},${myMeet.lng.toFixed(4)}`;
  const MAP_ID = Deno.env.get("GMAPS_MAP_ID") || "";
  let resp = MAP_ID ? await fetch(`${base}&map_id=${MAP_ID}&key=${KEY}`) : new Response(null, { status: 599 });
  if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image")) {
    const m = `${base}&style=saturation:-100&style=feature:poi.business%7Cvisibility:off&key=`;
    resp = await fetch(m + KEY);
    if (!resp.ok && GEO_KEY !== KEY) resp = await fetch(m + GEO_KEY);
  }
  if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image")) return null;
  const buf = new Uint8Array(await resp.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  return "data:image/png;base64," + btoa(bin);
}
async function nearbyPeople(me: ReturnType<typeof mine>, uid: string, lat: number, lng: number) {
  const since = new Date(Date.now() - 45 * 6e4).toISOString();
  const { data: pres } = await me.from("tapin_presence").select("profile_id,area,lat,lng,picks,meet,at,prof:profiles(id,display_name,avatar_url)").gt("at", since).neq("profile_id", uid).limit(40);
  return (pres ?? [])
    .map((r) => ({ r, d: km({ lat, lng }, { lat: r.lat, lng: r.lng }) }))
    .filter((x) => x.d <= 1.6).sort((a, b) => a.d - b.d).slice(0, 8)
    .map(({ r, d }) => ({
      id: r.profile_id, name: (r.prof as { display_name?: string } | null)?.display_name ?? "Someone", avatar: (r.prof as { avatar_url?: string } | null)?.avatar_url ?? null,
      area: r.area, lat: r.lat, lng: r.lng, dist_m: Math.round(d * 1000), ago_min: Math.max(0, Math.round((Date.now() - new Date(r.at).getTime()) / 6e4)), picks: Array.isArray(r.picks) ? r.picks.slice(0, 4) : [], meet: meetOf(r.meet),
    }));
}
async function myMeet(me: ReturnType<typeof mine>, uid: string): Promise<Meet> {
  const { data } = await me.from("tapin_presence").select("meet,at").eq("profile_id", uid).maybeSingle();
  return data && Date.now() - new Date(data.at).getTime() < 45 * 6e4 ? meetOf(data.meet) : null;
}
type Meet = { id: string; name: string; lat: number; lng: number } | null;
function meetOf(v: unknown): Meet {
  const m = v as { id?: unknown; name?: unknown; lat?: unknown; lng?: unknown } | null;
  if (!m || typeof m.lat !== "number" || typeof m.lng !== "number" || typeof m.name !== "string") return null;
  return { id: String(m.id ?? "").slice(0, 80), name: m.name.slice(0, 80), lat: m.lat, lng: m.lng };
}
function rng(seed: number) { let t = (seed >>> 0) || 1; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const user = await requireUser(req);
    if (!user) return json({ error: "auth" }, 401);
    const me = mine(req);

    // wave: a push to someone in your circle who's tapped in nearby (1 per pair per hour)
    if (b.mode === "wave") {
      const to = String(b.to ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(to) || to === user.id) return json({ error: "to" }, 400);
      const [{ data: conn }, { data: comm }] = await Promise.all([me.rpc("are_connected", { u1: user.id, u2: to }), me.rpc("shares_community", { u1: user.id, u2: to })]);
      if (!conn && !comm) return json({ error: "not_circle" }, 403);
      const sb = svc();
      const wk = `w:${user.id}:${to}:${new Date().toISOString().slice(0, 13)}`;
      const { data: prev } = await sb.from("tapin_cache").select("key").eq("key", wk).maybeSingle();
      if (prev) return json({ ok: true, already: true });
      await sb.from("tapin_cache").upsert({ key: wk, payload: {}, at: new Date().toISOString() });
      const { data: meP } = await sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      const { data: pres } = await sb.from("tapin_presence").select("area").eq("profile_id", user.id).maybeSingle();
      const first = (meP?.display_name ?? "Someone").split(" ")[0];
      await sb.from("waves").insert({ from_id: user.id, to_id: to, from_name: meP?.display_name ?? null, area: pres?.area ?? null });
      const pr = await fetch(`${URL_()}/functions/v1/push-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-push-secret": Deno.env.get("PUSH_SECRET") ?? "" },
        body: JSON.stringify({ title: `${first} waved 👋`, body: `${first} is tapped in near you${pres?.area ? ` in ${pres.area}` : ""}. Tap in to find each other.`, url: "https://codewontchange-nyc.github.io/Collide/plans", profile_ids: [to] }),
      }).catch(() => null);
      return json({ ok: true, pushed: !!(pr && pr.ok) });
    }

    const lat = Number(b.lat), lng = Number(b.lng);
    if (!isFinite(lat) || !isFinite(lng)) return json({ error: "where" }, 400);

    if (b.mode === "where") return json(await whereAmI(lat, lng));

    if (b.mode === "peoplemap") {
      const [people, mm] = await Promise.all([nearbyPeople(me, user.id, lat, lng), myMeet(me, user.id)]);
      return json({ people, meet: mm, img: await peopleMap(lat, lng, people, mm) });
    }

    // seen: flip presence on/off without rebuilding a bundle
    if (b.mode === "seen") {
      if (b.visible) {
        const w = await whereAmI(lat, lng);
        const picks = Array.isArray(b.picks) ? b.picks.filter((x: unknown) => typeof x === "string").slice(0, 4) : [];
        const { error } = await me.from("tapin_presence").upsert({ profile_id: user.id, cell: `${b.city === "atl" ? "atl" : "nyc"}:${lat.toFixed(2)}:${lng.toFixed(2)}`, area: w.area, lat: +lat.toFixed(3), lng: +lng.toFixed(3), picks, meet: meetOf(b.meet), at: new Date().toISOString() });
        if (error) return json({ error: error.message }, 400);
      } else await me.from("tapin_presence").delete().eq("profile_id", user.id);
      return json({ ok: true });
    }

    if (b.mode !== "bundle") return json({ error: "mode" }, 400);
    const city = b.city === "atl" ? "atl" : "nyc";
    const seed = Number(b.seed) || 1;
    const exclude = new Set<string>(Array.isArray(b.exclude) ? b.exclude.filter((x: unknown) => typeof x === "string").slice(0, 60) : []);
    const sb = svc();
    if (Math.random() < 0.05) await sb.from("tapin_cache").delete().lt("at", new Date(Date.now() - 864e5).toISOString());

    // throttle: 12 bundles per person per hour
    const hourKey = `u:${user.id}:${new Date().toISOString().slice(0, 13)}`;
    const { data: hk } = await sb.from("tapin_cache").select("payload").eq("key", hourKey).maybeSingle();
    const used = Number(hk?.payload?.n ?? 0) + 1;
    await sb.from("tapin_cache").upsert({ key: hourKey, payload: { n: used }, at: new Date().toISOString() });
    const throttled = used > 12;

    // pool: Google places around this grid cell, cached an hour
    const cellKey = `p:${city}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    const { data: cached } = await sb.from("tapin_cache").select("payload,at").eq("key", cellKey).maybeSingle();
    let pool: Place[] = [], area: string | null = null, wide = false;
    if (cached && Date.now() - new Date(cached.at).getTime() < 36e5) {
      pool = cached.payload.pool ?? []; area = cached.payload.area ?? null; wide = !!cached.payload.wide;
      console.log("pool: cache hit", cellKey, pool.length);
    } else {
      const build = async (radius: number) => {
        const [a, c] = await Promise.all([
          nearby(lat, lng, radius, "type=restaurant&opennow=true"),
          nearby(lat, lng, radius, `keyword=${encodeURIComponent("things to do")}`),
        ]);
        const seen = new Set<string>(); const out: Place[] = [];
        for (const p of [...a, ...c]) { if (seen.has(p.id) || p.n < 15 || !catOf(p.types)) continue; seen.add(p.id); out.push(p); }
        return out;
      };
      const [w, p1] = await Promise.all([whereAmI(lat, lng), build(1000)]);
      area = w.area; pool = p1;
      if (pool.length < 8) { pool = await build(2000); wide = true; }
      await sb.from("tapin_cache").upsert({ key: cellKey, payload: { pool, area, wide }, at: new Date().toISOString() });
      console.log("pool: built", cellKey, pool.length, wide ? "(wide)" : "");
    }

    // Collide POIs and today's plans, as the caller sees them
    const maxKm = wide ? 2 : 1;
    const { data: pois } = await me.from("pois").select("id,name,category,address,lat,lng,images,tier,sponsored,story").not("lat", "is", null);
    const nearPois = (pois ?? [])
      .map((p) => ({ ...p, d: km({ lat, lng }, { lat: p.lat, lng: p.lng }) }))
      .filter((p) => p.d <= maxKm)
      .sort((a, b) => (Number(!!b.sponsored) - Number(!!a.sponsored)) || a.d - b.d)
      .slice(0, 3);
    const today = new Date(Date.now() - 4 * 36e5).toISOString().slice(0, 10); // ET-ish day boundary
    const { data: plans } = await me.from("activities").select("id,title,at_time,place,date,visibility,host_id,itin_kind,rsvps(profile_id)").eq("date", today).limit(6);
    const todays = (plans ?? []).filter((a) => a.itin_kind !== "hunt").slice(0, 3);

    // picks: seeded, avoiding what the person already saw
    const r = rng(seed * 7919 + pool.length);
    const score = (p: Place) => (p.rating || 3.5) * Math.log10((p.n || 15) + 10) + r() * 1.6;
    const fresh = pool.filter((p) => !exclude.has(p.id));
    const src = fresh.length >= 6 ? fresh : pool;
    const by = (c: Cat) => src.filter((p) => catOf(p.types) === c).sort((a, b) => score(b) - score(a));
    const eat = by("eat").slice(0, 3);
    const sip = [...by("coffee").slice(0, 1), ...by("drink").slice(0, 1)];
    if (sip.length < 2) sip.push(...by(sip.some((p) => catOf(p.types) === "coffee") ? "drink" : "coffee").slice(1, 2));
    const doo = by("do").slice(0, 3);
    const taken = new Set([...eat, ...sip, ...doo].map((p) => p.id));
    const nxt = (c: Cat, n: number) => by(c).filter((p) => !taken.has(p.id)).slice(0, n);
    const eatS = nxt("eat", 3), dooS = nxt("do", 3), sipS = [...nxt("coffee", 2), ...nxt("drink", 2)].slice(0, 3);
    const mkPlace = (p: Place, group: string) => {
      const cat = catOf(p.types) as Cat; const d = km({ lat, lng }, p) * 1000;
      return {
        kind: "place", group, id: p.id, name: p.name, cat, emoji: emojiOf(cat, p.types),
        meta: { rating: p.rating || null, n: p.n || null, price: p.price, open_now: p.open },
        dist_m: Math.round(d), walk_min: Math.max(1, Math.round(d / 80)), addr: p.addr,
        maps: `https://maps.google.com/?daddr=${encodeURIComponent(p.name + ", " + p.addr)}`, lat: p.lat, lng: p.lng,
      };
    };
    const picks = [
      ...nearPois.map((p) => ({
        kind: "poi", group: "spots", id: p.id, name: p.name, cat: "poi", emoji: "⚫", meta: { category: p.category || null, sponsored: !!p.sponsored },
        dist_m: Math.round(p.d * 1000), walk_min: Math.max(1, Math.round(p.d * 1000 / 80)), addr: p.address || "", image: (p.images ?? [])[0] ?? null,
        blurb: p.story ? String(p.story).split(/(?<=[.!?])\s/)[0].slice(0, 140) : null, lat: p.lat, lng: p.lng,
        maps: `https://maps.google.com/?daddr=${encodeURIComponent(p.name + ", " + (p.address || ""))}`,
      })),
      ...eat.map((p) => mkPlace(p, "eat")),
      ...sip.map((p) => mkPlace(p, "sip")),
      ...doo.map((p) => mkPlace(p, "do")),
      ...todays.map((a) => ({
        kind: "plan", group: "tonight", id: a.id, name: a.title, cat: "plan", emoji: "📅",
        meta: { at_time: a.at_time, place: a.place, rsvps: (a.rsvps ?? []).length, mine: (a.rsvps ?? []).some((x: { profile_id: string }) => x.profile_id === user.id) },
      })),
    ];

    const spares = { eat: eatS.map((p) => mkPlace(p, "eat")), sip: sipS.map((p) => mkPlace(p, "sip")), do: dooS.map((p) => mkPlace(p, "do")) };

    // presence: say "I'm here" (coarsely) if they chose to be seen, then look for their people nearby
    const areaLbl = area || (city === "atl" ? "Atlanta" : "New York");
    if (b.visible === true) {
      await me.from("tapin_presence").upsert({ profile_id: user.id, cell: `${city}:${lat.toFixed(2)}:${lng.toFixed(2)}`, area: areaLbl, lat: +lat.toFixed(3), lng: +lng.toFixed(3), picks: picks.filter((p) => p.kind !== "plan").slice(0, 4).map((p) => p.name), meet: meetOf(b.meet), at: new Date().toISOString() });
    } else if (b.visible === false) await me.from("tapin_presence").delete().eq("profile_id", user.id);
    const people = await nearbyPeople(me, user.id, lat, lng);
    const peopleMapP = peopleMap(lat, lng, people, b.visible === true ? meetOf(b.meet) : null);

    // editorial
    const now = new Date(Date.now() - 4 * 36e5);
    const hour = now.getUTCHours();
    const daypart = hour < 11 ? "morning" : hour < 15 ? "midday" : hour < 18 ? "late afternoon" : hour < 22 ? "evening" : "late night";
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getUTCDay()];
    const areaName = area || (city === "atl" ? "Atlanta" : "New York");
    let headline = `Your hour in ${areaName}`, body = "";
    const named = picks.filter((p) => p.kind !== "plan").slice(0, 8).map((p) => `${p.name} (${p.kind === "poi" ? "a Collide spot" : (p as { cat: string }).cat}${(p as { walk_min?: number }).walk_min ? `, ${(p as { walk_min: number }).walk_min} min walk` : ""})`).join("; ");
    const noteTargets = [...picks.filter((p) => p.group === "do"), ...spares.do, ...picks.filter((p) => p.kind === "poi" && !(p as { blurb?: string | null }).blurb)].slice(0, 9);
    const notes: Record<string, string> = {};
    if (!throttled && picks.length) {
      try {
        const prompt = `You write the front-page blurb for "Tap in", a feature in a small social app that hands someone a short walking list of good things near them right now. Voice: a warm, specific neighborhood newspaper — concrete, a little wry, never salesy. No emoji, no exclamation marks, no lists, no second-guessing the reader. Do not invent facts about the places beyond their names and categories.

Where: ${areaName}, ${city === "atl" ? "Atlanta" : "New York City"}. When: ${weekday} ${daypart}.
Picks on the list: ${named || "(none)"}.
${todays.length ? `Also happening today in the city: ${todays.map((a) => a.title).join("; ")}.` : ""}
${people.length ? `People the reader knows are tapped in a few blocks away right now: ${people.map((p) => p.name.split(" ")[0] + (p.meet ? ` (wants to meet at ${p.meet.name})` : "")).join(", ")}. Mention this once, warmly, by first name — it's the best part.` : ""}

Walking notes: for each item below, write 1-2 sentences (20-40 words) a friend would say while walking there — what it is, why it's worth it right now. Stick to what its name, category and neighborhood make clear plus well-known facts about famous places; if unsure, keep it to mood and timing rather than specifics.
${noteTargets.map((p) => `- id=${p.id} | ${p.name} | ${p.kind === "poi" ? "Collide spot" : (p as { cat: string }).cat} | ${(p as { walk_min?: number }).walk_min ?? "?"} min walk`).join("\n")}

Reply with JSON only: {"headline": "5-8 words, no period", "body": "2-3 sentences, 45-70 words, naming two or three of the picks and the neighborhood", "notes": {"<id>": "the walking note", ...}}`;
        const cr = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 1800, thinking: { type: "disabled" }, messages: [{ role: "user", content: prompt }] }),
        });
        const cj = await cr.json();
        const txt = String(cj?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "");
        const m = txt.match(/\{[\s\S]*\}/);
        if (cr.ok && m) { const o = JSON.parse(m[0]); if (o.headline) headline = String(o.headline).slice(0, 80); if (o.body) body = String(o.body).slice(0, 600);
          if (o.notes && typeof o.notes === "object") for (const [k, v] of Object.entries(o.notes)) if (typeof v === "string") notes[k] = v.slice(0, 320); }
        else { console.error("editorial", cr.status, cj?.error?.message); if (b.debug) (b as { _err?: string })._err = `${cr.status} stop=${cj?.stop_reason} types=${(cj?.content ?? []).map((c: { type: string }) => c.type).join(",")} text=${txt.slice(0, 300)} err=${cj?.error?.message ?? ""}`; }
      } catch (e) { console.error("editorial", e); if (b.debug) (b as { _err?: string })._err = String(e); }
    }
    if (!body) {
      const first = picks.find((p) => p.kind !== "plan");
      body = first ? `A ${daypart} in ${areaName} with ${first.name} a ${(first as { walk_min: number }).walk_min}-minute walk away, and ${Math.max(0, picks.length - 1)} more worth the detour below.` : `A quiet ${daypart} in ${areaName}. Wander a block and try again.`;
    }

    const withNote = <T extends { id: string }>(p: T) => (notes[p.id] ? { ...p, note: notes[p.id] } : p);
    return json({ area: areaName, wide, throttled, headline, body, seed, picks: picks.map(withNote), spares: { eat: spares.eat, sip: spares.sip, do: spares.do.map(withNote) }, people, peopleMap: await peopleMapP, pool: pool.length, daypart, weekday, ...(b.debug ? { _err: (b as { _err?: string })._err ?? null } : {}) });
  } catch (e) {
    console.error("tapin error:", e);
    return json({ error: "internal" }, 500);
  }
});
