/**
 * Test environment setup for vitest.
 *
 * This file is loaded via vite.config.ts `test.setupFiles` and runs before each test.
 * It provides necessary browser API mocks for DOM-like test environments.
 */
import { vi } from "vitest";

/**
 * Mock window.matchMedia when the test DOM environment doesn't provide it.
 *
 * Our metrics code uses matchMedia to detect PWA display mode
 * (`display-mode: standalone`). This mock ensures
 * tests can run without errors and defaults to browser mode (matches: false).
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof Element !== "undefined" && !Element.prototype.animate) {
  Object.defineProperty(Element.prototype, "animate", {
    writable: true,
    value: vi.fn().mockImplementation(() => {
      const animation = {
        currentTime: 0,
        effect: null,
        onfinish: null as Animation["onfinish"],
        playState: "running" as AnimationPlayState,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
        cancel: vi.fn(() => {
          animation.playState = "idle";
        }),
        finish: vi.fn(() => {
          if (animation.playState === "finished") return;
          animation.playState = "finished";
          animation.onfinish?.call(
            animation as unknown as Animation,
            new Event("finish") as AnimationPlaybackEvent,
          );
        }),
        pause: vi.fn(() => {
          animation.playState = "paused";
        }),
        play: vi.fn(() => {
          animation.playState = "running";
          queueMicrotask(() => animation.finish());
        }),
        reverse: vi.fn(),
      };

      queueMicrotask(() => animation.finish());
      return animation as unknown as Animation;
    }),
  });
}
