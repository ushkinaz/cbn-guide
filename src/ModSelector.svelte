<script lang="ts">
import { t } from "@transifex/native";
import { createEventDispatcher, onDestroy } from "svelte";
import type {
  ModData,
  ModInfo,
  SupportedTypesWithMapped,
  Translation,
} from "./types";
import { mapType, resolveSelectionWithDependencies } from "./data";
import { cleanText } from "./utils/format";

const MOD_SELECTOR_CONTEXT = "Mod selector";

//From https://github.com/cataclysmbn/Cataclysm-BN/blob/main/data/mods/default.json
const DEFAULT_MOD_IDS = [
  // "bn",
  // "bn_lua",
  "nuclear_tear",
  "no_npc_food",
  "novitamins",
  "No_Rail_Stations",
  "no_reviving_zombies",
  "limit_fungal_growth",
  "udp_redux",
  "pride_flags",
  "tablet_ebook",
  "change_hairstyle",
  "cbm_slots",
];

export let open = false;
export let mods: ModInfo[] = [];
export let rawModsJson: Record<string, ModData> = {};
export let selectedModIds: string[] = [];
export let loading = false;
export let errorMessage: string | null = null;

const dispatch = createEventDispatcher<{
  close: void;
  apply: string[];
}>();

let draftSelectedModIds: string[] = [];
let wasOpen = false;
let availableDefaultModIds: string[] = [];

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function translateField(value: Translation | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return cleanText(value);
  if ("str" in value) return cleanText(value.str);
  return cleanText(value.str_sp);
}

function categoryLabel(mod: ModInfo): string {
  const normalized = translateField(mod.category).replaceAll("_", " ").trim();
  return normalized || t("Uncategorized", { _context: MOD_SELECTOR_CONTEXT });
}

function modDisplayName(mod: ModInfo): string {
  return translateField(mod.name) || mod.id;
}

function modDescription(mod: ModInfo): string {
  return translateField(mod.description);
}

function modDependencies(mod: ModInfo): string {
  let nonCoreDependencies = mod.dependencies.filter(
    (mod_id) => mod_id !== "bn" && mod_id !== "bn_lua",
  );
  if (nonCoreDependencies.length === 0) return "";
  return t("requires: {dependencies}", {
    dependencies: nonCoreDependencies.join(", "),
    _context: MOD_SELECTOR_CONTEXT,
  });
}

const LOCATION_RELATED_TYPES = new Set<string>([
  "overmap_connection",
  "overmap_location",
  "overmap_terrain",
  "start_location",
]);

type ModContentCounts = {
  items: number;
  monsters: number;
  mutations: number;
  locations: number;
};

type ModContentStat = {
  label: string;
  value: number;
};

const MOD_STAT_LABELS = {
  items: t("items", { _context: MOD_SELECTOR_CONTEXT }),
  monsters: t("monsters", { _context: MOD_SELECTOR_CONTEXT }),
  mutations: t("mutations", { _context: MOD_SELECTOR_CONTEXT }),
  locations: t("locations", { _context: MOD_SELECTOR_CONTEXT }),
} as const;

function deriveModContentCounts(rawData: unknown[]): ModContentCounts {
  let items = 0;
  let monsters = 0;
  let mutations = 0;
  let locations = 0;

  for (const entry of rawData) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rawType =
      "type" in entry && typeof (entry as { type?: unknown }).type === "string"
        ? (entry as { type: string }).type
        : null;
    if (!rawType) continue;

    const mappedType = mapType(rawType as keyof SupportedTypesWithMapped);
    if (mappedType === "item" && rawType !== "item") items += 1;
    if (mappedType === "monster") monsters += 1;
    if (mappedType === "mutation") mutations += 1;
    if (mappedType === "overmap_special" || LOCATION_RELATED_TYPES.has(rawType))
      locations += 1;
  }

  return { items, monsters, mutations, locations };
}

