<script lang="ts">
import * as Sentry from "@sentry/browser";
import Thing from "./Thing.svelte";
import { data, mapType, singularName } from "./data";
import {
  DEFAULT_TILESET,
  isValidTileset,
  tileData,
  TILESETS,
} from "./tile-data";
import SearchResults from "./SearchResults.svelte";
import Catalog from "./Catalog.svelte";
import ModSelector from "./ModSelector.svelte";
import redditIcon from "./assets/icons/link-reddit.svg";
import bnIcon from "./assets/icons/link-bn.svg";
import discordIcon from "./assets/icons/link-discord.svg";
import catapultIcon from "./assets/icons/link-catapult.svg";
import { GAME_REPO_URL, UI_GUIDE_NAME } from "./constants";
import { t } from "@transifex/native";
import { buildMetaDescription } from "./seo";
import {
  NIGHTLY_VERSION,
  STABLE_VERSION,
  type BuildInfo,
  type InitialAppState,
  buildUrl,
  changeVersion,
  getCurrentVersionSlug,
  getVersionedBasePath,
  getUrlConfig,
  handleInternalNavigation,
  initializeRouting,
  isSupportedType,
  isSupportedVersion,
  navigateTo,
  page,
  updateQueryParam,
  updateQueryParamNoReload,
  updateSearchRoute,
} from "./routing";

import { metrics } from "./metrics";
import { mark, nowTimeStamp } from "./utils/perf";
import { syncSearch, searchResults, flushSearch } from "./search";

import Logo from "./Logo.svelte";
import CategoryGrid from "./CategoryGrid.svelte";
import Loading from "./Loading.svelte";
import Spinner from "./Spinner.svelte";
import { fade } from "svelte/transition";
import { RUNNING_MODE } from "./utils/env";
import MigoWarning from "./MigoWarning.svelte";
import Notification, { notify } from "./Notification.svelte";

let scrollY = 0;

const SEARCH_UI_CONTEXT = "Search UI";
const PWA_INSTALL_CONTEXT = "PWA Install";
const VERSION_SELECTOR_CONTEXT = "Version Selector";
const SEARCH_RESULTS_CONTEXT = "Search Results";
const PAGE_DESCRIPTION_CONTEXT = "Page description";
const INTRO_DASHBOARD_CONTEXT = "Intro dashboard";
const LANGUAGE_SELECTOR_CONTEXT = "Language selector";
const URL_MODS_CONTEXT = "URL mods";

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let item: { type: string; id: string } | null = null;
let search: string = "";
$: item = $page.route.item;

// Track URL changes for navigation detection
let previousUrl: string | undefined = undefined;
let previousPathname: string | undefined = undefined;
let previousRouteSearch: string | undefined = undefined;

// Sync search and scroll on URL changes (navigation).
// IMPORTANT: Only update 'search' if it differs from page store to preserve user input
// while typing. This prevents the reactive statement from overwriting partial queries.
$: if ($page.url.href !== previousUrl) {
  const currentPathname = $page.url.pathname;
  const currentRouteSearch = $page.route.search;

  // On initial load OR URL changed - sync search (only if different)
  if (
    currentRouteSearch !== previousRouteSearch &&
    search !== currentRouteSearch
  ) {
    search = currentRouteSearch;
  }

  if (
    previousUrl !== undefined &&
    (currentPathname !== previousPathname ||
      currentRouteSearch !== previousRouteSearch)
  ) {
    // This is a navigation event (not initial load), scroll to top
    window.scrollTo(0, 0);
  }

  previousUrl = $page.url.href;
  previousPathname = currentPathname;
  previousRouteSearch = currentRouteSearch;
}

let builds: BuildInfo[] | null = null;

const requestedVersion = $page.route.version;
let resolvedVersion: string;
const isBranchAlias =
  requestedVersion === STABLE_VERSION || requestedVersion === NIGHTLY_VERSION;

let latestStableBuild: BuildInfo | undefined;
let latestNightlyBuild: BuildInfo | undefined;

