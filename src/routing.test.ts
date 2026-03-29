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
import {
  dispatchPopState,
  createAppFetchMock,
  setWindowLocation,
} from "./routing.test-helpers";
import { _reset as resetRouting } from "./routing";
import { resetSearchState } from "./search-state.svelte";
import { tileData, _resetCache as resetTilesetCache } from "./tile-data";

vi.hoisted(() => {
  (globalThis as any).__isTesting__ = true;
});

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
    window.scrollTo = vi.fn();
    setWindowLocation("stable/");
    resetRouting();
    global.fetch = defaultFetchMock;
    container = document.createElement("div");
    document.body.appendChild(container);

    for (const notification of get(notifications)) {
      dismiss(notification.id);
    }
  });

  afterEach(() => {
    cleanup();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    data._reset();
    tileData.reset();
    resetTilesetCache();
    resetRouting();
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

  test("shows and clears the install affordance from window events", async () => {
    render(App, {
      target: container,
    });

    await waitForDataLoad();
    expect(document.querySelector(".install-button")).toBeNull();

    const prompt = vi.fn();
    const beforeInstallPrompt = new Event("beforeinstallprompt");
    Object.assign(beforeInstallPrompt, { prompt });

    window.dispatchEvent(beforeInstallPrompt);

    await waitFor(() =>
      expect(document.querySelector(".install-button")).not.toBeNull(),
    );

    await fireEvent.click(document.querySelector(".install-button")!);
    expect(prompt).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("appinstalled"));

    await waitFor(() =>
      expect(document.querySelector(".install-button")).toBeNull(),
    );
  });

  test("renders the item page after popstate navigation", async () => {
    render(App, {
      target: container,
    });

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
    expect(document.title.toLowerCase()).toMatch(/rock/);
  });

  test("popstate clears tileset override when the query parameter is removed", async () => {
    localStorage.setItem("cbn-guide:tileset", "retrodays");
    setWindowLocation("stable/", "?t=undead_people");

    render(App, {
      target: container,
    });

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

    render(App, {
      target: container,
    });

    await waitForDataLoad("rock");

    expect(window.location.pathname).toContain("search/rock");
    expect(document.body.textContent?.toLowerCase()).toContain("rock");
    expect(document.querySelector('a[href="/stable/item/rock"]')).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain(
      "there was a problem displaying this page",
    );
  });

  test("mod selector apply updates mods query param in order", async () => {
    setWindowLocation("stable/", "?mods=aftershock");
    const { getByLabelText, getByRole, getByText } = render(App, {
      target: container,
    });

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

    expect(new URL(window.location.href).searchParams.get("mods")).toBe(
      "aftershock,magiclysm",
    );
  });

  test("loads compatible mod tileset chunk URLs for active mods", async () => {
    setWindowLocation("stable/", "?mods=civilians&t=undead_people");

    render(App, {
      target: container,
    });

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

    render(App, {
      target: container,
    });

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
    render(App, {
      target: container,
    });

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
    expect(document.querySelector('a[href="/stable/item/rock"]')).toBeTruthy();

    await act(async () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();
    });

    await waitForUiSettled();
    expect(document.body.textContent?.toLowerCase()).toContain("rock");
  });

  test("canonical and alternate links include mods query param", async () => {
    setWindowLocation("stable/item/rock", "?mods=aftershock");

    render(App, {
      target: container,
    });

    await waitForDataLoad("rock");

    let canonical = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    const waitStart = Date.now();
    while (!canonical && Date.now() - waitStart < 2_000) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
      canonical = document.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement | null;
    }

    expect(canonical).toBeTruthy();
    expect(canonical?.href).toContain("mods=aftershock");

    const alternates = Array.from(
      document.querySelectorAll('link[rel="alternate"]'),
    ) as HTMLLinkElement[];
    expect(alternates.length).toBeGreaterThan(0);
    expect(
      alternates.every((link) => link.href.includes("mods=aftershock")),
    ).toBe(true);
  });

  test("shows an initialization error notification when builds.json fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn(() =>
      Promise.reject(new Error("Network Error")),
    ) as typeof fetch;

    render(App, {
      target: container,
    });

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(document.body.textContent).toContain(
        "Failed to initialize application. Please reload.",
      ),
    );

    errorSpy.mockRestore();
  });
});
