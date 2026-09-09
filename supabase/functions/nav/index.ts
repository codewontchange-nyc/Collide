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
      const addr = String(b.address || "").slice(0, 200);
      if (!addr) return json({ error: "address" }, 400);
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GEO_KEY}`,
      ).then((x) => x.json());
      const g = r.results?.[0];
      if (!g) return json({ error: "not_found", status: r.status });
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

    // ---- POI modes: place scrape, mini map, directions ----
    if (b.mode === "poi" || b.mode === "poimap" || b.mode === "poiroute") {
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
        const top = r.results?.[0];
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
        const m =
          `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
          `&zoom=${Number(b.zoom) || 16}&size=600x300&scale=2&maptype=roadmap` +
          `&markers=color:0x111111%7C${lat},${lng}` +
          `&style=saturation:-100&style=feature:poi.business%7Cvisibility:off&key=`;
        let resp = await fetch(m + KEY);
        if (!resp.ok && GEO_KEY !== KEY) resp = await fetch(m + GEO_KEY);
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
    return json({ error: String(e) }, 500);
  }
});
