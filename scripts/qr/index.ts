import QRCode from "npm:qrcode@1.5.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collide-city",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { text } = await req.json().catch(() => ({}));
    if (!text || typeof text !== "string" || text.length > 512) {
      return new Response(JSON.stringify({ error: "bad text" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const svg = await QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
    return new Response(JSON.stringify({ svg }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
