<script lang="ts">
import { getContext } from "svelte";
import { byName, CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import { t } from "@transifex/native";

export let item_id: string;

const data = getContext<CBNData>("data");

const sources = data
  .byType("item")
  .filter(
    (it) => it.id && "smoking_result" in it && it.smoking_result === item_id,
  );

sources.sort(byName);
</script>

{#if sources.length}
  <section>
    <h2>{t("Smoke", { _context: "Obtaining" })}</h2>
    <LimitedList items={sources} let:item>
      <ItemLink type="item" id={item.id} />
    </LimitedList>
  </section>
{/if}
