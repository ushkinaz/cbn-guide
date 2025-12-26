<script lang="ts">
import Thing from "./Thing.svelte";
import { data, loadProgress, singularName, versionSlug } from "./data";
import { tileData } from "./tile-data";
import SearchResults from "./SearchResults.svelte";
import Catalog from "./Catalog.svelte";
import InterpolatedTranslation from "./InterpolatedTranslation.svelte";
import redditIcon from "./assets/icons/link-reddit.svg";
import bnIcon from "./assets/icons/link-bn.svg";
import discordIcon from "./assets/icons/link-discord.svg";
import catapultIcon from "./assets/icons/link-catapult.svg";
import {
  BUILDS_URL,
  GAME_REPO_URL,
  getTilesetUrl,
  GUIDE_NAME,
  TILESETS,
} from "./constants";
import { t } from "@transifex/native";
import debounce from "lodash/debounce";

import Logo from "./Logo.svelte";
import CategoryGrid from "./CategoryGrid.svelte";

let item: { type: string; id: string } | null = null;

let builds:
  | {
      build_number: string;
      prerelease: boolean;
      created_at: string;
      langs?: string[];
    }[]
  | null = null;

const url = new URL(location.href);

// helper to get path segments relative to BASE_URL
function getPathSegments(): string[] {
  const path = location.pathname.slice(import.meta.env.BASE_URL.length - 1);
  // remove the leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  if (!cleanPath) return [];
  return cleanPath.split("/").map(decodeURIComponent);
}

const stableVersion = "stable";
const nightlyVersion = "nightly";
const latestVersion = "latest";

function isValidVersionSlug(s: string): boolean {
  if (!s) return false;
  if ([stableVersion, nightlyVersion, latestVersion].includes(s)) return true;
  return /^\d/.test(s) || /^v\d/.test(s);
}

// A valid version might be 'stable', 'nightly', or a build number.
let segments = getPathSegments();
let versionParam = segments[0];

// If the first segment looks like a version, use it.
// Otherwise, assume the user omitted the version and wants stable.
if (versionParam && !isValidVersionSlug(versionParam)) {
  // Redirect to /stable/...
  const newPath =
    import.meta.env.BASE_URL + "stable/" + segments.join("/") + location.search;
  location.replace(newPath);
  // Stop processing (the reload will happen momentarily)
  versionParam = stableVersion; // failsafe
} else {
  versionParam = versionParam || stableVersion;
}

function getCurrentVersionSlug(): string {
  const s = getPathSegments();
  return s[0] || stableVersion;
}

// Map "latest" to "nightly"
const requestedVersion =
  versionParam === latestVersion ? nightlyVersion : versionParam;
let version = stableVersion; // Default for initial reactive state

fetch(BUILDS_URL)
  .then((d) => d.json())
  .then((b) => {
    builds = b;
    // Resolve version aliases
    if (requestedVersion === stableVersion) {
      version =
        b.find((build: any) => !build.prerelease)?.build_number ??
        b[0].build_number;
    } else if (requestedVersion === nightlyVersion) {
      version = b[0].build_number;
    } else {
      version = requestedVersion;
    }

    // Verify if the version actually exists in the build list
    const versionExists = b.some(
      (build: any) => build.build_number === version,
    );
    if (!versionExists) {
      console.warn(
        `Version ${version} not found in builds list, falling back to stable.`,
      );
      version =
        b.find((build: any) => !build.prerelease)?.build_number ??
        b[0].build_number;
      // Also fix the URL if we are falling back
      const newPath =
        import.meta.env.BASE_URL +
        stableVersion +
        "/" +
        segments.slice(1).join("/") +
        location.search;
      history.replaceState(null, "", newPath);
      versionSlug.set(stableVersion);
    }

    data.setVersion(version, locale);
  })
  .catch((e) => {
    console.error(e);
    // Fallback if builds list fails to load entirely
    // We can't really validate against the list if we don't have it.
    // But we can try to proceed or just default.
    version = requestedVersion;
    data.setVersion(version, locale);
  });

