<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

let data = getContext<CBNData>("data");

let sources = $derived(data.grownFrom(item_id));
</script>

{#if sources.length}
  <section>
    <h2>{t("Grown From", { _context: "Obtaining" })}</h2>
    <LimitedList items={sources}>
      {#snippet children({ item })}
        <ItemLink id={item.id} type="item" /> ({item.seed_data.grow ?? "1 day"})
      {/snippet}
    </LimitedList>
  </section>
{/if}
