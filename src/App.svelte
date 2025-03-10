<script lang="ts">
import Thing from "./Thing.svelte";
import { CddaData, data, loadProgress, mapType, singularName } from "./data";
import { tileData } from "./tile-data";
import SearchResults from "./SearchResults.svelte";
import Catalog from "./Catalog.svelte";
import dontPanic from "./assets/dont_panic.png";
import InterpolatedTranslation from "./InterpolatedTranslation.svelte";
import redditIcon from "./assets/icons/link-reddit.svg";
import bnIcon from "./assets/icons/link-bn.svg";
import discordIcon from "./assets/icons/link-discord.svg";
import catapultIcon from "./assets/icons/link-catapult.svg";
import { GUIDE_NAME } from "./constants";
import { t } from "@transifex/native";
import type { SupportedTypeMapped } from "./types";
import throttle from "lodash/throttle";

let item: { type: string; id: string } | null = null;

let builds:
  | {
      build_number: string;
      prerelease: boolean;
      created_at: string;
      langs?: string[];
    }[]
  | null = null;

fetch("https://raw.githubusercontent.com/mythosmod/cbn-data/main/builds.json")
  .then((d) => d.json())
  .then((b) => {
    builds = b;
  })
  .catch((e) => {
    console.error(e);
  });

const url = new URL(location.href);
const version = url.searchParams.get("v") ?? loadVersion() ?? "latest";
const locale = url.searchParams.get("lang");
data.setVersion(version, locale);

const tilesets = [
  {
    name: "BrownLikeBears",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/BrownLikeBears",
  },
  {
    name: "ChestHole16",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/ChestHole16Tileset",
  },
  {
    name: "HitButton iso",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/HitButton_iso",
  },
  {
    name: "Hoder's",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/HoderTileset",
  },
  {
    name: "UNDEAD_PEOPLE",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/MSX%2B%2BUnDeadPeopleEdition",
  },
  {
    name: "RetroDays+",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/RetroDays%2BTileset",
  },
  {
    name: "RetroDays",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/RetroDaysTileset",
  },
  {
    name: "UltiCa",
    url: "https://raw.githubusercontent.com/cataclysmbnteam/Cataclysm-BN/{version}/gfx/UltimateCataclysm",
  },
];

const normalizeTemplate = (t: string) => (t === "null" || !t ? "" : t);

function loadTileset(): string {
  try {
    const tilesetIDStorage = localStorage.getItem("cdda-guide:tileset");
    return tilesetIDStorage ?? "-";
  } catch (e) {
    return "-";
  }
}

function saveTileset(tileset: string | null) {
  try {
    let sanitizedTilesetID =
      tilesets.find((t) => t.name === tileset)?.name || null;
    if (!tileset || !sanitizedTilesetID)
      localStorage.removeItem("cdda-guide:tileset");
    else localStorage.setItem("cdda-guide:tileset", sanitizedTilesetID);
  } catch (e) {
    /* swallow security errors, which can happen when in incognito mode */
  }
}

function loadVersion(): string {
  try {
    return localStorage.getItem("cdda-guide:version") ?? "latest";
  } catch (e) {
    return "latest";
  }
}

function saveVersion(version: string | null) {
  try {
    if (!version) localStorage.removeItem("cdda-guide:version");
    else localStorage.setItem("cdda-guide:version", version);
  } catch (e) {
    /* swallow security errors, which can happen when in incognito mode */
  }
}

let tileset: string = loadTileset();
let tilesetUrlTemplate: string = "";

$: saveTileset(tileset);
$: saveVersion(version);
$: tilesetUrlTemplate = normalizeTemplate(
  tilesets.find((t) => t.name === tileset)?.url ?? "",
);
$: tilesetUrl = $data
  ? (tilesetUrlTemplate?.replace("{version}", $data.build_number!) ?? null)
  : null;
$: tileData.setURL(tilesetUrl);

function decodeQueryParam(p: string) {
  return decodeURIComponent(p.replace(/\+/g, " "));
}

