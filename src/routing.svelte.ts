/**
 * Routing module - encapsulates raw URL parsing and history synchronization.
 *
 * Documentation: docs/routing.md
 */

import { BASE_URL } from "./utils/env";
import {
  buildsState,
  NIGHTLY_VERSION,
  STABLE_VERSION,
  tryResolveBuildVersion,
  type BuildsState,
} from "./builds.svelte";
import { isSupportedType } from "./supported-types";
import { debounce } from "./utils/debounce";

export type RouteTarget =
  | { kind: "home" }
  | { kind: "search"; query: string }
  | { kind: "catalog"; type: string }
  | { kind: "item"; type: string; id: string };

/**
 * Raw parsed URL route, no validation or verification.
 *
 * @internal
 */
export type URLRoute = {
  versionSlug: string;
  modsParam: string[];
  localeParam?: string;
  tilesetParam?: string;
  target: RouteTarget;
};

type PageState = {
  url: URL;
  route: URLRoute;
};

export type BuildURLOptions = Partial<
  Pick<URLRoute, "localeParam" | "tilesetParam" | "modsParam">
>;

// ============================================================================
// Internal Helper Functions
// ============================================================================

function stripBaseFromPathname(pathname: string): string {
  const baseURL = BASE_URL;
  const baseNoSlash = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;

  if (pathname === baseNoSlash) return "/";
  if (pathname.startsWith(baseURL)) return pathname.slice(baseURL.length - 1);
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

function isRouteHeadSegment(segment: string | undefined): boolean {
  return (
    segment === "search" || (segment !== undefined && isSupportedType(segment))
  );
}

function buildPathnameFromSegments(segments: string[]): string {
  const basePath = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;

  if (segments.length === 0) {
    return basePath;
  }

  const encodedPath = segments.map(encodeURIComponent).join("/");
  return segments.length === 1
    ? `${basePath}${encodedPath}/`
    : `${basePath}${encodedPath}`;
}

function buildRelativeURL(url: URL, segments: string[]): string {
  return buildPathnameFromSegments(segments) + url.search + url.hash;
}

/**
 * Canonicalize malformed version routes once build metadata is available.
 *
 * Rewrites missing-version deep links such as `/monster/zombie` to
 * `/nightly/monster/zombie`, and rewrites invalid explicit versions such as
 * `/bogus/monster/zombie` to `/nightly/monster/zombie`.
 *
 * The bare home route remains untouched, and any existing query string or hash
 * fragment is preserved in the returned URL.
 *
 * @param urlInput - Browser URL to inspect and potentially canonicalize
 * @param builds - Loaded build metadata used to validate version slugs
 * @returns Canonical relative URL when a rewrite is needed, otherwise `null`
 */
export function canonicalizeMalformedVersionURL(
  urlInput: string,
  builds: BuildsState,
): string | null {
  const url = new URL(urlInput, location.origin);
  const segments = getPathSegmentsFromPath(url.pathname);

  if (segments.length === 0) {
    return null;
  }

  const [firstSegment, ...restSegments] = segments;
  if (tryResolveBuildVersion(firstSegment, builds) !== undefined) {
    return null;
  }

  const rewrittenSegments = isRouteHeadSegment(firstSegment)
    ? [NIGHTLY_VERSION, ...segments]
    : [NIGHTLY_VERSION, ...restSegments];
  const canonicalURL = buildRelativeURL(url, rewrittenSegments);
  const currentURL = url.pathname + url.search + url.hash;

  return canonicalURL === currentURL ? null : canonicalURL;
}

export function parseRoute(urlInput: string): URLRoute {
  const url = new URL(urlInput, location.origin);
  const segments = getPathSegmentsFromPath(url.pathname);

  return {
    versionSlug: segments[0] || STABLE_VERSION,
    modsParam: normalizeMods(url.searchParams.get("mods")),
    localeParam: url.searchParams.get("lang") || undefined,
    tilesetParam: url.searchParams.get("t") || undefined,
    target: createRouteTarget(segments[1], segments[2]),
  };
}

function createPageState(urlInput: string): PageState {
  const url = new URL(urlInput, location.origin);
  return {
    url,
    route: parseRoute(urlInput),
  };
}

// ============================================================================
// State Management
// ============================================================================

function createPageStateFromLocation(): PageState {
  if (typeof window === "undefined") {
    return createEmptyPageState("http://localhost/");
  }

  return createPageState(location.href);
}

function createEmptyPageState(url: string): PageState {
  return {
    url: new URL(url),
    route: {
      versionSlug: STABLE_VERSION,
      modsParam: [],
      target: { kind: "home" },
    },
  };
}

export const page = $state<PageState>(createPageStateFromLocation());

function updatePageState(): PageState {
  const nextPageState = createPageStateFromLocation();
  page.url = nextPageState.url;
  page.route = nextPageState.route;
  return page;
}

/**
 * Test helper: reset singleton store and module state between app mounts in routing tests.
 * @internal
 */
export function _reset() {
  debouncedReplaceState.cancel();
  updatePageState();
}

export function initializeRouting(): URLRoute {
  return updatePageState().route;
}

/**
 * Build a clean URL from a route target and query-backed routing options.
 */
export function buildURL(
  versionSlug: string,
  target: RouteTarget,
  options: BuildURLOptions = {},
): string {
  const mods = normalizeMods((options.modsParam ?? []).join(","));
  let path = BASE_URL + versionSlug + "/";

  if (target.kind === "catalog") {
    path += encodeURIComponent(target.type);
  } else if (target.kind === "item") {
    path += `${encodeURIComponent(target.type)}/${encodeURIComponent(target.id)}`;
  } else if (target.kind === "search") {
    path += target.query
      ? `search/${encodeURIComponent(target.query)}`
      : "search";
  }

  const url = new URL(path, location.origin);
  if (options.localeParam && options.localeParam !== "en") {
    url.searchParams.set("lang", options.localeParam);
  }
  if (options.tilesetParam) {
    url.searchParams.set("t", options.tilesetParam);
  }
  if (mods.length > 0) {
    url.searchParams.set("mods", mods.join(","));
  }
  return url.pathname + url.search;
}

type HistoryMode = "push" | "replace";

function navigateWithHistory(url: string, mode: HistoryMode): void {
  if (mode === "push") {
    history.pushState(null, "", url);
  } else {
    history.replaceState(null, "", url);
  }
  updatePageState();
}

export function navigateToURL(url: string, mode: HistoryMode): void {
  debouncedReplaceState.cancel();
  navigateWithHistory(url, mode);
}

function sameOrderedStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function requiresHardNavigation(current: PageState, next: PageState): boolean {
  const currentPageState = current.route;
  const newPageState = next.route;

  return (
    currentPageState.versionSlug !== newPageState.versionSlug ||
    currentPageState.localeParam !== newPageState.localeParam ||
    !sameOrderedStrings(currentPageState.modsParam, newPageState.modsParam)
  );
}

/**
 * Debounced version of history.replaceState for search input updates
 * Prevents excessive history updates during rapid typing
 */
const debouncedReplaceState = debounce((url: string) => {
  navigateWithHistory(url, "replace");
}, 400);

export function replaceURLDebounced(url: string): void {
  debouncedReplaceState(url);
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
      const currentPageState = page;
      const newPageState = createPageState(anchor.href);
      if (requiresHardNavigation(currentPageState, newPageState)) {
        return false;
      }

      const targetURL = `${anchor.pathname}${anchor.search}`;
      event.preventDefault();
      navigateToURL(targetURL, "push");
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
    if (buildsState.current) {
      const canonicalURL = canonicalizeMalformedVersionURL(
        location.href,
        buildsState.current,
      );
      if (canonicalURL) {
        navigateToURL(canonicalURL, "replace");
        return;
      }
    }
    updatePageState();
  };
  window.addEventListener("popstate", win.__routing_popstate_handler__);
}
