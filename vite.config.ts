/// <reference types="vitest" />
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import EnvironmentPlugin from "vite-plugin-environment";
import { execSync } from "node:child_process";

const getCommitDate = () => {
  let dateStr: string;
  try {
    dateStr = execSync("git show -s --format=%cs HEAD").toString().trim();
  } catch {
    const now = new Date();
    dateStr = now.toISOString().split("T")[0];
  }
  return dateStr;
};

const commitDate = getCommitDate();

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
      PERF_ENABLED: "false",
      COMMIT_DATE: commitDate,
    }),
    svelte(),
    VitePWA({
      devOptions: {
        enabled: true,
      },
      manifest: {
        short_name: "Cataclysm:BN Guide",
        name: "Hitchhiker's Guide to the Cataclysm: Bright Nights",
        description:
          "Database for Cataclysm: Bright Nights. Search for items, monsters, bionics & more",
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
        categories: ["reference", "games"],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,webp}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        navigateFallback: "index.html",

        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/data\.cataclysmbn-guide\.com\/builds\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "builds-cache",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 3,
              },
            },
          },
          {
            // The latest nightly / updates regularly
            urlPattern:
              /^https:\/\/data\.cataclysmbn-guide\.com\/data\/nightly\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "nightly-cache",
              expiration: {
                maxEntries: 15,
                maxAgeSeconds: 60 * 60 * 3,
              },
            },
          },
          {
            // The latest stable / rarely updates
            urlPattern:
              /^https:\/\/data\.cataclysmbn-guide\.com\/data\/stable\//,
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
            urlPattern: /^https:\/\/data\.cataclysmbn-guide\.com\/data\/v/,
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
            urlPattern: /^https:\/\/data\.cataclysmbn-guide\.com\/data\/20/,
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
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
  },
});