// Initialize routing and fetch builds
const appStart = nowTimeStamp();
const p = mark("app-routing-start");
initializeRouting()
  .then((result: InitialAppState) => {
    builds = result.builds;
    resolvedVersion = result.resolvedVersion;
    latestStableBuild = result.latestStableBuild;
    latestNightlyBuild = result.latestNightlyBuild;
    const requestedModsFromUrl = [...$page.route.mods];

    data
      .setVersion(
        resolvedVersion,
        localeParam,
        isBranchAlias ? requestedVersion : undefined,
        builds.find((b) => b.build_number === resolvedVersion)?.langs,
        requestedModsFromUrl,
      )
      .then(() => {
        if ($data) {
          const resolvedMods = $data.active_mods ?? [];
          if (!arraysEqual(requestedModsFromUrl, resolvedMods)) {
            const removedMods = requestedModsFromUrl.filter(
              (modId) => !resolvedMods.includes(modId),
            );
            updateQueryParamNoReload(
              "mods",
              resolvedMods.length > 0 ? resolvedMods.join(",") : null,
            );
            if (removedMods.length > 0) {
              notify(
                t("Ignored unknown mods from URL: {mods}.", {
                  mods: removedMods.join(", "),
                  _context: URL_MODS_CONTEXT,
                }),
                "warn",
              );
            }
          }
        }

        if (
          $data &&
          $data.requested_locale !== $data.effective_locale &&
          $data.requested_locale !== "en"
        ) {
          const build_number = $data.build_number;
          const from = getLanguageName($data.requested_locale);
          const to = getLanguageName($data.effective_locale);
          notify(
            t(
              "Translation for {requested_lang} missing in {build_number}. Using {resolved_lang}.",
              {
                build_number: build_number,
                requested_lang: from,
                resolved_lang: to,
              },
            ),
            "warn",
          );
        }
        metrics.distribution(
          "data.load.duration_ms",
          nowTimeStamp() - appStart,
          {
            unit: "millisecond",
          },
        );
      })
      .catch((e) => {
        console.error(e);
        notify(
          t(
            "Failed to load data for {version}. Please select a different version from the footer.",
            { version: resolvedVersion },
          ),
          "error",
        );
      })
      .finally(() => {
        p.finish();
      });
  })
  .catch((e) => {
    Sentry.captureException(e);
    console.error(e);
    //TODO: Notify user, we failed to load our app.
  });

const urlConfig = getUrlConfig();
const localeParam = urlConfig.locale;
const tilesetParam = urlConfig.tileset;

function loadTileset(): string {
  try {
    const tilesetIDStorage =
      localStorage.getItem("cbn-guide:tileset") || DEFAULT_TILESET.name;
    if (isValidTileset(tilesetIDStorage)) {
      return tilesetIDStorage;
    }
  } catch (e) {
    /* swallow security errors, which can happen when in incognito mode */
  }
  return DEFAULT_TILESET.name;
}

function saveTileset(tileset: string | null) {
  try {
    if (isValidTileset(tileset)) {
      localStorage.setItem("cbn-guide:tileset", tileset!);
    } else {
      localStorage.removeItem("cbn-guide:tileset");
    }
  } catch (e) {
    /* swallow security errors, which can happen when in incognito mode */
  }
}

function setMetaDescription(value: string) {
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute("content", value);
    return;
  }
  const created = document.createElement("meta");
  created.name = "description";
  created.content = value;
  document.head.appendChild(created);
}

function setOgTitle(value: string) {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    ogTitle.setAttribute("content", value);
    return;
  }
  const created = document.createElement("meta");
  created.setAttribute("property", "og:title");
  created.content = value;
  document.head.appendChild(created);
}

let tileset: string =
  (isValidTileset(tilesetParam) ? tilesetParam : null) ?? loadTileset();

// React to tileset changes
$: tileData.setTileset($data, tileset);

function formatTitle(pageTitle: string | null = null): string {
  if (RUNNING_MODE !== "browser") {
    return pageTitle ?? "";
  }
  return pageTitle ? `${pageTitle} | ${UI_GUIDE_NAME}` : UI_GUIDE_NAME;
}

const defaultMetaDescription = t(
  "{guide} data reference for Cataclysm: Bright Nights.",
  {
    guide: UI_GUIDE_NAME,
  },
);

let metaDescription = defaultMetaDescription;

$: {
  if (
    item &&
    item.id &&
    $data &&
    isSupportedType(item.type) &&
    $data.byIdMaybe(item.type, item.id)
  ) {
    const it = $data.byId(item.type, item.id);
    document.title = formatTitle(singularName(it));
    metaDescription = buildMetaDescription(it);
  } else if (item && !item.id && item.type) {
    document.title = formatTitle(item.type);
    metaDescription = t("{type} catalog in {guide}.", {
      type: item.type,
      guide: UI_GUIDE_NAME,
      _context: PAGE_DESCRIPTION_CONTEXT,
    });
  } else if ($page.route.search) {
    const searchQuery = $page.route.search;
    document.title = formatTitle(
      `${t("Search:", { _context: SEARCH_RESULTS_CONTEXT })} ${searchQuery}`,
    );
    metaDescription = t("Search {guide} for {query}.", {
      guide: UI_GUIDE_NAME,
      query: searchQuery,
      _context: PAGE_DESCRIPTION_CONTEXT,
    });
  } else {
    document.title = formatTitle();
    metaDescription = defaultMetaDescription;
  }

  setOgTitle(document.title);
  if (metaDescription) setMetaDescription(metaDescription);
}

