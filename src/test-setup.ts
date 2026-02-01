/**
 * Test environment setup for vitest.
 *
 * This file is loaded via vite.config.ts `test.setupFiles` and runs before each test.
 * It provides necessary browser API mocks for JSDOM environments.
 */
import { vi } from "vitest";

/**
 * Mock window.matchMedia for JSDOM environments.
 *
 * JSDOM doesn't provide matchMedia by default, but our metrics code uses it
 * to detect PWA display mode (`display-mode: standalone`). This mock ensures
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
