<script lang="ts">
import { getContext } from "svelte";
import { CBNData, omsName } from "../../data";
import { getVersionedBasePath } from "../../routing";
import type { ItemChance, Loot } from "./spawnLocations";
import { formatFixed2, formatPercent } from "../../utils/format";
import type { OvermapSpecial } from "../../types";
import OvermapAppearance from "./OvermapAppearance.svelte";
import { t } from "../../i18n";
import LimitedTableList from "../../LimitedTableList.svelte";
import { isTesting } from "../../utils/env";

export let id: string;
export let loots:
  | Promise<Map<string, { loot: Loot; ids: string[] }>>
  | (() => Promise<Map<string, { loot: Loot; ids: string[] }>>);
export let heading: string;

let showData = isTesting;

const data = getContext<CBNData>("data");

function filterLocations(
  lootByAppearance: Map<string, { loot: Loot; ids: string[] }>,
  id: string,
): { overmap_special: OvermapSpecial; ids: string[]; chance: ItemChance }[] {
  const spawnLocations: {
    overmap_special: OvermapSpecial;
    ids: string[];
    chance: ItemChance;
  }[] = [];
  for (const { loot, ids } of lootByAppearance.values()) {
    if (loot.has(id)) {
      const chance = loot.get(id)!;
      const oms = data.byId("overmap_special", ids[0]);
      spawnLocations.push({ overmap_special: oms, ids, chance });
    }
  }
  spawnLocations.sort((a, b) =>
    formatFixed2(b.chance.prob * 100) === formatFixed2(a.chance.prob * 100)
      ? b.chance.expected - a.chance.expected
      : b.chance.prob - a.chance.prob,
  );
  return spawnLocations;
}
</script>

{#if showData}
  {#await Promise.resolve(typeof loots === "function" ? loots() : loots)}
    <section>
      <h1>{heading}</h1>
      <p style="color: var(--cata-color-gray)" data-testid="loading-indicator">
        <em>{t("Loading...")}</em>
      </p>
    </section>
  {:then spawnLocationsUnfiltered}
    {@const spawnLocations = filterLocations(spawnLocationsUnfiltered, id)}
    {#if spawnLocations.length}
      <section>
        <LimitedTableList items={spawnLocations}>
          <tr slot="header">
            <th colspan="2"><h1>{heading}</h1></th>
            <th style="text-align: right; padding-left: 1em;"
              ><h1>{t("Avg. Count", { _context: "Obtaining" })}</h1></th>
            <th style="text-align: right; padding-left: 1em;"
              ><h1>{t("Chance", { _context: "Obtaining" })}</h1></th>
          </tr>
          <tr class="middle" slot="item" let:item={loc}>
            <td
              style="text-align: center; width: 0; padding-left: 0.5em; padding-right: 0.5em;">
              <OvermapAppearance overmapSpecial={loc.overmap_special} />
            </td>
            <td>
              <a
                href="{getVersionedBasePath()}overmap_special/{loc
                  .ids[0]}{location.search}"
                >{omsName(data, loc.overmap_special)}</a>
              {#if loc.ids.length > 1}
                {t("({n} variants)", { n: loc.ids.length })}
              {/if}
            </td>
            <td style="text-align: right; padding-left: 1em;"
              >{formatFixed2(loc.chance.expected)}</td>
            <td style="text-align: right; padding-left: 1em;"
              >{formatPercent(loc.chance.prob)}</td>
          </tr>
        </LimitedTableList>
      </section>
    {/if}
  {/await}
{:else}
  <section>
    <button on:click={() => (showData = true)} class="disclosure">
      {t("Load {heading}...", { heading })}
    </button>
  </section>
{/if}

<style>
tr.middle td {
  vertical-align: middle;
  font-variant-numeric: tabular-nums;
}
</style>