$: if ($data) {
  syncSearch(search, $data);
}

const handleSearchInput = () => {
  updateSearchRoute(search, $page.route.item);
};

const executeSearchAction = () => {
  // Flush any pending debounced search to ensure results are fresh
  flushSearch();

  const results = $searchResults;
  if (results && results.size > 0) {
    // Get the first item from the first group in the results
    const firstGroup = results.values().next().value;
    if (firstGroup && firstGroup.length > 0) {
      const firstResult = firstGroup[0];
      metrics.count("search.enter_navigation");
      navigateTo(
        getCurrentVersionSlug(),
        { type: mapType(firstResult.type), id: firstResult.id },
        "",
      );
    }
  }
};

const handleSearchKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && search && $data) {
    e.preventDefault(); // Prevent form submission
    executeSearchAction();
  }
};

let isModSelectorOpen = false;
let isModSelectorLoading = false;
let modSelectorError: string | null = null;

async function openModSelector(): Promise<void> {
  if (!$data) return;
  metrics.count("ui.mod_selector.click");

  modSelectorError = null;
  isModSelectorOpen = true;
  if ($data.mods !== null) return;

  isModSelectorLoading = true;
  try {
    await data.ensureModsLoaded();
  } catch (e) {
    console.error(e);
    modSelectorError = t("Failed to load mods. Please try again.");
  } finally {
    isModSelectorLoading = false;
  }
}

function closeModSelector(): void {
  isModSelectorOpen = false;
}

function applyMods(event: CustomEvent<string[]>): void {
  // Changing mods triggers a full page reload to ensure data consistency.
  isModSelectorOpen = false;
  const selectedMods = event.detail;
  metrics.gauge("data.mods.load", selectedMods.length);
  updateQueryParam(
    "mods",
    selectedMods.length > 0 ? selectedMods.join(",") : null,
  );
}

function handleNavigation(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const link = target.closest("a");
  if (link && link.hostname !== window.location.hostname) {
    metrics.count("ui.link.click", 1, {
      domain: link.hostname,
      type: "external",
    });
  }

  // Just call handleInternalNavigation; page store updates automatically
  handleInternalNavigation(event);
}

let deferredPrompt: any;
window.addEventListener("beforeinstallprompt", (e) => {
  deferredPrompt = e;
});

function maybeFocusSearch(e: KeyboardEvent) {
  if (e.key === "/" && document.activeElement?.id !== "search") {
    document.getElementById("search")?.focus();
    e.preventDefault();
  }
}

/**
 * Returns the native name (endonym) of a language (e.g., "Deutsch" for "de").
 * Uses Intl.DisplayNames to auto-generate names without hardcoded lists.
 * Falls back to English or the raw code if strict native naming fails.
 */
function getLanguageName(code: string) {
  const bcp47 = code.replace(/_/, "-");
  try {
    if (Intl?.DisplayNames) {
      // Use the language itself as the target locale to get the "Endonym"
      // e.g. 'ru' -> 'Русский', 'de' -> 'Deutsch'
      return (
        new Intl.DisplayNames([bcp47], {
          type: "language",
          fallback: "none",
        }).of(bcp47) || code
      );
    }
  } catch (e) {
    console.warn(`Failed to get language name for ${code}`, e);
  }
  return code;
}

$: canonicalUrl = buildUrl(
  STABLE_VERSION,
  $page.route.item,
  $page.route.search,
  localeParam,
  null,
  $page.route.mods,
);
</script>

<svelte:window
  on:click={handleNavigation}
  on:keydown={maybeFocusSearch}
  on:appinstalled={() => metrics.count("app.pwa.install")}
  bind:scrollY />

