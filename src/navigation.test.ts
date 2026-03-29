/**
 * @vitest-environment happy-dom
 */

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
import {
  _resetPreferences,
  initializePreferences,
  preferences,
  setPreferredTileset,
} from "./preferences.svelte";
import {
  bootstrapApplication,
  buildLinkTo,
  changeTileset,
  navigateTo,
  navigation,
  updateSearchRoute,
} from "./navigation.svelte";
import { _reset as resetRouting, page } from "./routing.svelte";
import {
  createBuildsFetchMock,
  setWindowLocation,
} from "./routing.test-helpers";
import { _resetVersionState, initializeBuildsState } from "./builds.svelte";

describe("navigation", () => {
  let originalFetch: typeof global.fetch;
  let defaultFetchMock: typeof fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    defaultFetchMock = createBuildsFetchMock();
  });

  beforeEach(() => {
    setWindowLocation("stable/");
    resetRouting();
    _resetPreferences();
    _resetVersionState();
    localStorage.removeItem?.("cbn-guide:tileset");
    global.fetch = defaultFetchMock;
  });

  afterEach(() => {
    resetRouting();
    _resetPreferences();
    _resetVersionState();
    global.fetch = defaultFetchMock;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("derives the effective tileset from preferences when the URL omits t", async () => {
    initializePreferences();
    setPreferredTileset("retrodays");
    await initializeBuildsState();

    expect(navigation).toMatchObject({
      tileset: "retrodays",
      mods: [],
    });
    expect(buildLinkTo({ kind: "home" })).toBe("/stable/?t=retrodays");
  });

  test("uses a valid URL tileset override transiently without persisting it", async () => {
    setPreferredTileset("retrodays");
    setWindowLocation("stable/item/rock", "?t=ultica");
    resetRouting();
    await initializeBuildsState();

    expect(navigation).toMatchObject({
      tileset: "ultica",
    });
    expect(preferences).toEqual({
      preferredTileset: "retrodays",
    });
    expect(buildLinkTo({ kind: "home" })).toBe("/stable/?t=ultica");
  });

  test("buildLinkTo preserves language, tileset, and mods in imperative links", async () => {
    setWindowLocation(
      "stable/item/rock",
      "?lang=ru_RU&t=retrodays&mods=aftershock",
    );
    resetRouting();
    await initializeBuildsState();

    expect(buildLinkTo({ kind: "catalog", type: "monster" })).toBe(
      "/stable/monster?lang=ru_RU&t=retrodays&mods=aftershock",
    );
  });

  test("buildLinkTo builds a reactive link from navigation context", async () => {
    setWindowLocation(
      "stable/item/rock",
      "?lang=ru_RU&t=retrodays&mods=aftershock",
    );
    resetRouting();
    await initializeBuildsState();

    expect(buildLinkTo({ kind: "catalog", type: "monster" })).toBe(
      "/stable/monster?lang=ru_RU&t=retrodays&mods=aftershock",
    );
  });

  test("buildLinkTo omits the default locale and empty mods", async () => {
    setWindowLocation("stable/item/rock", "?lang=en");
    resetRouting();
    await initializeBuildsState();

    expect(buildLinkTo({ kind: "item", type: "item", id: "rock" })).toBe(
      "/stable/item/rock?t=undead_people",
    );
  });

  test("navigateTo preserves the current mods query param and updates the page store", async () => {
    setWindowLocation("stable/", "?mods=aftershock,magiclysm");
    resetRouting();
    await initializeBuildsState();
    vi.spyOn(history, "pushState").mockImplementation((_, __, url) => {
      const nextUrl = new URL(String(url), window.location.origin);
      window.location.pathname = nextUrl.pathname;
      window.location.search = nextUrl.search;
      window.location.href = nextUrl.toString();
    });

    navigateTo({ kind: "item", type: "item", id: "rock" });

    expect(new URLSearchParams(window.location.search).get("mods")).toBe(
      "aftershock,magiclysm",
    );
    expect(page.route.target).toEqual({
      kind: "item",
      type: "item",
      id: "rock",
    });
  });

  test("updateSearchRoute reuses link normalization for query-backed state", async () => {
    setWindowLocation(
      "stable/item/rock",
      "?lang=en&t=retrodays&mods= aftershock , ,magiclysm,aftershock,bn ",
    );
    resetRouting();
    await initializeBuildsState();
    vi.spyOn(history, "pushState").mockImplementation((_, __, url) => {
      const nextUrl = new URL(String(url), window.location.origin);
      window.location.pathname = nextUrl.pathname;
      window.location.search = nextUrl.search;
      window.location.href = nextUrl.toString();
    });

    updateSearchRoute(
      {
        kind: "item",
        type: "item",
        id: "rock",
      },
      "test query",
    );

    expect(window.location.pathname).toContain("stable/search/test%20query");
    expect(new URLSearchParams(window.location.search).get("lang")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("t")).toBe(
      "retrodays",
    );
    expect(new URLSearchParams(window.location.search).get("mods")).toBe(
      "aftershock,magiclysm",
    );
    expect(page.route.target).toEqual({
      kind: "search",
      query: "test query",
    });
  });

  test("changeTileset updates navigation context, persists the choice, and rewrites the current URL softly", async () => {
    await initializeBuildsState();
    const replaceStateSpy = vi
      .spyOn(history, "replaceState")
      .mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

    changeTileset("retrodays");

    expect(navigation.tileset).toBe("retrodays");
    expect(preferences).toEqual({
      preferredTileset: "retrodays",
    });
    expect(window.location.search).toContain("t=retrodays");
    expect(replaceStateSpy).toHaveBeenCalledOnce();
  });

  test("bootstrapApplication rejects invalid requested versions before mount", async () => {
    setWindowLocation("bogus/item/rock");
    resetRouting();

    await expect(bootstrapApplication()).rejects.toThrow(
      "Failed to resolve version: bogus",
    );
  });
});
