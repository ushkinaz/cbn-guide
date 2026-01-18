<script lang="ts">
import { t } from "../../i18n";
import InterpolatedTranslation from "../../InterpolatedTranslation.svelte";

import { getContext } from "svelte";
import { CBNData, i18n, singularName } from "../../data";
import { getVersionedBasePath } from "../../routing";

import type { Recipe, RequirementData } from "../../types";
import ItemLink from "../ItemLink.svelte";

export let requirement: RequirementData & { using?: Recipe["using"] };
export let direction: "uncraft" | "craft" = "craft";

const _context = "Requirement";
const data = getContext<CBNData>("data");

let { tools, qualities } =
  direction === "craft"
    ? data.normalizeRequirements(requirement)
    : data.normalizeRequirementsForDisassembly(requirement);
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
              <ItemLink
                type="tool_quality"
                id={quality.id}
                slot="0"
                showIcon={false} />
            </InterpolatedTranslation>{/each}
        </li>
      {/each}
      {#each tools as toolChoices}
        <li>
          {#each toolChoices as [toolId, count], i}
            {#if i !== 0}{i18n.__(" OR ")}{/if}
            {#if count <= 0}
              {#if data.craftingPseudoItem(toolId)}
                <a
                  href="{getVersionedBasePath()}furniture/{data.craftingPseudoItem(
                    toolId,
                  )}{location.search}"
                  >{singularName(data.byId("item", toolId))}</a>
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
                <svelte:fragment slot="0">
                  {#if data.craftingPseudoItem(toolId)}
                    <a
                      href="{getVersionedBasePath()}furniture/{data.craftingPseudoItem(
                        toolId,
                      )}{location.search}"
                      >{singularName(data.byId("item", toolId))}</a>
                  {:else}
                    <ItemLink type="item" id={toolId} showIcon={false} />
                  {/if}
                </svelte:fragment>
              </InterpolatedTranslation>
            {/if}
          {/each}
        </li>
      {/each}
    </ul>
  </dd>
{/if}
