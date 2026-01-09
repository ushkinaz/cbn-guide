import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import EnvironmentPlugin from "vite-plugin-environment";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000, //I'm so sorry, Chuck
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
      includeAssets: ["robots.txt", "sitemap.xml", "opensearch.xml"],
      manifest: {
        short_name: "Cataclysm: Bright Nights Guide",
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
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,webp}"],
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
          {
            // latest lang files
            urlPattern:
              /^https:\/\/cbn-data\.pages\.dev\/data\/latest\/lang\/.+\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "latest-lang-cache",
              expiration: {
                maxEntries: 3,
                maxAgeSeconds: 60 * 60 * 12,
              },
            },
          },
          {
            // latest gfx files
            urlPattern:
              /^https:\/\/cbn-data\.pages\.dev\/data\/latest\/gfx\/.+$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "latest-gfx-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 12,
              },
            },
          },
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
            // Stable lang files
            urlPattern:
              /^https:\/\/cbn-data\.pages\.dev\/data\/v.*\/lang\/.+\.json$/,
            handler: "CacheFirst",
            options: {
              cacheName: "stable-lang-cache",
              expiration: {
                maxEntries: 9,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            // Stable gfx files
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/data\/v.*\/gfx\/.+$/,
            handler: "CacheFirst",
            options: {
              cacheName: "stable-gfx-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
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
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
          {
            // Nightly lang files
            urlPattern:
              /^https:\/\/cbn-data\.pages\.dev\/data\/20.*\/lang\/.+\.json$/,
            handler: "CacheFirst",
            options: {
              cacheName: "nightly-lang-cache",
              expiration: {
                maxEntries: 15,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          {
            // Nightly gfx files
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/data\/20.*\/gfx\/.+$/,
            handler: "CacheFirst",
            options: {
              cacheName: "nightly-gfx-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
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
