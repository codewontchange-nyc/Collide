// colony-match: smart matching for a need, server side.
// Same heuristic as the client's src/domain/match.ts, reimplemented compactly:
//   skill 40 (primary) / 20 (adjacent), distance 20/12/4 by haversine inside the
//   provider's radius, availability inside the urgency window 15, budget fit
//   15 (pool covers it now) / 8 (next month's leftover covers it), trust up to 10
//   (rating, brought by a member, already serves a colony home). Deterministic.
//
// POST { need_id }  (signed-in member of the need's colony)
//   -> { need_id, matches: [{ id, provider_id, score, reasons, quote_cents, earliest, status }] }
// Writes the top 3 rows to public.matches (service role) and sets the need to 'matched'.
//
// Deployed with: supabase functions deploy colony-match --no-verify-jwt --project-ref <ref>
// Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//
// NOT WIRED: designed alongside the prototype. The client's runMatch action
// calls this once Supabase is configured; until then matching runs in the browser.

import { CORS, json, requireUser, svc, uuidRe } from "../_shared/stripe.ts";

type Skill = string;
type Urgency = "whenever" | "this_week" | "soon" | "urgent";
type Avail = { weekday: number; from_t: string; to_t: string };
type ProviderRow = {
  id: string; colony_id: string | null; name: string; area: string; lat: number; lng: number; radius_km: number;
  rate_cents: number; rate_unit: "visit" | "hour"; rating: number; homes_served: number; kind: string;
  curated: boolean; brought_by: string | null;
  provider_skills: { skill: Skill; is_primary: boolean }[];
  provider_availability: Avail[];
};

/** Skills a provider can reasonably cover for a neighbouring category. */
const ADJACENT: Record<Skill, Skill[]> = {
  handyman: ["plumbing", "electrical", "hvac", "seasonal"],
  plumbing: ["handyman"],
  electrical: ["handyman"],
  hvac: ["handyman"],
  seasonal: ["handyman", "plants", "cleaning"],
  pest: ["cleaning"],
  sewing: [],
  plants: ["seasonal"],
  cleaning: ["house_manager", "laundry"],
  laundry: ["cleaning"],
  shopping: ["house_manager"],
  house_manager: ["shopping", "cleaning"],
  cooking: ["shopping"],
};

/** Typical hours per visit, used to turn an hourly rate into a quote. */
const TYPICAL_HOURS: Record<Skill, number> = {
  plumbing: 2, electrical: 2, hvac: 3, handyman: 3, pest: 1.5, sewing: 1, seasonal: 4,
  cooking: 4, cleaning: 3, laundry: 1, shopping: 2, house_manager: 2, plants: 1,
};

/** Days ahead that still count as "in time" for each urgency. */
const WINDOW_DAYS: Record<Urgency, number> = { urgent: 2, soon: 7, this_week: 7, whenever: 30 };

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function dollars(cents: number) { return "$" + Math.round(cents / 100).toLocaleString("en-US"); }

/** First day from tomorrow with an availability window, inside `limit` days; null when none. */
function earliestDay(avail: Avail[], today: Date, limit: number) {
  for (let i = 1; i <= limit; i++) {
    const d = addDays(today, i);
    const w = avail.find((a) => a.weekday === d.getUTCDay());
    if (w) return { date: d, window: w };
  }
  return null;
}