function toVisibleStats(counts: ModContentCounts): ModContentStat[] {
  const stats: ModContentStat[] = [];
  if (counts.items > 0)
    stats.push({ label: MOD_STAT_LABELS.items, value: counts.items });
  if (counts.monsters > 0)
    stats.push({ label: MOD_STAT_LABELS.monsters, value: counts.monsters });
  if (counts.mutations > 0)
    stats.push({ label: MOD_STAT_LABELS.mutations, value: counts.mutations });
  if (counts.locations > 0)
    stats.push({ label: MOD_STAT_LABELS.locations, value: counts.locations });
  return stats;
}

function close(): void {
  dispatch("close");
}

function apply(): void {
  dispatch("apply", draftSelectedModIds);
}

function reset(): void {
  draftSelectedModIds = [];
}

function selectDefaultMods(): void {
  draftSelectedModIds = [...availableDefaultModIds];
}

function onOverlayClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    close();
  }
}

function handleEscape(event: KeyboardEvent): void {
  if (!open || event.key !== "Escape") return;
  event.preventDefault();
  close();
}

function syncBodyClass(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("mods-selector-open", enabled);
}

$: {
  if (open && !wasOpen) {
    draftSelectedModIds = [...selectedModIds];
  }
  wasOpen = open;
}

$: groupedMods = mods.reduce((acc, mod) => {
  const label = categoryLabel(mod);
  if (!acc.has(label)) {
    acc.set(label, []);
  }
  acc.get(label)!.push(mod);
  return acc;
}, new Map<string, ModInfo[]>());

$: groupedCategories = [...groupedMods.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([category, mods]): [string, ModInfo[]] => [
    category,
    [...mods].sort((a, b) =>
      modDisplayName(a).localeCompare(modDisplayName(b)),
    ),
  ]);

$: availableDefaultModIds = DEFAULT_MOD_IDS.filter((modId, idx, all) => {
  if (modId === "bn") return false;
  if (all.indexOf(modId) !== idx) return false;
  return mods.some((mod) => mod.id === modId);
});

$: modContentStatsById = mods.reduce((acc, mod) => {
  const rawData = rawModsJson[mod.id]?.data ?? [];
  acc.set(mod.id, toVisibleStats(deriveModContentCounts(rawData)));
  return acc;
}, new Map<string, ModContentStat[]>());

$: modsById = mods.reduce((acc, mod) => {
  acc.set(mod.id, mod);
  return acc;
}, new Map<string, ModInfo>());

$: if (modsById.size > 0) {
  // Keep URL-selected ids intact while mod metadata is still loading.
  // Otherwise, resolving against an empty map clears valid selections.
  const normalizedSelection = resolveSelectionWithDependencies(
    draftSelectedModIds,
    modsById,
  );
  if (!arraysEqual(normalizedSelection, draftSelectedModIds)) {
    draftSelectedModIds = normalizedSelection;
  }
}

$: syncBodyClass(open);

onDestroy(() => {
  syncBodyClass(false);
});
</script>

