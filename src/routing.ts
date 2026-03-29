/**
 * Routing module - encapsulates all routing logic for the application
 *
 * Documentation: docs/routing.md
 *
 * Responsibilities:
 * - URL parsing and path segment extraction
 * - Version handling (aliases, resolution, validation)
 * - Search query encoding/decoding
 * - History management (pushState, replaceState)
 * - URL generation and manipulation
 */

import { get, type Readable, writable } from "svelte/store";
import { BUILDS_URL } from "./constants";
import { BASE_URL } from "./utils/env";
import { debounce } from "./utils/debounce";

// ============================================================================
// Constants
// ============================================================================

export const STABLE_VERSION = "stable";
export const NIGHTLY_VERSION = "nightly";
export const LATEST_VERSION = "latest";

// ============================================================================
// Types
// ============================================================================

export type RouteTarget =
  | { kind: "home" }
  | { kind: "search"; query: string }
  | { kind: "catalog"; type: string }
  | { kind: "item"; type: string; id: string };

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
  mods: string[];
  locale: string | null;
  tileset: string | null;
  target: RouteTarget;
};

type PageState = {
  url: URL;
  route: ParsedRoute;
};

export type BuildUrlOptions = Partial<
  Pick<ParsedRoute, "locale" | "tileset" | "mods">
>;

/**
 * Result of routing initialization - essentially the initial application state
 */
export type InitialAppState = {
  builds: BuildInfo[];
  resolvedVersion: string;
  mods: string[];
  locale: string | null;
  /**
   * `True` when initializeRouting already triggered location.replace().
   * App startup must stop in this case to avoid kicking off redundant data loads
   * while the browser is navigating to the corrected URL.
   */
  redirected: boolean;
  latestStableBuild?: BuildInfo;
  latestNightlyBuild?: BuildInfo;
};

// ============================================================================
// Internal Helper Functions
// ============================================================================

function stripBaseFromPathname(pathname: string): string {
  const baseUrl = BASE_URL;
  const baseNoSlash = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  if (pathname === baseNoSlash) return "/";
  if (pathname.startsWith(baseUrl)) return pathname.slice(baseUrl.length - 1);
  if (pathname.startsWith(baseNoSlash + "/"))
    return pathname.slice(baseNoSlash.length);
  return pathname;
}

function isPathUnderBase(pathname: string): boolean {
  const baseUrl = BASE_URL;
  const baseNoSlash = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  return (
    baseUrl === "/" ||
    pathname === baseNoSlash ||
    pathname.startsWith(baseUrl) ||
    pathname.startsWith(baseNoSlash + "/")
  );
}

/**
 * Extract and decode path segments from a given pathname
 *
 * Handles:
 * - Base URL stripping
 * - Empty segment filtering (e.g., //vehicle → ["vehicle"])
 * - URI decoding (%2F → /)
 *
 * @param pathname - The pathname to parse
 * @returns Array of decoded path segments
 */
function getPathSegmentsFromPath(pathname: string): string[] {
  const path = stripBaseFromPathname(pathname);
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  if (!cleanPath) return [];
  // filter(Boolean) removes empty segments from double slashes
  return cleanPath.split("/").filter(Boolean).map(decodeURIComponent);
}

/**
 * Normalize the mods query parameter into a stable list.
 */
function normalizeMods(raw: string | null): string[] {
  if (!raw) return [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const modId = part.trim();
    if (!modId || modId === "bn" || seen.has(modId)) continue;
    seen.add(modId);
    normalized.push(modId);
  }
  return normalized;
}

function createRouteTarget(
  type: string | undefined,
  id: string | undefined,
): RouteTarget {
  if (type === "search") {
    return { kind: "search", query: id ?? "" };
  }

  if (type) {
    return id ? { kind: "item", type, id } : { kind: "catalog", type };
  }

  return { kind: "home" };
}

function parseRouteFromUrl(url: URL): ParsedRoute {
  const segments = getPathSegmentsFromPath(url.pathname);

  return {
    version: segments[0] || STABLE_VERSION,
    mods: normalizeMods(url.searchParams.get("mods")),
    locale: url.searchParams.get("lang"),
    tileset: url.searchParams.get("t"),
    target: createRouteTarget(segments[1], segments[2]),
  };
}

function readCurrentLocation(): PageState {
  const url = new URL(location.href);
  return {
    url,
    route: parseRouteFromUrl(url),
  };
}

/**
 * Get build timestamp for sorting
 */
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

