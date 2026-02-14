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
