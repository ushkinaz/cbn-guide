<script lang="ts">
import LimitedTableList from "../../LimitedTableList.svelte";
import { metrics } from "../../metrics";
import ItemLink from "../ItemLink.svelte";
import type { Loot } from "./spawnLocations";
import { formatFixed2, formatPercent } from "../../utils/format";
import { t } from "../../i18n";
import type { SupportedTypesWithMapped } from "src/types";
import { isTesting } from "../../utils/env";

export let loot: Loot | Promise<Loot> | (() => Loot | Promise<Loot>);
export let type: keyof SupportedTypesWithMapped = "item";
export let heading: string =
  type === "furniture"
    ? t("Furniture", { _context: "Loot Table" })
    : type === "terrain"
      ? t("Terrain", { _context: "Loot Table" })
      : t("Loot", { _context: "Loot Table" });

let showData = isTesting;
</script>

{#if showData}
  {#await Promise.resolve(typeof loot === "function" ? loot() : loot)}
    <section>
      <h1>{heading}</h1>
      <p style="color: var(--cata-color-gray)" data-testid="loading-indicator">
        <em>{t("Loading...")}</em>
      </p>
    </section>
  {:then loot}
    {#if loot.size}
      {@const sortedLoot = [...loot.entries()].sort((a, b) =>
        formatFixed2(b[1].prob * 100) === formatFixed2(a[1].prob * 100)
          ? b[1].expected - a[1].expected
          : b[1].prob - a[1].prob,
      )}
      <section>
        <LimitedTableList items={sortedLoot}>
          <tr slot="header">
            <th><h1>{heading}</h1></th>
            <th class="numeric"
              ><h1>
                {t("Avg. Count", {
                  _context: "Loot Table",
                  _comment:
                    "Column heading in a table: average number of an item found in a location/vehicle, dropped by a monster, etc.",
                })}
              </h1></th>
            <th class="numeric"
              ><h1>
                {t("Chance", {
                  _context: "Loot Table",
                  _comment:
                    "Column heading in a table: chance that at least one of an item is found in a location/vehicle, dropped by a monster, etc.",
                })}
              </h1></th>
          </tr>
          <tr slot="item" let:item={[item_id, chance]}>
            <td style="padding-left: 5px;">
              <ItemLink {type} id={item_id} showIcon={true} />
            </td>
            <td class="numeric">{formatFixed2(chance.expected)}</td>
            <td class="numeric">{formatPercent(chance.prob)}</td>
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
        metrics.count("data.loot_table.load", 1, { type, heading });
      }}
      class="disclosure">
      {t("Load {heading}...", { heading })}
    </button>
  </section>
{/if}

<style>
th,
td {
  padding: 0;
  padding-left: 1em;
  white-space: nowrap;
}
th:first-child,
td:first-child {
  padding-left: 0;
}
td {
  vertical-align: middle;
}
td.numeric,
th.numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
