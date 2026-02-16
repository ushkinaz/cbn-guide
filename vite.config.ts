import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import EnvironmentPlugin from "vite-plugin-environment";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { readFileSync } from "fs";

const commitSHA = (
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  "local"
).slice(0, 8);

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const buildDate = new Date().toISOString().split("T")[0].replace(/-/g, "");

let build = commitSHA !== "local" ? `+${commitSHA}` : "+local";
//Follows semantic versioning: https://semver.org/. Used in Sentry releases.
//1.5.0-20260102+c635cbec
const releaseID = `${pkg.version}-${buildDate}${build}`;

// Deployment environment: "next" for preview deployments, "production" for main
const deployEnv = process.env.DEPLOY_NEXT === "1" ? "next" : "production";

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
  define: {
    __RELEASE_ID__: JSON.stringify(releaseID),
    __COMMIT_SHA__: JSON.stringify(commitSHA),
    __DEPLOY_ENV__: JSON.stringify(deployEnv),
  },
  plugins: [
    EnvironmentPlugin({
      PERF_ENABLED: "false",
      DEPLOY_NEXT: null,
      GITHUB_SHA: null,
      CI: "0",
      CF_PAGES_COMMIT_SHA: null,
      SENTRY_DSN: null,
      SENTRY_AUTH_TOKEN: null,
      TRANSIFEX_TOKEN: "1/2e39db44e1e5ba8d2c455d407b183aca31facc52",
    }),
    svelte(),
    VitePWA({
      devOptions: {
        enabled: true,
      },
      injectRegister: "auto",
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
        globPatterns: ["**/*.{js,css,html}", "**/*.{png,svg,woff2,webp}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        navigateFallback: "index.html",

        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/data\.cataclysmbn-guide\.com\/builds\.json$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "builds-cache-v2",
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 15, // 15 minutes - align with nightly freshness
              },
              cacheableResponse: {
                statuses: [200],
              },
              fetchOptions: {
                mode: "cors",
                credentials: "omit",
              },
            },
          },
          {
            // The latest nightly / updates daily
            urlPattern:
              /^https:\/\/data\.cataclysmbn-guide\.com\/data\/nightly\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "nightly-cache-v2",
              expiration: {
                maxEntries: 15,
                maxAgeSeconds: 60 * 15, // 15 minutes - align with Edge cache
              },
              cacheableResponse: {
                statuses: [200],
              },
              fetchOptions: {
                mode: "cors",
                credentials: "omit",
              },
            },
          },
          {
            // The latest stable / rarely updates
            urlPattern:
              /^https:\/\/data\.cataclysmbn-guide\.com\/data\/stable\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "stable-cache-v2",
              expiration: {
                maxEntries: 15,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [200],
              },
              fetchOptions: {
                mode: "cors",
                credentials: "omit",
              },
            },
          },
          {
            // Stable named releases / never updates
            urlPattern: /^https:\/\/data\.cataclysmbn-guide\.com\/data\/v/,
            handler: "CacheFirst",
            options: {
              cacheName: "stable-named-cache-v2",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [200],
              },
              fetchOptions: {
                mode: "cors",
                credentials: "omit",
              },
            },
          },
          {
            // Nightly named releases / never updates
            urlPattern: /^https:\/\/data\.cataclysmbn-guide\.com\/data\/20/,
            handler: "CacheFirst",
            options: {
              cacheName: "nightly-named-cache-v2",
              expiration: {
                maxEntries: 45,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
              cacheableResponse: {
                statuses: [200],
              },
              fetchOptions: {
                mode: "cors",
                credentials: "omit",
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
    sentryVitePlugin({
      org: "ushkinaz",
      project: "cbn-guide",
      disable:
        !process.env.CI || process.env.CI === "0" || process.env.CI === "false",
      release: {
        name: `cbn-guide@${releaseID}`,
        dist: commitSHA,
        deploy: {
          env: deployEnv,
        },
      },
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayShadowDom: true,
        excludeReplayIframe: true,
        excludeReplayWorker: true,
      },
    }),
  ],
  // @ts-ignore
  test: {
    environment: "happy-dom",
    setupFiles: ["src/test-setup.ts"],
  },
});
