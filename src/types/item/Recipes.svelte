<script context="module" lang="ts">
import type { Recipe as RecipeType } from "../../types";
import { singularName } from "../../data";
// Lazily compute the recipe index.
let recipeIndex: Record<string, RecipeType[]>;
export function getRecipeIndex(data: CBNData) {
  if (!recipeIndex) {
    recipeIndex = {};
    for (const recipe of data.byType("recipe")) {
      if (recipe.result && !recipe.obsolete) {
        if (!recipeIndex[recipe.result]) {
          recipeIndex[recipe.result] = [];
        }
        recipeIndex[recipe.result].push(recipe);
      }
    }
  }
  return recipeIndex;
}

// And the byproducts index.
let byproductsIndex: Record<string, RecipeType[]>;
export function getByproductsIndex(data: CBNData) {
  if (!byproductsIndex) {
    byproductsIndex = {};
    for (const recipe of data.byType("recipe")) {
      if (recipe.result) {
        for (const byproduct of recipe.byproducts ?? []) {
          if (!byproductsIndex[byproduct[0]]) {
            byproductsIndex[byproduct[0]] = [];
          }
          byproductsIndex[byproduct[0]].push(recipe);
        }
      }
    }
    // Sort byproducts by result name.
    for (const byproducts of Object.values(byproductsIndex)) {
      byproducts.sort((a, b) => {
        const aResult = data.byId("item", a.result!);
        const bResult = data.byId("item", b.result!);
        return singularName(aResult).localeCompare(singularName(bResult));
      });
    }
  }
  return byproductsIndex;
}
</script>

<script lang="ts">
import { t } from "../../i18n";

import { getContext } from "svelte";
import { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import Recipe from "../Recipe.svelte";

export let item_id: string;

let data = getContext<CBNData>("data");

const recipes = getRecipeIndex(data)[item_id] ?? [];
recipes.sort(
  (a, b) =>
    ((a.never_learn ?? false) as unknown as number) -
    ((b.never_learn ?? false) as unknown as number),
);

const byproducts = getByproductsIndex(data)[item_id] ?? [];
</script>

{#if recipes.length}
  {#each recipes as recipe (recipe)}
    <Recipe {recipe} showResult={recipe.result !== item_id} />
  {/each}
{/if}

{#if byproducts.length}
  <section>
    <h1>{t("Byproduct when crafting", { _context: "Obtaining" })}</h1>
    <LimitedList items={byproducts} let:item>
      <ItemLink type="item" id={item.result} />
    </LimitedList>
  </section>
{/if}