function daypart(fromT: string) {
  const h = Number(fromT.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const need_id = String(b.need_id ?? "");
    if (!uuidRe.test(need_id)) return json({ error: "bad_request" }, 400);

    const user = await requireUser(req);
    if (!user) return json({ error: "auth" }, 401);
    const sb = svc();

    // ---- need, membership, home ----
    const { data: need } = await sb.from("needs").select("id,colony_id,home_id,category,urgency,status").eq("id", need_id).maybeSingle();
    if (!need) return json({ error: "not_found" }, 404);
    const { data: member } = await sb.from("colony_members").select("profile_id").eq("colony_id", need.colony_id).eq("profile_id", user.id).maybeSingle();
    if (!member) return json({ error: "forbidden" }, 403);
    const { data: home } = await sb.from("homes").select("id,label,area,lat,lng").eq("id", need.home_id).maybeSingle();
    if (!home) return json({ error: "no_home" }, 409);

    // ---- colony context: pool, leftover, members, who already serves here ----
    const [{ data: balance }, { data: period }, { data: members }, { data: engaged }, { data: accepted }] = await Promise.all([
      sb.rpc("pool_balance", { cid: need.colony_id }),
      sb.from("budget_periods").select("leftover_cents").eq("colony_id", need.colony_id).order("month", { ascending: false }).limit(1).maybeSingle(),
      sb.from("colony_members").select("profile_id").eq("colony_id", need.colony_id),
      sb.from("engagements").select("provider_id").eq("colony_id", need.colony_id),
      sb.from("matches").select("provider_id, needs!inner(colony_id)").eq("status", "accepted").eq("needs.colony_id", need.colony_id),
    ]);
    const pool = Number(balance ?? 0);
    const leftover = Math.max(0, Number(period?.leftover_cents ?? 0));
    const memberIds = new Set((members ?? []).map((m) => m.profile_id as string));
    const servesHere = new Set([
      ...(engaged ?? []).map((e) => e.provider_id as string),
      ...(accepted ?? []).map((m) => m.provider_id as string),
    ]);

    // ---- candidates: this colony's providers plus the marketplace, with the skill or an adjacent one ----
    const wanted = [need.category, ...(ADJACENT[need.category] ?? [])];
    const { data: rows, error: pErr } = await sb.from("providers")
      .select("id,colony_id,name,area,lat,lng,radius_km,rate_cents,rate_unit,rating,homes_served,kind,curated,brought_by,provider_skills(skill,is_primary),provider_availability(weekday,from_t,to_t)")
      .or(`colony_id.eq.${need.colony_id},colony_id.is.null`);
    if (pErr) return json({ error: "providers", detail: pErr.message }, 500);
    const candidates = ((rows ?? []) as unknown as ProviderRow[])
      .filter((p) => p.provider_skills.some((s) => wanted.includes(s.skill)));

    // ---- score ----
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const urgency = (need.urgency as Urgency) ?? "whenever";
    const windowDays = WINDOW_DAYS[urgency] ?? 30;

    const scored = candidates.map((p) => {
      const reasons: string[] = [];
      let score = 0;

      // skill 40 / 20
      const primary = p.provider_skills.find((s) => s.is_primary)?.skill ?? p.provider_skills[0]?.skill;
      const hasSkill = p.provider_skills.some((s) => s.skill === need.category);
      if (primary === need.category) score += 40;
      else if (hasSkill || (ADJACENT[need.category] ?? []).includes(primary ?? "")) score += 20;

      // distance 20 / 12 / 4 inside the provider's radius
      const km = haversineKm(home.lat, home.lng, p.lat, p.lng);
      if (km <= p.radius_km) {
        if (km <= 3) score += 20; else if (km <= 8) score += 12; else score += 4;
        if (km <= 8) reasons.push(`${km < 1 ? "Under 1" : Math.round(km)} km from ${home.label}`);
      }
      if (p.homes_served > 0) reasons.push(`Serves ${p.homes_served} homes in ${p.area || home.area}`);

      // availability inside the urgency window 15
      const soon = earliestDay(p.provider_availability, today, windowDays);
      const first = soon ?? earliestDay(p.provider_availability, today, 14);
      if (soon) {
        score += 15;
        reasons.push(`Free ${DAY[soon.date.getUTCDay()]} ${daypart(soon.window.from_t)}`);
      }
      const earliest = iso(first?.date ?? addDays(today, 14));

      // budget fit 15 / 8 against the pool
      const hours = TYPICAL_HOURS[need.category] ?? 2;
      const quote = p.rate_unit === "hour" ? Math.round(p.rate_cents * hours) : p.rate_cents;
      if (pool >= quote) {
        score += 15;
        reasons.push(`Pool covers it with ${dollars(pool - quote)} to spare`);
      } else if (pool + leftover >= quote) {
        score += 8;
        reasons.push("Pool covers it next month");
      }

      // trust up to 10
      let trust = Math.round((Number(p.rating) / 5) * 6);
      if (p.brought_by && memberIds.has(p.brought_by)) { trust += 2; reasons.push("Brought by a member"); }
      if (servesHere.has(p.id)) { trust += 2; reasons.push("Already in your colony"); }
      if (Number(p.rating) >= 4.5) reasons.push(`Rated ${Number(p.rating).toFixed(1)}`);
      score += Math.min(10, trust);

      return { provider_id: p.id, name: p.name, score: Math.min(100, score), reasons: reasons.slice(0, 4), quote_cents: quote, earliest };
    });

    // deterministic: score desc, then earliest asc, then name
    scored.sort((a, b) => b.score - a.score || a.earliest.localeCompare(b.earliest) || a.name.localeCompare(b.name));
    const top = scored.slice(0, 3);
    if (!top.length) return json({ need_id, matches: [] });

    // ---- write ----
    const { data: written, error: mErr } = await sb.from("matches")
      .upsert(top.map((m) => ({
        need_id, provider_id: m.provider_id, score: m.score, reasons: m.reasons,
        quote_cents: m.quote_cents, earliest: m.earliest, status: "suggested",
      })), { onConflict: "need_id,provider_id" })
      .select("id,need_id,provider_id,score,reasons,quote_cents,earliest,status");
    if (mErr) return json({ error: "matches", detail: mErr.message }, 500);
    if (need.status === "open" || need.status === "matching") {
      await sb.from("needs").update({ status: "matched" }).eq("id", need_id);
    }
    return json({ need_id, matches: written ?? [] });
  } catch (e) {
    console.error("colony-match", e);
    return json({ error: "internal", detail: String(e).slice(0, 200) }, 500);
  }
});
