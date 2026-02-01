export const isTesting =
  (globalThis as any).__isTesting__ === true ||
  (typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env.MODE === "test");
// Detect if running as PWA (installed app) vs browser
export const RUNNING_MODE =
  typeof window !== "undefined" &&
  window.matchMedia("(display-mode: standalone)").matches
    ? "pwa"
    : "browser";
