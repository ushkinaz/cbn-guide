/**
 * Routing module - encapsulates all routing logic for the application
 *
 * Responsibilities:
 * - URL parsing and path segment extraction
 * - Version handling (aliases, resolution, validation)
 * - Search query encoding/decoding
 * - History management (pushState, replaceState)
 * - URL generation and manipulation
 */

import { BUILDS_URL } from "./constants";

// ============================================================================
// Constants
// ============================================================================

export const STABLE_VERSION = "stable";
export const NIGHTLY_VERSION = "nightly";
export const LATEST_VERSION = "latest";

// ============================================================================
// Types
// ============================================================================

/**
 * Build info type (mirrors JSON structure from builds.json)
 */
export type BuildInfo = {
  build_number: string;
  prerelease: boolean;
  created_at: string;
  langs?: string[];
};

/**
 * Parsed route state for the application
 */
export type ParsedRoute = {
  version: string;
  item: { type: string; id: string } | null;
  search: string;
};

/**
 * URL configuration extracted from query parameters
 */
export type UrlConfig = {
  locale: string | null;
  tileset: string | null;
};

/**
 * Result of routing initialization - essentially the initial application state
 */
export type InitialAppState = {
  builds: BuildInfo[];
  resolvedVersion: string;
  latestStableBuild?: BuildInfo;
  latestNightlyBuild?: BuildInfo;
};

// ============================================================================
// Internal Helper Functions
// ============================================================================

type Debounced<T extends (...args: any[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
};

function debounce<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number,
): Debounced<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, waitMs);
  }) as Debounced<T>;

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Get path segments relative to BASE_URL
 */
function getPathSegments(): string[] {
  const path = location.pathname.slice(import.meta.env.BASE_URL.length - 1);
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  if (!cleanPath) return [];
  return cleanPath.split("/").map(decodeURIComponent);
}

/**
 * Get the current version slug from URL
 * This is what components should use to build relative URLs
 */
export function getCurrentVersionSlug(): string {
  const segments = getPathSegments();
  return segments[0] || STABLE_VERSION;
}

/**
 * Get the base path for the current version (e.g., "/cbn-guide/stable/")
 * Use this when building href strings in templates
 */
export function getVersionedBasePath(): string {
  return import.meta.env.BASE_URL + getCurrentVersionSlug() + "/";
}

/**
 * Get current URL search params
 */
function getSearchParams(): URLSearchParams {
  return new URLSearchParams(location.search);
}

/**
 * Get a specific search param value
 */
function getSearchParam(param: string): string | null {
  return getSearchParams().get(param);
}

/**
 * Get build timestamp for sorting
 */
function getBuildTimestamp(build: BuildInfo): number {
  const ts = Date.parse(build.created_at);
  return Number.isNaN(ts) ? -Infinity : ts;
}

/**
 * Pick the latest build matching a predicate
 * Uses O(n) algorithm instead of O(n log n) sorting
 */
function pickLatestBuild(
  buildList: BuildInfo[],
  predicate: (build: BuildInfo) => boolean,
): BuildInfo | undefined {
  let latest: BuildInfo | undefined;
  let latestTimestamp = -Infinity;

  for (const build of buildList) {
    if (!predicate(build)) continue;
    const ts = getBuildTimestamp(build);
    if (
      ts > latestTimestamp ||
      (ts === latestTimestamp &&
        build.build_number > (latest?.build_number ?? ""))
    ) {
      latestTimestamp = ts;
      latest = build;
    }
  }

  return latest;
}

/**
 * Resolve a version alias to an actual build number
 */
function resolveVersionAlias(
  slug: string,
  latestStableBuild: BuildInfo | undefined,
  latestNightlyBuild: BuildInfo | undefined,
): string | undefined {
  if (slug === STABLE_VERSION) return latestStableBuild?.build_number;
  if (slug === NIGHTLY_VERSION || slug === LATEST_VERSION)
    return latestNightlyBuild?.build_number;
  return slug;
}

/**
 * Get fallback version from builds list
 */
