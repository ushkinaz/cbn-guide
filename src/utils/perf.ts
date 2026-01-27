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
  finish(): number;
}

/**
 * Mark the start of a performance measurement and return a marker to finish it.
 * In production, it uses a lightweight implementation just returning the duration.
 * In development, it also creates performance marks and measures for browser devtools.
 *
 * @param name - Name of the measurement
 * @param addTimestamp - If true, adds a unique timestamp to the mark names (dev only)
 * @returns Object with finish() method that returns the duration in ms
 */
export function mark(name: string, addTimestamp: boolean = false): PerfMarker {
  const start = performance.now();

  if (!isDev) {
    return {
      finish() {
        return performance.now() - start;
      },
    };
  }

  const uniqueSuffix = addTimestamp ? `:${start}` : "";
  const startMark = `${name}${uniqueSuffix}:start`;
  const endMark = `${name}${uniqueSuffix}:end`;

  performance.mark(startMark);

  return {
    finish() {
      const end = performance.now();
      performance.mark(endMark);
      performance.measure(name, startMark, endMark);
      return end - start;
    },
  };
}

/**
 * Get current high-resolution timestamp.
 * Always returns performance.now() to support metrics in production.
 */
export function now(): number {
  return performance.now();
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