<svelte:window on:keydown={handleEscape} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="mods-overlay" on:click={onOverlayClick} role="presentation">
    <div
      class="mods-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mods-dialog-title">
      <header class="mods-header">
        <div class="mods-header-info">
          <h2 id="mods-dialog-title">
            {t("Mods [{count}]", {
              _context: MOD_SELECTOR_CONTEXT,
              count: draftSelectedModIds.length,
            })}
          </h2>
        </div>
        <button
          type="button"
          class="close-button"
          on:click={close}
          aria-label={t("Close mod selector", {
            _context: MOD_SELECTOR_CONTEXT,
          })}
          title={t("Close mod selector", { _context: MOD_SELECTOR_CONTEXT })}>
          ✕
        </button>
      </header>

      {#if loading}
        <p class="mods-state">
          {t("Loading available mods…", { _context: MOD_SELECTOR_CONTEXT })}
        </p>
      {:else if errorMessage}
        <p class="mods-state error">{errorMessage}</p>
      {:else if groupedCategories.length === 0}
        <p class="mods-state">
          {t("No mods found for this build.", {
            _context: MOD_SELECTOR_CONTEXT,
          })}
        </p>
      {:else}
        <div class="mods-list">
          {#each groupedCategories as [category, categoryMods]}
            <section class="mods-category">
              <h3>{category}</h3>
              <ul>
                {#each categoryMods as mod}
                  {@const contentStats = modContentStatsById.get(mod.id) ?? []}
                  <li>
                    <label class="mod-row">
                      <input
                        type="checkbox"
                        bind:group={draftSelectedModIds}
                        value={mod.id}
                        aria-label={modDisplayName(mod)} />
                      <span class="mod-body">
                        <span class="mod-main">
                          <span class="mod-line">
                            <span class="mod-name">{modDisplayName(mod)}</span>
                            <span class="mod-id">[{mod.id}]</span>
                          </span>
                          {#if modDescription(mod)}
                            <span class="mod-description"
                              >{modDescription(mod)}</span>
                          {/if}
                          {#if modDependencies(mod)}
                            <span class="mod-dependencies"
                              >{modDependencies(mod)}</span>
                          {/if}
                        </span>
                        {#if contentStats.length > 0}
                          <span
                            class={`mod-stats mod-stats-count-${contentStats.length}`}>
                            {#each contentStats as stat}
                              <span class="mod-stat">
                                <span class="mod-stat-label"
                                  >{stat.label}:</span>
                                <span class="mod-stat-value"
                                  >{stat.value.toLocaleString()}</span>
                              </span>
                            {/each}
                          </span>
                        {/if}
                      </span>
                    </label>
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      {/if}

      <footer class="mods-actions">
        <div class="mods-actions-buttons">
          <button type="button" class="ghost" on:click={close}>
            {t("Cancel", { _context: MOD_SELECTOR_CONTEXT })}
          </button>
          <button
            type="button"
            class="ghost"
            on:click={reset}
            disabled={draftSelectedModIds.length === 0}>
            {t("Reset", { _context: MOD_SELECTOR_CONTEXT })}
          </button>
        </div>
        <div class="mods-actions-main">
          <div class="mods-actions-utilities">
            <button
              type="button"
              class="ghost"
              on:click={selectDefaultMods}
              disabled={availableDefaultModIds.length === 0 ||
                loading ||
                !!errorMessage}
              title={t("Load default in-game preset", {
                _context: MOD_SELECTOR_CONTEXT,
              })}>
              {t("Default", { _context: MOD_SELECTOR_CONTEXT })}
            </button>
            <button
              type="button"
              class="apply"
              on:click={apply}
              disabled={loading || !!errorMessage}>
              {t("Apply", { _context: MOD_SELECTOR_CONTEXT })}
            </button>
          </div>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style>
/*noinspection CssUnusedSymbol*/
:global(body.mods-selector-open) {
  overflow: hidden !important;
}

.mods-overlay {
  position: fixed !important;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: max(1rem, env(safe-area-inset-top))
    max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
  background: rgba(0, 0, 0, 0.75);
  pointer-events: auto;
  overscroll-behavior: contain;
}

.mods-dialog {
  width: min(56rem, 100%);
  max-width: 100%;
  max-height: min(86dvh, 60rem);
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--cata-color-black) 92%, #06131a 8%);
  border: 1px solid var(--cata-color-dark_gray);
  border-top: 2px solid var(--cata-color-cyan);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 14px 34px rgba(0, 0, 0, 0.55);
}

.mods-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.mods-header-info {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.mods-header h2 {
  margin: 0;
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cata-color-light_cyan);
}

.mods-list {
  padding: 0.75rem 1rem;
  overflow: auto;
}

.mods-category:not(:last-child) {
  margin-bottom: 0.9rem;
}

.mods-category h3 {
  margin: 0 0 0.5rem;
  color: var(--cata-color-gray);
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
}

.mods-category ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.mods-category li:not(:last-child) {
  margin-bottom: 0.35rem;
}

.mod-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.45rem 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.mod-row:hover {
  border-color: color-mix(in srgb, var(--cata-color-cyan) 55%, transparent);
  background: rgba(255, 255, 255, 0.04);
}

.mod-row input {
  margin: 0.2rem 0 0;
}

.mod-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.2rem 1rem;
  align-items: flex-start;
}

.mod-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.mod-line {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.mod-name {
  color: var(--cata-color-white);
}

.mod-id {
  color: var(--cata-color-dark_gray);
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.78rem;
}

.mod-description {
  color: var(--cata-color-gray);
  font-size: 0.84rem;
  line-height: 1.35;
}

.mod-dependencies {
  color: var(--cata-color-dark_gray);
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.78rem;
  line-height: 1.3;
}

.mod-stats {
  display: grid;
  grid-template-columns: max-content max-content;
  justify-content: end;
  align-content: start;
  column-gap: 0.45rem;
  row-gap: 0.1rem;
  text-align: right;
  white-space: nowrap;
  color: var(--cata-color-dark_gray);
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.78rem;
  line-height: 1.3;
}

.mod-stat {
  display: contents;
}

.mod-stat-label {
  text-align: right;
  color: var(--cata-color-gray);
}

.mod-stat-value {
  color: var(--cata-color-cyan);
}

.mods-state {
  margin: 0;
  padding: 1rem;
  color: var(--cata-color-gray);
}

.mods-state.error {
  color: var(--cata-color-light_red);
}

.mods-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.75rem 1rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.mods-actions-buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
}

.mods-actions-utilities,
.mods-actions-main {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.mods-actions-main {
  margin-left: 0.35rem;
}

.mods-actions button,
.close-button {
  margin: 0;
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.8rem;
  border-radius: 0;
}

.close-button {
  border: 1px solid transparent;
  background: transparent;
  color: var(--cata-color-gray);
  padding: 0.2rem 0.35rem;
  line-height: 1;
}

.close-button:hover {
  border-color: var(--cata-color-dark_gray);
  color: var(--cata-color-white);
}

.ghost {
  background: transparent;
  color: var(--cata-color-gray);
  border: 1px solid var(--cata-color-dark_gray);
}

.ghost:hover {
  border-color: var(--cata-color-cyan);
  color: var(--cata-color-cyan);
}

.apply {
  background: color-mix(in srgb, var(--cata-color-cyan) 18%, transparent);
  color: var(--cata-color-light_cyan);
  border: 1px solid var(--cata-color-cyan);
}

.apply:hover:not(:disabled) {
  background: color-mix(in srgb, var(--cata-color-cyan) 28%, transparent);
}

.apply:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .mods-overlay {
    padding: 0.65rem;
  }

  .mods-dialog {
    max-height: 92dvh;
  }

  .mods-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .mods-actions-buttons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }

  .mods-actions-utilities,
  .mods-actions-main {
    display: grid;
    grid-template-columns: 1fr;
  }

  .mods-actions-main {
    margin-left: 0;
  }

  .mods-actions-utilities button,
  .mods-actions-main button {
    width: 100%;
  }

  .mod-body {
    grid-template-columns: 1fr;
  }

  .mod-stats {
    justify-content: start;
    justify-self: end;
    text-align: right;
    white-space: normal;
    grid-template-columns: repeat(4, minmax(0, max-content));
    column-gap: 0.75rem;
    row-gap: 0.2rem;
  }

  .mod-stats.mod-stats-count-1 {
    grid-template-columns: repeat(2, minmax(0, max-content));
  }

  .mod-stats.mod-stats-count-2 {
    grid-template-columns: repeat(4, minmax(0, max-content));
  }

  .mod-stats.mod-stats-count-3 {
    grid-template-columns: repeat(6, minmax(0, max-content));
  }

  .mod-stats.mod-stats-count-4 {
    grid-template-columns: repeat(4, minmax(0, max-content));
  }

  .mod-stat {
    display: contents;
  }
}

@media (max-width: 600px) {
  .mods-actions-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
