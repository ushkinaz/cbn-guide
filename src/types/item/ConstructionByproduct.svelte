<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import { byName, i18n } from "../../utils/i18n";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

const data = getContext<CBNData>("data");

const constructions = data
  .byType("construction")
  .filter((c) => {
    const byproducts = data.flattenItemGroup(
      data.normalizeItemGroup(c.byproducts, "collection"),
    );
    return byproducts.some((d) => d.id === item_id);
  })
  .sort(byName);
</script>

{#if constructions.length}
  <section>
    <h2>{t("Construct", { _context: "Obtaining" })}</h2>
    <LimitedList items={constructions}>
      {#snippet children({ item: f })}
        <ItemLink id={f.group} type="construction_group" showIcon={false} />
        {#if f.pre_terrain}
          on {#each [f.pre_terrain].flat() as preTerrain, i}
            {@const itemType = preTerrain.startsWith("f_")
              ? "furniture"
              : "terrain"}
            {#if i !== 0}{i18n.__(" OR ")}{/if}
            <ItemLink type={itemType} id={preTerrain} />
          {/each}
        {/if}
      {/snippet}
    </LimitedList>
  </section>
{/if}
