<script lang="ts">
import { t } from "@transifex/native";
import { getContext, untrack } from "svelte";

import InterpolatedTranslation from "../../InterpolatedTranslation.svelte";
import { CBNData } from "../../data";

import type { Recipe, RequirementData } from "../../types";
import ItemLink from "../ItemLink.svelte";
import { gameSingularName, i18n } from "../../i18n/gettext";
import { buildLinkTo } from "../../navigation.svelte";

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

function furnLink(id: string): string {
  return buildLinkTo({
    kind: "item",
    type: "furniture",
    id,
  });
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
            <InterpolatedTranslation
              str={i18n
                ._n(
                  "%1$d tool with %2$s of %3$d or more.",
                  "%1$d tools with %2$s of %3$d or more.",
                  quality.amount ?? 1,
                  quality.amount ?? 1,
                  "{tool_quality}",
                  quality.level,
                )
                .replace(/\$./g, "")}
              slot0="tool_quality">
              {#snippet _0()}
                <ItemLink
                  type="tool_quality"
                  id={quality.id}
                  showIcon={false} />
              {/snippet}
            </InterpolatedTranslation>{/each}
        </li>
      {/each}
      {#each tools as toolChoices}
        <li>
          {#each toolChoices as [toolId, count], i}
            {#if i !== 0}{i18n.__(" OR ")}{/if}
            {#if count <= 0}
              {#if data.craftingPseudoItem(toolId)}
                <a href={furnLink(data.craftingPseudoItem(toolId)!)}
                  >{gameSingularName(data.byId("item", toolId))}</a>
              {:else}
                <ItemLink type="item" id={toolId} showIcon={false} />
              {/if}
            {:else}
              <InterpolatedTranslation
                str={i18n
                  .dcnpgettext(
                    null,
                    "requirement",
                    "%1$s (%2$d charge)",
                    "%1$s (%2$d charges)",
                    count,
                    "{item}",
                    count,
                  )
                  .replace(/\$./g, "")}
                slot0="item">
                {#snippet _0()}
                  {#if data.craftingPseudoItem(toolId)}
                    <a href={furnLink(data.craftingPseudoItem(toolId)!)}
                      >{gameSingularName(data.byId("item", toolId))}</a>
                  {:else}
                    <ItemLink type="item" id={toolId} showIcon={false} />
                  {/if}
                {/snippet}
              </InterpolatedTranslation>
            {/if}
          {/each}
        </li>
      {/each}
    </ul>
  </dd>
{/if}
