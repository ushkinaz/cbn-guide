/**
 * @vitest-environment happy-dom
 */

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
import {
  _reset as resetRouting,
  buildUrl,
  getCurrentVersionSlug,
  handleInternalNavigation,
  initializeRouting,
  navigateTo,
  page,
  getRoute,
  updateSearchRoute,
} from "./routing";
import {
  createBuildsFetchMock,
  dispatchPopState,
  getTestBuilds,
  setWindowLocation,
} from "./routing.test-helpers";
import { BASE_URL } from "./utils/env";

function latestBuild(prerelease: boolean): string {
  return [...getTestBuilds()]
    .filter((build) => build.prerelease === prerelease)
    .sort((left, right) => {
      const leftTime = Date.parse(left.created_at);
      const rightTime = Date.parse(right.created_at);
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return right.build_number.localeCompare(left.build_number, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })[0]!.build_number;
}

function mockLocationReplace() {
  const originalReplace = window.location.replace;
  let replaceUrl = "";
  const replaceSpy = vi.fn((next: string | URL) => {
    replaceUrl = next.toString();
    const url = new URL(replaceUrl, window.location.origin);
    window.location.pathname = url.pathname;
    window.location.search = url.search;
    window.location.href = url.toString();
  });

  delete (window.location as { replace?: unknown }).replace;
  window.location.replace = replaceSpy as typeof window.location.replace;

  return {
    replaceSpy,
    restore() {
      window.location.replace = originalReplace;
    },
    get replaceUrl() {
      return replaceUrl;
    },
  };
}

function mockLocationAssign() {
  const originalAssign = window.location.assign;
  let assignUrl = "";
  const assignSpy = vi.fn((next: string | URL) => {
    assignUrl = next.toString();
    const url = new URL(assignUrl, window.location.origin);
    window.location.pathname = url.pathname;
    window.location.search = url.search;
    window.location.href = url.toString();
  });

  delete (window.location as { assign?: unknown }).assign;
  window.location.assign = assignSpy as typeof window.location.assign;

  return {
    assignSpy,
    restore() {
      window.location.assign = originalAssign;
    },
    get assignUrl() {
      return assignUrl;
    },
  };
}

describe("Routing logic", () => {
  let originalFetch: typeof global.fetch;
  let defaultFetchMock: typeof fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    defaultFetchMock = createBuildsFetchMock();
  });

  beforeEach(() => {
    window.scrollTo = vi.fn();
    setWindowLocation("stable/");
    global.fetch = defaultFetchMock;
    resetRouting();
  });

  afterEach(() => {
    resetRouting();
    global.fetch = defaultFetchMock;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("URL parsing and encoding", () => {
    test("getCurrentVersionSlug defaults to stable on the home route", () => {
      expect(getCurrentVersionSlug()).toBe("stable");
    });

    test("normalizes mods query param in parseRoute", () => {
      setWindowLocation(
        "stable/item/rock",
        "?mods= aftershock , ,magiclysm,aftershock,bn ",
      );
      resetRouting();

      expect(getRoute().mods).toEqual(["aftershock", "magiclysm"]);
    });

    test("includes locale and tileset in the parsed route", () => {
      setWindowLocation("stable/item/rock", "?lang=ru_RU&t=retro");
      resetRouting();

      expect(getRoute()).toMatchObject({
        locale: "ru_RU",
        tileset: "retro",
        target: { kind: "item", type: "item", id: "rock" },
      });
    });

    test("buildUrl includes ordered mods query param", () => {
      const url = buildUrl(
        "stable",
        { kind: "item", type: "item", id: "rock" },
        { mods: ["aftershock", "magiclysm"] },
      );

      expect(url).toContain("mods=aftershock%2Cmagiclysm");
    });

    test("buildUrl omits mods query param when empty", () => {
      const url = buildUrl("stable", {
        kind: "item",
        type: "item",
        id: "rock",
      });
      expect(url).not.toContain("mods=");
    });

    test("mods query param round-trips through buildUrl and parseRoute", () => {
      const url = buildUrl(
        "stable",
        { kind: "search", query: "test query" },
        { mods: ["aftershock", "magiclysm"] },
      );
      const builtUrl = new URL(url);
      const relativePath = builtUrl.pathname.startsWith(BASE_URL)
        ? builtUrl.pathname.slice(BASE_URL.length)
        : builtUrl.pathname.slice(1);

      setWindowLocation(relativePath, builtUrl.search);
      resetRouting();

      expect(getRoute()).toMatchObject({
        locale: null,
        tileset: null,
        mods: ["aftershock", "magiclysm"],
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
      const url = buildUrl("stable", { kind: "search", query });
      const builtUrl = new URL(url);
      const relativePath = builtUrl.pathname.startsWith(BASE_URL)
        ? builtUrl.pathname.slice(BASE_URL.length)
        : builtUrl.pathname.slice(1);

      setWindowLocation(relativePath);
      resetRouting();

      expect(builtUrl.pathname).toBe(`${BASE_URL}stable${expectedPathSuffix}`);
      expect(getRoute().target).toEqual({ kind: "search", query });
    });

    test.each(["simple_id", "id with spaces", "item_id+variant", "a+b"])(
      "round-trips item id %s",
      (id) => {
        const url = buildUrl("stable", { kind: "item", type: "item", id });
        const builtUrl = new URL(url);
        const relativePath = builtUrl.pathname.startsWith(BASE_URL)
          ? builtUrl.pathname.slice(BASE_URL.length)
          : builtUrl.pathname.slice(1);

        setWindowLocation(relativePath);
        resetRouting();

        expect(getRoute().target).toEqual({ kind: "item", type: "item", id });
      },
    );

    test("round-trips catalog target", () => {
      const url = buildUrl("stable", { kind: "catalog", type: "item" });
      const builtUrl = new URL(url);
      const relativePath = builtUrl.pathname.startsWith(BASE_URL)
        ? builtUrl.pathname.slice(BASE_URL.length)
        : builtUrl.pathname.slice(1);

      setWindowLocation(relativePath);
      resetRouting();

      expect(builtUrl.pathname).toBe(`${BASE_URL}stable/item`);
      expect(getRoute().target).toEqual({ kind: "catalog", type: "item" });
    });
  });

  describe("imperative navigation and page store", () => {
    test("navigateTo preserves the current mods query param", () => {
      setWindowLocation("stable/", "?mods=aftershock,magiclysm");
      resetRouting();
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
      expect(get(page).route.target).toEqual({
        kind: "item",
        type: "item",
        id: "rock",
      });
    });

    test("updateSearchRoute reuses buildUrl normalization for query params", () => {
      setWindowLocation(
        "stable/item/rock",
        "?lang=en&t=retro&mods= aftershock , ,magiclysm,aftershock,bn ",
      );
      resetRouting();
      vi.spyOn(history, "pushState").mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

      updateSearchRoute("test query", {
        kind: "item",
        type: "item",
        id: "rock",
      });

      expect(window.location.pathname).toContain("stable/search/test%20query");
      expect(new URL(window.location.href).searchParams.get("lang")).toBeNull();
      expect(new URL(window.location.href).searchParams.get("t")).toBe("retro");
      expect(new URL(window.location.href).searchParams.get("mods")).toBe(
        "aftershock,magiclysm",
      );
      expect(get(page).route.target).toEqual({
        kind: "search",
        query: "test query",
      });
      expect(get(page).route.locale).toBeNull();
      expect(get(page).route.tileset).toBe("retro");
      expect(get(page).route.mods).toEqual(["aftershock", "magiclysm"]);
    });

    test("handleInternalNavigation ignores modified clicks", () => {
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

    test("handleInternalNavigation intercepts same-version links and preserves current query", () => {
      setWindowLocation("stable/search/rock", "?mods=aftershock");
      resetRouting();
      vi.spyOn(history, "pushState").mockImplementation((_, __, url) => {
        const nextUrl = new URL(String(url), window.location.origin);
        window.location.pathname = nextUrl.pathname;
        window.location.search = nextUrl.search;
        window.location.href = nextUrl.toString();
      });

      const anchor = document.createElement("a");
      anchor.href = "http://localhost:3000/stable/item/rock";
      Object.defineProperty(anchor, "origin", {
        value: "http://localhost:3000",
      });
      Object.defineProperty(anchor, "pathname", {
        value: "/stable/item/rock",
      });
      Object.defineProperty(anchor, "search", {
        value: "",
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
      expect(get(page).route.target).toEqual({
        kind: "item",
        type: "item",
        id: "rock",
      });
      expect(get(page).route.mods).toEqual(["aftershock"]);
      expect(get(page).url.search).toContain("mods=aftershock");
    });

    test("handleInternalNavigation hard reloads links that set lang or mods", () => {
      setWindowLocation("stable/item/guide");
      resetRouting();
      const pushStateSpy = vi.spyOn(history, "pushState");
      const locationAssign = mockLocationAssign();

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
      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(locationAssign.assignSpy).toHaveBeenCalledWith(
        "/stable/?lang=uk&mods=inna",
      );
      expect(locationAssign.assignUrl).toBe("/stable/?lang=uk&mods=inna");
      locationAssign.restore();
    });

    test("page store updates on popstate events", () => {
      setWindowLocation("stable/item/rock");
      dispatchPopState();

      expect(get(page).route.target).toEqual({
        kind: "item",
        type: "item",
        id: "rock",
      });

      setWindowLocation("stable/search/test");
      dispatchPopState();

      expect(get(page).route.target).toEqual({
        kind: "search",
        query: "test",
      });
      expect(get(page).url.pathname).toContain("search/test");
    });

    test("popstate updates the page store exactly once per event", () => {
      let updateCount = 0;
      const unsubscribe = page.subscribe(() => {
        updateCount++;
      });
      const initialCount = updateCount;

      setWindowLocation("stable/item/rock");
      dispatchPopState();

      expect(updateCount).toBe(initialCount + 1);
      unsubscribe();
    });
  });

  describe("routing initialization", () => {
    test("resolves the stable alias to the latest stable build", async () => {
      setWindowLocation("stable/");
      resetRouting();

      await expect(initializeRouting()).resolves.toMatchObject({
        locale: null,
        mods: [],
        redirected: false,
        resolvedVersion: latestBuild(false),
      });
    });

    test("resolves the nightly alias to the latest nightly build", async () => {
      setWindowLocation("nightly/");
      resetRouting();

      await expect(initializeRouting()).resolves.toMatchObject({
        redirected: false,
        resolvedVersion: latestBuild(true),
      });
    });

    test("returns bootstrap locale and mods from the initial route", async () => {
      setWindowLocation(
        "stable/item/rock",
        "?lang=ru_RU&mods=aftershock,magiclysm",
      );
      resetRouting();

      await expect(initializeRouting()).resolves.toMatchObject({
        locale: "ru_RU",
        mods: ["aftershock", "magiclysm"],
        redirected: false,
        resolvedVersion: latestBuild(false),
      });
    });

    test("uses one comparator for equal-timestamp stable builds", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve<unknown>([
              {
                build_number: "v0.9.1",
                prerelease: false,
                created_at: "2026-03-15T21:35:42Z",
              },
              {
                build_number: "v0.10.0",
                prerelease: false,
                created_at: "2026-03-15T21:35:42Z",
              },
              {
                build_number: "2026-03-15",
                prerelease: true,
                created_at: "2026-03-15T21:35:42Z",
              },
            ]),
        } as Response),
      ) as typeof fetch;
      setWindowLocation("stable/");
      resetRouting();

      await expect(initializeRouting()).resolves.toMatchObject({
        redirected: false,
        resolvedVersion: "v0.10.0",
        latestStableBuild: {
          build_number: "v0.10.0",
        },
      });
    });

    test("prepends /stable/ to invalid version paths", async () => {
      setWindowLocation("non-existent-version/item/rock");
      resetRouting();
      const redirect = mockLocationReplace();

      await expect(initializeRouting()).resolves.toMatchObject({
        locale: null,
        mods: [],
        redirected: true,
      });

      expect(redirect.replaceSpy).toHaveBeenCalledWith(
        expect.stringContaining("stable/non-existent-version/item/rock"),
      );
      redirect.restore();
    });

    test("uses stable as the version slug after redirect correction", async () => {
      setWindowLocation("mutation");
      resetRouting();
      const redirect = mockLocationReplace();

      await expect(initializeRouting()).resolves.toMatchObject({
        locale: null,
        mods: [],
        redirected: true,
      });

      setWindowLocation("stable/mutation");
      resetRouting();

      expect(getCurrentVersionSlug()).toBe("stable");
      redirect.restore();
    });

    test.each(["mutation", "item", "monster", "terrain"])(
      "prepends /stable/ when %s is accessed without a version",
      async (typePath) => {
        setWindowLocation(typePath);
        resetRouting();
        const redirect = mockLocationReplace();

        await expect(initializeRouting()).resolves.toMatchObject({
          locale: null,
          mods: [],
          redirected: true,
        });

        expect(redirect.replaceUrl).toContain(`stable/${typePath}`);
        redirect.restore();
      },
    );

    test("preserves URL encoding when redirecting versionless paths", async () => {
      setWindowLocation("search/fire%2Faxe");
      resetRouting();
      const redirect = mockLocationReplace();

      await expect(initializeRouting()).resolves.toMatchObject({
        locale: null,
        mods: [],
        redirected: true,
      });

      expect(redirect.replaceUrl).toContain("stable/search/fire%2Faxe");
      expect(redirect.replaceUrl).not.toContain("stable/search/fire/axe");
      redirect.restore();
    });

    test("surfaces fetch failures from builds.json", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network Error")),
      ) as typeof fetch;

      await expect(initializeRouting()).rejects.toThrow("Network Error");
    });
  });
});
