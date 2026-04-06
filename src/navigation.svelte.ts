import { resolveTileset } from "./tile-data";
import {
  initializePreferences,
  preferences,
  setDefaultMods,
  setPreferredTileset,
} from "./preferences.svelte";
import {
  buildURL,
  initializeRouting,
  navigateToURL,
  page,
  replaceURLDebounced,
  resolveVersionedPath,
  type RouteTarget,
} from "./routing.svelte";
import {
  buildsState,
  type BuildsState,
  initializeBuildsState,
  resolveBuildVersion,
} from "./builds.svelte";
import { initializeUILocale } from "./i18n/ui-locale";
import { DEFAULT_LOCALE } from "./constants";
import { BASE_URL } from "./utils/env";

type NavigationContext = {
  url: URL;
  buildRequestedVersion: string;
  buildResolvedVersion: string;
  locale: string;
  tileset: string;
  mods: string[];
  target: RouteTarget;
};

// ARCHITECTURE: Follows ADR-006 (Layered Navigation Bootstrap and Page Metadata).
// This read model combines raw route state, preferences, and build metadata so
// the rest of the UI does not need to re-derive effective navigation rules.
export const navigation: NavigationContext = {
  get url(): URL {
    return page.url;
  },
  get buildRequestedVersion(): string {
    return page.route.versionSlug;
  },
  get buildResolvedVersion(): string {
    return resolveBuildVersion(page.route.versionSlug, buildsState.current);
  },
  get locale(): string {
    return page.route.localeParam ?? DEFAULT_LOCALE;
  },
  get tileset(): string {
    return resolveTileset(
      preferences.preferredTileset,
      page.route.tilesetParam,
    );
  },
  get mods(): string[] {
    return page.route.modsParam;
  },
  get target(): RouteTarget {
    return page.route.target;
  },
};

/**
 * Non-reactive variant of linkTo, use only in imperative contexts
 * @param target
 */
export function buildLinkTo(target: RouteTarget): string {
  return buildURL(
    navigation.buildRequestedVersion,
    target,
    navigation.locale,
    navigation.tileset,
    navigation.mods,
  );
}

export function navigateTo(target: RouteTarget): void {
  navigateToURL(buildLinkTo(target), "push");
}

export function updateSearchRoute(
  currentTarget: RouteTarget,
  searchQuery: string,
): void {
  const nextTarget: RouteTarget = searchQuery
    ? { kind: "search", query: searchQuery }
    : { kind: "home" };
  const shouldPush =
    currentTarget.kind === "catalog" || currentTarget.kind === "item";
  const href = buildLinkTo(nextTarget);

  if (shouldPush) {
    navigateToURL(href, "push");
    return;
  }

  replaceURLDebounced(href);
}

/**
 * Changes the current tileset w/o reloading the page
 *
 */
export function changeTileset(tileset: string): void {
  if (setPreferredTileset(tileset)) {
    navigateToURL(
      buildURL(
        navigation.buildRequestedVersion,
        navigation.target,
        navigation.locale,
        tileset,
        navigation.mods,
      ),
      "replace",
    );
  }
}

/**
 * Changes the current language and reloads the page
 * @param locale
 */
export function changeLanguage(locale: string): void {
  location.href = buildURL(
    navigation.buildRequestedVersion,
    navigation.target,
    locale,
    navigation.tileset,
    navigation.mods,
  );
}

/**
 * Changes the current version and reloads the page
 * @param buildVersion
 */
export function changeVersion(buildVersion: string): void {
  location.href = buildURL(
    buildVersion,
    navigation.target,
    navigation.locale,
    navigation.tileset,
    navigation.mods,
  );
}

export function changeMods(mods: string[]): void {
  setDefaultMods(mods);
  location.href = buildURL(
    navigation.buildRequestedVersion,
    navigation.target,
    navigation.locale,
    navigation.tileset,
    mods,
  );
}

function stripBaseFromPathname(pathname: string): string {
  const baseNoSlash = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

  if (pathname === baseNoSlash) return "/";
  if (pathname.startsWith(BASE_URL)) return pathname.slice(BASE_URL.length - 1);
  if (pathname.startsWith(baseNoSlash + "/"))
    return pathname.slice(baseNoSlash.length);
  return pathname;
}

function hasVersionlessHomePath(pathname: string): boolean {
  const path = stripBaseFromPathname(pathname);
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return cleanPath.length === 0;
}

function buildCanonicalBootstrapURL(
  urlInput: string,
  builds: BuildsState,
): string {
  const currentURL = new URL(urlInput, location.origin);

  const canonicalPath = resolveVersionedPath(currentURL.pathname, builds);

  const canonicalMods =
    page.route.modsParam.length > 0
      ? page.route.modsParam
      : (preferences.defaultMods ?? []);

  const canonicalLocale = page.route.localeParam;

  const canonicalTileset = resolveTileset(
    preferences.preferredTileset,
    page.route.tilesetParam,
  );

  const builtCanonicalURL = new URL(
    buildURL(
      canonicalPath.versionSlug,
      canonicalPath.target,
      canonicalLocale,
      canonicalTileset,
      canonicalMods,
    ),
    location.origin,
  );

  // Preserve the root home route shape while still normalizing query-backed context.
  if (
    hasVersionlessHomePath(currentURL.pathname) &&
    canonicalPath.target.kind === "home"
  ) {
    builtCanonicalURL.pathname = currentURL.pathname;
  }

  builtCanonicalURL.hash = currentURL.hash;
  return (
    builtCanonicalURL.pathname +
    builtCanonicalURL.search +
    builtCanonicalURL.hash
  );
}

/**
 * Initializes the navigation prerequisites before the app shell mounts.
 *
 * Routing and preferences are available synchronously, build metadata is loaded
 * asynchronously, malformed version URLs are canonicalized once version aliases
 * can be resolved, and the UI locale is applied before the first render.
 */
export async function bootstrapApplication(): Promise<void> {
  initializeRouting();
  initializePreferences();
  const versionState = await initializeBuildsState();
  const canonicalURL = buildCanonicalBootstrapURL(location.href, versionState);
  const currentURL = location.pathname + location.search + location.hash;

  if (canonicalURL !== currentURL) {
    navigateToURL(canonicalURL, "replace");
  }

  await initializeUILocale(page.route.localeParam);
}
