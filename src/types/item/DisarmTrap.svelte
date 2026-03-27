<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import type { Trap } from "../../types";
import ItemLink from "../ItemLink.svelte";

interface Props {
  item_id: string;
}

let { item_id: sourceItemId }: Props = $props();
const item_id = untrack(() => sourceItemId);

const data = getContext<CBNData>("data");

const traps = data.disarmTrap(item_id) as Trap[];
</script>

{#if traps.length}
  <section>
    <h2>{t("Disarmed From", { _context: "Obtaining" })}</h2>
    <LimitedList items={traps}>
      {#snippet children({ item: trap })}
        <ItemLink id={trap.id} type="trap" />
      {/snippet}
    </LimitedList>
  </section>
{/if}