const locale = url.searchParams.get("lang");

const tilesets = TILESETS;

const ASCII_TILESET = "-";
const DEFAULT_TILESET = ASCII_TILESET;

const normalizeTemplate = (t: string) => (t === "null" || !t ? "" : t);

function loadTileset(): string {
  try {
    const tilesetIDStorage =
      localStorage.getItem("cbn-guide:tileset") || DEFAULT_TILESET;
    if (isValidTileset(tilesetIDStorage)) {
      return tilesetIDStorage;
    }
  } catch (e) {
    /* swallow security errors, which can happen when in incognito mode */
  }
  return DEFAULT_TILESET;
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

function isValidTileset(tilesetID: string | null) {
  return (
    (tilesetID && tilesetID === ASCII_TILESET) ||
    tilesets.some((t) => t.name === tilesetID)
  );
}

const tilesetParam = url.searchParams.get("t");

let tileset: string =
  (isValidTileset(tilesetParam) ? tilesetParam : null) ?? loadTileset();
let tilesetUrlTemplate: string = "";

$: tilesetUrlTemplate = normalizeTemplate(
  (() => {
    const t = tilesets.find((t) => t.name === tileset);
    return t ? getTilesetUrl("{version}", t.path) : "";
  })(),
);
$: tilesetUrl = $data
  ? (tilesetUrlTemplate?.replace("{version}", $data.build_number!) ?? null)
  : null;
$: tileData.setURL(tilesetUrl);

function decodeQueryParam(p: string) {
  return decodeURIComponent(p.replace(/\+/g, " "));
}

function load() {
  const segs = getPathSegments();
  // Expected structure: [version, type, id] or [version, 'search', query]
  // or just [version]

  // Set version slug
  const newVersionParam = getCurrentVersionSlug();
  versionSlug.set(newVersionParam);

  // If we simply have a version, we might want to reload data if it changed?
  // The initial fetch above handles the initial load.
  // If navigation happens between versions, we might need to trigger data reload.
  // However, for now, let's just handle parsing.

  // We assume the first segment is the version.
  const type = segs[1];
  const id = segs[2];

  if (type === "search") {
    item = null;
    search = id ? decodeQueryParam(id) : "";
  } else if (type) {
    item = { type, id: id ? decodeQueryParam(id) : "" };
  } else {
    // Home page
    item = null;
    search = "";
  }

  window.scrollTo(0, 0);
}

$: if (item && item.id && $data && $data.byIdMaybe(item.type as any, item.id)) {
  const it = $data.byId(item.type as any, item.id);
  document.title = `${singularName(it)} - ` + GUIDE_NAME;
} else if (item && !item.id && item.type) {
  document.title = `${item.type} - ` + GUIDE_NAME;
} else {
  document.title = GUIDE_NAME;
}

let search: string = "";

load();

// Throttle replaceState to avoid browser warnings.
// |debounce| isn't defined when running tests for some reason.
const replaceState = debounce
  ? debounce(history.replaceState.bind(history), 400, {
      trailing: true,
    })
  : history.replaceState.bind(history);

const handleSearchInput = () => {
  // The current version is used in the path
  const currentVer = getCurrentVersionSlug();

  // Construct a new path
  let newPath = import.meta.env.BASE_URL + currentVer + "/";
  if (search) {
    newPath += "search/" + encodeURIComponent(search);
  }

  if (item) history.pushState(null, "", newPath + location.search);
  else replaceState(null, "", newPath + location.search);
  item = null;
};

function maybeNavigate(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest("a") as HTMLAnchorElement | null;
  if (anchor && anchor.href) {
    const { origin, pathname } = new URL(anchor.href);
    if (
      origin === location.origin &&
      pathname.startsWith(import.meta.env.BASE_URL)
    ) {
      event.preventDefault();
      history.pushState(null, "", pathname + location.search);
      load();
    }
  }
}

window.addEventListener("popstate", () => {
  load();
});

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
      ? new Intl.DisplayNames([code.replace(/_/, ASCII_TILESET)], {
          type: "language",
        }).of(code.replace(/_/, ASCII_TILESET))
      : code)
  );
}

