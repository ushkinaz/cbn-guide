<script lang="ts">
import { t } from "@transifex/native";
import { getContext } from "svelte";
import { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import type { Recipe } from "../../types";
import ThingLink from "../ThingLink.svelte";

import { gameSingularName } from "../../i18n/game-locale";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

let data = getContext<CBNData>("data");

const uncraftableFromSet = new Set<string>();
const allCraftableThings = (data.byType("recipe") as Recipe[])
  .concat(data.byType("uncraft"))
  .map((x) => x.result)
  .filter((x): x is string => !!x);
for (const id of allCraftableThings) {
  const recipe = data.uncraftRecipe(id);
  if (recipe && recipe.result) {
    const { components } = data.normalizeRequirementsForDisassembly(recipe);
    const defaultComponents = components.map((c) => c[0]);
    if (defaultComponents.some(([id]) => id === item_id))
      uncraftableFromSet.add(recipe.result);
  }
}
const uncraftableFrom = [...uncraftableFromSet].sort((a, b) =>
  gameSingularName(data.byId("item", a)).localeCompare(
    gameSingularName(data.byId("item", b)),
  ),
);
</script>

{#if uncraftableFrom.length}
  <section>
    <h2>{t("Disassemble", { _context: "Obtaining" })}</h2>
    <LimitedList items={uncraftableFrom}>
      {#snippet children({ item: id })}
        <ThingLink type="item" {id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}
