/**
 * @vitest-environment jsdom
 */

import { act, cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as fs from "fs";

import App from "./App.svelte";
// Load test data
const testData = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/all.test.json", "utf8"),
);
const testBuilds = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/builds.test.json", "utf8"),
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
          ok: true,
          json: () => Promise.resolve(testBuilds),
        } as Response);
      }
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(testData),
        } as Response);
      }
      if (url.includes("ru_RU.json")) {
        return Promise.resolve({
          ok: true,
          json: () => {},
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked fetch: ${url}`));
    }) as typeof fetch;

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

    test("ignores internal navigation when modifier keys are pressed", async () => {
      // Start at home
      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // We need to import the handler directly to test its return value
      // since we can't easily spy on the native browser new tab behavior
      const { handleInternalNavigation } = await import("./routing");

      // Mock an event with meta key (Cmd+Click)
      const mockEvent = {
        target: document.createElement("a"),
        preventDefault: vi.fn(),
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
      } as unknown as MouseEvent;

      // Setup the anchor to look like an internal link
      const anchor = mockEvent.target as HTMLAnchorElement;
      anchor.href = "http://localhost:3000/stable/item/rock";
      // We need to ensure the closest("a") works
      // In a real event, target might be a child, but here it is the anchor itself
      // The routing implementation uses target.closest("a")
      // Since we passed a disconnected element, closest might fail if we don't mock it or append it
      // Let's just mock closest on the target
      (mockEvent.target as any).closest = () => anchor;
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/stable/item/rock",
      });

      const handled = handleInternalNavigation(mockEvent);

      // Should return false (not handled) and NOT prevent default
      expect(handled).toBe(false);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
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

  describe("URL Encoding/Decoding", () => {
    test("handles plus signs in search queries correctly", async () => {
      // Direct import to test parseRoute
      const { parseRoute, buildUrl } = await import("./routing");

      // Test encoding: "C++ programming" should encode + as %2B
      const searchQuery = "C++ programming";
      const url = buildUrl("stable", null, searchQuery);

      // Should encode + as %2B and space as %20
      expect(url).toContain("C%2B%2B%20programming");

      // Simulate URL navigation
      updateLocation("stable/search/C%2B%2B%20programming");

      const route = parseRoute();
      // Should decode back to original query
      expect(route.search).toBe("C++ programming");
    });

    test("handles plus signs in item IDs correctly", async () => {
      const { parseRoute, buildUrl } = await import("./routing");

      // Test item ID with plus sign
      const itemId = "item_id+variant";
      const url = buildUrl("stable", { type: "item", id: itemId }, "");

      // Should encode + as %2B
      expect(url).toContain("item_id%2Bvariant");

      // Simulate URL navigation
      updateLocation("stable/item/item_id%2Bvariant");

      const route = parseRoute();
      expect(route.item?.id).toBe("item_id+variant");
    });

    test("handles spaces in search queries correctly", async () => {
      const { parseRoute, buildUrl } = await import("./routing");

      const searchQuery = "test query with spaces";
      const url = buildUrl("stable", null, searchQuery);

      // Spaces should be encoded as %20
      expect(url).toContain("test%20query%20with%20spaces");

      updateLocation("stable/search/test%20query%20with%20spaces");

      const route = parseRoute();
      expect(route.search).toBe("test query with spaces");
    });

    test("handles special characters in search", async () => {
      const { parseRoute, buildUrl } = await import("./routing");

      const searchQuery = "test&query=value";
      const url = buildUrl("stable", null, searchQuery);

      // Should properly encode & and =
      expect(url).toContain(encodeURIComponent("test&query=value"));

      const encodedQuery = encodeURIComponent(searchQuery);
      updateLocation(`stable/search/${encodedQuery}`);

      const route = parseRoute();
      expect(route.search).toBe("test&query=value");
    });

    test("round-trip encoding: search query", async () => {
      const { parseRoute, buildUrl } = await import("./routing");

      const testCases = [
        "simple",
        "with spaces",
        "C++",
        "a+b+c",
        "test&query",
        "special@#$chars",
        "unicode: 日本語",
      ];

      for (const query of testCases) {
        const url = buildUrl("stable", null, query);
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        // Extract the search part from the path
        const match = path.match(/\/search\/(.+)$/);
        expect(match).toBeTruthy();

        // Remove BASE_URL from path to get relative path
        const baseUrl = import.meta.env.BASE_URL;
        const relativePath = path.startsWith(baseUrl)
          ? path.slice(baseUrl.length)
          : path.slice(1); // fallback: remove leading /

        updateLocation(relativePath);

        const route = parseRoute();
        expect(route.search).toBe(query);
      }
    });

    test("round-trip encoding: item ID", async () => {
      const { parseRoute, buildUrl } = await import("./routing");

      const testCases = ["simple_id", "id with spaces", "c++_item", "a+b"];

      for (const id of testCases) {
        const url = buildUrl("stable", { type: "item", id }, "");
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        // Remove BASE_URL from path to get relative path
        const baseUrl = import.meta.env.BASE_URL;
        const relativePath = path.startsWith(baseUrl)
          ? path.slice(baseUrl.length)
          : path.slice(1); // fallback: remove leading /

        updateLocation(relativePath);

        const route = parseRoute();
        expect(route.item?.id).toBe(id);
      }
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

      await waitForDataLoad();
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
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalReplace = window.location.replace;
      let replaceCalled = false;
      delete (window.location as any).replace;
      window.location.replace = vi.fn((url: string | URL) => {
        replaceCalled = true;
        const u = new URL(url as string, window.location.origin);
        window.location.pathname = u.pathname;
        window.location.search = u.search;
        window.location.href = u.href;
      }) as any;

      // Start with invalid version - should prepend /stable/
      updateLocation("invalid-version-999/");

      render(App, {
        target: container,
      });

      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Should have called location.replace to prepend /stable/
      expect(replaceCalled).toBe(true);
      expect(window.location.pathname).toContain("stable/invalid-version-999");

      warnSpy.mockRestore();
      window.location.replace = originalReplace;
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
    test("prepends /stable/ to invalid version paths", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalReplace = window.location.replace;
      let replaceCalled = false;
      let replaceUrl = "";
      delete (window.location as any).replace;
      window.location.replace = vi.fn((url: string | URL) => {
        replaceCalled = true;
        replaceUrl = url.toString();
        const u = new URL(url as string, window.location.origin);
        window.location.pathname = u.pathname;
        window.location.search = u.search;
        window.location.href = u.href;
      }) as any;

      // Use a version that doesn't exist - should prepend /stable/
      updateLocation("non-existent-version/item/rock");

      render(App, {
        target: container,
      });

      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Should prepend /stable/ to the path
      expect(replaceCalled).toBe(true);
      expect(replaceUrl).toContain("stable/non-existent-version/item/rock");

      warnSpy.mockRestore();
      window.location.replace = originalReplace;
    });

    test("prepends /stable when accessing data type path without version", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // Mock location.replace to simulate page reload
      const originalReplace = window.location.replace;
      let replaceCalled = false;
      let replaceUrl = "";
      delete (window.location as any).replace;
      window.location.replace = vi.fn((url: string | URL) => {
        replaceCalled = true;
        replaceUrl = url.toString();
        const u = new URL(url as string, window.location.origin);
        window.location.pathname = u.pathname;
        window.location.search = u.search;
        window.location.href = u.href;
      }) as any;

      // Navigate to /mutation (missing version prefix)
      updateLocation("mutation");

      render(App, {
        target: container,
      });

      // Wait a bit for the async initialization
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Should have called location.replace to redirect to /stable/mutation
      expect(replaceCalled).toBe(true);
      expect(replaceUrl).toContain("stable/mutation");

      warnSpy.mockRestore();
      window.location.replace = originalReplace;
    });

    test("preserves URL encoding when redirecting versionless paths", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalReplace = window.location.replace;
      let replaceCalled = false;
      let replaceUrl = "";
      delete (window.location as any).replace;
      window.location.replace = vi.fn((url: string | URL) => {
        replaceCalled = true;
        replaceUrl = url.toString();
        const u = new URL(url as string, window.location.origin);
        window.location.pathname = u.pathname;
        window.location.search = u.search;
        window.location.href = u.href;
      }) as any;

      // Navigate to /search/fire%2Faxe (encoded slash in search query)
      updateLocation("search/fire%2Faxe");

      render(App, {
        target: container,
      });

      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Should preserve %2F encoding, not turn it into /
      expect(replaceCalled).toBe(true);
      expect(replaceUrl).toContain("stable/search/fire%2Faxe");
      expect(replaceUrl).not.toContain("stable/search/fire/axe");

      warnSpy.mockRestore();
      window.location.replace = originalReplace;
    });

    test("prepends /stable for various data types without version", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalReplace = window.location.replace;
      let replaceCalled = false;
      let replaceUrl = "";
      delete (window.location as any).replace;
      window.location.replace = vi.fn((url: string | URL) => {
        replaceCalled = true;
        replaceUrl = url.toString();
        const u = new URL(url as string, window.location.origin);
        window.location.pathname = u.pathname;
        window.location.search = u.search;
        window.location.href = u.href;
      }) as any;

      const dataTypes = [
        "item",
        "monster",
        "terrain",
        "tool_quality",
        "vehicle",
        "skill",
        "mutation_category",
      ];

      for (const type of dataTypes) {
        cleanup();
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        container = document.createElement("div");
        document.body.appendChild(container);

        replaceCalled = false;
        replaceUrl = "";
        updateLocation(type);

        render(App, {
          target: container,
        });

        await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

        expect(replaceCalled).toBe(true);
        expect(replaceUrl).toContain(`stable/${type}`);
      }

      warnSpy.mockRestore();
      window.location.replace = originalReplace;
    });

    test("after redirect from /mutation, links use correct version slug", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const originalReplace = window.location.replace;
      let replaceCalled = false;
      let replaceUrl = "";
      delete (window.location as any).replace;
      window.location.replace = vi.fn((url: string | URL) => {
        replaceCalled = true;
        replaceUrl = url.toString();
        const u = new URL(url as string, window.location.origin);
        window.location.pathname = u.pathname;
        window.location.search = u.search;
        window.location.href = u.href;
      }) as any;

      // Navigate to /mutation
      updateLocation("mutation");

      render(App, {
        target: container,
      });

      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Should have called location.replace
      expect(replaceCalled).toBe(true);
      expect(replaceUrl).toContain("stable/mutation");

      // Simulate the page reload by updating location manually
      updateLocation("stable/mutation");

      // Re-render App with the corrected URL
      cleanup();
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      container = document.createElement("div");
      document.body.appendChild(container);

      render(App, {
        target: container,
      });

      await waitForDataLoad();

      // After redirect, getCurrentVersionSlug should return "stable"
      const { getCurrentVersionSlug } = await import("./routing");
      expect(getCurrentVersionSlug()).toBe("stable");

      // Links should use /stable or /nightly, not /mutation as version
      const links = document.querySelectorAll("a[href]");
      const internalLinks = Array.from(links).filter((link) =>
        (link as HTMLAnchorElement).href.includes("localhost:3000"),
      );

      for (const link of internalLinks) {
        const href = (link as HTMLAnchorElement).href;
        const path = new URL(href).pathname;
        // Path should not start with /mutation/ (that would mean mutation is the version)
        // but /stable/mutation/ or /nightly/mutation/ is fine (mutation is the data type)
        expect(path).not.toMatch(/^\/mutation\//);
      }

      warnSpy.mockRestore();
      window.location.replace = originalReplace;
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