function load() {
  const path = location.pathname.slice(import.meta.env.BASE_URL.length - 1);
  let m: RegExpExecArray | null;
  if ((m = /^\/([^\/]+)(?:\/(.+))?$/.exec(path))) {
    const [, type, id] = m;
    if (type === "search") {
      item = null;
      search = decodeQueryParam(id ?? "");
    } else {
      item = { type, id: id ? decodeURIComponent(id) : "" };
    }

    window.scrollTo(0, 0);
  } else {
    item = null;
    search = "";
  }
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
// |throttle| isn't defined when running tests for some reason.
const replaceState = throttle
  ? throttle(history.replaceState.bind(history), 100, {
      trailing: true,
    })
  : history.replaceState.bind(history);

const clearItem = () => {
  if (item)
    history.pushState(
      null,
      "",
      import.meta.env.BASE_URL +
        (search ? "search/" + encodeURIComponent(search) : "") +
        location.search,
    );
  else
    replaceState(
      null,
      "",
      import.meta.env.BASE_URL +
        (search ? "search/" + encodeURIComponent(search) : "") +
        location.search,
    );
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
      uk: "українська",
      uk_UA: "українська",
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

const randomableItemTypes = new Set([
  "item",
  "monster",
  "furniture",
  "terrain",
  "vehicle_part",
  "tool_quality",
  "mutation",
  "martial_art",
  "json_flag",
  "achivement",
]);

async function getRandomPage() {
  const d = await new Promise<CddaData>((resolve) => {
    const unsubscribe = data.subscribe((v) => {
      if (v) {
        resolve(v);
        setTimeout(() => unsubscribe());
      }
    });
  });
  const items = d
    .all()
    .filter(
      (x) => "id" in x && randomableItemTypes.has(mapType(x.type)),
    ) as (SupportedTypeMapped & { id: string })[];
  return items[(Math.random() * items.length) | 0];
}

let randomPage: string | null = null;

function newRandomPage() {
  getRandomPage().then((r) => {
    randomPage = `${import.meta.env.BASE_URL}${mapType(r.type)}/${r.id}${
      location.search
    }`;
  });
}

newRandomPage();

// This is one character behind the actual search value, because
// of the throttle, but eh, it's good enough.
let currentHref = location.href;
$: item, search, (currentHref = location.href);

function langHref(lang: string, href: string) {
  const u = new URL(href);
  u.searchParams.set("lang", lang);
  return u.toString();
}
</script>

<svelte:window on:click={maybeNavigate} on:keydown={maybeFocusSearch} />

<svelte:head>
  {#if builds}
    {@const build_number =
      version === "latest" ? builds[0].build_number : version}
    {#each [...(builds.find((b) => b.build_number === build_number)?.langs ?? [])].sort( (a, b) => a.localeCompare(b), ) as lang}
      <link
        rel="alternate"
        hreflang={lang}
        href={langHref(lang, currentHref)} />
    {/each}
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
          on:input={clearItem}
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
    <aside style="float:right">
      <img
        src={dontPanic}
        height="200"
        width="343"
        alt="The words 'Don't Panic' in big friendly letters" />
    </aside>
    <p style="text-wrap: pretty">
      <InterpolatedTranslation
        str={t(
          `Your offline companion to the world of {link_cbn}. Instantly find details on recipes, loot sources, and survival info — all in one place.`,
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

    <ul>
      <li><a href="/item{location.search}">{t("Items")}</a></li>
      <li><a href="/monster{location.search}">{t("Monsters")}</a></li>
      <li><a href="/furniture{location.search}">{t("Furniture")}</a></li>
      <li><a href="/terrain{location.search}">{t("Terrain")}</a></li>
      <li><a href="/vehicle_part{location.search}">{t("Vehicle Parts")}</a></li>
      <li><a href="/tool_quality{location.search}">{t("Qualities")}</a></li>
      <li><a href="/mutation{location.search}">{t("Mutations")}</a></li>
      <li><a href="/martial_art{location.search}">{t("Martial Arts")}</a></li>
      <li><a href="/json_flag{location.search}">{t("Flags")}</a></li>
      <li><a href="/achievement{location.search}">{t("Achievements")}</a></li>
    </ul>

    <InterpolatedTranslation
      str={t(`Or visit a {link_random_page}.`, {
        link_random_page: "{link_random_page}",
      })}
      slot0="link_random_page">
      <a slot="0" href={randomPage} on:click={() => setTimeout(newRandomPage)}
        >{t("random page")}</a>
    </InterpolatedTranslation>
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
            value={$data?.build_number ??
              (version === "latest" ? builds[0].build_number : version)}
            on:change={(e) => {
              const url = new URL(location.href);
              let buildNumber = e.currentTarget.value;
              if (buildNumber === builds?.[0].build_number)
                buildNumber = "latest";
              url.searchParams.set("v", buildNumber);
              location.href = url.toString();
            }}>
            <optgroup label="Stable">
              {#each builds.filter((b) => !b.prerelease) as build}
                <!--TODO: versions below 0.7 are not exactly supported, do a better job at dynamically finding latest supported versions.  -->
                {#if build.build_number === "v0.7.0"}
                  <option value={build.build_number}
                    >{build.build_number}</option>
                {/if}
              {/each}
            </optgroup>
            <optgroup label="Experimental">
              {#each builds.filter((b) => b.prerelease) as build, i}
                <option value={build.build_number}
                  >{build.build_number}
                  {#if i === 0}&nbsp;(latest){/if}
                </option>
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
        }}>
        <option value="-">None (ASCII)</option>
        {#each tilesets as { name, url }}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </div>
    <div class="select-group">
      <label for="language_select">{t("Language:")}</label>
      {#if builds}
        {@const build_number =
          version === "latest" ? builds[0].build_number : version}
        <select
          disabled
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
    <span class="link">
      <img
        src={bnIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      <a
        href="https://github.com/cataclysmbnteam/Cataclysm-BN#readme"
        target="_blank"
        rel="noopener noreferrer">Cataclysm BN</a>
    </span>
    <span class="link">
      <img
        src={discordIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      <a
        href="https://discord.gg/XW7XhXuZ89"
        target="_blank"
        rel="noopener noreferrer">Discord</a>
    </span>
    <span class="link">
      <img
        src={redditIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      <a
        href="https://www.reddit.com/r/cataclysmbn/"
        target="_blank"
        rel="noopener noreferrer">Reddit</a>
    </span>
    <spin class="link">
      <img
        src={catapultIcon}
        width="16"
        height="16"
        alt="Cataclysm BN icon"
        class="icon" />
      <a
        href="https://github.com/qrrk/Catapult"
        target="_blank"
        rel="noopener noreferrer">Catapult Launcher</a>
    </spin>
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
  padding-top: 1em;
  text-align: center;
}

footer .link {
  text-wrap: nowrap;
}

footer #links .icon {
  text-decoration: none;
  padding-left: 1em;
  padding-right: 0.2em;
}

footer #credits {
  font-size: 0.6em;
  color: var(--cata-color-dark_gray);
  margin: 1rem auto 0;
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
  max-width: 220px;
}
</style>
