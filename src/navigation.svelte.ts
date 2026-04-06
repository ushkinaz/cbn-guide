import { resolveTileset } from "./tile-data";
import {
  initializePreferences,
  preferences,
  setDefaultMods,
  setPreferredTileset,
} from "./preferences.svelte";
import {
  buildURL,
  canonicalizeMalformedVersionURL,
  initializeRouting,
  navigateToURL,
  page,
  replaceURLDebounced,
  type RouteTarget,
} from "./routing.svelte";
import {
  buildsState,
  initializeBuildsState,
  resolveBuildVersion,
} from "./builds.svelte";
import { initializeUILocale } from "./i18n/ui-locale";
import { DEFAULT_LOCALE } from "./constants";

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

  if (
    page.route.modsParam.length === 0 &&
    preferences.defaultMods !== null &&
    preferences.defaultMods.length > 0
  ) {
    const urlWithMods = buildURL(
      page.route.versionSlug,
      page.route.target,
      page.route.localeParam,
      page.route.tilesetParam,
      preferences.defaultMods,
    );
    navigateToURL(urlWithMods, "replace");
  }

  const versionState = await initializeBuildsState();

  const canonicalURL = canonicalizeMalformedVersionURL(
    location.href,
    versionState,
  );
  if (canonicalURL) {
    navigateToURL(canonicalURL, "replace");
  }

  await initializeUILocale(page.route.localeParam);
}
