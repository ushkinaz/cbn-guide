<script lang="ts">
import { t } from "@transifex/native";
import { getContext, untrack } from "svelte";

import InterpolatedTranslation from "../../InterpolatedTranslation.svelte";
import { CBNData } from "../../data";

import type { Recipe, RequirementData } from "../../types";
import ThingLink from "../ThingLink.svelte";
import { gameSingularName, i18n } from "../../i18n/game-locale";
import { buildLinkTo } from "../../navigation.svelte";
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
    <ul class="no-bullets">
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
        <li>
          {#each toolChoices as [toolId, count], i}
            {#if i !== 0}{i18n.__(" OR ")}{/if}
            {#if count <= 0}
              {#if data.craftingPseudoItem(toolId)}
                <a href={furnLink(data.craftingPseudoItem(toolId)!)}
                  >{gameSingularName(data.byId("item", toolId))}</a>
              {:else}
                <ThingLink type="item" id={toolId} showIcon={false} />
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
                    <ThingLink type="item" id={toolId} showIcon={false} />
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
