// qr — render a small QR SVG for the caller's connect code / links. Requires a
// signed-in user (it does its own auth) so it can't be looped anonymously.
import QRCode from "npm:qrcode@1.5.4";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collide-city",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("authorization") ?? "";
    const { data } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    ).auth.getUser();
    if (!data.user) return json({ error: "auth" }, 401);

    const { text } = await req.json().catch(() => ({}));
    if (!text || typeof text !== "string" || text.length > 512) return json({ error: "bad text" }, 400);
    const svg = await QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
    return json({ svg });
  } catch (e) {
    console.error("qr error:", e);
    return json({ error: "internal" }, 500);
  }
});
