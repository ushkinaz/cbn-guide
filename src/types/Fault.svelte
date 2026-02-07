<script lang="ts">
import type { CBNData } from "../data";
import { i18n, singular, singularName } from "../data";
import ItemLink from "./ItemLink.svelte";
import { getContext } from "svelte";
import type { Fault, RequirementData } from "../types";
import { t } from "@transifex/native";
import RequirementDataTools from "./item/RequirementDataTools.svelte";

const data = getContext<CBNData>("data");
const _context = "Fault";

export let item: Fault;

const mendingMethods = (item.mending_methods ?? []).map((mm) => {
  const requirements: [RequirementData, number][] =
    typeof mm.requirements === "string"
      ? [[data.byId("requirement", mm.requirements), 1]]
      : Array.isArray(mm.requirements)
        ? mm.requirements.map(
            ([id, num]) =>
              [data.byId("requirement", id), num] as [RequirementData, number],
          )
        : [[mm.requirements, 1]];
  const requirement = data.normalizeRequirementUsing(requirements);
  const components = data.flattenRequirement(
    requirement.components,
    (r) => r.components,
  );
  return { mending_method: mm, components, requirement };
});
</script>

<h1>{t("Fault")}: {singularName(item)}</h1>

<section>
  <dl>
    <dt>{t("Flags")}</dt>
    <dd>
      <ul class="comma-separated">
        {#each item.flags ?? [] as flag}
          <li>{flag}</li>
        {:else}
          <li><em>{t("none")}</em></li>
        {/each}
      </ul>
    </dd>
  </dl>
  <p style="color: var(--cata-color-gray)">{singular(item.description)}</p>
</section>

{#if mendingMethods.length}
  <h2>{t("Mending Methods", { _context })}</h2>
{/if}

{#each mendingMethods as { components, requirement, mending_method }}
  <section>
    <h1>{singularName(mending_method)}</h1>
    <dl>
      <dt>{t("Skills Used", { _context })}</dt>
      <dd>
        {#each mending_method.skills as { id, level }, i}
          <ItemLink type="skill" {id} showIcon={false} /> ({level}){#if i === mending_method.skills.length - 2}{" and "}{:else if i !== mending_method.skills.length - 1}{", "}{/if}
        {:else}
          {t("none")}
        {/each}
      </dd>
      <dt>{t("Time to Complete")}</dt>
      <dd>{mending_method.time}</dd>
      <RequirementDataTools {requirement} />
      {#if components.length}
        <dt>{t("Components", { _context: "Requirement" })}</dt>
        <dd>
          <ul>
            {#each components as componentChoices}
              <li>
                {#each componentChoices.map( (c) => ({ ...c, item: data.byId("item", c.id) }), ) as { id, count }, i}
                  {#if i !== 0}{i18n.__(" OR ")}{/if}
                  <ItemLink {id} {count} type="item" showIcon={false} />
                {/each}
              </li>
            {/each}
          </ul>
        </dd>
      {/if}
      {#if mending_method.turns_into}
        <dt>{t("Turns Into", { _context })}</dt>
        <dd>
          <ItemLink
            type="fault"
            id={mending_method.turns_into}
            showIcon={false} />
        </dd>
      {/if}
    </dl>
  </section>
{/each}
