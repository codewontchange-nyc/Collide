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
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(pid)}&fields=name,formatted_address,geometry,opening_hours,website,formatted_phone_number,rating,user_ratings_total,price_level,photos,types,url&key=${KEY}`,
          ).then((x) => x.json())
        ).result;
        if (!det) return json({ error: "not_found" }, 404);
        const photos: string[] = [];
        if (isStaff) {
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
    if (b.mode === "poi" || b.mode === "poimap" || b.mode === "poiroute") {
      if (!(await requireUser(req))) return json({ error: "auth" }, 401);
      const url = Deno.env.get("SUPABASE_URL")!;
      const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: poi } = await sb
        .from("pois")
        .select("id,name,city,address,hours,link,lat,lng")
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
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${top.place_id}&fields=rating,user_ratings_total,price_level,opening_hours,formatted_phone_number,website,url,formatted_address,geometry,business_status&key=${key}`,
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
        // Collide's cloud map style first; inline desaturation as fallback.
        const MAP_ID = Deno.env.get("GMAPS_MAP_ID") || "5ae98f9830e03186";
        let resp = await fetch(`${base}&map_id=${MAP_ID}&key=${KEY}`);
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
