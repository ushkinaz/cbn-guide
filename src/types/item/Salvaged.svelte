<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";
import { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import type { Item, Material } from "../../types";
import ThingLink from "../ThingLink.svelte";

import { byName } from "../../i18n/game-locale";
import { parseMass } from "../../utils/format";

interface Props {
  item_id: string;
}

let { item_id: sourceItemId }: Props = $props();
const item_id = untrack(() => sourceItemId);

let data = getContext<CBNData>("data");

const item = data.byId("item", item_id);

function itemsWithOnlyMaterial(soughtMat: Material): Item[] {
  return data
    .byType("item")
    .filter((it) => it.id)
    .filter((it) => {
      const mat =
        typeof it.material === "string" ? [it.material] : (it.material ?? []);
      return mat.length === 1 && mat[0] === soughtMat.id;
    });
}

const salvagedFromMaterials = data
  .byType("material")
  .filter((m) => m.id)
  .filter((mat) => mat.salvaged_into === item_id)
  .flatMap((mat) => itemsWithOnlyMaterial(mat))
  .filter((it) => !(it.flags ?? []).includes("NO_SALVAGE"))
  .filter((it) => parseMass(it.weight ?? 0) >= parseMass(item.weight ?? 0))
  .sort(byName);
</script>

{#if salvagedFromMaterials.length}
  <section>
    <h2>{t("Salvage", { _context: "Obtaining" })}</h2>
    <LimitedList items={salvagedFromMaterials}>
      {#snippet children({ item })}
        <ThingLink type="item" id={item.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}
