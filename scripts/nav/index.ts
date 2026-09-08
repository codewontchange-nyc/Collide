import { createClient } from "npm:@supabase/supabase-js@2";

const KEY = Deno.env.get("GOOGLE_MAPS_KEY") ?? "";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!KEY) return json({ error: "no_key" }, 500);
    const b = await req.json();

    if (b.mode === "geocode") {
      const addr = String(b.address || "").slice(0, 200);
      if (!addr) return json({ error: "address" }, 400);
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${KEY}`,
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
            .maybeSingle()
        ).data;
      if (!claimed) return json({ error: "not_claimed" }, 403);
      const mode = ["walking", "transit", "driving", "bicycling"].includes(b.travel)
        ? b.travel
        : "walking";
      const f = b.from ?? {};
      if (typeof f.lat !== "number" || typeof f.lng !== "number")
        return json({ error: "from" }, 400);
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${f.lat},${f.lng}&destination=${m.pickup_lat},${m.pickup_lng}&mode=${mode}&key=${KEY}`,
      ).then((x) => x.json());
      const leg = r.routes?.[0]?.legs?.[0];
      if (!leg) return json({ error: "no_route", status: r.status });
      const steps = leg.steps.map(
        (s: { html_instructions: string; distance?: { text: string } }) =>
          s.html_instructions.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() +
          (s.distance ? ` — ${s.distance.text}` : ""),
      );
      return json({
        steps,
        dist: leg.distance?.text ?? "",
        mins: Math.round((leg.duration?.value ?? 0) / 60),
      });
    }

    return json({ error: "mode" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
