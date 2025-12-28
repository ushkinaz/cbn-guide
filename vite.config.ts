import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import EnvironmentPlugin from "vite-plugin-environment";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@sentry")) return "sentry";
            if (id.includes("@transifex") || id.includes("gettext.js"))
              return "i18n";
            if (
              id.includes("svelte") ||
              id.includes("vite") ||
              id.includes("workbox")
            )
              return "framework";
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  plugins: [
    EnvironmentPlugin({
      GITHUB_SHA: null,
      CF_PAGES_COMMIT_SHA: null,
      SENTRY_DSN: null,
    }),
    svelte(),
    VitePWA({
      devOptions: {
        enabled: true,
      },
      includeAssets: ["favicon.png"],
      manifest: {
        short_name: "Cataclysm: BN Guide",
        name: "The Hitchhiker's Guide to the Cataclysm: Bright Nights",
        description:
          "The Hitchhiker's Guide to the Cataclysm: Bright Nights. Search items, monsters, and more in this offline-capable guide for the zombie survival roguelike.",
        icons: [
          {
            src: "icon-192.png",
            type: "image/png",
            sizes: "192x192",
          },
          {
            src: "icon-512.png",
            type: "image/png",
            sizes: "512x512",
          },
        ],
        start_url: "./",
        theme_color: "#202020",
        background_color: "#1c1c1c",
        display: "standalone",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/builds\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "builds-cache",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 12, // 12 hours, matches schedule of data puller
              },
            },
          },
          {
            // the latest / all.json updates regularly
            urlPattern:
              /^https:\/\/cbn-data\.pages\.dev\/data\/latest\/all\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "latest-cache",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 12, // 12 hours, matches schedule of data puller
              },
            },
          },
          // all the other all.json files are the same forever, so if we have
          {
            // Stable releases
            urlPattern:
              /^https:\/\/cbn-data\.pages\.dev\/data\/v.*\/all\.json$/,
            handler: "CacheFirst",
            options: {
              cacheName: "stable-data-cache",
              expiration: {
                maxEntries: 3,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 1 month
              },
            },
          },
          {
            // Nightly releases
            urlPattern:
              /^https:\/\/cbn-data\.pages\.dev\/data\/20.*\/all\.json$/,
            handler: "CacheFirst",
            options: {
              cacheName: "nightly-data-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
          {
            // Use saved translations if possible, update in the background.
            urlPattern: /^https:\/\/cds\.svc\.transifex\.net\//,
            handler: "StaleWhileRevalidate",
          },
        ],
        // Without this, a stale service worker can be alive for a long time
        // and get out of date with the server.
        skipWaiting: true,
      },
    }),
  ],
});
