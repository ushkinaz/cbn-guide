<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";

interface Props {
  item_id: string;
}

let { item_id: sourceItemId }: Props = $props();
const item_id = untrack(() => sourceItemId);

let data = getContext<CBNData>("data");

const sources = data.grownFrom(item_id);
</script>

{#if sources.length}
  <section>
    <h2>{t("Grown From", { _context: "Obtaining" })}</h2>
    <LimitedList items={sources}>
      {#snippet children({ item })}
        <ItemLink id={item.id} type="item" /> ({item.seed_data?.grow ??
          t("1 day")})
      {/snippet}
    </LimitedList>
  </section>
{/if}
