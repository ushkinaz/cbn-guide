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
  _reset as resetRouting,
  buildURL,
  canonicalizeMalformedVersionURL,
  handleInternalNavigation,
  page,
  parseRoute,
} from "./routing.svelte";
import {
  createBuildsFetchMock,
  dispatchPopState,
  setWindowLocation,
} from "./routing.test-helpers";
import { BASE_URL } from "./utils/env";
import { _resetVersionState, initializeBuildsState } from "./builds.svelte";

function toRelativePath(url: string): string {
  const builtUrl = new URL(url, window.location.origin);
  return builtUrl.pathname.startsWith(BASE_URL)
    ? builtUrl.pathname.slice(BASE_URL.length)
    : builtUrl.pathname.slice(1);
}

describe("routing URL logic", () => {
  let originalFetch: typeof global.fetch;
  let defaultFetchMock: typeof fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    defaultFetchMock = createBuildsFetchMock();
  });

  beforeEach(() => {
    global.fetch = defaultFetchMock;
    window.scrollTo = vi.fn();
    setWindowLocation("stable/");
    resetRouting();
    _resetVersionState();
  });

  afterEach(() => {
    global.fetch = defaultFetchMock;
    resetRouting();
    _resetVersionState();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("parseRoute and buildURL", () => {
    test("defaults to stable on the home route", () => {
      expect(parseRoute("http://localhost/")).toMatchObject({
        versionSlug: "stable",
        modsParam: [],
        localeParam: undefined,
        tilesetParam: undefined,
        target: { kind: "home" },
      });
    });

    test("normalizes the mods query param", () => {
      expect(
        parseRoute(
          "http://localhost/stable/item/rock?mods= aftershock , ,magiclysm,aftershock,bn ",
        ),
      ).toMatchObject({
        modsParam: ["aftershock", "magiclysm"],
      });
    });

    test("captures locale and tileset from the URL", () => {
      expect(
        parseRoute("http://localhost/stable/item/rock?lang=ru_RU&t=retro"),
      ).toMatchObject({
        localeParam: "ru_RU",
        tilesetParam: "retro",
        target: { kind: "item", type: "item", id: "rock" },
      });
    });

    test("buildURL includes ordered mods", () => {
      const url = buildURL(
        "stable",
        { kind: "item", type: "item", id: "rock" },
        { modsParam: ["aftershock", "magiclysm"] },
      );

      expect(url).toContain("mods=aftershock%2Cmagiclysm");
    });

    test("buildURL omits empty mods", () => {
      const url = buildURL("stable", {
        kind: "item",
        type: "item",
        id: "rock",
      });

      expect(url).not.toContain("mods=");
    });

    test("mods round-trip through buildURL and parseRoute", () => {
      const url = buildURL(
        "stable",
        { kind: "search", query: "test query" },
        { modsParam: ["aftershock", "magiclysm"] },
      );

      expect(parseRoute(url)).toMatchObject({
        localeParam: undefined,
        tilesetParam: undefined,
        modsParam: ["aftershock", "magiclysm"],
        target: { kind: "search", query: "test query" },
      });
    });

    test.each([
      ["", "/search"],
      ["simple", "/search/simple"],
      ["with spaces", "/search/with%20spaces"],
      ["C++ programming", "/search/C%2B%2B%20programming"],
      ["a+b+c", "/search/a%2Bb%2Bc"],
      ["test&query=value", "/search/test%26query%3Dvalue"],
      ["special@#$chars", "/search/special%40%23%24chars"],
      ["unicode: 日本語", "/search/unicode%3A%20%E6%97%A5%E6%9C%AC%E8%AA%9E"],
    ])("round-trips search query %s", (query, expectedPathSuffix) => {
      const url = buildURL("stable", { kind: "search", query });

      expect(new URL(url, window.location.origin).pathname).toBe(
        `${BASE_URL}stable${expectedPathSuffix}`,
      );
      expect(parseRoute(url).target).toEqual({ kind: "search", query });
    });

    test.each(["simple_id", "id with spaces", "item_id+variant", "a+b"])(
      "round-trips item id %s",
      (id) => {
        const url = buildURL("stable", { kind: "item", type: "item", id });

        expect(parseRoute(url).target).toEqual({
          kind: "item",
          type: "item",
          id,
        });
      },
    );

    test("round-trips catalog targets", () => {
      const url = buildURL("stable", { kind: "catalog", type: "item" });

      expect(new URL(url, window.location.origin).pathname).toBe(
        `${BASE_URL}stable/item`,
      );
      expect(parseRoute(url).target).toEqual({
        kind: "catalog",
        type: "item",
      });
    });
  });

  describe("malformed version URL canonicalization", () => {
    test.each([
      ["http://localhost/monster/zombie", "/nightly/monster/zombie"],
      ["http://localhost/item", "/nightly/item"],
      ["http://localhost/search/rock", "/nightly/search/rock"],
    ])("canonicalizes missing version route %s", async (input, expected) => {
      const state = await initializeBuildsState();

      expect(canonicalizeMalformedVersionURL(input, state)).toBe(expected);
    });

    test("canonicalizes invalid explicit versions and preserves query and hash", async () => {
      const state = await initializeBuildsState();

      expect(
        canonicalizeMalformedVersionURL(
          "http://localhost/bad/item/rock?lang=ru_RU&t=retrodays&mods=aftershock#lore",
          state,
        ),
      ).toBe("/nightly/item/rock?lang=ru_RU&t=retrodays&mods=aftershock#lore");
    });

    test("keeps the bare home URL untouched", async () => {
      const state = await initializeBuildsState();

      expect(
        canonicalizeMalformedVersionURL("http://localhost/", state),
      ).toBeNull();
    });
  });

  describe("internal navigation interception", () => {
    test("ignores modified clicks", () => {
      const anchor = document.createElement("a");
      anchor.href = "http://localhost:3000/stable/item/rock";
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/stable/item/rock",
      });

      const event = {
        target: {
          closest: () => anchor,
        },
        preventDefault: vi.fn(),
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      } as unknown as MouseEvent;

      expect(handleInternalNavigation(event)).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test("intercepts links when raw route identity stays soft-navigable", () => {
      setWindowLocation("stable/search/rock", "?mods=aftershock");
      resetRouting();
      vi.spyOn(history, "pushState").mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

      const anchor = document.createElement("a");
      anchor.href = "http://localhost:3000/stable/item/rock?mods=aftershock";
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/stable/item/rock",
      });
      Object.defineProperty(anchor, "search", {
        value: "?mods=aftershock",
      });

      const event = {
        target: {
          closest: () => anchor,
        },
        preventDefault: vi.fn(),
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      } as unknown as MouseEvent;

      expect(handleInternalNavigation(event)).toBe(true);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toContain("stable/item/rock");
      expect(new URLSearchParams(window.location.search).get("mods")).toBe(
        "aftershock",
      );
      expect(page.route.target).toEqual({
        kind: "item",
        type: "item",
        id: "rock",
      });
      expect(page.route.modsParam).toEqual(["aftershock"]);
    });

    test("does not intercept links that change locale or mods", () => {
      setWindowLocation("stable/item/guide");
      resetRouting();
      const pushStateSpy = vi.spyOn(history, "pushState");

      const anchor = document.createElement("a");
      anchor.href = "http://localhost:3000/stable/?lang=uk&mods=inna";
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/stable/",
      });
      Object.defineProperty(anchor, "search", {
        value: "?lang=uk&mods=inna",
      });

      const event = {
        target: {
          closest: () => anchor,
        },
        preventDefault: vi.fn(),
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      } as unknown as MouseEvent;

      expect(handleInternalNavigation(event)).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(pushStateSpy).not.toHaveBeenCalled();
    });

    test("keeps SPA navigation when lang and mods are unchanged", () => {
      setWindowLocation("stable/item/guide", "?lang=uk&mods=inna");
      resetRouting();
      const pushStateSpy = vi
        .spyOn(history, "pushState")
        .mockImplementation((_, __, url) => {
          const nextUrl = new URL(String(url), window.location.origin);
          window.location.pathname = nextUrl.pathname;
          window.location.search = nextUrl.search;
          window.location.href = nextUrl.toString();
        });

      const anchor = document.createElement("a");
      anchor.href = "http://localhost:3000/stable/?lang=uk&mods=inna";
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/stable/",
      });
      Object.defineProperty(anchor, "search", {
        value: "?lang=uk&mods=inna",
      });

      const event = {
        target: {
          closest: () => anchor,
        },
        preventDefault: vi.fn(),
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      } as unknown as MouseEvent;

      expect(handleInternalNavigation(event)).toBe(true);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(pushStateSpy).toHaveBeenCalledOnce();
      expect(window.location.pathname).toBe("/stable/");
      expect(window.location.search).toBe("?lang=uk&mods=inna");
    });

    test("keeps SPA navigation when only the tileset changes", () => {
      setWindowLocation("stable/item/guide", "?lang=uk&mods=inna&t=retrodays");
      resetRouting();
      const pushStateSpy = vi
        .spyOn(history, "pushState")
        .mockImplementation((_, __, url) => {
          const nextUrl = new URL(String(url), window.location.origin);
          window.location.pathname = nextUrl.pathname;
          window.location.search = nextUrl.search;
          window.location.href = nextUrl.toString();
        });

      const anchor = document.createElement("a");
      anchor.href =
        "http://localhost:3000/stable/?lang=uk&mods=inna&t=undead_people";
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/stable/",
      });
      Object.defineProperty(anchor, "search", {
        value: "?lang=uk&mods=inna&t=undead_people",
      });

      const event = {
        target: {
          closest: () => anchor,
        },
        preventDefault: vi.fn(),
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      } as unknown as MouseEvent;

      expect(handleInternalNavigation(event)).toBe(true);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(pushStateSpy).toHaveBeenCalledOnce();
      expect(window.location.search).toBe("?lang=uk&mods=inna&t=undead_people");
    });

    test("does not intercept links to a different version", () => {
      setWindowLocation("stable/item/guide", "?lang=uk&mods=inna");
      resetRouting();
      const pushStateSpy = vi.spyOn(history, "pushState");

      const anchor = document.createElement("a");
      anchor.href = "http://localhost:3000/v0.8/item/guide?lang=uk&mods=inna";
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/v0.8/item/guide",
      });
      Object.defineProperty(anchor, "search", {
        value: "?lang=uk&mods=inna",
      });

      const event = {
        target: {
          closest: () => anchor,
        },
        preventDefault: vi.fn(),
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      } as unknown as MouseEvent;

      expect(handleInternalNavigation(event)).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(pushStateSpy).not.toHaveBeenCalled();
    });
  });

  describe("page store synchronization", () => {
    test("updates the page store on popstate events", () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();

      expect(page.route.target).toEqual({
        kind: "item",
        type: "item",
        id: "rock",
      });

      setWindowLocation(
        toRelativePath(
          buildURL("stable", {
            kind: "search",
            query: "test",
          }),
        ),
      );
      dispatchPopState();

      expect(page.route.target).toEqual({
        kind: "search",
        query: "test",
      });
      expect(page.url.pathname).toContain("search/test");
    });

    test("keeps the exported page object stable across popstate updates", () => {
      const initialPage = page;

      setWindowLocation("stable/item/rock");
      dispatchPopState();

      expect(page).toBe(initialPage);
      expect(page.route.target).toEqual({
        kind: "item",
        type: "item",
        id: "rock",
      });
    });
  });
});
