<script lang="ts">
import { getContext } from "svelte";
import { type CBNData } from "../../data";
import { t } from "@transifex/native";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";

import { byName } from "../../i18n/game-locale";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

const data = getContext<CBNData>("data");

const sources = $derived(data.getDissectionSources(item_id));
// Deduplicate monsters since multiple harvest entries might point to the same item/group
const monsters = $derived(
  Array.from(
    new Map(sources.map((s) => [s.monster.id, s.monster])).values(),
  ).sort(byName),
);
</script>

{#if monsters.length}
  <section>
    <h2>{t("Dissected From", { _context: "Obtaining" })}</h2>
    <LimitedList items={monsters}>
      {#snippet children({ item: monster })}
        <ItemLink type="monster" id={monster.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}
