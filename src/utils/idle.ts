import { isTesting } from "./env";

const DEFAULT_IDLE_YIELD_TIMEOUT_MS = 1;

const requestIdleCallbackCompat: typeof window.requestIdleCallback =
  typeof window !== "undefined" &&
  typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback.bind(window)
    : function (cb: (deadline: IdleDeadline) => void): number {
        const start = Date.now();
        return setTimeout(function () {
          cb({
            didTimeout: false,
            timeRemaining: function () {
              return Math.max(0, 50 - (Date.now() - start));
            },
          });
        }, 0) as unknown as number;
      };

/**
 * Yield execution until the browser has idle time available.
 * Falls back to a setTimeout-based shim when requestIdleCallback is unavailable.
 */
export function yieldUntilIdle(
  timeoutMs: number = DEFAULT_IDLE_YIELD_TIMEOUT_MS,
): Promise<IdleDeadline> {
  if (isTesting)
    return Promise.resolve({
      didTimeout: false,
      timeRemaining: () => 100,
    });

  return new Promise<IdleDeadline>((resolve) => {
    requestIdleCallbackCompat(resolve, { timeout: timeoutMs });
  });
}
