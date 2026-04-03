import { BUILDS_URL } from "./constants";

export const STABLE_VERSION = "stable";
export const NIGHTLY_VERSION = "nightly";
export const LATEST_VERSION = "latest";

export type BuildInfo = {
  build_number: string;
  prerelease: boolean;
  created_at: string;
  langs?: string[];
};

export type BuildsState = {
  builds: BuildInfo[];
  latestStableBuild: BuildInfo;
  latestNightlyBuild: BuildInfo;
};

export const buildsState = $state<{
  current: BuildsState | undefined;
}>({
  current: undefined,
});

function getBuildTimestamp(build: BuildInfo): number {
  const ts = Date.parse(build.created_at);
  return Number.isNaN(ts) ? -Infinity : ts;
}

function compareBuildsDescending(left: BuildInfo, right: BuildInfo): number {
  const leftTimestamp = getBuildTimestamp(left);
  const rightTimestamp = getBuildTimestamp(right);

  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  return right.build_number.localeCompare(left.build_number, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function pickLatestBuild(
  buildList: BuildInfo[],
  predicate: (build: BuildInfo) => boolean,
): BuildInfo {
  let latest: BuildInfo | undefined;
  let latestTimestamp = -Infinity;

  for (const build of buildList) {
    if (!predicate(build)) continue;
    const ts = getBuildTimestamp(build);
    if (
      !latest ||
      (ts >= latestTimestamp && compareBuildsDescending(build, latest) < 0)
    ) {
      latestTimestamp = ts;
      latest = build;
    }
  }

  return latest ?? buildList[0];
}

function versionExists(builds: BuildInfo[], buildNumber: string): boolean {
  return builds.some((build) => build.build_number === buildNumber);
}

/**
 * Is >= 0.7.0 ?
 * @param buildNumber
 */
export function isSupportedVersion(buildNumber: string): boolean {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(buildNumber);
  if (!match) return false;
  const [, major, minor] = match;
  return parseInt(major) > 0 || (parseInt(major) === 0 && parseInt(minor) >= 7);
}

export async function initializeBuildsState(): Promise<BuildsState> {
  const response = await fetch(BUILDS_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch builds: ${response.status} ${response.statusText}`,
    );
  }

  const builds = [...((await response.json()) as BuildInfo[])].sort(
    compareBuildsDescending,
  );

  const latestStableBuild = pickLatestBuild(
    builds,
    (build) => !build.prerelease,
  );
  const latestNightlyBuild = pickLatestBuild(
    builds,
    (build) => build.prerelease,
  );

  buildsState.current = {
    builds,
    latestStableBuild,
    latestNightlyBuild,
  };
  return buildsState.current;
}

/**
 * Test helper: resets `buildsState` to an empty state.
 * @internal test-only
 */
export function _resetBuildsState(): void {
  buildsState.current = undefined;
}

export function tryResolveBuildVersion(
  version: string,
  builds?: BuildsState,
): string | undefined {
  if (!builds) {
    return version;
  }

  let resolvedVersion = version;
  let latestStableBuild = builds.latestStableBuild;
  let latestNightlyBuild = builds.latestNightlyBuild;

  if (resolvedVersion === STABLE_VERSION)
    resolvedVersion = latestStableBuild.build_number;
  if (resolvedVersion === NIGHTLY_VERSION || resolvedVersion === LATEST_VERSION)
    resolvedVersion = latestNightlyBuild.build_number;

  if (!versionExists(builds.builds, resolvedVersion)) {
    return undefined;
  }

  return resolvedVersion;
}

export function resolveBuildVersion(
  version: string,
  buildsState?: BuildsState,
): string {
  const resolvedVersion = tryResolveBuildVersion(version, buildsState);

  if (!resolvedVersion) {
    console.warn(`Version "${version}" not found`);
    throw new Error(`Failed to resolve version: ${version}`);
  }

  return resolvedVersion;
}
