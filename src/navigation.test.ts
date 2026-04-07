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
  setTileset,
} from "./preferences.svelte";
import {
  bootstrapApplication,
  buildLinkTo,
  changeTileset,
  navigateTo,
  navigation,
  updateSearchRoute,
} from "./navigation.svelte";
import { _resetRouting, page } from "./routing.svelte";
import {
  createBuildsFetchMock,
  setWindowLocation,
} from "./routing.test-helpers";
import { _resetBuildsState, initializeBuildsState } from "./builds.svelte";

describe("navigation", () => {
  let originalFetch: typeof global.fetch;
  let defaultFetchMock: typeof fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    defaultFetchMock = createBuildsFetchMock();
  });

  beforeEach(() => {
    setWindowLocation("stable/");
    _resetRouting();
    _resetPreferences();
    _resetBuildsState();
    localStorage.removeItem?.("cbn-guide:tileset");
    localStorage.removeItem?.("cbn-guide:mods");
    global.fetch = defaultFetchMock;
  });

  afterEach(() => {
    _resetRouting();
    _resetPreferences();
    _resetBuildsState();
    global.fetch = defaultFetchMock;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("derives the effective tileset from preferences when the URL omits t", async () => {
    initializePreferences();
    setTileset("retrodays");
    await initializeBuildsState();

    expect(navigation).toMatchObject({
      tileset: "retrodays",
      mods: [],
    });
    expect(buildLinkTo({ kind: "home" })).toBe("/stable/?t=retrodays");
  });

  test("uses a valid URL tileset override transiently without persisting it", async () => {
    setTileset("retrodays");
    setWindowLocation("stable/item/rock", "?t=ultica");
    _resetRouting();
    await initializeBuildsState();

    expect(navigation).toMatchObject({
      tileset: "ultica",
    });
    expect(preferences).toEqual({
      tileset: "retrodays",
      mods: [],
    });
    expect(buildLinkTo({ kind: "home" })).toBe("/stable/?t=ultica");
  });

  test("buildLinkTo builds a reactive link from navigation context", async () => {
    setWindowLocation(
      "stable/item/rock",
      "?lang=ru_RU&t=retrodays&mods=aftershock",
    );
    _resetRouting();
    await initializeBuildsState();

    expect(buildLinkTo({ kind: "catalog", type: "monster" })).toBe(
      "/stable/monster?lang=ru_RU&t=retrodays&mods=aftershock",
    );
  });

  test("buildLinkTo omits default locale, default tileset, and empty mods", async () => {
    setWindowLocation("stable/item/rock", "?lang=en&t=undead_people");
    _resetRouting();
    await initializeBuildsState();

    expect(buildLinkTo({ kind: "item", type: "item", id: "rock" })).toBe(
      "/stable/item/rock",
    );
  });

  test("navigateTo preserves the current mods query param and updates the page store", async () => {
    setWindowLocation("stable/", "?mods=aftershock,magiclysm");
    _resetRouting();
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
    _resetRouting();
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
      tileset: "retrodays",
      mods: [],
    });
    expect(window.location.search).toContain("t=retrodays");
    expect(replaceStateSpy).toHaveBeenCalledOnce();
  });

  test("bootstrapApplication canonicalizes invalid requested versions before mount", async () => {
    setWindowLocation(
      "bogus/item/rock",
      "?lang=ru_RU&t=retrodays&mods=aftershock",
    );
    _resetRouting();
    const replaceStateSpy = vi
      .spyOn(history, "replaceState")
      .mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

    await expect(bootstrapApplication()).resolves.toBeUndefined();

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/nightly/item/rock?lang=ru_RU&t=retrodays&mods=aftershock",
    );
    expect(page.route).toMatchObject({
      versionSlug: "nightly",
      localeParam: "ru_RU",
      tilesetParam: "retrodays",
      modsParam: ["aftershock"],
      target: { kind: "item", type: "item", id: "rock" },
    });
  });

  test("bootstrap injects saved mods into bare URL", async () => {
    localStorage.setItem("cbn-guide:mods", JSON.stringify(["aftershock"]));
    setWindowLocation("stable/");
    _resetRouting();
    const replaceStateSpy = vi
      .spyOn(history, "replaceState")
      .mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

    await bootstrapApplication();

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/stable/?mods=aftershock",
    );
    expect(page.route.modsParam).toEqual(["aftershock"]);
  });

  test("bootstrap does not inject when URL already has mods", async () => {
    localStorage.setItem("cbn-guide:mods", JSON.stringify(["magiclysm"]));
    setWindowLocation("stable/", "?mods=aftershock");
    _resetRouting();
    const replaceStateSpy = vi.spyOn(history, "replaceState");

    await bootstrapApplication();

    expect(replaceStateSpy).not.toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("magiclysm"),
    );
    expect(page.route.modsParam).toEqual(["aftershock"]);
  });

  test("bootstrap does not inject when no preset saved", async () => {
    localStorage.removeItem("cbn-guide:mods");
    setWindowLocation("stable/");
    _resetRouting();
    const replaceStateSpy = vi.spyOn(history, "replaceState");

    await bootstrapApplication();

    expect(replaceStateSpy).not.toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("mods="),
    );
    expect(page.route.modsParam).toEqual([]);
  });

  test("bootstrap canonicalizes version and saved preferences with one replaceState", async () => {
    localStorage.setItem("cbn-guide:tileset", "retrodays");
    localStorage.setItem("cbn-guide:mods", JSON.stringify(["aftershock"]));
    setWindowLocation("bogus/item/rock");
    _resetRouting();
    const replaceStateSpy = vi
      .spyOn(history, "replaceState")
      .mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

    await bootstrapApplication();

    expect(replaceStateSpy).toHaveBeenCalledOnce();
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      "/nightly/item/rock?t=retrodays&mods=aftershock",
    );
    expect(page.route).toMatchObject({
      versionSlug: "nightly",
      tilesetParam: "retrodays",
      modsParam: ["aftershock"],
      target: { kind: "item", type: "item", id: "rock" },
    });
  });
});
