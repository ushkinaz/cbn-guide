import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import EnvironmentPlugin from "vite-plugin-environment";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  build: {
    sourcemap: process.env.VITE_SOURCEMAP === "true",
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
        globPatterns: ["**/*.{css,html,png,svg,woff2,webp}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        navigateFallback: "index.html",
        navigateFallbackDenylist: [
          //refer /public/_redirects
          /^\/$/, // Root redirect to /stable
          /^\/latest\//, // /latest/* -> /nightly/*
          // Legacy paths that redirect to nightly
          /^\/item\//,
          /^\/monster\//,
          /^\/furniture\//,
          /^\/terrain\//,
          /^\/vehicle_part\//,
          /^\/tool_quality\//,
          /^\/mutation\//,
          /^\/martial_art\//,
          /^\/json_flag\//,
          /^\/achievement\//,
          /^\/search\//,
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/builds\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "builds-cache",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 12,
              },
            },
          },
          {
            // The latest nightly / updates regularly
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/data\/nightly\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "nightly-cache",
              expiration: {
                maxEntries: 15,
                maxAgeSeconds: 60 * 60 * 6,
              },
            },
          },
          {
            // The latest stable / rarely updates
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/data\/stable\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "stable-cache",
              expiration: {
                maxEntries: 15,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            // Stable named releases / never updates
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/data\/v/,
            handler: "CacheFirst",
            options: {
              cacheName: "stable-named-cache",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            // Nightly named releases / never updates
            urlPattern: /^https:\/\/cbn-data\.pages\.dev\/data\/20/,
            handler: "CacheFirst",
            options: {
              cacheName: "nightly-named-cache",
              expiration: {
                maxEntries: 45,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
          {
            // Use saved translations if possible, update in the background.
            urlPattern: /^https:\/\/cds\.svc\.transifex\.net\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "i18n-cache",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
        ],
        // Without this, a stale service worker can be alive for a long time
        // and get out of date with the server.
        skipWaiting: true,
      },
    }),
  ],
});
