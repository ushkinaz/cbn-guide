/**
 * Performance measurement utilities for development.
 * All measurements are NO-OP in production builds.
 */

import { isTesting } from "./env";

// In browser (Vite): use import.meta.env.DEV
// In Node.js (tsx/vitest): default to true for measurements
const isDev =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.DEV && !isTesting && process.env.PERF_ENABLED === "true"
    : true;

interface PerfMarker {
  finish(): void;
}

const noopMarker: PerfMarker = {
  finish: () => {},
};

/**
 * Mark the start of a performance measurement and return a marker to finish it.
 * NO-OP in production.
 *
 * @param name - Name of the measurement
 * @param addTimestamp - If true, adds a unique timestamp to the mark names
 * @returns Object with finish() method to complete the measurement
 *
 * @example
 * // Simple case
 * const p = perf.mark("CBNData.constructor");
 * // ... code to measure ...
 * p.finish();
 *
 * @example
 * // With timestamp for unique measurements
 * const p = perf.mark("CBNData._flatten", true);
 * // ... code to measure ...
 * p.finish();
 */
export function mark(name: string, addTimestamp: boolean = false): PerfMarker {
  if (!isDev) {
    return noopMarker;
  }

  const measureName = name;
  const uniqueSuffix = addTimestamp ? `:${performance.now()}` : "";
  const startMark = `${name}${uniqueSuffix}:start`;
  const endMark = `${name}${uniqueSuffix}:end`;

  performance.mark(startMark);

  return {
    finish() {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
    },
  };
}

/**
 * Get current high-resolution timestamp.
 * Returns 0 in production to avoid overhead.
 */
export function now(): number {
  if (isDev) {
    return performance.now();
  }
  return 0;
}

/**
 * Helper to measure a synchronous function execution.
 * NO-OP in production.
 *
 * @example
 * const result = measureSync('myFunction', () => {
 *   // expensive operation
 *   return computedValue;
 * });
 */
export function measureSync<T>(name: string, fn: () => T): T {
  if (isDev) {
    const p = mark(name);
    try {
      return fn();
    } finally {
      p.finish();
    }
  }
  return fn();
}

/**
 * Helper to measure an async function execution.
 * NO-OP in production.
 *
 * @example
 * const result = await measureAsync('myAsyncFunction', async () => {
 *   // expensive async operation
 *   return await fetchData();
 * });
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (isDev) {
    const p = mark(name);
    try {
      return await fn();
    } finally {
      p.finish();
    }
  }
  return fn();
}
