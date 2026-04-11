<script lang="ts">
import * as Sentry from "@sentry/browser";
import Thing from "./Thing.svelte";
import { type CBNData, data, mapType, prewarmDerivedCaches } from "./data";
import { tileData, TILESETS } from "./tile-data";
import SearchResults from "./SearchResults.svelte";
import Catalog from "./Catalog.svelte";
import ModSelector from "./ModSelector.svelte";
import redditIcon from "./assets/icons/link-reddit.svg";
import bnIcon from "./assets/icons/link-bn.svg";
import discordIcon from "./assets/icons/link-discord.svg";
import catapultIcon from "./assets/icons/link-catapult.svg";
import { DEFAULT_LOCALE, GAME_REPO_URL, UI_GUIDE_NAME } from "./constants";
import { t } from "@transifex/native";
import {
  buildLinkTo,
  changeLanguage,
  changeMods,
  changeTileset,
  changeVersion,
  navigateTo,
  navigation,
  updateSearchRoute,
} from "./navigation.svelte";
import { handleInternalNavigation } from "./routing.svelte";
import {
  type BuildInfo,
  buildsState,
  isSupportedVersion,
  NIGHTLY_VERSION,
  STABLE_VERSION,
} from "./builds.svelte";

import { metrics } from "./metrics";
import { nowTimeStamp } from "./utils/perf";
import { searchState } from "./search-state.svelte";

import Logo from "./Logo.svelte";
import CategoryGrid from "./CategoryGrid.svelte";
import Loading from "./Loading.svelte";
import Spinner from "./Spinner.svelte";
import { fade } from "svelte/transition";
import { isNext, isTesting } from "./utils/env";
import MigoWarning from "./MigoWarning.svelte";
import Notification, { notify } from "./Notification.svelte";
import RenderErrorFallback from "./RenderErrorFallback.svelte";
import PageMeta from "./PageMeta.svelte";

import { resolveLocale } from "./i18n/game-locale";

let scrollY = $state(0);

const SEARCH_UI_CONTEXT = "Search UI";
const PWA_INSTALL_CONTEXT = "PWA Install";
const VERSION_SELECTOR_CONTEXT = "Version Selector";
const INTRO_DASHBOARD_CONTEXT = "Intro dashboard";
const LANGUAGE_SELECTOR_CONTEXT = "Language selector";
const PREWARM_IDLE_TIMEOUT_MS = 500;

