/**
 * Central environment configuration.
 * Leverages Vite's native environment handling for idiomatic usage.
 */

// Vite automatically sets:
// - import.meta.env.DEV to true in dev
// - import.meta.env.PROD to true in prod
// - import.meta.env.MODE to 'test' during vitest

/**
 * True if running in Vitest or if manually toggled via globalThis.
 */
export const isTesting =
  (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test") ||
  (typeof globalThis !== "undefined" &&
    (globalThis as any).__isTesting__ === true);

/**
 * True when running the Vite dev server.
 */
export const isDev =
  (typeof import.meta !== "undefined" && import.meta.env?.DEV) ?? true;

/**
 * True when running a production build.
 */
export const isProd =
  (typeof import.meta !== "undefined" && import.meta.env?.PROD) ?? false;

/**
 * True if running in a "next" (staging/preview) deployment.
 */
export const isNext =
  typeof __DEPLOY_ENV__ !== "undefined" && __DEPLOY_ENV__ === "next";

/**
 * The base URL of the application.
 */
export const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";

/**
 * Performance measurement is enabled in dev (but not testing) if requested via env.
 */
export const isPerfEnabled =
  isDev &&
  !isTesting &&
  typeof import.meta !== "undefined" &&
  import.meta.env?.VITE_PERF_ENABLED === "true";

/**
 * Detect if running as PWA (installed app) vs browser tab.
 */
export const RUNNING_MODE =
  typeof window !== "undefined" &&
  window.matchMedia("(display-mode: standalone)").matches
    ? "pwa"
    : "browser";
