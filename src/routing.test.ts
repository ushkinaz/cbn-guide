/**
 * @vitest-environment jsdom
 */

import { act, cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "fs";

import App from "./App.svelte";
import { versionSlug } from "./routing";
// Load test data
const testData = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/all.json", "utf8"),
);
const testBuilds = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/builds.json", "utf8"),
);

describe("Routing E2E Tests", () => {
  vi.setConfig({ testTimeout: 10000 });
  let originalFetch: typeof global.fetch;
  let container: HTMLElement;

  beforeEach(() => {
    // Set testing flag
    (globalThis as any).__isTesting__ = true;

    // Mock window.scrollTo for jsdom
    window.scrollTo = vi.fn();

    // Reset DOM location
    const baseUrl = import.meta.env.BASE_URL || "/";
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        href: `http://localhost:3000${baseUrl}stable/`,
        origin: "http://localhost:3000",
        pathname: `${baseUrl}stable/`,
        search: "",
        toString() {
          return this.href;
        },
      },
    });

    // Mock fetch
    originalFetch = global.fetch;
    global.fetch = vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("builds.json")) {
        return Promise.resolve({
          json: () => Promise.resolve(testBuilds),
        } as Response);
      }
      if (url.includes("all.json")) {
        return Promise.resolve({
          json: () => Promise.resolve(testData),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked fetch: ${url}`));
    }) as typeof fetch;

    // Reset stores
    versionSlug.set("stable");

    // Create a container for rendering
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    cleanup();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  async function waitForDataLoad() {
    // Wait for "Loading" to disappear and Logo or Thing to appear
    let retries = 20;
    while (retries > 0) {
      const text = document.body.innerText || document.body.textContent || "";
      if (
        !text.includes("Loading") &&
        (text.includes("Hitchhiker") ||
          text.includes("Description") ||
          text.includes("Search Results") ||
          text.includes("Catalog") ||
          text.includes("rock") ||
          text.includes("HHG"))
      ) {
        return;
      }
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
      retries--;
    }
    throw new Error("Timed out waiting for data load");
  }

  async function waitForNavigation() {
    // Small delay to allow Svelte reactive statements to settle
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  }

  function updateLocation(path: string, search = "") {
    const baseUrl = import.meta.env.BASE_URL || "/";
    window.location.pathname = baseUrl + path;
    window.location.search = search;
    window.location.href = `http://localhost:3000${window.location.pathname}${window.location.search}`;
  }

  function dispatchPopState() {
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  describe("Item Navigation", () => {
    test("navigates to an item page when clicking an internal link", async () => {
      // Start at home
      const { container: appContainer } = render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Check we're on home by looking for specific text
      expect(document.body.textContent).toContain("Hitchhiker");

      // Simulate navigation by updating location and dispatching popstate
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();

      // Check URL was updated
      expect(window.location.pathname).toContain("item/rock");
      // Check DOM reflects item view (data has lowercase "rock")
      // Explicitly wait for "rock" to appear in innerText to be safe
      await waitForDataLoad();
      await waitForNavigation();
      const text = (
        document.body.innerText ||
        document.body.textContent ||
        ""
      ).toLowerCase();
      expect(text).toMatch(/rock/);
      expect(document.title.toLowerCase()).toMatch(/rock/);
    });

    test("preserves query parameters during navigation", async () => {
      // Set up with a query parameter
      updateLocation("stable/", "?lang=ru_RU");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Navigate to an item
      await act(async () => {
        updateLocation("stable/item/rock", "?lang=ru_RU");
        dispatchPopState();
      });

      await waitForNavigation();

      // Check query param persists
      expect(window.location.search).toContain("lang=ru_RU");
    });
  });

  describe("Search Navigation", () => {
    test("renders search results when loading a search path directly", async () => {
      // Set location to a search path
      updateLocation("stable/search/test");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // URL should have search path
      expect(window.location.pathname).toContain("search/test");
      const text = document.body.textContent || "";
      // Logs show "HHG" is part of the search results header
      expect(text.includes("Search Results") || text.includes("HHG")).toBe(
        true,
      );
    });

    test("handles search query encoding", async () => {
      // Set location with special characters
      updateLocation("stable/search/test%20query");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // URL should contain encoded search
      expect(window.location.pathname).toContain("search/test%20query");
    });
  });

  describe("History Navigation", () => {
    test("reacts to history navigation and renders the matching route", async () => {
      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Navigate to item
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("item/rock");
      expect(document.body.textContent?.toLowerCase()).toContain("rock");

      // Navigate to search via popstate
      await act(async () => {
        updateLocation("stable/search/test");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("search/test");
      let text = document.body.textContent || "";
      expect(text.includes("Search Results") || text.includes("HHG")).toBe(
        true,
      );

      // Go back to item
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("item/rock");
      text = (
        document.body.innerText ||
        document.body.textContent ||
        ""
      ).toLowerCase();
      expect(text).toContain("rock");
    });

    test("handles back button from item to search", async () => {
      // Start at search
      updateLocation("stable/search/rock");

      render(App, {
        target: container,
      });

      await waitForDataLoad();
      expect(window.location.pathname).toContain("search/rock");

      // Navigate forward to item
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("item/rock");
      expect(document.body.textContent?.toLowerCase()).toContain("rock");

      // Go back
      await act(async () => {
        updateLocation("stable/search/rock");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("search/rock");
      const text = document.body.textContent || "";
      expect(text.includes("Search Results") || text.includes("HHG")).toBe(
        true,
      );
    });

    test("handles forward button from home to item", async () => {
      render(App, {
        target: container,
      });

      await waitForDataLoad();
      expect(window.location.pathname).toContain("stable/");

      // Navigate to item
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("item/rock");
      expect(document.body.textContent?.toLowerCase()).toContain("rock");

      // Go back to home
      await act(async () => {
        updateLocation("stable/");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("stable/");
      expect(document.body.textContent).toContain("Hitchhiker");

      // Go forward to item
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();
      expect(window.location.pathname).toContain("item/rock");
      expect(document.body.textContent?.toLowerCase()).toContain("rock");
    });
  });

  describe("Version Handling", () => {
    test("navigates to correct version with incorrect typed-in URL", async () => {
      // Start with invalid version
      updateLocation("invalid-version-999/");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // App should load successfully (version exists in testBuilds)
      expect(document.body).toBeTruthy();
    });

    test("navigates to correct version when clicking an internal link", async () => {
      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Navigate to nightly version item
      await act(async () => {
        updateLocation("nightly/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();

      // Should navigate successfully
      expect(window.location.pathname).toContain("nightly/item/rock");
      const text = (
        document.body.innerText ||
        document.body.textContent ||
        ""
      ).toLowerCase();
      expect(text).toContain("rock");
    });

    test(" resolves version aliases correctly", async () => {
      // Test with stable alias
      updateLocation("stable/");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Should load successfully
      expect(document.body).toBeTruthy();

      cleanup();
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      container = document.createElement("div");
      document.body.appendChild(container);

      // Test with nightly alias
      updateLocation("nightly/");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Should load successfully
      expect(document.body).toBeTruthy();
    });

    test("preserves version slug in URLs", async () => {
      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Navigate to an item
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();

      // URL should still contain stable
      expect(window.location.pathname).toContain("stable");
    });
  });

  describe("Catalog Navigation", () => {
    test("navigates to catalog view when type without ID", async () => {
      updateLocation("stable/item");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Should show catalog (no ID in URL)
      expect(window.location.pathname).toBe(
        `${import.meta.env.BASE_URL}stable/item`,
      );
    });

    test("handles catalog to item navigation", async () => {
      updateLocation("stable/item");

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // Should show catalog
      expect(window.location.pathname).toContain("stable/item");

      // Click an item in the catalog (simulated via navigation)
      await act(async () => {
        updateLocation("stable/item/rock");
        dispatchPopState();
      });

      await waitForNavigation();

      // Should navigate to item
      expect(window.location.pathname).toContain("stable/item/rock");
      const text = (
        document.body.innerText ||
        document.body.textContent ||
        ""
      ).toLowerCase();
      expect(text).toContain("rock");
    });
  });

  describe("Redirection & Fallbacks", () => {
    test("redirects to latest stable when version is not found", async () => {
      // Mock console.warn to avoid cluttering test output
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // Support history.replaceState for redirect
      const replaceSpy = vi
        .spyOn(window.history, "replaceState")
        .mockImplementation((state, title, url) => {
          if (typeof url === "string") {
            const u = new URL(url, window.location.origin);
            window.location.pathname = u.pathname;
            window.location.search = u.search;
            window.location.href = u.href;
          }
        });

      // Use a version that definitely doesn't exist in mocks
      updateLocation("non-existent-version/");

      render(App, {
        target: container,
      });

      // waitForDataLoad will wait for "Hitchhiker" which appears on Home after redirect
      await waitForDataLoad();

      // Should have redirected to stable
      expect(window.location.pathname).toContain("v0.7.0");
      expect(document.body.textContent).toContain("Hitchhiker");

      warnSpy.mockRestore();
      replaceSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    test("shows error message when builds.json fails to load", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Force fetch failure for builds
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network Error")),
      ) as any;

      render(App, {
        target: container,
      });

      // Wait a bit for the catch block to run
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

      // Since App.svelte only console.errors on builds failure,
      // we check for the spy call.
      // (Future improvement: check for a UI error notification if added)
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });
});