function schedulePrewarm(cbnData: CBNData): void {
  if (isTesting || typeof window === "undefined") return;
  if (typeof window.requestIdleCallback !== "function") return;
  if (document.visibilityState !== "visible") return;

  const runPrewarm = () => {
    if (document.visibilityState !== "visible") return;
    const prewarmStart = nowTimeStamp();
    void prewarmDerivedCaches(cbnData)
      .then(() => {
        const durationMs = nowTimeStamp() - prewarmStart;
        metrics.duration("data.loot.prewarm", durationMs);
      })
      .catch((error: unknown) => {
        console.warn("Failed to prewarm derived caches", error);
      });
  };

  window.requestIdleCallback(runPrewarm, {
    timeout: PREWARM_IDLE_TIMEOUT_MS,
  });
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function routeSearchQuery(): string {
  return navigation.target.kind === "search" ? navigation.target.query : "";
}

let search: string = $state("");
let previousUrl: string | undefined = undefined;
let previousPathname: string | undefined = undefined;
let previousRouteSearch: string | undefined = undefined;

let builds: BuildInfo[] | null = $derived(buildsState.current?.builds ?? null);
let requestedVersion = $derived(navigation.buildRequestedVersion);
let resolvedVersion = $derived(navigation.buildResolvedVersion);
let latestStableBuild: BuildInfo | undefined = $derived(
  buildsState.current?.latestStableBuild,
);
let latestNightlyBuild: BuildInfo | undefined = $derived(
  buildsState.current?.latestNightlyBuild,
);
let prewarmScheduledFor: CBNData | null = null;
let lastDataLoadKey: string | null = $state(null);

function updateSentryContext(resolvedVersion?: string): void {
  if (resolvedVersion) {
    Sentry.setTag("resolvedVersion", resolvedVersion);
  }
  Sentry.setContext("routing", {
    resolvedVersion: resolvedVersion,
  });
}

$effect(() => {
  const currentUrl = navigation.url.href;
  const currentRouteSearch = routeSearchQuery();

  if (currentUrl !== previousUrl) {
    if (search !== currentRouteSearch) {
      search = currentRouteSearch;
    }

    previousUrl = currentUrl;
  }
});

// Force scroll to top when navigation changes the visible route.
$effect(() => {
  const currentPathname = navigation.url.pathname;
  const currentRouteSearch = routeSearchQuery();

  if (
    previousPathname !== undefined &&
    (currentPathname !== previousPathname ||
      currentRouteSearch !== previousRouteSearch)
  ) {
    window.scrollTo(0, 0);
  }

  previousPathname = currentPathname;
  previousRouteSearch = currentRouteSearch;
});

$effect(() => {
  updateSentryContext(navigation.buildResolvedVersion);
});

/**
 * Loads game data for the given version/locale/mods combination.
 * Handles the loadData call, Sentry capture, and user notification on error.
 */
async function loadDataForVersion(
  requestedVersion: string,
  requestedMods: string[],
  requestedLocale: string,
): Promise<void> {
  const dataLoadStart = nowTimeStamp();
  try {
    const result = await data.loadData(
      requestedVersion,
      requestedLocale,
      requestedMods,
    );
    if (!result) return; // Aborted by newer data load
  } catch (error) {
    const context = {
      dataLoad: {
        requestedVersion,
        requestedLocale,
        requestedMods,
      },
    };
    console.warn("Failed to load data", error);
    Sentry.captureException(error, {
      contexts: context,
    });
    notify(
      t(
        "Failed to load data for {version}. Please check your internet connection and try again. If the problem persists, please report it to the developer via Discord or GitHub.",
        { version: requestedVersion },
      ),
      "error",
    );
    return;
  }

  metrics.distribution(
    "data.load.duration_ms",
    nowTimeStamp() - dataLoadStart,
    { unit: "millisecond" },
  );
}

let gameLocale: string = $derived.by(() =>
  resolveLocale(navigation.locale, currentBuild?.langs ?? []),
);

let currentBuild: BuildInfo | undefined = $derived(
  buildsState.current?.builds.find(
    (build) => build.build_number === navigation.buildResolvedVersion,
  ),
);

let modsActiveCount = $derived($data?.activeMods().length ?? 0);

$effect(() => {
  if (!currentBuild || !navigation.buildResolvedVersion) {
    return;
  }

  const requestedStateKey = JSON.stringify({
    rq_v: navigation.buildRequestedVersion,
    rs_v: navigation.buildResolvedVersion,
    loc: gameLocale,
    mods: navigation.mods,
  });
  if (requestedStateKey === lastDataLoadKey) {
    return;
  }

  lastDataLoadKey = requestedStateKey;

  void (async () => {
    await loadDataForVersion(
      navigation.buildRequestedVersion,
      navigation.mods,
      gameLocale,
    );
  })();
});

$effect(() => {
  tileData.setTileset($data, navigation.tileset);
});

$effect(() => {
  searchState.sync(search, $data);
});

$effect(() => {
  if ($data && $data !== prewarmScheduledFor) {
    prewarmScheduledFor = $data;
    schedulePrewarm($data);
  }
});

const handleSearchInput = () => {
  updateSearchRoute(navigation.target, search);
};

const executeSearchAction = () => {
  // Flush any pending debounced search to ensure results are fresh
  searchState.flush();

  const firstResult = searchState.firstResult;
  if (firstResult) {
    metrics.count("search.result.open", 1, { method: "enter_key" });
    navigateTo({
      kind: "item",
      type: mapType(firstResult.type),
      id: firstResult.id,
    });
  }
};

const handleSearchKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && search && $data) {
    e.preventDefault(); // Prevent form submission
    executeSearchAction();
  }
};

let isModSelectorOpen = $state(false);

async function openModSelector(): Promise<void> {
  if (!$data) return;
  metrics.count("ui.modal.open", 1, { widget_id: "mod_selector" });
  isModSelectorOpen = true;
}

function closeModSelector(): void {
  isModSelectorOpen = false;
}

function applyMods(selectedMods: string[]): void {
  // Changing mods triggers a full page reload to ensure data consistency.
  isModSelectorOpen = false;
  metrics.gauge("data.mods.count", selectedMods.length);
  changeMods(selectedMods);
}

function handleNavigation(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const link = target.closest("a");
  if (link && link.hostname !== window.location.hostname) {
    metrics.count("ui.link.click", 1, {
      domain: link.hostname,
      type: "external",
    });
  }

  handleInternalNavigation(event);
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void> | void;
};

let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
function handleAppInstalled(): void {
  deferredPrompt = null;
  metrics.count("app.pwa.install");
}
function handleBeforeInstallPrompt(e: Event): void {
  deferredPrompt = e as BeforeInstallPromptEvent;
}
function maybeFocusSearch(e: KeyboardEvent): void {
  if (e.key === "/" && document.activeElement?.id !== "search") {
    document.getElementById("search")?.focus();
    e.preventDefault();
  }
}

function onItemBoundaryError(boundaryError: unknown): void {
  const error =
    boundaryError instanceof Error
      ? boundaryError
      : new Error(String(boundaryError));
  const target = navigation.target;
  metrics.count("app.error.catch", 1, {
    type:
      target.kind === "catalog" || target.kind === "item"
        ? target.type
        : "shell",
    id: target.kind === "item" ? target.id : "none",
  });
  const context = {
    route: {
      version: navigation.buildRequestedVersion,
      target: target,
    },
  };
  console.error(error, context);
  Sentry.captureException(error, {
    contexts: { context },
  });
}

