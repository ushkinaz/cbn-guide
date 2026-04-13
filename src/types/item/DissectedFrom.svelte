<script lang="ts">
import { getContext } from "svelte";
import { type CBNData } from "../../data";
import { t } from "@transifex/native";
import LimitedList from "../../LimitedList.svelte";
import ThingLink from "../ThingLink.svelte";

import { byName } from "../../i18n/game-locale";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

const data = getContext<CBNData>("data");

const monsters = $derived(
  Array.from(
    new Map(
      data.dissectedFrom(item_id).map((monster) => [monster.id, monster]),
    ).values(),
  ).sort(byName),
);
</script>

{#if monsters.length}
  <section>
    <h2>{t("Dissected From", { _context: "Obtaining" })}</h2>
    <LimitedList items={monsters}>
      {#snippet children({ item: monster })}
        <ThingLink type="monster" id={monster.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}