/**
 * Pick the latest build matching a predicate
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
      !latest ||
      (ts >= latestTimestamp && compareBuildsDescending(build, latest) < 0)
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
 * Get a fallback version from the builds list
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

// ============================================================================
// State Management
// ============================================================================

function createPageStateFromLocation(): PageState {
  if (typeof window === "undefined") {
    return createEmptyPageState("http://localhost/");
  }

  return readCurrentLocation();
}

function createEmptyPageState(url: string): PageState {
  return {
    url: new URL(url),
    route: {
      version: STABLE_VERSION,
      mods: [],
      locale: null,
      tileset: null,
      target: { kind: "home" },
    },
  };
}

const _page = writable<PageState>(createPageStateFromLocation());

/**
 * Global store representing the current page state (URL and parsed route).
 * Updates whenever navigation occurs via the routing functions in this module.
 */
export const page: Readable<PageState> = { subscribe: _page.subscribe };

/**
 * Internal helper to update the page store
 */
function updatePageState() {
  _page.set(createPageStateFromLocation());
}

/**
 * Test helper: reset singleton store and module state between app mounts in routing tests.
 * @internal
 */
export function _reset() {
  debouncedReplaceState.cancel();
  updatePageState();
}

// ============================================================================
// Core Exported Utilities (Read/Compute)
// ============================================================================

/**
 * Gets the current URL and extract route information for the app
 *
 * @returns Parsed route state from the synchronized page store
 */
export function getRoute(): ParsedRoute {
  return get(_page).route;
}

/**
 * Get the current version slug from URL
 * This is what components should use to build relative URLs
 */
export function getCurrentVersionSlug(): string {
  return get(_page).route.version;
}

/**
 * Get the base path for the current version (e.g., "/stable/")
 * Use this when building href strings in templates
 */
export function getVersionedBasePath(): string {
  return BASE_URL + getCurrentVersionSlug() + "/";
}

/**
 * Build a clean URL from a route target and query-backed routing options.
 */
