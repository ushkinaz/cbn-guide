/**
 * @vitest-environment happy-dom
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/svelte";
import { get } from "svelte/store";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import App from "./App.svelte";
import { data } from "./data";
import { dismiss, notifications } from "./Notification.svelte";
import { _resetPreferences, setPreferredTileset } from "./preferences.svelte";
import {
  dispatchPopState,
  createAppFetchMock,
  setWindowLocation,
} from "./routing.test-helpers";
import { _reset as resetRouting } from "./routing.svelte";
import { resetSearchState } from "./search-state.svelte";
import { tileData, _resetCache as resetTilesetCache } from "./tile-data";
import { _resetVersionState } from "./builds.svelte";

import { bootstrapApplication } from "./navigation.svelte";

vi.hoisted(() => {
  (globalThis as any).__isTesting__ = true;
});

function installMockStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  return storage;
}

function clearHeadMetadata(): void {
  for (const element of document.head.querySelectorAll(
    'link[rel="canonical"], link[rel="alternate"], meta[name="description"], meta[property="og:title"], meta[property="og:description"]',
  )) {
    element.remove();
  }
}

describe("App routing integration", () => {
  vi.setConfig({ testTimeout: 120_000 });
  const ROUTING_TEARDOWN_SETTLE_MS = 150;
  let originalFetch: typeof global.fetch;
  let originalImage: typeof global.Image;
  let defaultFetchMock: typeof fetch;
  let container: HTMLElement;

  beforeAll(() => {
    originalFetch = global.fetch;
    originalImage = global.Image;
    defaultFetchMock = createAppFetchMock();
    global.fetch = defaultFetchMock;

    class MockImage {
      onload: ((this: GlobalEventHandlers, ev: Event) => any) | null = null;
      onerror: OnErrorEventHandler = null;
      width = 32;
      height = 32;
      #src = "";

      get src() {
        return this.#src;
      }

      set src(value: string) {
        this.#src = value;
        queueMicrotask(() => {
          this.onload?.call(window, new Event("load"));
        });
      }
    }

    global.Image = MockImage as unknown as typeof global.Image;
  });

  beforeEach(() => {
    installMockStorage();
    clearHeadMetadata();
    window.scrollTo = vi.fn();
    setWindowLocation("stable/");
    localStorage.removeItem?.("cbn-guide:tileset");
    resetRouting();
    _resetPreferences();
    _resetVersionState();
    global.fetch = defaultFetchMock;
    container = document.createElement("div");
    document.body.appendChild(container);

    for (const notification of get(notifications)) {
      dismiss(notification.id);
    }
  });

  afterEach(() => {
    cleanup();
    clearHeadMetadata();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    data._reset();
    tileData.reset();
    resetTilesetCache();
    resetRouting();
    _resetPreferences();
    _resetVersionState();
    resetSearchState();
    global.fetch = defaultFetchMock;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Let pending Svelte window-binding timeouts settle before async-leak collection.
    await new Promise((resolve) =>
      setTimeout(resolve, ROUTING_TEARDOWN_SETTLE_MS),
    );
    global.fetch = originalFetch;
    global.Image = originalImage;
  });

  async function waitForDataLoad(expectedText?: string | RegExp) {
    await waitFor(() => expect(get(data)).not.toBeNull(), { timeout: 10_000 });
    await waitFor(
      () =>
        expect(
          document.querySelector(".loading-container.full-screen"),
        ).toBeNull(),
      { timeout: 10_000 },
    );

    if (!expectedText) return;

    await waitFor(() => {
      const text = document.body.textContent || "";
      if (typeof expectedText === "string") {
        expect(text.toLowerCase()).toContain(expectedText.toLowerCase());
        return;
      }
      expect(expectedText.test(text)).toBe(true);
    });
  }

  async function waitForUiSettled() {
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  }

  async function renderApp() {
    await bootstrapApplication().catch(() => undefined);
    return render(App, {
      target: container,
    });
  }

  test("renders the item page after popstate navigation", async () => {
    await renderApp();

    await waitForDataLoad();
    expect(document.body.textContent).toContain("Hitchhiker");

    await act(async () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();
    });

    await waitForDataLoad("rock");
    await waitForUiSettled();

    const text = (
      document.body.innerText ||
      document.body.textContent ||
      ""
    ).toLowerCase();
    expect(window.location.pathname).toContain("item/rock");
    expect(text).toMatch(/rock/);
    expect(text).toContain("ammunition");
    expect(text).toContain("stone");
    expect(text).toContain("a rock the size of a baseball");
    expect(text).not.toContain("there was a problem displaying this page");
  });

  test("popstate falls back to the saved preference after removing a transient tileset override", async () => {
    setPreferredTileset("retrodays");
    setWindowLocation("stable/", "?t=undead_people");

    await renderApp();

    await waitForDataLoad();
    await waitFor(() =>
      expect(document.getElementById("tileset_select")).toBeTruthy(),
    );
    expect(
      (document.getElementById("tileset_select") as HTMLSelectElement).value,
    ).toBe("undead_people");

    await act(async () => {
      setWindowLocation("stable/");
      dispatchPopState();
    });

    await waitForUiSettled();
    await waitFor(() =>
      expect(
        (document.getElementById("tileset_select") as HTMLSelectElement).value,
      ).toBe("retrodays"),
    );
  });

  test("renders search results when loading a search path directly", async () => {
    setWindowLocation("stable/search/rock");

    await renderApp();

    await waitForDataLoad("rock");

    expect(window.location.pathname).toContain("search/rock");
    expect(document.body.textContent?.toLowerCase()).toContain("rock");
    expect(
      document.querySelector('a[href="/stable/item/rock?t=undead_people"]'),
    ).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain(
      "there was a problem displaying this page",
    );
  });

  test("home page links update to the current tileset on selector changes", async () => {
    await renderApp();

    await waitForDataLoad();

    const tilesetSelect = document.getElementById(
      "tileset_select",
    ) as HTMLSelectElement;
    const brandLink = document.querySelector(
      ".brand-link",
    ) as HTMLAnchorElement;
    const logoLink = document.querySelector(".logo-link") as HTMLAnchorElement;
    const itemsHomeLink = document.querySelector(
      '.category-card[href="/stable/item?t=undead_people"]',
    ) as HTMLAnchorElement;
    const randomHomeLink = document.querySelector(
      ".category-card.random",
    ) as HTMLAnchorElement;

    expect(brandLink.getAttribute("href")).toBe("/stable/?t=undead_people");
    expect(logoLink.getAttribute("href")).toBe(
      "/stable/item/guidebook?t=undead_people",
    );
    expect(itemsHomeLink.getAttribute("href")).toBe(
      "/stable/item?t=undead_people",
    );
    expect(randomHomeLink.getAttribute("href")).toBe(
      "/stable/?t=undead_people",
    );

    await fireEvent.change(tilesetSelect, {
      target: { value: "retrodays" },
    });

    await waitFor(() => expect(tilesetSelect.value).toBe("retrodays"));
    await waitFor(() =>
      expect(brandLink.getAttribute("href")).toBe("/stable/?t=retrodays"),
    );
    await waitFor(() =>
      expect(logoLink.getAttribute("href")).toBe(
        "/stable/item/guidebook?t=retrodays",
      ),
    );
    await waitFor(() =>
      expect(itemsHomeLink.getAttribute("href")).toBe(
        "/stable/item?t=retrodays",
      ),
    );
    await waitFor(() =>
      expect(randomHomeLink.getAttribute("href")).toBe("/stable/?t=retrodays"),
    );
  });

  test("mod selector apply updates mods query param in order", async () => {
    setWindowLocation("stable/", "?mods=aftershock");
    const { getByLabelText, getByRole, getByText } = await renderApp();

    await waitForDataLoad();
    await waitFor(() =>
      expect(
        (
          getByRole("button", {
            name: "Mods (1 active)",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );

    await fireEvent.click(getByRole("button", { name: "Mods (1 active)" }));
    await waitFor(() => expect(getByLabelText("Aftershock")).toBeTruthy());

    await fireEvent.click(getByLabelText("Magiclysm"));
    await fireEvent.click(getByText("Apply"));

    expect(new URLSearchParams(window.location.search).get("mods")).toBe(
      "aftershock,magiclysm",
    );
  });

  test("loads compatible mod tileset chunk URLs for active mods", async () => {
    setWindowLocation("stable/", "?mods=civilians&t=undead_people");

    await renderApp();

    await waitForDataLoad();

    await waitFor(() =>
      expect(
        (
          global.fetch as unknown as {
            mock: { calls: Array<[unknown, ...unknown[]]> };
          }
        ).mock.calls.some(([input]) =>
          String(input).includes("/mods/civilians/gfx/cops.webp"),
        ),
      ).toBe(true),
    );
  });

  test("filters unknown mods from the URL and warns once", async () => {
    setWindowLocation(
      "stable/item/rock",
      "?mods=aftershock,missing_mod,magiclysm,bad_mod",
    );
    const replaceStateSpy = vi.spyOn(history, "replaceState");

    await renderApp();

    await waitForDataLoad("rock");

    await waitFor(() =>
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        "",
        expect.stringContaining("mods=aftershock%2Cmagiclysm"),
      ),
    );

    const warnNotification = get(notifications).find(
      (notification) => notification.type === "warn",
    );
    expect(warnNotification?.message).toContain("missing_mod, bad_mod");
    replaceStateSpy.mockRestore();
  });

  test("reacts to history navigation and renders the matching route", async () => {
    await renderApp();

    await waitForDataLoad();

    await act(async () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();
    });

    await waitForUiSettled();
    expect(document.body.textContent?.toLowerCase()).toContain("rock");

    await act(async () => {
      setWindowLocation("stable/search/rock");
      dispatchPopState();
    });

    await waitForUiSettled();
    await waitFor(() =>
      expect(window.location.pathname).toContain("search/rock"),
    );
    expect(document.body.textContent?.toLowerCase()).toContain("rock");
    expect(
      document.querySelector('a[href="/stable/item/rock?t=undead_people"]'),
    ).toBeTruthy();

    await act(async () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();
    });

    await waitForUiSettled();
    expect(document.body.textContent?.toLowerCase()).toContain("rock");
  });

  test("canonicalizes malformed popstate version URLs with replaceState", async () => {
    await renderApp();

    await waitForDataLoad();
    const replaceStateSpy = vi
      .spyOn(history, "replaceState")
      .mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

    await act(async () => {
      setWindowLocation("bogus/item/rock", "?mods=aftershock");
      dispatchPopState();
    });

    await waitForUiSettled();
    await waitFor(() =>
      expect(window.location.pathname).toBe("/nightly/item/rock"),
    );
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/nightly/item/rock?mods=aftershock",
    );
    expect(document.body.textContent?.toLowerCase()).toContain("rock");
  });
});
