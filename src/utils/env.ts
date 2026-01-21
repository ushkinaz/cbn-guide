export const isTesting =
  (globalThis as any).__isTesting__ === true ||
  (typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env.MODE === "test");