export function buildUrl(
  version: string,
  target: RouteTarget,
  options: BuildUrlOptions = {},
): string {
  const mods = options.mods ?? [];
  let path = BASE_URL + version + "/";

  if (target.kind === "catalog") {
    path += encodeURIComponent(target.type);
  } else if (target.kind === "item") {
    path += `${encodeURIComponent(target.type)}/${encodeURIComponent(target.id)}`;
  } else if (target.kind === "search") {
    path += target.query
      ? `search/${encodeURIComponent(target.query)}`
      : "search";
  }

  // Always use URL class for consistent encoding/formatting
  const url = new URL(path, location.origin);
  if (options.locale && options.locale !== "en") {
    url.searchParams.set("lang", options.locale);
  }
  if (options.tileset) {
    url.searchParams.set("t", options.tileset);
  }
  if (mods.length > 0) {
    url.searchParams.set("mods", mods.join(","));
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

type HistoryMode = "push" | "replace";

function navigateWithHistory(url: string, mode: HistoryMode): void {
  if (mode === "push") {
    history.pushState(null, "", url);
  } else {
    history.replaceState(null, "", url);
  }
  updatePageState();
}

function requiresHardNavigation(search: string): boolean {
  if (!search) {
    return false;
  }

  const searchParams = new URLSearchParams(search);
  return searchParams.has("lang") || searchParams.has("mods");
}

function buildUrlInCurrentContext(target: RouteTarget): string {
  const currentPageState = get(_page);
  return buildUrl(currentPageState.route.version, target, {
    locale: currentPageState.route.locale,
    tileset: currentPageState.route.tileset,
    mods: currentPageState.route.mods,
  });
}

function updateCurrentQueryParam(
  param: string,
  value: string | null,
  reload: boolean,
): void {
  debouncedReplaceState.cancel();

  const url = new URL(get(_page).url);

  if (value) {
    url.searchParams.set(param, value);
  } else {
    url.searchParams.delete(param);
  }

  if (reload) {
    location.href = url.toString();
    return;
  }

  navigateWithHistory(url.toString(), "replace");
}

/**
 * Debounced version of history.replaceState for search input updates
 * Prevents excessive history updates during rapid typing
 */
const debouncedReplaceState = debounce((url: string) => {
  navigateWithHistory(url, "replace");
}, 400);

/**
 * Update the URL to reflect a version change (causes full page reload)
 */
export function changeVersion(newVersion: string): void {
  const currentPageState = get(_page);
  location.href = buildUrl(newVersion, currentPageState.route.target, {
    locale: currentPageState.route.locale,
    tileset: currentPageState.route.tileset,
    mods: currentPageState.route.mods,
  });
}

/**
 * Update the URL to reflect a search query
 * Uses replaceState for search updates (no item), pushState when navigating from an item
 *
 * @param searchQuery - The search query string
 * @param currentTarget - The current target being viewed (if any)
 */
export function updateSearchRoute(
  searchQuery: string,
  currentTarget: RouteTarget,
): void {
  const nextTarget: RouteTarget = searchQuery
    ? { kind: "search", query: searchQuery }
    : { kind: "home" };
  const fullUrl = buildUrlInCurrentContext(nextTarget);
  const shouldPush =
    currentTarget.kind === "catalog" || currentTarget.kind === "item";

  if (shouldPush) {
    navigateWithHistory(fullUrl, "push");
  } else {
    debouncedReplaceState(fullUrl);
  }
}

/**
 * Update URL query parameters and reload (for language and mod changes)
 */
export function updateQueryParam(param: string, value: string | null): void {
  updateCurrentQueryParam(param, value, true);
}

/**
 * Update URL query parameters without reload (for tileset changes)
 */
export function updateQueryParamNoReload(
  param: string,
  value: string | null,
): void {
  updateCurrentQueryParam(param, value, false);
}

/**
 * Navigate to a new route without affecting query params
 */
export function navigateTo(target: RouteTarget): void {
  // Cancel any pending debounced URL updates - user is explicitly navigating
  debouncedReplaceState.cancel();

  navigateWithHistory(buildUrlInCurrentContext(target), "push");
}

/**
 * Handle click events on internal links for SPA navigation
 *
 * @param event - Mouse click event
 * @returns true if navigation was handled, false if default should proceed
 */
export function handleInternalNavigation(event: MouseEvent): boolean {
  const anchor = (event.target as Element).closest("a");

  // Ignore modified clicks (new tab, etc.)
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.defaultPrevented
  ) {
    return false;
  }

  // Check if this is an internal navigation
  if (anchor) {
    if (anchor.origin === location.origin && isPathUnderBase(anchor.pathname)) {
      const currentPageState = get(_page);

      // Version-aware navigation check:
      // If the target version differs from the current version, do NOT intercept.
      // Changing version requires a full page reload to load new game data.
      const currentVersion = currentPageState.route.version;
      const targetSegments = getPathSegmentsFromPath(anchor.pathname);
      const targetVersion = targetSegments[0] || STABLE_VERSION;

      if (targetVersion !== currentVersion) {
        return false;
      }

      event.preventDefault();
      // Cancel pending debounced updates
      debouncedReplaceState.cancel();
      // Use anchor's query params if present, otherwise preserve current
      const targetUrl =
        anchor.pathname + (anchor.search || currentPageState.url.search);
      if (requiresHardNavigation(anchor.search)) {
        location.assign(targetUrl);
        return true;
      }
      navigateWithHistory(targetUrl, "push");
      return true;
    }
  }

  return false;
}

// Listen for popstate events (browser back/forward)
if (typeof window !== "undefined") {
  const win = window as any;
  if (win.__routing_popstate_handler__) {
    window.removeEventListener("popstate", win.__routing_popstate_handler__);
  }
  win.__routing_popstate_handler__ = () => {
    updatePageState();
  };
  window.addEventListener("popstate", win.__routing_popstate_handler__);
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
  // Ensure page state is synced at startup
  updatePageState();
  const initialRoute = get(_page).route;
  const response = await fetch(BUILDS_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch builds: ${response.status} ${response.statusText}`,
    );
  }
  const builds: BuildInfo[] = await response.json();

  // Sort builds by date descending
  builds.sort(compareBuildsDescending);

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

  const requestedVersion = initialRoute.version;

  let resolvedVersion =
    resolveVersionAlias(
      requestedVersion,
      latestStableBuild,
      latestNightlyBuild,
    ) ?? fallbackVersion;

  let redirected = false;

  // Version validation and automatic /stable/ prefixing
  // If the first segment isn't a valid version (stable/nightly/v0.9.1), prepend /stable/
  // This simple heuristic handles:
  // - Data type paths: /mutation/ID → /stable/mutation/ID
  // - Typos: /stabke/item → /stable/stabke/item (404 with clear error)
  if (!versionExists(builds, resolvedVersion)) {
    console.warn(
      `Version "${resolvedVersion}" not found, prepending /stable/ to path`,
    );
    resolvedVersion = latestStableBuild?.build_number ?? fallbackVersion;

    // Preserve raw pathname to maintain URL encoding (e.g., %2F)
    // Using decoded segments would corrupt paths like /search/fire%2Faxe
    const rawRelativePath = stripBaseFromPathname(location.pathname);
    const cleanRawPath = rawRelativePath.startsWith("/")
      ? rawRelativePath.slice(1)
      : rawRelativePath;

    // Use location.replace() to force full page reload
    // history.replaceState() would only update URL without re-parsing route
    const newPath =
      BASE_URL + STABLE_VERSION + "/" + cleanRawPath + location.search;
    location.replace(newPath);

    // Return early - page will reload with the corrected URL
    redirected = true;
  }

  return {
    builds: builds,
    mods: initialRoute.mods,
    resolvedVersion: resolvedVersion,
    locale: initialRoute.locale,
    latestStableBuild: latestStableBuild,
    latestNightlyBuild: latestNightlyBuild,
    redirected: redirected,
  };
}
