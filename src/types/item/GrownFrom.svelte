<script lang="ts">
import { t } from "../../i18n";

import { getContext } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";

export let item_id: string;

let data = getContext<CBNData>("data");

const sources = data.grownFrom(item_id);
</script>

{#if sources.length}
  <section>
    <h1>{t("Grown From", { _context: "Obtaining" })}</h1>
    <LimitedList items={sources} let:item>
      <ItemLink id={item.id} type="item" /> ({item.seed_data.grow ?? "1 day"})
    </LimitedList>
  </section>
{/if}
