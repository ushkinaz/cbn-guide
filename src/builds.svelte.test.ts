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
  _resetBuildsState,
  buildsState,
  initializeBuildsState,
  isSupportedVersion,
  resolveBuildVersion,
} from "./builds.svelte";
import { createBuildsFetchMock, getTestBuilds } from "./routing.test-helpers";

vi.mock("./utils/retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./utils/retry")>();
  return {
    ...actual,
    retry: (fn: any, options: any = {}) => {
      return actual.retry(fn, { ...options, baseDelayMs: 0 });
    },
  };
});

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

describe("builds bootstrap", () => {
  let originalFetch: typeof global.fetch;
  let defaultFetchMock: typeof fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
    defaultFetchMock = createBuildsFetchMock();
  });

  beforeEach(() => {
    global.fetch = defaultFetchMock;
    _resetBuildsState();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    _resetBuildsState();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("loads builds metadata and stores latest stable and nightly builds", async () => {
    const state = await initializeBuildsState();

    expect(state.builds.length).toBeGreaterThan(0);
    expect(state.latestStableBuild.prerelease).toBe(false);
    expect(state.latestNightlyBuild.prerelease).toBe(true);
    expect(buildsState.current).toEqual(state);
  });

  test("resolves stable and nightly aliases from build metadata", async () => {
    const state = await initializeBuildsState();

    expect(resolveBuildVersion("stable", state)).toBe(latestBuild(false));
    expect(resolveBuildVersion("nightly", state)).toBe(latestBuild(true));
  });

  test("falls back to the newest available build when no stable release exists", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              build_number: "2026-03-28",
              prerelease: true,
              created_at: "2026-03-28T12:00:00Z",
            },
          ]),
      } as Response),
    ) as typeof fetch;

    await expect(initializeBuildsState()).resolves.toMatchObject({
      latestStableBuild: {
        build_number: "2026-03-28",
      },
      latestNightlyBuild: {
        build_number: "2026-03-28",
      },
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

    await expect(initializeBuildsState()).resolves.toMatchObject({
      latestStableBuild: {
        build_number: "v0.10.0",
      },
      latestNightlyBuild: {
        build_number: "2026-03-15",
      },
    });
  });

  test("surfaces fetch failures", async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error("Network Error")),
    ) as typeof fetch;

    await expect(initializeBuildsState()).rejects.toThrow("Network Error");
  });

  test("recognizes the supported release floor", () => {
    expect(isSupportedVersion("v0.7.0")).toBe(true);
    expect(isSupportedVersion("v0.6.9")).toBe(false);
    expect(isSupportedVersion("2026-03-28")).toBe(false);
  });
});
