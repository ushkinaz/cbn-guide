<script lang="ts">
import LimitedTableList from "../../LimitedTableList.svelte";
import { metrics } from "../../metrics";
import ThingLink from "../ThingLink.svelte";
import type { Loot } from "./spawnLocations";
import { formatFixed2, formatPercent } from "../../utils/format";
import { t } from "@transifex/native";
import type { SupportedTypesWithMapped } from "src/types";

interface Props {
  loot: Loot | Promise<Loot> | (() => Loot | Promise<Loot>);
  type?: keyof SupportedTypesWithMapped;
  heading?: string;
  // By default, data is not shown but can be loaded on demand
  showData?: boolean;
}

let {
  loot,
  type = "item",
  heading = type === "furniture"
    ? t("Furniture", { _context: "Loot Table" })
    : type === "terrain"
      ? t("Terrain", { _context: "Loot Table" })
      : t("Loot", { _context: "Loot Table" }),
  showData = true,
}: Props = $props();
</script>

{#if showData}
  {#await Promise.resolve(typeof loot === "function" ? loot() : loot)}
    <section>
      <h2>{heading}</h2>
      <p style="color: var(--cata-color-gray)" data-testid="loading-indicator">
        <em>{t("Loading...")}</em>
      </p>
    </section>
  {:then loot}
    {#if loot.size}
      {@const sortedLoot = [...loot.entries()].sort((a, b) => {
        const pA = Math.round(a[1].prob * 10000);
        const pB = Math.round(b[1].prob * 10000);
        return pA === pB
          ? b[1].expected - a[1].expected
          : b[1].prob - a[1].prob;
      })}
      <section>
        <LimitedTableList items={sortedLoot}>
          {#snippet header()}
            <tr>
              <th><h2>{heading}</h2></th>
              <th class="numeric">
                {t("Avg. Count", {
                  _context: "Loot Table",
                  _comment:
                    "Column heading in a table: average number of an item found in a location/vehicle, dropped by a monster, etc.",
                })}
              </th>
              <th class="numeric">
                {t("Chance", {
                  _context: "Loot Table",
                  _comment:
                    "Column heading in a table: chance that at least one of an item is found in a location/vehicle, dropped by a monster, etc.",
                })}
              </th>
            </tr>
          {/snippet}
          {#snippet item({ item })}
            {@const [item_id, chance] = item}
            <tr>
              <td style="padding-left: 5px;">
                <ThingLink {type} id={item_id} showIcon={true} />
              </td>
              <td class="numeric">{formatFixed2(chance.expected)}</td>
              <td class="numeric">{formatPercent(chance.prob)}</td>
            </tr>
          {/snippet}
        </LimitedTableList>
      </section>
    {/if}
  {/await}
{:else}
  <section>
    <button
      onclick={() => {
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
  padding: 0 0 0 1em;
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