function getFallbackVersion(
  builds: BuildInfo[],
  latestStableBuild: BuildInfo | undefined,
  latestNightlyBuild: BuildInfo | undefined,
): string {
  return (
    latestStableBuild?.build_number ||
    latestNightlyBuild?.build_number ||
    builds[0]?.build_number ||
    // Easter egg: This version should never be reached in production.
    // If we get here, all builds are missing - something is very wrong.
    "Grinch-v1.0"
  );
}

/**
 * Check if a version exists in the builds list
 */
function versionExists(builds: BuildInfo[], buildNumber: string): boolean {
  return builds.some((build) => build.build_number === buildNumber);
}

/**
 * Redirect to a different version (replaces current history entry)
 */
function redirectToVersion(
  newVersion: string,
  preservePath: boolean = true,
): void {
  const segments = getPathSegments();
  if (preservePath && segments.length > 0) {
    segments[0] = newVersion;
  } else {
    // Either !preservePath or empty segments - start fresh with just version
    segments.length = 0;
    segments.push(newVersion);
  }

  const newPath =
    import.meta.env.BASE_URL + segments.join("/") + location.search;
  history.replaceState(null, "", newPath);
}

// ============================================================================
// Core Exported Utilities (Read/Compute)
// ============================================================================

/**
 * Parse the current URL and extract route information for the app
 * This determines what should be displayed based on the URL structure
 *
 * @returns Object with version, item (for thing/catalog pages) or search query
 */
export function parseRoute(): ParsedRoute {
  const segments = getPathSegments();
  const version = segments[0] || STABLE_VERSION;
  const type = segments[1];
  const id = segments[2];

  if (type === "search") {
    return {
      version,
      item: null,
      search: id || "",
    };
  } else if (type) {
    return {
      version,
      item: { type, id: id || "" },
      search: "",
    };
  }

  return {
    version,
    item: null,
    search: "",
  };
}

/**
 * Extract configuration from URL query parameters
 * Centralizes all URL reading for app configuration
 *
 * @returns Object with locale and tileset from query params
 */
export function getUrlConfig(): UrlConfig {
  return {
    locale: getSearchParam("lang"),
    tileset: getSearchParam("t"),
  };
}

/**
 * Build a clean URL from route components
 */
export function buildUrl(
  version: string,
  item: { type: string; id: string } | null,
  search: string,
  locale: string | null = null,
  tileset: string | null = null,
): string {
  let path = import.meta.env.BASE_URL + version + "/";

  if (item) {
    if (item.type && item.id) {
      path += encodeURIComponent(item.type) + "/" + encodeURIComponent(item.id);
    } else if (item.type) {
      path += encodeURIComponent(item.type);
    }
  } else if (search) {
    path += "search/" + encodeURIComponent(search);
  }

  // Always use URL class for consistent encoding/formatting
  const url = new URL(path, location.origin);
  if (locale && locale !== "en") {
    url.searchParams.set("lang", locale);
  }
  if (tileset) {
    url.searchParams.set("t", tileset);
  }
  return url.toString();
}

/**
 * Check if a build number is v0.7.0 or later (supported version)
 */
export function isSupportedVersion(buildNumber: string): boolean {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(buildNumber);
  if (!match) return false;
  const [, major, minor] = match;
  return parseInt(major) > 0 || (parseInt(major) === 0 && parseInt(minor) >= 7);
}

// ============================================================================
// Action Utilities (Navigation & state change)
// ============================================================================

/**
 * Debounced version of history.replaceState for search input updates
 * Prevents excessive history updates during rapid typing
 */
const debouncedReplaceState = debounce(
  (url: string) => history.replaceState(null, "", url),
  400,
);

/**
 * Update the URL to reflect a version change (causes full page reload)
 */
export function changeVersion(newVersion: string): void {
  const segments = getPathSegments();
  if (segments.length === 0) {
    segments.push(newVersion);
  } else {
    segments[0] = newVersion;
  }

  const newPath = import.meta.env.BASE_URL + segments.join("/");
  location.href = newPath + location.search;
}

/**
 * Update the URL to reflect a search query
 * Uses replaceState for search updates (no item), pushState when navigating from an item
 *
 * @param searchQuery - The search query string
 * @param currentItem - The current item being viewed (if any)
 */
