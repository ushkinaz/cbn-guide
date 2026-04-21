<script lang="ts">
import { t } from "@transifex/native";
import { getContext, untrack } from "svelte";

import RequirementsAndList from "./RequirementsAndList.svelte";
import { CBNData } from "../../data";

import type { Recipe, RequirementData } from "../../types";
import { gameSingularName } from "../../i18n/game-locale";
import RequirementsOrList from "./RequirementsOrList.svelte";
import ThingLink from "../ThingLink.svelte";
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

type RequirementChoiceRow =
  | {
      kind: "quality";
      choices: { id: string; level?: number; amount?: number }[];
    }
  | {
      kind: "tool";
      choices: ExactToolChoice[];
    };

function exactToolChoiceName(choice: ExactToolChoice): string {
  return gameSingularName(data.byId(choice.type, choice.id));
}

function qualityChoiceName(choice: {
  id: string;
  level?: number;
  amount?: number;
}): string {
  return gameSingularName(data.byId("tool_quality", choice.id));
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

function sortedQualityChoices(
  qualityChoices: { id: string; level?: number; amount?: number }[],
): { id: string; level?: number; amount?: number }[] {
  return [...qualityChoices].sort(
    (a, b) =>
      qualityChoiceName(a).localeCompare(qualityChoiceName(b)) ||
      (a.level ?? 0) - (b.level ?? 0) ||
      a.id.localeCompare(b.id),
  );
}

let rows = $derived.by((): RequirementChoiceRow[] => [
  ...(qualities ?? []).map((qualityChoices) => ({
    kind: "quality" as const,
    choices: sortedQualityChoices(qualityChoices),
  })),
  ...tools.map((toolChoices) => ({
    kind: "tool" as const,
    choices: exactToolChoices(toolChoices),
  })),
]);
</script>

{#if rows.length}
  <dt>{t("Tools Required", { _context })}</dt>
  <dd>
    <RequirementsAndList items={rows}>
      {#snippet children({ item: row })}
        <RequirementsOrList items={row.choices} hideLabelWhenSingle={true}>
          {#snippet children({ item: choice })}
            {#if row.kind === "quality"}
              <ToolQualityLink
                id={choice.id}
                count={choice.amount}
                level={choice.level} />
            {:else}
              {@const charges = choice.count}
              {#if charges <= 0}
                <ThingLink type={choice.type} id={choice.id} showIcon={false} />
              {:else}
                <ThingLink type={choice.type} id={choice.id} showIcon={false} />
                {t("{charges} {charges, plural, =1 {charge} other {charges}}", {
                  charges,
                })}
              {/if}
            {/if}
          {/snippet}
        </RequirementsOrList>
      {/snippet}
    </RequirementsAndList>
  </dd>
{/if}
