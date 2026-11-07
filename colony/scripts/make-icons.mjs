// Renders public/favicon.svg (the colony ring) to the PWA icon set with the preinstalled Chromium.
// Run: npm run icons. PNGs are committed so the host never needs a browser.
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/favicon.svg"), "utf8");
const out = join(root, "public/icons");
mkdirSync(out, { recursive: true });

const candidates = [
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
  "/opt/pw-browsers/chromium-1243/chrome-linux/chrome",
  "/opt/pw-browsers/chromium",
].filter(Boolean);
const executablePath = process.env.PLAYWRIGHT_BROWSERS_PATH ? undefined : candidates.find((p) => existsSync(p));

const page = (size, pad, radius) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;background:#ffffff;border-radius:${radius}px;display:grid;place-items:center">
<div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace("<svg ", '<svg style="width:100%;height:100%" ')}</div>
</div></body></html>`;

const jobs = [
  ["icon-192.png", 192, 28, 0],
  ["icon-512.png", 512, 76, 0],
  ["maskable-512.png", 512, 128, 0],
  ["apple-touch-icon.png", 180, 28, 0],
];

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const [name, size, pad, radius] of jobs) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(page(size, pad, radius));
  await p.screenshot({ path: join(out, name), clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
  console.log("wrote", name);
}
await browser.close();
