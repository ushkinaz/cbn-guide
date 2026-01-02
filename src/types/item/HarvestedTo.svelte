<script lang="ts">
import { getContext } from "svelte";
import { CBNData, i18n } from "../../data";
import ThingLink from "../ThingLink.svelte";
import type { MapDataCommon } from "../../types";
import ItemSymbol from "./ItemSymbol.svelte";
import { t } from "@transifex/native";

/**
 * The source from which resources are harvested.
 */
export let item: MapDataCommon;

const data = getContext<CBNData>("data");
const _context = "Terrain / Furniture";

const harvestBySeason: Map<string, string[]> = new Map();
for (const harvestDef of item.harvest_by_season ?? []) {
  for (const season of harvestDef.seasons) {
    for (const h of harvestDef.entries) {
      const dropsBySeason = harvestBySeason.get(season) ?? [];
      dropsBySeason.push(h.drop);
      harvestBySeason.set(season, dropsBySeason);
    }
  }
}
const seasonOrder = ["winter", "spring", "summer", "autumn"];
const harvestBySeasonList = [...harvestBySeason.entries()];
harvestBySeasonList.sort(
  (a, b) => seasonOrder.indexOf(a[0]) - seasonOrder.indexOf(b[0]),
);
</script>

{#if harvestBySeasonList.length}
  <dt>{t("Harvest", { _context })}</dt>
  <dd>
    <dl>
      {#each harvestBySeasonList as [season, harvests]}
        <dt>{i18n.__(season.replace(/^(.)/, (x) => x.toUpperCase()))}</dt>
        <dd>
          <ul>
            {#each harvests as harvestId}
              <li>
                <ItemSymbol item={data.byId("item", harvestId)} />
                <ThingLink type="item" id={harvestId} />
              </li>
            {/each}
          </ul>
        </dd>
      {/each}
    </dl>
  </dd>
{/if}