/**
 * Returns the native name (endonym) of a language (e.g., "Deutsch" for "de").
 * Uses Intl.DisplayNames to auto-generate names without hardcoded lists.
 * Falls back to English or the raw code if strict native naming fails.
 */
function getLanguageName(code: string): string {
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
</script>

<svelte:window
  onclick={handleNavigation}
  onkeydown={maybeFocusSearch}
  onbeforeinstallprompt={handleBeforeInstallPrompt}
  onappinstalled={handleAppInstalled}
  bind:scrollY />

<PageMeta />

<Notification />
{#if isNext}
  <MigoWarning />
{/if}

<header>
  <nav>
    <div class="title">
      <a
        href={buildLinkTo({ kind: "home" })}
        class="brand-link"
        onclick={() => (search = "")}
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
            oninput={handleSearchInput}
            onkeydown={handleSearchKeydown}
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
                aria-label={t("Clear search", {
                  _context: SEARCH_UI_CONTEXT,
                })}
                onclick={() => {
                  search = "";
                  handleSearchInput();
                  document.getElementById("search")?.focus();
                }}>
                <span class="icon-text">✕</span>
              </button>

              {#if searchState.results && searchState.results.size > 0}
                <span class="separator"></span>
                <button
                  class="search-control-btn search-action-button"
                  tabindex="-1"
                  aria-label={t("Go to first result", {
                    _context: SEARCH_UI_CONTEXT,
                  })}
                  onmousedown={(e) => e.preventDefault()}
                  onclick={executeSearchAction}>
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
        onclick={openModSelector}
        disabled={!$data}
        aria-busy={!$data}
        aria-label={t("Mods ({count} active)", {
          count: modsActiveCount,
        })}>
        <span class="mods-button-inner">
          <span class="mods-button-normal" class:loading-hidden={!$data}>
            <span class="mods-label">{t("Mods")}</span>
            <span class="mods-count">[{modsActiveCount}]</span>
          </span>
          <span
            class="mods-button-loading"
            class:active={!$data}
            aria-hidden={$data !== null}>
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

{#if $data}
  <ModSelector
    open={isModSelectorOpen}
    rawModsJSON={$data.allMods()}
    selectedModIds={$data.activeMods()}
    onclose={closeModSelector}
    onapply={(mods) => applyMods(mods)} />
{/if}

<main>
  {#if navigation.target.kind === "catalog" || navigation.target.kind === "item"}
    {#if $data}
      {#key navigation.target}
        <svelte:boundary onerror={onItemBoundaryError}>
          {#if navigation.target.kind === "item"}
            <Thing item={navigation.target} data={$data} />
          {:else}
            <Catalog type={navigation.target.type} data={$data} />
          {/if}
          {#snippet failed(e)}
            <RenderErrorFallback
              data={$data}
              error={e}
              item={navigation.target.kind === "item"
                ? navigation.target
                : null} />
          {/snippet}
        </svelte:boundary>
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
      <SearchResults data={$data} {search} results={searchState.results} />
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
                onclick={(e) => {
                  e.preventDefault();
                  deferredPrompt?.prompt();
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
              >{t("Maintainer", {
                _context: INTRO_DASHBOARD_CONTEXT,
              })}:</span>
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
              >{t("Feedback", {
                _context: INTRO_DASHBOARD_CONTEXT,
              })}:</span>
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
      onclick={scrollToTop}
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
          <select
            id="version_select"
            aria-label={t("Version", { _context: VERSION_SELECTOR_CONTEXT })}
            value={requestedVersion}
            onchange={(e) => {
              const v = e.currentTarget.value;
              metrics.count("ui.version.change", 1, {
                from: navigation.buildRequestedVersion,
                to: v,
              });
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
            <option>{$data.buildVersion()}</option>
          </select>
        {/if}
      {:else}
        <select disabled><option>{t("Loading...")}</option></select>
      {/if}
    </div>
    <div class="select-group">
      <select
        id="tileset_select"
        aria-label={t("Tileset")}
        value={navigation.tileset}
        onchange={(e) => {
          const nextTileset = e.currentTarget.value ?? "";
          changeTileset(nextTileset);
          metrics.count("ui.tileset.change", 1, { tileset: nextTileset });
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
          value={navigation.locale}
          onchange={(e) => {
            const lang = e.currentTarget.value;
            changeLanguage(lang);
          }}>
          <option value={DEFAULT_LOCALE}>English</option>
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
  padding-right: 80px;

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

@media (max-width: 700px) {
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
    padding: 0.3rem 0.45rem;
  }

  .mods-label {
    display: none;
  }
}
</style>
