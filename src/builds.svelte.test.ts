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
  _resetVersionState,
  buildsState,
  initializeBuildsState,
  isSupportedVersion,
  LATEST_VERSION,
  NIGHTLY_VERSION,
  resolveBuildVersion,
  STABLE_VERSION,
  tryResolveBuildVersion,
  type BuildsState,
} from "./builds.svelte";
import { createBuildsFetchMock, getTestBuilds } from "./routing.test-helpers";

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
    _resetVersionState();
  });

  afterEach(() => {
    global.fetch = defaultFetchMock;
    _resetVersionState();
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

  test("resolves the latest alias to the same build as nightly", async () => {
    const state = await initializeBuildsState();

    expect(resolveBuildVersion(LATEST_VERSION, state)).toBe(
      resolveBuildVersion(NIGHTLY_VERSION, state),
    );
  });

  test("_resetVersionState clears buildsState", async () => {
    await initializeBuildsState();
    expect(buildsState.current).toBeDefined();

    _resetVersionState();
    expect(buildsState.current).toBeUndefined();
  });

  test("surfaces non-ok HTTP responses", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as Response),
    ) as typeof fetch;

    await expect(initializeBuildsState()).rejects.toThrow("Failed to fetch builds: 503");
  });
});

describe("tryResolveBuildVersion", () => {
  const stableBuilds: BuildsState = {
    builds: [
      {
        build_number: "2026-03-01",
        prerelease: false,
        created_at: "2026-03-01T00:00:00Z",
      },
      {
        build_number: "2026-03-10",
        prerelease: true,
        created_at: "2026-03-10T00:00:00Z",
      },
    ],
    latestStableBuild: {
      build_number: "2026-03-01",
      prerelease: false,
      created_at: "2026-03-01T00:00:00Z",
    },
    latestNightlyBuild: {
      build_number: "2026-03-10",
      prerelease: true,
      created_at: "2026-03-10T00:00:00Z",
    },
  };

  test("returns the version unchanged when no builds state is provided", () => {
    expect(tryResolveBuildVersion("stable")).toBe("stable");
    expect(tryResolveBuildVersion("nightly")).toBe("nightly");
    expect(tryResolveBuildVersion("2026-03-01")).toBe("2026-03-01");
  });

  test("resolves stable alias to the latest stable build number", () => {
    expect(tryResolveBuildVersion(STABLE_VERSION, stableBuilds)).toBe(
      "2026-03-01",
    );
  });

  test("resolves nightly alias to the latest nightly build number", () => {
    expect(tryResolveBuildVersion(NIGHTLY_VERSION, stableBuilds)).toBe(
      "2026-03-10",
    );
  });

  test("resolves latest alias to the same build as nightly", () => {
    expect(tryResolveBuildVersion(LATEST_VERSION, stableBuilds)).toBe(
      tryResolveBuildVersion(NIGHTLY_VERSION, stableBuilds),
    );
  });

  test("returns undefined for a build number not in the builds list", () => {
    expect(
      tryResolveBuildVersion("unknown-build-9999", stableBuilds),
    ).toBeUndefined();
  });

  test("passes through a concrete build number that exists in the list", () => {
    expect(tryResolveBuildVersion("2026-03-01", stableBuilds)).toBe(
      "2026-03-01",
    );
  });
});

describe("resolveBuildVersion", () => {
  const builds: BuildsState = {
    builds: [
      {
        build_number: "2026-01-15",
        prerelease: false,
        created_at: "2026-01-15T00:00:00Z",
      },
    ],
    latestStableBuild: {
      build_number: "2026-01-15",
      prerelease: false,
      created_at: "2026-01-15T00:00:00Z",
    },
    latestNightlyBuild: {
      build_number: "2026-01-15",
      prerelease: false,
      created_at: "2026-01-15T00:00:00Z",
    },
  };

  test("throws when the requested version is not found in builds", () => {
    expect(() =>
      resolveBuildVersion("no-such-build", builds),
    ).toThrow("Failed to resolve version: no-such-build");
  });

  test("resolves and returns a known build number without throwing", () => {
    expect(resolveBuildVersion("2026-01-15", builds)).toBe("2026-01-15");
  });
});

describe("isSupportedVersion", () => {
  test("accepts versions at or above the 0.7.0 floor", () => {
    expect(isSupportedVersion("v0.7.0")).toBe(true);
    expect(isSupportedVersion("v0.7.5")).toBe(true);
    expect(isSupportedVersion("v0.7")).toBe(true);
    expect(isSupportedVersion("v1.0.0")).toBe(true);
    expect(isSupportedVersion("v1.0")).toBe(true);
    expect(isSupportedVersion("1.0.0")).toBe(true);
  });

  test("rejects versions below the 0.7.0 floor", () => {
    expect(isSupportedVersion("v0.6.9")).toBe(false);
    expect(isSupportedVersion("v0.6")).toBe(false);
    expect(isSupportedVersion("v0.1.0")).toBe(false);
  });

  test("rejects non-semver strings including date-format build numbers", () => {
    expect(isSupportedVersion("2026-03-28")).toBe(false);
    expect(isSupportedVersion("nightly")).toBe(false);
    expect(isSupportedVersion("stable")).toBe(false);
    expect(isSupportedVersion("")).toBe(false);
  });
});