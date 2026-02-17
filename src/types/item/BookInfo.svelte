<script lang="ts">
import { t } from "@transifex/native";
import { getContext } from "svelte";
import type { CBNData } from "../../data";

import type { BookSlot } from "../../types";
import ItemLink from "../ItemLink.svelte";

export let item: BookSlot & { id: string; type: "BOOK" };

let data = getContext<CBNData>("data");

const bookRecipes = new Map<string, { recipe_name: string; level: number }>();
function add(recipe_id: string, recipe_name: string, level: number) {
  let recipe_data = bookRecipes.get(recipe_id) ?? { recipe_name, level };
  bookRecipes.set(recipe_id, {
    recipe_name,
    level: Math.min(level, recipe_data.level ?? Infinity),
  });
}

for (const recipe of data.byType("recipe")) {
  if (!recipe.result || !Array.isArray(recipe.book_learn)) continue;

  for (const [
    id,
    level = 0,
    recipe_name = recipe.result,
  ] of recipe.book_learn) {
    if (id === item.id) {
      add(recipe.result, recipe_name, level);
    }
  }
}
</script>

<section>
  <h2>{t("Book", { _comment: "Section heading" })}</h2>
  <dl>
    {#if item.skill}
      <dt>{t("Skill")}</dt>
      <dd><ItemLink id={item.skill} type="skill" showIcon={false} /></dd>
      <dt>{t("Required Level")}</dt>
      <dd>{item.required_level ?? 0}</dd>
      <dt>{t("Maximum Level")}</dt>
      <dd>{item.max_level ?? 0}</dd>
    {/if}
    <dt>{t("Required Intelligence")}</dt>
    <dd>{item.intelligence ?? 0}</dd>
    <dt>{t("Read Time")}</dt>
    <dd>{item.time ?? 0}</dd>
    <dt>{t("Fun")}</dt>
    <dd>{item.fun ?? 0}</dd>
    {#if item.chapters}
      <dt>{t("Chapters")}</dt>
      <dd>{item.chapters}</dd>
    {/if}
    {#if item.martial_art}
      <dt>{t("Martial Art")}</dt>
      <dd>
        <ItemLink type="martial_art" id={item.martial_art} showIcon={false} />
      </dd>
    {/if}
    {#if bookRecipes.size}
      <dt>{t("Recipes")}</dt>
      <dd>
        <ul>
          {#each [...bookRecipes.entries()].sort((a, b) => {
            return a[1].level - b[1].level || a[1].recipe_name.localeCompare(b[1].recipe_name);
          }) as [id, { recipe_name, level }]}
            <li><ItemLink {id} type="item" showIcon={false} /> ({level})</li>
          {/each}
        </ul>
      </dd>
    {/if}
  </dl>
</section>
