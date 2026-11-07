import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const base = (env.VITE_BASE || "/").replace(/\/?$/, "/");
  return {
    base,
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
        manifest: {
          name: "Colony",
          short_name: "Colony",
          description: "Everyone has a role. Each one is vital.",
          start_url: ".",
          scope: ".",
          id: base,
          display: "standalone",
          orientation: "portrait",
          background_color: "#ffffff",
          theme_color: "#ffffff",
          lang: "en",
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          navigateFallback: "index.html",
          cleanupOutdatedCaches: true,
          globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: "CacheFirst",
              options: { cacheName: "fonts-css", expiration: { maxEntries: 4, maxAgeSeconds: 604800 } },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: "CacheFirst",
              options: { cacheName: "fonts-glyphs", expiration: { maxEntries: 16, maxAgeSeconds: 31536000 } },
            },
            {
              urlPattern: /^https:\/\/api\.dicebear\.com\//,
              handler: "CacheFirst",
              options: { cacheName: "avatars", expiration: { maxEntries: 400, maxAgeSeconds: 2592000 } },
            },
          ],
        },
      }),
    ],
  };
});
