<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";
import type { CBNData } from "../../data";

import type { Recipe, RequirementData } from "../../types";
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
</script>

{#if qualities?.length || tools?.length}
  <RequirementDataTools {requirement} />
{/if}
{#if components.length}
  <dt>{t("Components", { _context })}</dt>
  <dd>
    <ul>
      {#each components as componentChoices}
        <li>
          {#each componentChoices
            .map(([id, count]) => ({ id, count, item: data.byId("item", id) }))
            .filter((c) => c.item) as { id, count }, i}
            {#if i !== 0}{" OR "}{/if}
            <ThingLink type="item" {id} {count} showIcon={false} />
          {/each}
        </li>
      {/each}
    </ul>
  </dd>
{/if}
