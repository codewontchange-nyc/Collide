import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = Deno.env.get("GOOGLE_MAPS_KEY") ?? "";
const GEO_KEY = Deno.env.get("GOOGLE_MAPS_KEY_GEO") || KEY;
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-collide-city",
};

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const TRAVEL = ["walking", "transit", "driving", "bicycling"];

// Every mode hits paid Google APIs (and some write to the DB with the service
// role), so require a valid end-user before doing any work.
async function requireUser(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("authorization") ?? "";
  const { data } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  }).auth.getUser();
  return data.user;
}

// Place Details rarely carries a neighborhood component; reverse geocoding does.
async function hood(loc?: { lat: number; lng: number }): Promise<string | null> {
  if (!loc) return null;
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&result_type=neighborhood&key=${GEO_KEY}`).then((x) => x.json());
    const c = r.results?.[0]?.address_components?.find((c: { types: string[] }) => c.types.includes("neighborhood"));
    return c?.long_name ?? null;
  } catch { return null; }
}

async function directions(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  travel: string,
) {
  const mode = TRAVEL.includes(travel) ? travel : "walking";
  const r = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&mode=${mode}&key=${KEY}`,
  ).then((x) => x.json());
  const leg = r.routes?.[0]?.legs?.[0];
  if (!leg) return { error: "no_route", status: r.status };
  const steps = leg.steps.map(
    (s: { html_instructions: string; distance?: { text: string } }) =>
      s.html_instructions.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() +
      (s.distance ? ` — ${s.distance.text}` : ""),
  );
  return {
    steps,
    dist: leg.distance?.text ?? "",
    mins: Math.round((leg.duration?.value ?? 0) / 60),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!KEY) return json({ error: "no_key" }, 500);
    const b = await req.json();

    if (b.mode === "geocode") {
      if (!(await requireUser(req))) return json({ error: "auth" }, 401);
      const addr = String(b.address || "").slice(0, 200);
      if (!addr) return json({ error: "address" }, 400);
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GEO_KEY}`,
      ).then((x) => x.json());
      const g = r.results?.[0];
      if (!g) return json({ error: "not_found", status: r.status }, 404);
      const comp = (t: string) =>
        g.address_components?.find((c: { types: string[] }) => c.types.includes(t))?.long_name;
      return json({
        lat: g.geometry.location.lat,
        lng: g.geometry.location.lng,
        area: comp("neighborhood") ?? comp("sublocality") ?? comp("locality") ?? null,
      });
    }

    if (b.mode === "route") {
      const auth = req.headers.get("authorization") ?? "";
      const url = Deno.env.get("SUPABASE_URL")!;
      const user = (
        await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: auth } },
        }).auth.getUser()
      ).data.user;
      if (!user) return json({ error: "auth" }, 401);
      const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: m } = await sb
        .from("meals")
        .select("pickup_lat,pickup_lng,cook_id")
        .eq("id", b.mid)
        .single();
      if (!m || m.pickup_lat == null) return json({ error: "not_found" }, 404);
      const claimed =
        m.cook_id === user.id ||
        !!(
          await sb
            .from("meal_claims")
            .select("meal_id")
            .eq("meal_id", b.mid)
            .eq("profile_id", user.id)
            .eq("status", "approved")
            .maybeSingle()
        ).data;
      if (!claimed) return json({ error: "not_claimed" }, 403);
      const f = b.from ?? {};
      if (typeof f.lat !== "number" || typeof f.lng !== "number")
        return json({ error: "from" }, 400);
      const d = await directions(f, { lat: m.pickup_lat, lng: m.pickup_lng }, b.travel);
      return json(d);
    }

    // ---- Add-a-spot modes: google autocomplete + data/photo pull + create ----
    if (b.mode === "placesearch" || b.mode === "placepull" || b.mode === "poicreate") {
      const url = Deno.env.get("SUPABASE_URL")!;
      const auth = req.headers.get("authorization") ?? "";
      const user = (
        await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: auth } },
        }).auth.getUser()
      ).data.user;
      if (!user) return json({ error: "auth" }, 401);
      const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: staffRows } = await sb
        .from("staff")
        .select("role")
        .eq("email", user.email ?? "");
      const isStaff = !!staffRows?.length;
      const cityName = b.city === "atl" ? "Atlanta, GA" : "New York, NY";

      if (b.mode === "placesearch") {
        const q = String(b.q || "").slice(0, 120).trim();
        if (!q) return json({ error: "q" }, 400);
        const r = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q + ", " + cityName)}&key=${KEY}`,
        ).then((x) => x.json());
        const out = (r.results || [])
          .filter(
            (t: { types?: string[]; user_ratings_total?: number }) =>
              (Array.isArray(t.types) &&
                (t.types.includes("establishment") || t.types.includes("point_of_interest"))) ||
              (t.user_ratings_total ?? 0) > 0,
          )
          .slice(0, 6)
          .map((t: Record<string, any>) => ({
            pid: t.place_id,
            name: t.name,
            addr: t.formatted_address ?? null,
            rating: t.rating ?? null,
            n: t.user_ratings_total ?? null,
            type: (t.types || []).find((x: string) => !["establishment", "point_of_interest", "food"].includes(x)) ?? null,
          }));
        return json({ results: out });
      }

      if (b.mode === "placepull") {
        const pid = String(b.place_id || "").slice(0, 300);
        if (!pid) return json({ error: "place_id" }, 400);
        const det = (
          await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(pid)}&fields=name,formatted_address,address_components,geometry,opening_hours,website,formatted_phone_number,rating,user_ratings_total,price_level,photos,types,url&key=${KEY}`,
          ).then((x) => x.json())
        ).result;
        if (!det) return json({ error: "not_found" }, 404);
        const photos: string[] = [];
        const comp = (t: string) => det.address_components?.find((c: { types: string[] }) => c.types.includes(t))?.long_name;
        if (isStaff && !b.nophotos) {
          const list = (det.photos || []).slice(0, 3);
          const safe = pid.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "p";
          for (let i = 0; i < list.length; i++) {
            try {
              const resp = await fetch(
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${list[i].photo_reference}&key=${KEY}`,
              );
              if (!resp.ok) continue;
              const ct = resp.headers.get("content-type") || "image/jpeg";
              const path = `poi/g/${safe}-${i}${ct.includes("png") ? ".png" : ".jpg"}`;
              const up = await sb.storage
                .from("event-media")
                .upload(path, new Uint8Array(await resp.arrayBuffer()), {
                  contentType: ct,
                  upsert: true,
                });
              if (!up.error) photos.push(path);
            } catch (_e) { /* photo optional */ }
          }
        }
        const wt: string[] = det.opening_hours?.weekday_text ?? [];
        const today = wt.length ? (wt[(new Date().getDay() + 6) % 7] || "").replace(/^[A-Za-z]+:\s*/, "") : "";
        return json({
          name: det.name ?? null,
          addr: det.formatted_address ?? null,
          lat: det.geometry?.location?.lat ?? null,
          lng: det.geometry?.location?.lng ?? null,
          phone: det.formatted_phone_number ?? null,
          site: det.website ?? null,
          rating: det.rating ?? null,
          n: det.user_ratings_total ?? null,
          hours_today: today || null,
          hours_week: wt,
          area: comp("neighborhood") ?? await hood(det.geometry?.location) ?? comp("sublocality") ?? comp("locality") ?? null,
          type: (det.types || []).find((x: string) => !["establishment", "point_of_interest", "food"].includes(x)) ?? null,
          photos,
        });
      }

      if (b.mode === "poicreate") {
        if (!isStaff) return json({ error: "staff_only" }, 403);
        const p = b.poi || {};
        const name = String(p.name || "").slice(0, 80).trim();
        if (!name) return json({ error: "name" }, 400);
        const city = ["nyc", "atl", "chi", "la", "sf", "nola", "dc"].includes(p.city) ? p.city : "nyc";
        const images = Array.isArray(p.images) ? p.images.filter((x: unknown) => typeof x === "string").slice(0, 6) : [];
        const row: Record<string, unknown> = {
          name,
          city,
          created_by: user.id,
          category: p.category ? String(p.category).slice(0, 40) : null,
          address: p.address ? String(p.address).slice(0, 160) : null,
          hours: p.hours ? String(p.hours).slice(0, 120) : null,
          link: p.link ? String(p.link).slice(0, 300) : null,
          blurb: p.blurb ? String(p.blurb).slice(0, 200) : null,
          notes: p.notes ? String(p.notes).slice(0, 400) : null,
          lat: typeof p.lat === "number" ? p.lat : null,
          lng: typeof p.lng === "number" ? p.lng : null,
          x: typeof p.x === "number" ? Math.min(1, Math.max(0, p.x)) : null,
          y: typeof p.y === "number" ? Math.min(1, Math.max(0, p.y)) : null,
          images,
          image_path: images[0] ?? null,
        };
        const ins = await sb.from("pois").insert(row).select("id").single();
        if (ins.error) return json({ error: ins.error.message }, 500);
        return json({ id: ins.data.id });
      }
    }

    // ---- POI modes: place scrape, mini map, directions ----
    // ---- visitmap: one static map with a pin per visited place ----
    // ---- hunts & adventures: area-circle mini map, and directions to a found stop ----
    if (b.mode === "huntmap" || b.mode === "stoproute") {
      const user = await requireUser(req);
      if (!user) return json({ error: "auth" }, 401);
      const url = Deno.env.get("SUPABASE_URL")!;
      const me = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
      });
      const aid = String(b.aid ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(aid)) return json({ error: "bad_request" }, 400);
      const { data: act } = await me.from("activities").select("id,host_id,city,itin_kind,itinerary").eq("id", aid).maybeSingle();
      if (!act) return json({ error: "not_found" }, 404);
      const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: cks } = await sb.from("itin_checkins").select("stop_idx").eq("activity_id", aid).eq("profile_id", user.id);
      const found = new Set((cks ?? []).map((c: { stop_idx: number }) => c.stop_idx));
      const isHost = act.host_id === user.id;
      // deno-lint-ignore no-explicit-any
      const stops: any[] = Array.isArray(act.itinerary) ? act.itinerary : [];
      // deno-lint-ignore no-explicit-any
      const hasLoc = (s: any) => typeof s?.lat === "number" && typeof s?.lng === "number";
      const reveal = (i: number) => isHost || found.has(i);
      const RAD: Record<string, number> = { sm: 200, md: 300, lg: 500 };

      if (b.mode === "stoproute") {
        const i = Number(b.i);
        const s = stops[i];
        if (!s) return json({ error: "not_found" }, 404);
        if (!reveal(i)) return json({ error: "not_found_yet" }, 403);
        if (!hasLoc(s)) return json({ error: "no_loc" }, 404);
        const f = b.from ?? {};
        if (typeof f.lat !== "number" || typeof f.lng !== "number") return json({ error: "from" }, 400);
        return json(await directions(f, { lat: s.lat, lng: s.lng }, b.travel));
      }

      // Circles are nudged off the true point by a hash of activity+stop (never the caller),
      // so the stop sits inside its circle but never at the center, and users can't triangulate.
      const h32 = (str: string) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
      const nudge = (i: number, lat: number, lng: number, r: number) => {
        const h = h32(`${aid}:${i}`);
        const ang = (h % 3600) / 3600 * 2 * Math.PI;
        const d = r * (0.15 + ((h >>> 12) % 1000) / 1000 * 0.25);
        return { lat: lat + d * Math.cos(ang) / 111320, lng: lng + d * Math.sin(ang) / (111320 * Math.cos(lat * Math.PI / 180)) };
      };
      const circle = (c: { lat: number; lng: number }, r: number, n = 24) => {
        const k = 111320 * Math.cos(c.lat * Math.PI / 180); const out: [number, number][] = [];
        for (let j = 0; j <= n; j++) { const a = 2 * Math.PI * j / n; out.push([c.lat + r * Math.cos(a) / 111320, c.lng + r * Math.sin(a) / k]); }
        return out;
      };
      const encPoly = (pts: [number, number][]) => {
        let out = "", pla = 0, pln = 0;
        for (const [la, ln] of pts) {
          const a = Math.round(la * 1e5), bb = Math.round(ln * 1e5);
          for (let v of [a - pla, bb - pln]) { v = v < 0 ? ~(v << 1) : v << 1; while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } out += String.fromCharCode(v + 63); }
          pla = a; pln = bb;
        }
        return out;
      };
      const located = stops.map((s, i) => ({ s, i })).filter((o) => hasLoc(o.s));
      if (!located.length) return json({ error: "no_loc" }, 404);
      let base = `https://maps.googleapis.com/maps/api/staticmap?size=600x340&scale=2&maptype=roadmap`;
      const badges: string[] = [];   // later markers paint on top, so lower numbers go last (the next stop wins)
      const placed: { lat: number; lng: number }[] = [];
      for (const { s, i } of located) {
        const r = RAD[s.radius] ?? 300;
        if (reveal(i)) {
          base += `&markers=size:mid%7Ccolor:0x18857a` + (i < 9 ? `%7Clabel:${i + 1}` : "") + `%7C${s.lat},${s.lng}`;
        } else {
          const c = nudge(i, s.lat, s.lng, r);
          base += `&path=fillcolor:0x18857a33%7Ccolor:0x18857aff%7Cweight:2%7Cenc:${encodeURIComponent(encPoly(circle(c, r)))}`;
          // order badge (numbered disc, no pin tip) on the circle's top edge — it tags the area, it is not the spot
          if (i < 20) {
            // walk the rim (north first) until the badge sits clear of the ones already placed
            const k = 111320 * Math.cos(c.lat * Math.PI / 180);
            let pt = { lat: c.lat + r / 111320, lng: c.lng };
            for (const deg of [0, 50, -50, 100, -100, 150, -150, 180]) {
              const a = deg * Math.PI / 180;
              pt = { lat: c.lat + r * Math.cos(a) / 111320, lng: c.lng + r * Math.sin(a) / k };
              if (!placed.some((p) => Math.hypot((p.lat - pt.lat) * 111320, (p.lng - pt.lng) * k) < 90)) break;
            }
            placed.push(pt);
            badges.unshift(`&markers=anchor:center%7Cicon:${encodeURIComponent(`https://codewontchange-nyc.github.io/Collide/assets/hunt-n2/${i + 1}.png`)}%7C${pt.lat.toFixed(6)},${pt.lng.toFixed(6)}`);
          }
        }
      }
      base += badges.join("");
      if (located.length === 1) base += "&zoom=14";
      const MAP_ID = Deno.env.get("GMAPS_MAP_ID") || "";
      let resp = MAP_ID ? await fetch(`${base}&map_id=${MAP_ID}&key=${KEY}`) : new Response(null, { status: 599 });
      if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image")) {
        const m = `${base}&style=saturation:-100&style=feature:poi.business%7Cvisibility:off&key=`;
        resp = await fetch(m + KEY);
        if (!resp.ok && GEO_KEY !== KEY) resp = await fetch(m + GEO_KEY);
      }
      if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image"))
        return json({ error: "map_unavailable", status: resp.status }, 502);
      const buf = new Uint8Array(await resp.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      return json({
        img: "data:image/png;base64," + btoa(bin),
        kind: act.itin_kind,
        stops: stops.map((s, i) => ({
          i, found: found.has(i), located: hasLoc(s), area: s.area ?? null, radius: s.radius ?? "md",
          ...(reveal(i) && hasLoc(s) ? { lat: s.lat, lng: s.lng, address: s.address ?? null, place: s.place ?? null } : {}),
        })),
      });
    }

    if (b.mode === "visitmap") {
      if (!(await requireUser(req))) return json({ error: "auth" }, 401);
      const pids = Array.isArray(b.pids) ? b.pids.filter((x: unknown) => typeof x === "string").slice(0, 40) : [];
      if (!pids.length) return json({ error: "pids" }, 400);
      const url = Deno.env.get("SUPABASE_URL")!;
      const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: pins } = await sb.from("pois").select("id,lat,lng").in("id", pids).not("lat", "is", null);
      if (!pins?.length) return json({ error: "no_pins" }, 404);
      const marks = pins.map((p: { lat: number; lng: number }) => `${p.lat},${p.lng}`).join("%7C");
      const base =
        `https://maps.googleapis.com/maps/api/staticmap?size=600x300&scale=2&maptype=roadmap` +
        `&markers=size:mid%7Ccolor:0x111111%7C${marks}` + (pins.length === 1 ? "&zoom=14" : "");
      const MAP_ID = Deno.env.get("GMAPS_MAP_ID") || "";
      let resp = MAP_ID ? await fetch(`${base}&map_id=${MAP_ID}&key=${KEY}`) : new Response(null, { status: 599 });
      if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image")) {
        const m = `${base}&style=saturation:-100&style=feature:poi.business%7Cvisibility:off&key=`;
        resp = await fetch(m + KEY);
        if (!resp.ok && GEO_KEY !== KEY) resp = await fetch(m + GEO_KEY);
      }
      if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image"))
        return json({ error: "map_unavailable", status: resp.status }, 502);
      const buf = new Uint8Array(await resp.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      return json({ img: "data:image/png;base64," + btoa(bin), pins });
    }

    if (b.mode === "poi" || b.mode === "poimap" || b.mode === "poiroute") {
      if (!(await requireUser(req))) return json({ error: "auth" }, 401);
      const url = Deno.env.get("SUPABASE_URL")!;
      const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: poi } = await sb
        .from("pois")
        .select("id,name,city,address,hours,link,lat,lng,images")
        .eq("id", b.pid)
        .single();
      if (!poi) return json({ error: "not_found" }, 404);
      const cityName = poi.city === "atl" ? "Atlanta, GA" : "New York, NY";

      // Places text search + details; tries the primary key, falls back to the geo key.
      let scraped: Record<string, unknown> | null | undefined;
      async function places() {
        if (scraped !== undefined) return scraped;
        scraped = null;
        const q = `${poi.name}, ${poi.address ? poi.address + ", " : ""}${cityName}`;
        let key = KEY;
        let r = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${key}`,
        ).then((x) => x.json());
        if (r.status === "REQUEST_DENIED" && GEO_KEY !== KEY) {
          key = GEO_KEY;
          r = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${key}`,
          ).then((x) => x.json());
        }
        const top = (r.results || []).find(
          (t: { types?: string[]; user_ratings_total?: number }) =>
            (Array.isArray(t.types) &&
              (t.types.includes("establishment") || t.types.includes("point_of_interest"))) ||
            (t.user_ratings_total ?? 0) > 0,
        );
        if (!top) return scraped;
        const det = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${top.place_id}&fields=rating,user_ratings_total,price_level,opening_hours,formatted_phone_number,website,url,formatted_address,geometry,business_status,photos&key=${key}`,
        ).then((x) => x.json());
        scraped = det.result ?? top;
        return scraped;
      }

      let lat = poi.lat, lng = poi.lng;
      if (lat == null || lng == null) {
        const g: any = await places();
        if (g?.geometry?.location) {
          lat = g.geometry.location.lat;
          lng = g.geometry.location.lng;
        } else if (poi.address) {
          const r = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(poi.address + ", " + cityName)}&key=${GEO_KEY}`,
          ).then((x) => x.json());
          const gg = r.results?.[0];
          if (gg) { lat = gg.geometry.location.lat; lng = gg.geometry.location.lng; }
        }
        if (lat != null) await sb.from("pois").update({ lat, lng }).eq("id", poi.id);
      }

      if (b.mode === "poi") {
        const g: any = await places();
        if (g) {
          const upd: Record<string, unknown> = {};
          if (!poi.address && g.formatted_address) upd.address = g.formatted_address;
          if (!poi.link && g.website) upd.link = g.website;
          if (Object.keys(upd).length) await sb.from("pois").update(upd).eq("id", poi.id);
        }
        // Photo backfill: POIs with no images (or only demo placeholders) get real
        // ones — Google Place photos first, the venue site's og:image as last resort.
        const curImgs: string[] = Array.isArray(poi.images) ? poi.images : [];
        const needPhotos =
          curImgs.length === 0 || curImgs.every((x) => typeof x === "string" && x.startsWith("poi/demo-"));
        if (needPhotos) {
          const stored: string[] = [];
          const put = async (bytes: ArrayBuffer, ct: string, i: number) => {
            const path = `poi/g/${poi.id}-${i}${ct.includes("png") ? ".png" : ct.includes("webp") ? ".webp" : ".jpg"}`;
            const up = await sb.storage.from("event-media").upload(path, new Uint8Array(bytes), {
              contentType: ct,
              upsert: true,
            });
            if (!up.error) stored.push(path);
          };
          for (const [i, ph] of ((g?.photos ?? []) as { photo_reference: string }[]).slice(0, 3).entries()) {
            try {
              const resp = await fetch(
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${ph.photo_reference}&key=${KEY}`,
              );
              const ct = resp.headers.get("content-type") || "";
              if (resp.ok && ct.startsWith("image")) await put(await resp.arrayBuffer(), ct, i);
            } catch (_e) { /* photo optional */ }
          }
          if (!stored.length && (poi.link || g?.website)) {
            try {
              const site = String(poi.link || g.website);
              const html = await fetch(site, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; CollideBot/1.0)" },
                signal: AbortSignal.timeout(8000),
              }).then((x) => x.text());
              const m =
                html.match(/property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) ||
                html.match(/content=["']([^"']+)["'][^>]*property=["']og:image/i) ||
                html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
              if (m?.[1]) {
                const u = new URL(m[1].replace(/&amp;/g, "&"), site).toString();
                const resp = await fetch(u, { signal: AbortSignal.timeout(8000) });
                const ct = resp.headers.get("content-type") || "";
                const len = Number(resp.headers.get("content-length") || 0);
                if (resp.ok && ct.startsWith("image") && len < 5e6) await put(await resp.arrayBuffer(), ct, 0);
              }
            } catch (_e) { /* last resort only */ }
          }
          if (stored.length)
            await sb.from("pois").update({ images: stored, image_path: stored[0] }).eq("id", poi.id);
        }
        return json({
          lat, lng,
          g: g && {
            rating: g.rating ?? null,
            n: g.user_ratings_total ?? null,
            price: g.price_level ?? null,
            open_now: g.opening_hours?.open_now ?? null,
            hours: g.opening_hours?.weekday_text ?? null,
            phone: g.formatted_phone_number ?? null,
            site: g.website ?? null,
            gurl: g.url ?? null,
            addr: g.formatted_address ?? null,
            status: g.business_status ?? null,
          },
        });
      }

      if (lat == null || lng == null) return json({ error: "no_loc" }, 404);

      if (b.mode === "poimap") {
        const base =
          `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
          `&zoom=${Number(b.zoom) || 16}&size=600x300&scale=2&maptype=roadmap` +
          `&markers=color:0x111111%7C${lat},${lng}`;
        // Collide's cloud map style (set GMAPS_MAP_ID); inline desaturation until then.
        const MAP_ID = Deno.env.get("GMAPS_MAP_ID") || "";
        let resp = MAP_ID
          ? await fetch(`${base}&map_id=${MAP_ID}&key=${KEY}`)
          : new Response(null, { status: 599 });
        if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image")) {
          const m = `${base}&style=saturation:-100&style=feature:poi.business%7Cvisibility:off&key=`;
          resp = await fetch(m + KEY);
          if (!resp.ok && GEO_KEY !== KEY) resp = await fetch(m + GEO_KEY);
        }
        if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image"))
          return json({ error: "map_unavailable", status: resp.status }, 502);
        const buf = new Uint8Array(await resp.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 8192)
          bin += String.fromCharCode(...buf.subarray(i, i + 8192));
        return json({ img: "data:image/png;base64," + btoa(bin), lat, lng });
      }

      if (b.mode === "poiroute") {
        const f = b.from ?? {};
        if (typeof f.lat !== "number" || typeof f.lng !== "number")
          return json({ error: "from" }, 400);
        const d = await directions(f, { lat, lng }, b.travel);
        return json(d);
      }
    }

    return json({ error: "mode" }, 400);
  } catch (e) {
    console.error("nav error:", e);
    return json({ error: "internal" }, 500);
  }
});
