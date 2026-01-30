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
import InterpolatedTranslation from "./InterpolatedTranslation.svelte";
import redditIcon from "./assets/icons/link-reddit.svg";
import bnIcon from "./assets/icons/link-bn.svg";
import discordIcon from "./assets/icons/link-discord.svg";
import catapultIcon from "./assets/icons/link-catapult.svg";
import { GAME_REPO_URL, GUIDE_NAME, UI_GUIDE_NAME } from "./constants";
import { t } from "./i18n";
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
import { fade } from "svelte/transition";

let scrollY = 0;

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  metrics.count("scroll_to_top.use");
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

    data
      .setVersion(
        resolvedVersion,
        localeParam,
        isBranchAlias ? requestedVersion : undefined,
      )
      .then(() => {
        metrics.distribution("data.load_time", nowTimeStamp() - appStart, {
          unit: "millisecond",
        });
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

$: {
  if (item && item.id && $data && $data.byIdMaybe(item.type as any, item.id)) {
    const it = $data.byId(item.type as any, item.id);
    document.title = formatTitle(singularName(it));
  } else if (item && !item.id && item.type) {
    document.title = formatTitle(item.type);
  } else if ($page.route.search) {
    document.title = formatTitle(
      `${t("Search:", { _context: "Search Results" })} ${$page.route.search}`,
    );
  } else {
    document.title = formatTitle();
  }
  setOgTitle(document.title);
}

function formatTitle(it: string | null = null) {
  return `${it} | ${UI_GUIDE_NAME}`;
}

const defaultMetaDescription = t(
  "{guide} data reference for Cataclysm: Bright Nights.",
  {
    guide: UI_GUIDE_NAME,
  },
);

// Monitor storage usage once per session
try {
  navigator.storage.estimate().then((estimate) => {
    metrics.gauge("storage.usage_bytes", estimate?.usage ?? -1, {
      unit: "byte",
    });
  });
} catch (e) {
  /* ignore */
}

let metaDescription = defaultMetaDescription;

$: if (item && item.id && $data && $data.byIdMaybe(item.type as any, item.id)) {
  const it = $data.byId(item.type as any, item.id);
  metaDescription = buildMetaDescription(it);
} else if (item && !item.id && item.type) {
  metaDescription = t("{type} catalog in {guide}.", {
    type: item.type,
    guide: UI_GUIDE_NAME,
  });
} else if (search) {
  metaDescription = t("Search {guide} for {query}.", {
    guide: UI_GUIDE_NAME,
    query: search,
  });
} else {
  metaDescription = defaultMetaDescription;
}

$: if (metaDescription) setMetaDescription(metaDescription);

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
      const firstResult = firstGroup[0].item;
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

function handleNavigation(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const link = target.closest("a");
  if (link && link.hostname !== window.location.hostname) {
    metrics.count("external_link.click", 1, { domain: link.hostname });
  }

  // Just call handleInternalNavigation; page store updates automatically
  handleInternalNavigation(event);
}

function maybeFocusSearch(e: KeyboardEvent) {
  if (e.key === "/" && document.activeElement?.id !== "search") {
    document.getElementById("search")?.focus();
    e.preventDefault();
  }
}

function getLanguageName(code: string) {
  // from src/options.cpp
  return (
    {
      en: "English",
      ar: "العربية",
      cs: "Český Jazyk",
      da: "Dansk",
      de: "Deutsch",
      el: "Ελληνικά",
      es_AR: "Español (Argentina)",
      es_ES: "Español (España)",
      fr: "Français",
      hu: "Magyar",
      id: "Bahasa Indonesia",
      is: "Íslenska",
      it_IT: "Italiano",
      ja: "日本語",
      ko: "한국어",
      nb: "Norsk",
      nl: "Nederlands",
      pl_PL: "Polski",
      pt_BR: "Português (Brasil)",
      ru_RU: "Русский",
      sr: "Српски",
      tr: "Türkçe",
      uk: "Українська",
      uk_UA: "Українська",
      zh_CN: "中文 (天朝)",
      zh_TW: "中文 (台灣)",
    }[code] ??
    (Intl?.DisplayNames
      ? new Intl.DisplayNames([code.replace(/_/, "-")], {
          type: "language",
        }).of(code.replace(/_/, "-"))
      : code)
  );
}

$: canonicalUrl = buildUrl(
  STABLE_VERSION,
  $page.route.item,
  $page.route.search,
  localeParam,
);
</script>

<svelte:window
  on:click={handleNavigation}
  on:keydown={maybeFocusSearch}
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
          )} />
      {/each}
    {/if}
  {/if}
