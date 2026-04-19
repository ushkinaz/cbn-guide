<script lang="ts">
import { t } from "@transifex/native";
import { getContext, untrack } from "svelte";

import { CBNData } from "../../data";

import type { Recipe, RequirementData } from "../../types";
import ThingLink from "../ThingLink.svelte";
import { gameSingularName } from "../../i18n/game-locale";
import ToolQualityLink from "../ToolQualityLink.svelte";

interface Props {
  requirement: RequirementData & { using?: Recipe["using"] };
  direction?: "uncraft" | "craft";
}

let {
  requirement: sourceRequirement,
  direction: sourceDirection = "craft",
}: Props = $props();
const requirement = untrack(() => sourceRequirement);
const direction = untrack(() => sourceDirection);

const _context = "Requirement";
const data = getContext<CBNData>("data");

let { tools, qualities } =
  direction === "craft"
    ? data.normalizeRequirements(requirement)
    : data.normalizeRequirementsForDisassembly(requirement);

type ExactToolChoice = {
  id: string;
  type: "furniture" | "item";
  count: number;
};

function exactToolChoiceName(choice: ExactToolChoice): string {
  return gameSingularName(data.byId(choice.type, choice.id));
}

function exactToolChoices(toolChoices: [string, number][]): ExactToolChoice[] {
  const exactChoices: ExactToolChoice[] = [];

  for (const [toolId, count] of toolChoices) {
    const furnitureProviders = data
      .craftingPseudoItems(toolId)
      .map((id) => ({ id, type: "furniture" as const, count }));

    if (furnitureProviders.length) exactChoices.push(...furnitureProviders);
    else exactChoices.push({ id: toolId, type: "item", count });
  }

  exactChoices.sort(
    (a, b) =>
      exactToolChoiceName(a).localeCompare(exactToolChoiceName(b)) ||
      a.type.localeCompare(b.type) ||
      a.id.localeCompare(b.id),
  );

  return exactChoices;
}
</script>

{#if qualities?.length || tools.length}
  <dt>{t("Tools Required", { _context })}</dt>
  <dd>
    <ul>
      {#each qualities ?? [] as qualityChoices}
        <li>
          {#each qualityChoices as quality, i}
            {#if i !== 0}{" OR "}{/if}
            <ToolQualityLink
              id={quality.id}
              count={quality.amount}
              level={quality.level} />
          {/each}
        </li>
      {/each}
      {#each tools as toolChoices}
        {@const tc = exactToolChoices(toolChoices)}
        <li>
          {#each tc as exactChoice, i}
            {#if i !== 0}{" OR "}{/if}
            {@const charges = exactChoice.count}
            {#if charges <= 0}
              <ThingLink
                type={exactChoice.type}
                id={exactChoice.id}
                showIcon={false} />
            {:else}
              <ThingLink
                type={exactChoice.type}
                id={exactChoice.id}
                showIcon={false} />&nbsp;
              {t("{charges} {charges, plural, =1 {charge} other {charges}}", {
                charges,
              })}
            {/if}
          {/each}
        </li>
      {/each}
    </ul>
  </dd>
{/if}
