<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import { getConstructionPrerequisites } from "../construction";
import { byName } from "../../i18n/gettext";

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
        {@const prerequisites = getConstructionPrerequisites(f)}
        {#if prerequisites.length}
          {t("on")}
          {#each prerequisites as prerequisite, i}
            {#if i !== 0},
            {/if}
            <ItemLink type={prerequisite.type} id={prerequisite.id} />
          {/each}
        {/if}
      {/snippet}
    </LimitedList>
  </section>
{/if}
