/**
 * @vitest-environment happy-dom
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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
import { _resetRouting } from "./routing.svelte";
import { _resetSearchState } from "./search-state.svelte";
import { tileData, _resetTilesetData } from "./tile-data";
import { _resetBuildsState } from "./builds.svelte";

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
    _resetRouting();
    _resetPreferences();
    _resetBuildsState();
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
    _resetTilesetData();
    _resetRouting();
    _resetPreferences();
    _resetBuildsState();
    _resetSearchState();
    global.fetch = defaultFetchMock;
    vi.restoreAllMocks();
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

  function expectVisibleText(text: string | RegExp): void {
    if (typeof text === "string") {
      expect(screen.getAllByText(new RegExp(text, "i")).length).toBeGreaterThan(
        0,
      );
      return;
    }
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  }

  async function renderApp() {
    await bootstrapApplication();
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
    expect(window.location.pathname).toContain("item/rock");
    expectVisibleText(/rock/i);
    expectVisibleText(/ammunition/i);
    expectVisibleText(/stone/i);
    expectVisibleText(/a rock the size of a baseball/i);
    expect(
      screen.queryByText(/there was a problem displaying this page/i),
    ).toBe(null);
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
    expectVisibleText(/rock/i);
    expect(
      screen.getByRole("link", { name: /rock/i }).getAttribute("href"),
    ).toBe("/stable/item/rock");
    expect(
      screen.queryByText(/there was a problem displaying this page/i),
    ).toBe(null);
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
      '.category-card[href="/stable/item"]',
    ) as HTMLAnchorElement;
    const randomHomeLink = document.querySelector(
      ".category-card.random",
    ) as HTMLAnchorElement;

    expect(brandLink.getAttribute("href")).toBe("/stable/");
    expect(logoLink.getAttribute("href")).toBe("/stable/item/guidebook");
    expect(itemsHomeLink.getAttribute("href")).toBe("/stable/item");
    expect(randomHomeLink.getAttribute("href")).toBe("/stable/");

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

  test("reacts to history navigation and renders the matching route", async () => {
    await renderApp();

    await waitForDataLoad();

    await act(async () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();
    });

    await waitFor(() => {
      expectVisibleText(/rock/i);
    });

    await act(async () => {
      setWindowLocation("stable/search/rock");
      dispatchPopState();
    });

    await waitFor(() =>
      expect(window.location.pathname).toContain("search/rock"),
    );
    await waitFor(() => {
      expectVisibleText(/rock/i);
      expect(
        screen.getByRole("link", { name: /rock/i }).getAttribute("href"),
      ).toBe("/stable/item/rock");
    });

    await act(async () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();
    });

    await waitFor(() => {
      expectVisibleText(/rock/i);
    });
  });
});
