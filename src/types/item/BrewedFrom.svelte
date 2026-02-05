<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";

export let item_id: string;

let data = getContext<CBNData>("data");

const sources = data.brewedFrom(item_id);
</script>

{#if sources.length}
  <section>
    <h1>{t("Fermented From", { _context: "Obtaining" })}</h1>
    <LimitedList items={sources} let:item>
      <ItemLink id={item.id} type="item" /> ({item.brewable.time ?? "1 turn"})
    </LimitedList>
  </section>
{/if}
