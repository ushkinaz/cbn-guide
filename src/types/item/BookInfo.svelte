<script lang="ts">
import { t } from "@transifex/native";
import { getContext } from "svelte";
import type { CddaData } from "../../data";

import type { BookSlot } from "../../types";
import ThingLink from "../ThingLink.svelte";

export let item: BookSlot & { id: string; type: "BOOK" };
const _context = "Item Book Info";

let data = getContext<CddaData>("data");

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
  <h1>{t("Book", { _context, _comment: "Section heading" })}</h1>
  <dl>
    {#if item.skill}
      <dt>{t("Skill", { _context })}</dt>
      <dd><ThingLink id={item.skill} type="skill" /></dd>
      <dt>{t("Required Level", { _context })}</dt>
      <dd>{item.required_level ?? 0}</dd>
      <dt>{t("Maximum Level", { _context })}</dt>
      <dd>{item.max_level ?? 0}</dd>
    {/if}
    <dt>{t("Required Intelligence", { _context })}</dt>
    <dd>{item.intelligence ?? 0}</dd>
    <dt>{t("Read Time", { _context })}</dt>
    <dd>{item.time ?? 0}</dd>
    <dt>{t("Fun", { _context })}</dt>
    <dd>{item.fun ?? 0}</dd>
    {#if item.chapters}
      <dt>{t("Chapters", { _context })}</dt>
      <dd>{item.chapters}</dd>
    {/if}
    {#if item.martial_art}
      <dt>{t("Martial Art", { _context })}</dt>
      <dd><ThingLink type="martial_art" id={item.martial_art} /></dd>
    {/if}
    {#if bookRecipes.size}
      <dt>{t("Recipes", { _context })}</dt>
      <dd>
        <ul>
          {#each [...bookRecipes.entries()].sort((a, b) => {
            return a[1].level - b[1].level || a[1].recipe_name.localeCompare(b[1].recipe_name);
          }) as [id, { recipe_name, level }]}
            <li><ThingLink {id} type="item" /> ({level})</li>
          {/each}
        </ul>
      </dd>
    {/if}
  </dl>
</section>