</svelte:head>

<header>
  <nav>
    <div class="title">
      <!-- svelte-ignore a11y-invalid-attribute -->
      <strong>
        <a
          href={getVersionedBasePath() + location.search}
          on:click={() => (search = "")}
          ><span class="wide">{UI_GUIDE_NAME}</span><span class="narrow"
            >HHG</span
          ></a>
      </strong>
    </div>
    <div class="search">
      <form role="search">
        <div class="search-input-wrapper">
          <input
            class="search-input"
            aria-label={t("Search")}
            placeholder={t("Search...", {
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
                aria-label={t("Clear search")}
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
                  aria-label={t("Go to first result")}
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
  </nav>
</header>

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
    <Logo />
    <p style="text-wrap: pretty">
      <InterpolatedTranslation
        str={t(
          `{hhg} is a comprehensive, offline-capable wiki for {link_cbn}.`,
          {
            hhg: "{hhg}",
            link_cbn: "{link_cbn}",
          },
        )}
        slot0="hhg"
        slot1="link_cbn">
        <span slot="0">{GUIDE_NAME}</span>
        <a
          slot="1"
          href="https://github.com/cataclysmbnteam/Cataclysm-BN#readme"
          style="text-wrap: nowrap">Cataclysm: Bright Nights</a>
      </InterpolatedTranslation>
    </p>
    <p style="text-wrap: pretty">
      <InterpolatedTranslation
        str={t(
          `Updated daily with full tileset support and data for both Stable and Nightly versions.
          Instantly search and cross-reference items, crafting recipes, drop rates, mutations, and bionics.`,
        )}>
      </InterpolatedTranslation>
    </p>
    <p style="text-wrap: pretty">
      <InterpolatedTranslation
        str={t(
          `All data is stored locally—just visit once and it works offline.`,
        )}>
      </InterpolatedTranslation>
    </p>

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
            aria-label={t("Version")}
            value={requestedVersion}
            on:change={(e) => {
              const v = e.currentTarget.value;
              metrics.count("version.change", 1, { v });
              changeVersion(v);
            }}>
            <optgroup label={t("Branch")}>
              <option value={STABLE_VERSION}
                >Stable ({latestStableBuild?.build_number ?? "N/A"})</option>
              <option value={NIGHTLY_VERSION}
                >Nightly ({latestNightlyBuild?.build_number ?? "N/A"})</option>
            </optgroup>
            <optgroup label={t("Stable")}>
              {#each builds.filter((b) => !b.prerelease && isSupportedVersion(b.build_number)) as build}
                <option value={build.build_number}>{build.build_number}</option>
              {/each}
            </optgroup>
            <optgroup label={t("Nightly")}>
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
          metrics.count("tileset.change", 1, { tileset });
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
          aria-label={t("Language")}
          value={localeParam || "en"}
          on:change={(e) => {
            const lang = e.currentTarget.value;
            updateQueryParam("lang", lang === "en" ? null : lang);
          }}>
          <option value="en">English</option>
          {#each [...(builds.find((b) => b.build_number === build_number)?.langs ?? [])].sort( (a, b) => a.localeCompare(b), ) as lang}
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
      rel="noopener noreferrer"
      class="link">
      <img
        src={bnIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      Cataclysm BN</a>
    <a
      href="https://discord.gg/XW7XhXuZ89"
      target="_blank"
      rel="noopener noreferrer"
      class="link">
      <img
        src={discordIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      Discord</a>
    <a
      href="https://www.reddit.com/r/cataclysmbn/"
      target="_blank"
      rel="noopener noreferrer"
      class="link">
      <img
        src={redditIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      Reddit</a>
    <a
      href="https://github.com/qrrk/Catapult"
      target="_blank"
      rel="noopener noreferrer"
      class="link">
      <img
        src={catapultIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      Catapult Launcher</a>
  </div>
  <div id="credits">
    <InterpolatedTranslation
      str={t(
        "Adopted to C:BN by {ushkinaz} on {github}. If you notice any problems, please file an {issue}!",
        {
          ushkinaz: "{ushkinaz}",
          github: "{github}",
          issue: "{issue}",
        },
      )}
      slot0="ushkinaz"
      slot1="github"
      slot2="issue">
      <a
        slot="0"
        href="https://github.com/ushkinaz"
        target="_blank"
        rel="noopener noreferrer">ushkinaz</a>
      <a
        slot="1"
        href="https://github.com/ushkinaz/cbn-guide/"
        target="_blank"
        rel="noopener noreferrer">GitHub</a>
      <a
        slot="2"
        href="https://github.com/ushkinaz/cbn-guide/issues/new?type=bug"
        >{t("issue")}</a>
    </InterpolatedTranslation>
  </div>
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
  box-shadow: 0px 0px 8px rgba(0, 0, 0, 0.5);
  width: 100%;
  height: 4rem;
  background: rgba(33, 33, 33, 0.98);
  padding: 0 calc(1em + 8px);
  box-sizing: border-box;
}

nav {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
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
  width: 100%;
}

.search-input {
  margin: 0;
  width: 100%;
  height: 40px;
  padding-right: 110px;
}

/* Hide native clear button */
.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

/* State Swap Logic Styles */
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

.hotkey-hint .structure {
  color: var(--cata-color-dark_gray);
}

.hotkey-hint .key {
  color: var(--cata-color-gray);
  font-weight: bold;
  font-family: monospace;
}

.search-control-btn {
  /* Reset */
  appearance: none;
  background: transparent;
  border: none;
  margin: 0;
  padding: 0 4px;

  /* Size & Layout */
  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;

  display: flex;
  align-items: center;
  justify-content: center;

  /* Typography */
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
}

footer {
  text-align: left;
  padding: 1em;
  max-width: 980px;
  margin: 2rem auto 0;
}

footer #links {
  text-decoration: none;
  padding-top: 2rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem;
}

footer .link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: var(--cata-color-light_gray);
  padding: 0.5em 0.75em;
  border-radius: 4px;
  transition: background-color 0.2s;
  white-space: nowrap;
}

footer .link:hover {
  background-color: rgba(255, 255, 255, 0.05);
  text-decoration: none;
  color: var(--cata-color-white);
}

footer .link .icon {
  margin-right: 0.5em;
  display: block;
}

footer #credits {
  font-size: 0.6em;
  color: var(--cata-color-dark_gray);
  margin: 1rem auto 0;
  text-align: center;
}

footer #credits a {
  text-decoration: none;
  color: var(--cata-color-gray);
}

footer #credits a:hover {
  text-decoration: underline;
}

.data-options {
  display: flex;
  flex-wrap: wrap;
  gap: 20px; /* Space between select groups */
  align-items: center;
  justify-content: center;
}

.scroll-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: none;
  background-color: var(--cata-color-cyan);
  color: var(--cata-color-black);
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
  background-color: var(--cata-color-light_cyan);
}

.select-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.select-group select {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.select-group select {
  padding: 4px 8px;
  min-width: 15rem;
}
</style>
