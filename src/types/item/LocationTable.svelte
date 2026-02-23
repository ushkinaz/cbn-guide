<script lang="ts">
import { getContext } from "svelte";
import { CBNData } from "../../data";
import type { ItemChance, Loot } from "./spawnLocations";
import { formatFixed2, formatPercent } from "../../utils/format";
import type { OvermapSpecial } from "../../types";
import { t } from "@transifex/native";
import LimitedTableList from "../../LimitedTableList.svelte";
import { isTesting } from "../../utils/env";
import { metrics } from "../../metrics";
import ItemLink from "../ItemLink.svelte";

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
  spawnLocations.sort((a, b) => {
    const pA = Math.round(a.chance.prob * 10000);
    const pB = Math.round(b.chance.prob * 10000);
    return pA === pB
      ? b.chance.expected - a.chance.expected
      : b.chance.prob - a.chance.prob;
  });
  return spawnLocations;
}
</script>

{#if showData}
  {#await Promise.resolve(typeof loots === "function" ? loots() : loots)}
    <section>
      {heading}
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
            <th>{heading}</th>
            <th style="text-align: right; padding-left: 1em;"
              >{t("Avg. Count", { _context: "Obtaining" })}</th>
            <th style="text-align: right; padding-left: 1em;"
              >{t("Chance", { _context: "Obtaining" })}</th>
          </tr>
          <tr class="middle" slot="item" let:item={loc}>
            <td>
              <ItemLink type="overmap_special" id={loc.ids[0]} />
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
    <button
      on:click={() => {
        showData = true;
        metrics.count("data.obtaining_table.load", 1, { id, heading });
      }}
      class="disclosure">
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