export function updateSearchRoute(
  searchQuery: string,
  currentItem: { type: string; id: string } | null,
): void {
  const currentVer = getCurrentVersionSlug();

  // Construct a new path
  let newPath = import.meta.env.BASE_URL + currentVer + "/";
  if (searchQuery) {
    newPath += "search/" + encodeURIComponent(searchQuery);
  }

  const fullUrl = newPath + location.search;

  if (currentItem) {
    history.pushState(null, "", fullUrl);
  } else {
    debouncedReplaceState(fullUrl);
  }
}

/**
 * Update URL query parameters and reload (for language changes)
 */
export function updateQueryParam(param: string, value: string | null): void {
  const url = new URL(location.href);
  if (value) {
    url.searchParams.set(param, value);
  } else {
    url.searchParams.delete(param);
  }
  location.href = url.toString();
}

/**
 * Update URL query parameters without reload (for tileset changes)
 */
export function updateQueryParamNoReload(
  param: string,
  value: string | null,
): void {
  const url = new URL(location.href);
  if (value) {
    url.searchParams.set(param, value);
  } else {
    url.searchParams.delete(param);
  }
  history.replaceState(null, "", url.toString());
}

/**
 * Handle click events to intercept internal navigation
 * Returns true if navigation was handled, false otherwise
 *
 * @param event - Mouse click event
 * @returns true if internal navigation was handled, false if external/not handled
 */
export function handleInternalNavigation(event: MouseEvent): boolean {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest("a") as HTMLAnchorElement | null;

  if (anchor && anchor.href) {
    // Standard browser behavior: let browser handle modifier keys and middle click
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return false;
    }

    // Use anchor element properties directly instead of creating URL object
    if (
      anchor.origin === location.origin &&
      anchor.pathname.startsWith(import.meta.env.BASE_URL)
    ) {
      event.preventDefault();
      // Cancel any pending debounced URL updates - user is explicitly navigating
      debouncedReplaceState.cancel();
      // We push to history, calculating the path from the anchor
      history.pushState(null, "", anchor.pathname + location.search);
      return true;
    }
  }

  return false;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize routing by fetching builds and resolving the requested version
 * This handles:
 * - Fetching builds.json
 * - Resolving version aliases (stable/nightly)
 * - Validating version exists
 * - Redirecting to fallback if needed
 *
 * @returns Promise with valid initial state
 * @throws Error if builds.json fails to load
 */
export async function initializeRouting(): Promise<InitialAppState> {
  const response = await fetch(BUILDS_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch builds: ${response.status} ${response.statusText}`,
    );
  }
  const builds: BuildInfo[] = await response.json();

  // Sort builds by date descending
  builds.sort((a, b) => {
    const tsA = getBuildTimestamp(a);
    const tsB = getBuildTimestamp(b);
    if (tsA !== tsB) return tsB - tsA;
    return b.build_number.localeCompare(a.build_number, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  const latestStableBuild = pickLatestBuild(
    builds,
    (build) => !build.prerelease,
  );
  const latestNightlyBuild = pickLatestBuild(
    builds,
    (build) => build.prerelease,
  );

  const fallbackVersion = getFallbackVersion(
    builds,
    latestStableBuild,
    latestNightlyBuild,
  );

  const requestedVersion = parseRoute().version;

  let resolvedVersion =
    resolveVersionAlias(
      requestedVersion,
      latestStableBuild,
      latestNightlyBuild,
    ) ?? fallbackVersion;

  // Verify if the version actually exists in the build list
  if (!versionExists(builds, resolvedVersion)) {
    // Fallback logic. We are here only if slug pointed to an incorrect version.
    if (fallbackVersion) {
      console.warn(
        `Version ${resolvedVersion} not found in builds list, falling back to ${fallbackVersion}.`,
      );
      //TODO: Notify user
      resolvedVersion = fallbackVersion;
      redirectToVersion(resolvedVersion, true);
    } else {
      //no fallback - should never be here
      console.error("Can not load anything. Are we totally offline?");
      //TODO: Notify user, we failed to load our app.
      throw new Error("Failed to resolve any valid version");
    }
  }

  return {
    builds,
    resolvedVersion,
    latestStableBuild,
    latestNightlyBuild,
  };
}