// This is one character behind the actual search value, because
// of the throttle, but eh, it's good enough.
let currentHref = location.href;
$: (item, search, (currentHref = location.href));

function getCleanUrl(
  _ver: string,
  _item: typeof item,
  _search: string,
  _locale: string | null,
): string {
  let path = import.meta.env.BASE_URL + _ver + "/";

  if (_item) {
    if (_item.type && _item.id) {
      path +=
        encodeURIComponent(_item.type) + "/" + encodeURIComponent(_item.id);
    } else if (_item.type) {
      path += encodeURIComponent(_item.type);
    }
  } else if (_search) {
    path += "search/" + encodeURIComponent(_search);
  }

  const u = new URL(path, location.origin);

  if (_locale && _locale !== "en") {
    u.searchParams.set("lang", _locale);
  }

  return u.toString();
}

$: canonicalUrl = getCleanUrl(stableVersion, item, search, locale);

function isSupportedVersion(buildNumber: string): boolean {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(buildNumber);
  if (!match) return false;
  const [, major, minor] = match;
  //0.7.0 or later
  return parseInt(major) > 0 || (parseInt(major) === 0 && parseInt(minor) >= 7);
}
</script>

<svelte:window on:click={maybeNavigate} on:keydown={maybeFocusSearch} />

<svelte:head>
  {#if builds}
    <link rel="canonical" href={canonicalUrl} />
    {@const currentBuild = builds.find((b) => b.build_number === version)}
    {#if currentBuild}
      {#each [...(currentBuild.langs ?? [])].sort( (a, b) => a.localeCompare(b), ) as lang}
        <link
          rel="alternate"
          hreflang={lang.replace("_", "-")}
          href={getCleanUrl($versionSlug, item, search, lang)} />
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
          href={import.meta.env.BASE_URL + location.search}
          on:click={() => (search = "")}
          ><span class="wide">{GUIDE_NAME}</span><span class="narrow">HHG</span
          ></a>
      </strong>
    </div>
    <div class="search">
      <form role="search">
        <input
          style="margin: 0; width: 100%"
          placeholder={t("Search...", {
            _comment: "Placeholder text in the search box",
          })}
          type="search"
          bind:value={search}
          on:input={handleSearchInput}
          id="search" />
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
      <span style="color: var(--cata-color-gray)">
        <em>{t("Loading...")}</em>
        {#if $loadProgress}
          ({($loadProgress[0] / 1024 / 1024).toFixed(1)}/{(
            $loadProgress[1] /
            1024 /
            1024
          ).toFixed(1)} MB)
        {/if}
      </span>
    {/if}
  {:else if search}
    {#if $data}
      {#key search}
        <SearchResults data={$data} {search} />
      {/key}
    {:else}
      <span style="color: var(--cata-color-gray)">
        <em>{t("Loading...")}</em>
        {#if $loadProgress}
          ({($loadProgress[0] / 1024 / 1024).toFixed(1)}/{(
            $loadProgress[1] /
            1024 /
            1024
          ).toFixed(1)} MB)
        {/if}
      </span>
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
          `Updated daily, it features full tileset support and data for both Stable and Nightly versions.
          Instantly search and cross-reference items, crafting recipes, drop rates, mutations, and bionics.`,
        )}>
      </InterpolatedTranslation>
    </p>
    <p style="text-wrap: pretty">
      <InterpolatedTranslation
        str={t(
          `The Guide stores all its data locally—just visit the page once and it will work even without internet access.`,
        )}>
      </InterpolatedTranslation>
      {#if deferredPrompt}
        <InterpolatedTranslation
          str={t(
            `It is also {installable_button}, so you can pop it out of your browser and use it like a regular app on your home screen or desktop.`,
            { installable_button: "{installable_button}" },
          )}
          slot0="installable_button">
          <button
            slot="0"
            class="disclosure"
            on:click={(e) => {
              e.preventDefault();
              deferredPrompt.prompt();
            }}>{t("installable")}</button>
        </InterpolatedTranslation>
      {/if}
    </p>

    <CategoryGrid />
  {/if}
</main>
<footer>
  <div class="data-options">
    <div class="select-group">
      <label for="version_select">{t("Version:")}</label>
      {#if $data || builds}
        {#if builds}
          <!-- svelte-ignore a11y-no-onchange -->
          <select
            id="version_select"
            value={requestedVersion}
            on:change={(e) => {
              const v = e.currentTarget.value;
              // Redirect to a new version
              const segs = getPathSegments();
              segs[0] = v;
              // If we were on the home page (segs length 1 or 0), just go to version root
              if (segs.length === 0) segs.push(v);

              const newPath = import.meta.env.BASE_URL + segs.join("/");
              location.href = newPath + location.search;
            }}>
            <optgroup label={t("Branch")}>
              <option value={stableVersion}
                >Stable ({builds.find((b) => !b.prerelease)?.build_number ??
                  "N/A"})</option>
              <option value={nightlyVersion}
                >Nightly ({builds.find((b) => b.prerelease)?.build_number ??
                  "N/A"})</option>
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
        <em style="color: var(--cata-color-gray)">({t("Loading...")})</em>
      {/if}
    </div>
    <div class="select-group">
      <label for="tileset_select">{t("Tileset:")}</label>
      <!-- svelte-ignore a11y-no-onchange -->
      <select
        id="tileset_select"
        value={tileset}
        on:change={(e) => {
          tileset = e.currentTarget.value ?? "";
          saveTileset(tileset);
          const url = new URL(location.href);
          url.searchParams.set("t", tileset);
          location.href = url.toString();
        }}>
        <option value={ASCII_TILESET}>None (ASCII)</option>
        {#each tilesets as { name }}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </div>
    <div class="select-group">
      <label for="language_select">{t("Language:")}</label>
      {#if builds}
        {@const build_number = version}
        <select
          id="language_select"
          value={locale || "en"}
          on:change={(e) => {
            const url = new URL(location.href);
            const lang = e.currentTarget.value;
            if (lang === "en") url.searchParams.delete("lang");
            else url.searchParams.set("lang", lang);
            location.href = url.toString();
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
        `Based on {link_original} by {link_nornagon}, updated for BN by {link_mythosmod}. Currently maintained by {link_ushkinaz} on {link_github}.
        If you notice any problems with this version, please {link_file_an_issue}!`,
        {
          link_original: "{link_original}",
          link_nornagon: "{link_nornagon}",
          link_mythosmod: "{link_mythosmod}",
          link_ushkinaz: "{link_ushkinaz}",
          link_github: "{link_github}",
          link_file_an_issue: "{link_file_an_issue}",
        },
      )}
      slot0="link_original"
      slot1="link_nornagon"
      slot2="link_mythosmod"
      slot3="link_ushkinaz"
      slot4="link_github"
      slot5="link_file_an_issue">
      Based on the .
      <a
        slot="0"
        href="https://cdda-guide.nornagon.net/"
        target="_blank"
        rel="noopener noreferrer">C:DDA guide</a>
      <a
        slot="1"
        href="https://www.nornagon.net"
        target="_blank"
        rel="noopener noreferrer">nornagon</a>
      <a
        slot="2"
        href="https://github.com/mythosmod/cbn-guide"
        target="_blank"
        rel="noopener noreferrer">MythosMod</a>
      <a
        slot="3"
        href="https://github.com/ushkinaz"
        target="_blank"
        rel="noopener noreferrer">ushkinaz</a>
      <a
        slot="4"
        href="https://github.com/ushkinaz/cbn-guide/"
        target="_blank"
        rel="noopener noreferrer">GitHub</a>
      <a
        slot="5"
        href="https://github.com/ushkinaz/cbn-guide/issues/new?type=bug"
        >{t("file an issue")}</a>
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

nav > .search {
  flex: 1;
  max-width: calc(0.5 * 980px);
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

.select-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.select-group label,
.select-group select {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.select-group select {
  padding: 4px 8px;
  min-width: 180px;
}
</style>