<svelte:head>
  {#if builds}
    <link rel="canonical" href={canonicalUrl} />
    {@const currentBuild = builds.find(
      (b) => b.build_number === resolvedVersion,
    )}
    {#if currentBuild}
      {#each [...(currentBuild.langs ?? [])].sort( (a, b) => a.localeCompare(b), ) as lang}
        <link
          rel="alternate"
          hreflang={lang.replace("_", "-")}
          href={buildUrl(
            getCurrentVersionSlug(),
            $page.route.item,
            $page.route.search,
            lang,
            null,
            $page.route.mods,
          )} />
      {/each}
    {/if}
  {/if}
</svelte:head>

<Notification />
{#if process.env.DEPLOY_NEXT === "1"}
  <MigoWarning />
{/if}

<header>
  <nav>
    <div class="title">
      <a
        href={getVersionedBasePath() + location.search}
        class="brand-link"
        on:click={() => (search = "")}
        ><span class="wide">{UI_GUIDE_NAME}</span><span class="narrow">HHG</span
        ></a>
    </div>
    <div class="search">
      <form role="search">
        <div class="search-input-wrapper">
          <input
            class="search-input"
            aria-label={t("Search", { _context: SEARCH_UI_CONTEXT })}
            placeholder={t("Search database...", {
              _context: SEARCH_UI_CONTEXT,
              _comment: "Placeholder text in the search box",
            })}
            type="search"
            enterkeyhint="go"
            bind:value={search}
            on:input={handleSearchInput}
            on:keydown={handleSearchKeydown}
            id="search" />

          <div class="search-controls">
            {#if !search}
              <span class="hotkey-hint">
                <span class="structure" aria-hidden="true">[</span>
                <kbd class="key">/</kbd>
                <span class="structure" aria-hidden="true">]</span>
              </span>
            {:else}
              <button
                type="button"
                class="search-control-btn search-clear-button"
                tabindex="-1"
                aria-label={t("Clear search", { _context: SEARCH_UI_CONTEXT })}
                on:click={() => {
                  search = "";
                  handleSearchInput();
                  document.getElementById("search")?.focus();
                }}>
                <span class="icon-text">✕</span>
              </button>

              {#if $searchResults && $searchResults.size > 0}
                <span class="separator"></span>
                <button
                  class="search-control-btn search-action-button"
                  tabindex="-1"
                  aria-label={t("Go to first result", {
                    _context: SEARCH_UI_CONTEXT,
                  })}
                  on:mousedown|preventDefault
                  on:click={executeSearchAction}>
                  <span class="structure" aria-hidden="true">[</span>
                  <kbd class="key" aria-hidden="true">⏎</kbd>
                  <span class="structure" aria-hidden="true">]</span>
                </button>
              {/if}
            {/if}
          </div>
        </div>
      </form>
    </div>
    <div class="header-actions">
      <button
        class="mods-button"
        type="button"
        on:click={openModSelector}
        disabled={!$data}
        aria-busy={isModSelectorLoading || !$data}
        aria-label={t("Mods ({count} active)", {
          count: $page.route.mods.length,
        })}>
        <span class="mods-button-inner">
          <span
            class="mods-button-normal"
            class:loading-hidden={isModSelectorLoading || !$data}>
            <span class="mods-label">{t("Mods")}</span>
            <span class="mods-count">[{String($page.route.mods.length)}]</span>
          </span>
          <span
            class="mods-button-loading"
            class:active={isModSelectorLoading || !$data}
            aria-hidden={!(isModSelectorLoading || !$data)}>
            <Spinner size={18} position="center" bounce={3} />
            <span class="mods-loading-label">
              {t("MODS", { _context: "Mods button" })}
            </span>
          </span>
        </span>
      </button>
    </div>
  </nav>
</header>

<ModSelector
  open={isModSelectorOpen}
  mods={$data?.mods ?? []}
  rawModsJson={$data?.raw_mods_json ?? {}}
  selectedModIds={$page.route.mods}
  loading={isModSelectorLoading}
  errorMessage={modSelectorError}
  on:close={closeModSelector}
  on:apply={applyMods} />

<main>
  {#if item}
    {#if $data}
      {#key item}
        {#if item.id}
          <Thing {item} data={$data} />
        {:else}
          <Catalog type={item.type} data={$data} />
        {/if}
      {/key}
    {:else}
      <Loading
        fullScreen={true}
        text={t("Loading {version} game data...", {
          version: resolvedVersion,
        })} />
    {/if}
  {:else if search}
    {#if $data}
      <SearchResults data={$data} {search} />
    {:else}
      <Loading
        fullScreen={true}
        text={t("Loading {version} game data...", {
          version: resolvedVersion,
        })} />
    {/if}
  {:else}
    <div class="intro-dashboard">
      <div class="intro-specs">
        <div class="spec-item">
          <span class="spec-label"
            >{t("NAME", { _context: INTRO_DASHBOARD_CONTEXT })}</span>
          <h1 class="guide-title">
            <span class="spec-value"
              >{t("The Hitchhiker's Guide", {
                _context: INTRO_DASHBOARD_CONTEXT,
              })}
            </span>
          </h1>
        </div>

        <div class="spec-item">
          <span class="spec-label"
            >{t("WIKI", { _context: INTRO_DASHBOARD_CONTEXT })}</span>
          <span class="spec-value">
            {t("Loot, Enemies, Drop Tables, Locations", {
              _context: INTRO_DASHBOARD_CONTEXT,
            })}
          </span>
        </div>
        <div class="spec-item">
          <span class="spec-label"
            >{t("TOOLS", { _context: INTRO_DASHBOARD_CONTEXT })}</span>
          <span class="spec-value">
            {t("Crafting, Recipes, Construction, Bionics", {
              _context: INTRO_DASHBOARD_CONTEXT,
            })}
          </span>
        </div>
        <div class="spec-item">
          <span class="spec-label"
            >{t("MODE", { _context: INTRO_DASHBOARD_CONTEXT })}</span>
          <span class="spec-value">
            {t("The definitive offline-capable database", {
              _context: INTRO_DASHBOARD_CONTEXT,
            })}&nbsp;{#if deferredPrompt}
              <button
                class="install-button"
                aria-label={t("install", { _context: PWA_INSTALL_CONTEXT })}
                on:click={(e) => {
                  e.preventDefault();
                  deferredPrompt.prompt();
                }}>
                <svg
                  class="icon-svg"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="2 2 20 18"
                  width="12"
                  height="12"
                  fill="currentColor">
                  <path
                    d="M2 4v14h20v-8h-2v6H4V6h10V4H2zm6 14h8v2H8v-2zm10-9l-4-4h3V2h2v5h3l-4 4z"
                    fill="currentColor"
                    fill-opacity="1" />
                </svg>
              </button>{/if}
          </span>
        </div>
        <div class="specs-footer">
          <div class="footer-item">
            <span class="spec-label"
              >{t("Maintainer", { _context: INTRO_DASHBOARD_CONTEXT })}:</span>
            <a href="https://github.com/ushkinaz" target="_blank">ushkinaz</a>
          </div>
          <div class="footer-item">
            <span class="spec-label"
              >{t("Code", { _context: INTRO_DASHBOARD_CONTEXT })}:</span>
            <a href="https://github.com/ushkinaz/cbn-guide/" target="_blank"
              >GitHub</a>
          </div>
          <div class="footer-item">
            <span class="spec-label"
              >{t("Feedback", { _context: INTRO_DASHBOARD_CONTEXT })}:</span>
            <a href="https://discord.gg/XW7XhXuZ89" target="_blank">Discord</a>
          </div>
        </div>
      </div>
      <div class="intro-manifest">
        <Logo />
      </div>
    </div>

    <CategoryGrid />
  {/if}
  {#if scrollY > 300}
    <button
      on:click={scrollToTop}
      transition:fade={{ duration: 200 }}
      aria-label={t("Scroll to top")}
      class="scroll-to-top">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="currentColor">
        <path d="M12 4l-8 8h6v8h4v-8h6z" />
      </svg>
    </button>
  {/if}
</main>
<footer>
  <div class="data-options">
    <div class="select-group">
      {#if $data || builds}
        {#if builds}
          <!-- svelte-ignore a11y-no-onchange -->
          <select
            id="version_select"
            aria-label={t("Version", { _context: VERSION_SELECTOR_CONTEXT })}
            value={requestedVersion}
            on:change={(e) => {
              const v = e.currentTarget.value;
              metrics.count("ui.version.change", 1, { v });
              changeVersion(v);
            }}>
            <optgroup
              label={t("Branch", { _context: VERSION_SELECTOR_CONTEXT })}>
              <option value={STABLE_VERSION}
                >{t("Stable", { _context: VERSION_SELECTOR_CONTEXT })} ({latestStableBuild?.build_number ??
                  "N/A"})</option>
              <option value={NIGHTLY_VERSION}
                >{t("Nightly", { _context: VERSION_SELECTOR_CONTEXT })} ({latestNightlyBuild?.build_number ??
                  "N/A"})</option>
            </optgroup>
            <optgroup
              label={t("Stable", { _context: VERSION_SELECTOR_CONTEXT })}>
              {#each builds.filter((b) => !b.prerelease && isSupportedVersion(b.build_number)) as build}
                <option value={build.build_number}>{build.build_number}</option>
              {/each}
            </optgroup>
            <optgroup
              label={t("Nightly", { _context: VERSION_SELECTOR_CONTEXT })}>
              {#each builds.filter((b) => b.prerelease) as build}
                <option value={build.build_number}>{build.build_number}</option>
              {/each}
            </optgroup>
          </select>
        {:else if $data}
          <select disabled>
            <option>{$data.build_number}</option>
          </select>
        {/if}
      {:else}
        <select disabled><option>{t("Loading...")}</option></select>
      {/if}
    </div>
    <div class="select-group">
      <!-- svelte-ignore a11y-no-onchange -->
      <select
        id="tileset_select"
        aria-label={t("Tileset")}
        value={tileset}
        on:change={(e) => {
          tileset = e.currentTarget.value ?? "";
          saveTileset(tileset);
          updateQueryParamNoReload("t", tileset);
          metrics.count("ui.tileset.change", 1, { tileset });
        }}>
        {#each TILESETS as { name, displayName }}
          <option value={name}>{displayName}</option>
        {/each}
      </select>
    </div>
    <div class="select-group">
      {#if builds}
        {@const build_number = resolvedVersion}
        <select
          id="language_select"
          aria-label={t("Language", { _context: LANGUAGE_SELECTOR_CONTEXT })}
          value={$data?.effective_locale || localeParam || "en"}
          on:change={(e) => {
            const lang = e.currentTarget.value;
            updateQueryParam("lang", lang === "en" ? null : lang);
          }}>
          <option value="en">English</option>
          {#each [...(builds.find((b) => b.build_number === build_number)?.langs ?? [])].sort( (a, b) => getLanguageName(a).localeCompare(getLanguageName(b)), ) as lang}
            <option value={lang}>{getLanguageName(lang)}</option>
          {/each}
        </select>
      {:else}
        <select disabled><option>{t("Loading...")}</option></select>
      {/if}
    </div>
  </div>

  <div id="links">
    <a
      href="{GAME_REPO_URL}#readme"
      target="_blank"
      rel="noopener"
      class="link">
      <img
        src={bnIcon}
        width="16"
        height="16"
        alt={t("Cataclysm BN icon")}
        class="icon" />
      Cataclysm BN</a>
    <a
      href="https://discord.gg/XW7XhXuZ89"
      target="_blank"
      rel="noopener"
      class="link">
      <img
        src={discordIcon}
        width="16"
        height="16"
        alt={t("Cataclysm BN icon")}
        class="icon" />
      Discord</a>
    <a
      href="https://www.reddit.com/r/cataclysmbn/"
      target="_blank"
      rel="noopener"
      class="link">
      <img
        src={redditIcon}
        width="16"
        height="16"
        alt={t("Reddit icon")}
        class="icon" />
      Reddit</a>
    <a
      href="https://github.com/qrrk/Catapult"
      target="_blank"
      rel="noopener"
      class="link">
      <img
        src={catapultIcon}
        width="16"
        height="16"
        alt={t("Catapult icon")}
        class="icon" />
      Catapult Launcher</a>
  </div>
  <div id="credits"></div>
</footer>

<style>
main {
  text-align: left;
  padding: 1em;
  max-width: 980px;
  margin: 4rem auto 0;
}

header {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  width: 100%;
  height: 4rem;
  background: #212121fa;
  border-top: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 calc(1em + 8px);
  box-sizing: border-box;
}

.brand-link {
  position: relative;
  color: var(--cata-color-gray);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.95rem;
  text-decoration: none;
  transition: color 0.15s ease;
}

/* THE BRACKETS */
.brand-link::before,
.brand-link::after {
  position: absolute;
  opacity: 0;
  color: var(--cata-color-dark_gray);
  font-weight: 400;
  transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
}

.brand-link::before {
  content: "[";
  left: -14px;
  transform: translateX(4px);
}

.brand-link::after {
  content: "]";
  right: -14px;
  transform: translateX(-4px);
}

/* THE INTERACTION */
.brand-link:hover {
  color: var(--cata-color-cyan); /* Text lights up */
}

.brand-link:hover::before,
.brand-link:hover::after {
  opacity: 1;
  transform: translateX(0); /* Snap into place */
}

nav {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

nav > .search {
  flex: 1;
  min-width: 0;
}

.header-actions {
  margin-left: 0.75rem;
  display: flex;
  align-items: center;
}

.mods-button {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  position: relative;
  min-height: 2.5rem;
  padding: 0.4rem 0.6rem;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 1px solid var(--cata-color-dark_gray);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  color: var(--cata-color-gray);
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

.mods-button:hover:not(:disabled) {
  border-color: var(--cata-color-cyan);
  color: var(--cata-color-cyan);
}

.mods-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mods-count {
  color: var(--cata-color-dark_gray);
}

.mods-button:hover:not(:disabled) .mods-count {
  color: var(--cata-color-gray);
}

.mods-button-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mods-loading-label {
  line-height: 1;
}

.mods-button-normal {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.mods-button-normal.loading-hidden {
  visibility: hidden;
}

.mods-button-loading {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  opacity: 0;
  pointer-events: none;
}

.mods-button-loading.active {
  opacity: 1;
}

kbd {
  /* Reset browser defaults */
  font-family: inherit;
  font-size: inherit;
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  margin: 0;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: auto;
  flex: 1;
  min-width: 200px;
  max-width: 600px;
}

.search-input {
  margin: 0;
  width: 100%;
  height: 40px;
  padding-right: 110px;

  background-color: rgba(0, 0, 0, 0.3); /* Semi-transparent depth */
  border: 1px solid var(--cata-color-dark_gray);
  color: var(--cata-color-white);
  border-radius: 4px;
  outline: none;

  transition:
    border-color 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    background-color 0.3s ease;
  animation: fadeIn 0.2s ease-out forwards;
}

.search-input:hover {
  border-color: color-mix(in srgb, var(--cata-color-cyan) 80%, transparent);
}

.search-input::placeholder {
  color: var(--cata-color-gray);
  opacity: 1; /* Firefox fix */
}

.search-input:focus {
  border-color: var(--cata-color-cyan);
  background-color: #000000;
  box-shadow: none;
}

.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.search-controls {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  z-index: 10;
}

.hotkey-hint {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.9rem;
  font-family: monospace;
  cursor: text;
  justify-content: center;
  height: 26px;
  padding: 0 4px;
  border-radius: 4px;
}

/* Hide hotkey hints on touch devices */
@media (hover: none) and (pointer: coarse) {
  .hotkey-hint {
    display: none !important;
  }
}

.hotkey-hint .structure {
  color: var(--cata-color-dark_gray);
}

.hotkey-hint .key {
  color: var(--cata-color-gray);
  font-weight: bold;
  font-family: monospace;
}

.search-control-btn {
  appearance: none;
  background: transparent;
  border: none;
  margin: 0;
  padding: 0 4px;

  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;

  display: flex;
  align-items: center;
  justify-content: center;

  font-family: monospace;
  font-size: 0.9rem;
  line-height: 1;
  transition: background-color 0.15s ease;
}

.search-control-btn:hover {
  background-color: color-mix(
    in srgb,
    var(--cata-color-dark_gray),
    transparent 80%
  );
}

.search-clear-button {
  color: var(--cata-color-gray);
}

.search-clear-button:hover {
  background-color: color-mix(
    in srgb,
    var(--cata-color-dark_gray),
    transparent 80%
  );
  color: var(--cata-color-white);
}

.search-clear-button .icon-text {
  transform: translateY(-1px);
  font-size: 1.1em;
}

.separator {
  display: block;
  width: 1px;
  height: 19px;
  background-color: var(--cata-color-dark_gray);
  opacity: 0.4;
  margin: 0 2px;
}

.search-action-button {
  gap: 2px;
}

.search-action-button:hover {
  color: var(--cata-color-cyan);
}

.search-action-button .structure {
  color: var(--cata-color-dark_gray);
  transition: color 0.15s;
}
.search-action-button .key {
  color: var(--cata-color-white);
  font-weight: bold;
  font-family: monospace;
  transition: color 0.15s;
}

.search-action-button:hover {
  background-color: color-mix(
    in srgb,
    var(--cata-color-dark_gray),
    transparent 80%
  );
}
.search-action-button:hover .structure {
  color: color-mix(in srgb, var(--cata-color-dark_gray), white 20%);
}
.search-action-button:hover .key {
  color: var(--cata-color-cyan);
}

nav > .title .narrow {
  display: none;
}

nav > .title {
  margin-right: 1em;
}

.intro-dashboard {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2rem;
  align-items: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: rgba(33, 33, 33, 0.4);
  border: 1px solid var(--cata-color-dark_gray);
  border-left: 3px solid var(--cata-color-cyan);
  border-radius: 0 4px 4px 0;
}

.intro-manifest {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

@media (max-width: 600px) {
}

.guide-title {
  /* h1 reset */
  margin: 0;
  padding: 0;
  border: none;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  font-family: inherit;
  color: inherit;

  display: inline;
  vertical-align: baseline;
}

.intro-specs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-family: monospace;
  font-size: 0.9rem;
}

.spec-item {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.spec-label {
  color: var(--cata-color-gray);
  font-weight: bold;
  white-space: nowrap;
}

.spec-value {
  color: var(--cata-color-gray);
}

@media (max-width: 600px) {
  .intro-dashboard {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    border-left: 1px solid var(--cata-color-dark_gray);
    border-top: 3px solid var(--cata-color-cyan);
  }
  .intro-manifest {
    justify-content: center;
    margin-top: 1rem;
  }
  .intro-manifest {
    display: none;
  }
  .specs-footer {
    flex-direction: column;
    gap: 0.25rem;
  }
  .footer-item:not(:last-child)::after {
    display: none;
  }
}

.specs-footer {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--cata-color-dark_gray);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
}

.footer-item {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
  white-space: nowrap;
}

.footer-item:not(:last-child)::after {
  content: "/";
  color: var(--cata-color-dark_gray);
  position: relative;
  left: 0.5rem;
  opacity: 0.5;
}

button.install-button {
  display: inline-flex;
  vertical-align: baseline;
  margin: 0;
  position: relative;

  white-space: nowrap;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;

  color: hsl(185deg, 45%, 45%);
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1;
  text-transform: uppercase;
  font-weight: bold;
  letter-spacing: 0.05em;

  align-items: center;
  /*gap: 4px;*/

  /* Smooth Fade In */
  animation: fadeIn 0.2s ease-out forwards;
}

button.install-button .icon-svg {
  display: inline-block;
  vertical-align: text-bottom;
}

button.install-button:hover {
  color: var(--cata-color-light_cyan);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.data-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 1em;
}

.select-group {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  flex: 1;
  min-width: 10rem;
  max-width: 15rem;
}

@media (max-width: 600px) {
  .data-options {
    flex-direction: column;
    align-items: center;
  }
  .select-group {
    width: 100%;
    margin-left: 0;
    margin-right: 0;
  }
}

.select-group select {
  margin: 0;
  width: 100%;
  font-size: 0.9rem;
  line-height: 1.5;
  padding: 4px 8px;
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  border: 1px solid var(--cata-color-dark_gray);
  transition:
    border-color 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    box-shadow 0.3s cubic-bezier(0.25, 1, 0.5, 1),
    background-color 0.3s ease;
}

.select-group select:hover {
  border-color: color-mix(in srgb, var(--cata-color-cyan) 80%, transparent);
}

.select-group select:focus {
  outline: none;
  border-color: var(--cata-color-cyan);
}

footer #links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  padding-top: 2rem;

  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 2rem;
  padding-bottom: 2rem;
}

footer .link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;

  font-family: monospace;
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  font-weight: 700;

  color: var(--cata-color-gray);

  /* RESET */
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  transition: color 0.2s ease;
  position: relative;
}

footer .link:hover {
  background-color: transparent;
  color: var(--cata-color-cyan);
}

footer .link .icon {
  margin-right: 8px;
  width: 14px;
  height: 14px;
  opacity: 0.6;
  transition:
    opacity 0.2s,
    filter 0.2s;
  filter: grayscale(100%);
}

footer .link:hover .icon {
  opacity: 1;
  filter: grayscale(0%);
}

footer .link::before {
  content: "[";
  margin-right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  color: var(--cata-color-dark_gray);
}
footer .link::after {
  content: "]";
  margin-left: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  color: var(--cata-color-dark_gray);
}

footer .link:hover::before,
footer .link:hover::after {
  opacity: 1;
}

.scroll-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 3rem;
  height: 3rem;

  border: 1px solid var(--cata-color-cyan);
  border-radius: 4px;
  background-color: var(--cata-color-black);
  color: var(--cata-color-cyan);

  z-index: 1000;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.2s,
    background-color 0.2s;
  padding: 0;
}

.scroll-to-top:hover {
  transform: translateY(-2px);
  background-color: var(--cata-color-cyan);
  color: var(--cata-color-black);
}

@media (max-width: 600px) {
  nav > .title .wide {
    display: none;
  }
  nav > .title .narrow {
    display: inline;
  }

  nav > .search {
    flex: 1;
  }

  .mods-button {
    min-height: 2.25rem;
    padding: 0.3rem 0.45rem;
  }

  .mods-label {
    display: none;
  }
}
</style>
