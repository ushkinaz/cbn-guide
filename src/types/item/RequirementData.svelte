<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";
import type { CBNData } from "../../data";

import type { Recipe, RequirementData } from "../../types";
import RequirementsAndList from "./RequirementsAndList.svelte";
import { gameSingularName } from "../../i18n/game-locale";
import RequirementsOrList from "./RequirementsOrList.svelte";
import ThingLink from "../ThingLink.svelte";
import RequirementDataTools from "./RequirementDataTools.svelte";

const _context = "Requirement";
interface Props {
  requirement: RequirementData & { using?: Recipe["using"] };
}

let { requirement: sourceRequirement }: Props = $props();
const requirement = untrack(() => sourceRequirement);

const data = getContext<CBNData>("data");

let { tools, qualities, components } = data.normalizeRequirements(requirement);

type SortableComponentChoice = {
  id: string;
  count: number;
  itemName: string;
};

function isSortableComponentChoice(component: {
  id: string;
  count: number;
  itemName: string | null;
}): component is SortableComponentChoice {
  return component.itemName !== null;
}

function sortComponentChoices(
  componentChoices: [string, number][],
): { id: string; count: number }[] {
  return componentChoices
    .map(([id, count]) => ({
      id,
      count,
      itemName: data.byIdMaybe("item", id)
        ? gameSingularName(data.byId("item", id))
        : null,
    }))
    .filter(isSortableComponentChoice)
    .sort(
      (a, b) =>
        a.itemName.localeCompare(b.itemName) || a.id.localeCompare(b.id),
    )
    .map(({ id, count }) => ({ id, count }));
}
</script>

{#if qualities?.length || tools?.length}
  <RequirementDataTools {requirement} />
{/if}
{#if components.length}
  <dt>{t("Components", { _context })}</dt>
  <dd>
    <RequirementsAndList items={components}>
      {#snippet children({ item: componentChoices })}
        {@const componentItems = sortComponentChoices(componentChoices)}
        <RequirementsOrList items={componentItems}>
          {#snippet children({ item: component })}
            <ThingLink
              type="item"
              id={component.id}
              count={component.count}
              showIcon={false} />
          {/snippet}
        </RequirementsOrList>
      {/snippet}
    </RequirementsAndList>
  </dd>
{/if}
