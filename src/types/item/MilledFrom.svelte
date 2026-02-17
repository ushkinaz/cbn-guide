<script lang="ts">
import { getContext } from "svelte";
import { byName, CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import { t } from "@transifex/native";

export let item_id: string;

const data = getContext<CBNData>("data");

const milledFrom = data
  .byType("item")
  .filter((it) => it.id && it.milling?.into === item_id);

milledFrom.sort(byName);
</script>

{#if milledFrom.length}
  <section>
    <h2>{t("Mill", { _context: "Obtaining" })}</h2>
    <LimitedList items={milledFrom} let:item>
      <ItemLink type="item" id={item.id} />
    </LimitedList>
  </section>
{/if}
