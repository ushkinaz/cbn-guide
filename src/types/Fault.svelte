<script lang="ts">
import RequirementsAndList from "./item/RequirementsAndList.svelte";
import type { CBNData } from "../data";
import ThingLink from "./ThingLink.svelte";
import { getContext, untrack } from "svelte";
import type { Fault, RequirementData } from "../types";
import { t } from "@transifex/native";
import RequirementDataTools from "./item/RequirementDataTools.svelte";
import { gameSingular, gameSingularName } from "../i18n/game-locale";
import RequirementsOrList from "./item/RequirementsOrList.svelte";

const data = getContext<CBNData>("data");
const _context = "Fault";

interface Props {
  item: Fault;
}

let { item: sourceItem }: Props = $props();
const item = untrack(() => sourceItem);

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

function sortComponentChoices(
  componentChoices: { id: string; count: number }[],
): { id: string; count: number }[] {
  return [...componentChoices].sort(
    (a, b) =>
      gameSingularName(data.byId("item", a.id)).localeCompare(
        gameSingularName(data.byId("item", b.id)),
      ) || a.id.localeCompare(b.id),
  );
}
</script>

<h1>{t("Fault")}: {gameSingularName(item)}</h1>

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
  <p style="color: var(--cata-color-gray)">{gameSingular(item.description)}</p>
</section>

{#if mendingMethods.length}
  <h2>{t("Mending Methods", { _context })}</h2>
{/if}

{#each mendingMethods as { components, requirement, mending_method }}
  <section>
    <h2>{gameSingularName(mending_method)}</h2>
    <dl>
      <dt>{t("Skills Used", { _context })}</dt>
      <dd>
        {#each mending_method.skills as { id, level }, i}
          <ThingLink type="skill" {id} showIcon={false} /> ({level}){#if i === mending_method.skills.length - 2}{" and "}{:else if i !== mending_method.skills.length - 1}{", "}{/if}
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
          <RequirementsAndList items={components}>
            {#snippet children({ item: componentChoices })}
              {@const sortedChoices = sortComponentChoices(componentChoices)}
              <RequirementsOrList
                items={sortedChoices}
                hideLabelWhenSingle={true}>
                {#snippet children({ item: component })}
                  <ThingLink
                    id={component.id}
                    count={component.count}
                    type="item"
                    showIcon={false} />
                {/snippet}
              </RequirementsOrList>
            {/snippet}
          </RequirementsAndList>
        </dd>
      {/if}
      {#if mending_method.turns_into}
        <dt>{t("Turns Into", { _context })}</dt>
        <dd>
          <ThingLink
            type="fault"
            id={mending_method.turns_into}
            showIcon={false} />
        </dd>
      {/if}
    </dl>
  </section>
{/each}
