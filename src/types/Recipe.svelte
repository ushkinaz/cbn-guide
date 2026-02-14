<script lang="ts">
import { t } from "@transifex/native";
import JsonView from "../JsonView.svelte";
import { getContext } from "svelte";
import { CBNData, i18n } from "../data";

import type { Recipe } from "../types";
import RequirementData from "./item/RequirementData.svelte";
import ItemLink from "./ItemLink.svelte";

export let recipe: Recipe;
export let showResult: boolean = false;

const data = getContext<CBNData>("data");
const _context = "Recipe";

const isSkillPair = (value: unknown): value is [string, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === "string" &&
  typeof value[1] === "number";

function normalizeSkillsRequired(
  skills_required:
    | [string, number]
    | [string, number][]
    | (string | number)[]
    | undefined,
): [string, number][] {
  if (!skills_required || skills_required.length === 0) return [];

  if (isSkillPair(skills_required)) {
    return [skills_required];
  }

  if (skills_required.every((entry) => isSkillPair(entry))) {
    return skills_required;
  }

  if (
    typeof skills_required[0] === "string" &&
    skills_required.length % 2 === 0 &&
    skills_required.every((entry, index) =>
      index % 2 === 0 ? typeof entry === "string" : typeof entry === "number",
    )
  ) {
    const result: [string, number][] = [];
    for (let i = 0; i < skills_required.length; i += 2) {
      const skill = skills_required[i];
      const level = skills_required[i + 1];
      if (typeof skill === "string" && typeof level === "number") {
        result.push([skill, level]);
      }
    }
    return result;
  }

  return [];
}

let skillsRequired = normalizeSkillsRequired(recipe.skills_required);

const writtenIn = Array.isArray(recipe.book_learn)
  ? [...recipe.book_learn]
  : [...Object.entries((recipe.book_learn ?? {}) as Record<string, any>)].map(
      ([k, v]) => [k, v.skill_level],
    );
writtenIn.sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));

const activityLevels = {
  SLEEP_EXERCISE: 0.85,
  NO_EXERCISE: 1.0,
  LIGHT_EXERCISE: 2.0,
  fake: 4.0,
  MODERATE_EXERCISE: 4.0,
  BRISK_EXERCISE: 6.0,
  ACTIVE_EXERCISE: 8.0,
  EXTRA_EXERCISE: 10.0,
};

//TODO: Transifex extraction only recognizes direct t("...") keys; replace t(activityLevelName(...)) with literal keys.
function activityLevelName(level: number) {
  const activity_descriptions = [
    "None",
    "Light",
    "Moderate",
    "Brisk",
    "Active",
    "Extreme",
  ];
  // Activity levels are 1, 2, 4, 6, 8, 10
  // So we can easily cut them in half and round down for an index
  const idx = Math.floor(level / 2);

  return i18n.pgettext("activity description", activity_descriptions[idx]);
}
</script>

<section class="recipe">
  <h1>
    {#if showResult}{t("Byproduct", {
        _context,
        _comment: "Section heading",
      })}{:else}{t("Craft", { _context, _comment: "Section heading" })}{/if}
  </h1>
  <p>
    {#if recipe.never_learn}
      <section class="warning">
        ⚠️ {t(
          "This recipe is not learnable. It may be used by NPCs or for debugging purposes.",
          {
            _context,
            _comment:
              "This is a basecamp recipe or other utility recipe that isn't directly usable by the player.",
          },
        )}
      </section>
    {/if}
  </p>
  <dl>
    {#if showResult && recipe.result}
      <dt>{t("Result", { _context })}</dt>
      <dd><ItemLink id={recipe.result} type="item" showIcon={false} /></dd>
    {/if}
    <dt>{t("Primary Skill", { _context })}</dt>
    <dd>
      {#if recipe.skill_used}
        <ItemLink type="skill" id={recipe.skill_used} showIcon={false} /> ({recipe.difficulty ??
          0})
      {:else}
        {t("none")}
      {/if}
    </dd>
    {#if skillsRequired.length}
      <dt>{t("Other Skills", { _context })}</dt>
      <dd>
        {#each skillsRequired as [skill, level], i}
          <ItemLink type="skill" id={skill} showIcon={false} /> ({level}){#if i === skillsRequired.length - 2}{" and "}{:else if i !== skillsRequired.length - 1}{", "}{/if}
        {:else}
          {t("none")}
        {/each}
      </dd>
    {/if}
    <dt>{t("Time to Complete")}</dt>
    <dd>{recipe.time ?? "0 m"}</dd>
    <dt>{t("Activity Level", { _context })}</dt>
    <dd>
      {t(
        activityLevelName(
          activityLevels[recipe.activity_level ?? "MODERATE_EXERCISE"],
        ),
      )}
    </dd>
    <dt>{t("Batch Time Savings", { _context })}</dt>
    <dd>
      {#if recipe.batch_time_factors}
        {recipe.batch_time_factors[0]}% at >{recipe.batch_time_factors[1]} unit{recipe
          .batch_time_factors[1] === 1
          ? ""
          : "s"}
      {:else}
        <em>{t("none")}</em>
      {/if}
    </dd>
    {#if recipe.charges}
      <dt>{t("Recipe Makes", { _context })}</dt>
      <dd>{recipe.charges}<!-- TODO: properly switch on result type --></dd>
    {/if}
    <RequirementData requirement={recipe} />
    {#if recipe.byproducts?.length}
      <dt>{t("Byproducts", { _context })}</dt>
      <dd>
        <ul>
          {#each recipe.byproducts as c}
            <li>
              <ItemLink
                type="item"
                id={c[0]}
                count={c[1] ?? 1}
                showIcon={false} />
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    <dt
      title="Learned at these skill levels, otherwise only learnable from a book">
      {t("Autolearn", { _context })}
    </dt>
    <dd>
      <!-- prettier-ignore-->
      {#if recipe.autolearn}
        <ul class="comma-separated">
          {#if Array.isArray(recipe.autolearn)}
            {#each recipe.autolearn as [skill, level]}
              <li><ItemLink type="skill" id={skill}  showIcon={false} /> ({level})</li>
            {/each}
          {:else}
            {#if recipe.skill_used}
              <li>
                <ItemLink type="skill" id={recipe.skill_used}  showIcon={false} /> ({recipe.difficulty ??
                  0})
              </li>
            {/if}
            {#if skillsRequired.length}
              {#each skillsRequired as [skill, level]}
                <li><ItemLink type="skill" id={skill}  showIcon={false} /> ({level})</li>
              {/each}
            {/if}
            {#if !recipe.skill_used && !skillsRequired.length}
            <li>{t('At birth', {_context})}</li>
            {/if}
          {/if}
        </ul>
      {:else}
        {t("No")}
      {/if}
    </dd>
    {#if writtenIn.length}
      <dt>
        {t("Written In", {
          _context,
          _comment: "List of books that contain the recipe",
        })}
      </dt>
      <dd>
        <ul class="comma-separated">
          {#each writtenIn as [item_id, level = 0]}
            <!-- prettier-ignore -->
            <li><span style="white-space: nowrap"><ItemLink id={item_id} type="item"  showIcon={false} /> ({level})</span></li>
          {/each}
        </ul>
      </dd>
    {/if}
  </dl>
  <JsonView obj={recipe} buildNumber={data.build_number} />
</section>

<style>
.warning {
  background-color: #69553f;
}
</style>
