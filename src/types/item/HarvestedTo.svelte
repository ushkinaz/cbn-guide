<script lang="ts">
import { getContext, untrack } from "svelte";
import { CBNData } from "../../data";
import ItemLink from "../ItemLink.svelte";
import type { MapDataCommon } from "../../types";
import { t } from "@transifex/native";

import { i18n } from "../../utils/i18n";

interface Props {
  /**
   * The source from which resources are harvested.
   */
  item: MapDataCommon;
}

let { item: sourceItem }: Props = $props();
const item = untrack(() => sourceItem);

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
          <ul class="no-bullets">
            {#each harvests as harvestId}
              <li>
                <ItemLink type="item" id={harvestId} />
              </li>
            {/each}
          </ul>
        </dd>
      {/each}
    </dl>
  </dd>
{/if}
