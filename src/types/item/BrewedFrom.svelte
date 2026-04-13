<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ThingLink from "../ThingLink.svelte";

interface Props {
  item_id: string;
}

let { item_id: sourceItemId }: Props = $props();
const item_id = untrack(() => sourceItemId);

let data = getContext<CBNData>("data");

const sources = data.brewedFrom(item_id);
</script>

{#if sources.length}
  <section>
    <h2>{t("Fermented From", { _context: "Obtaining" })}</h2>
    <LimitedList items={sources}>
      {#snippet children({ item })}
        <ThingLink id={item.id} type="item" /> ({item.brewable?.time ??
          t("1 turn")})
      {/snippet}
    </LimitedList>
  </section>
{/if}
