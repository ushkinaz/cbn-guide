<script lang="ts">
import { t } from "../i18n";

import { singularName } from "../data";
import type { MartialArtBuff, MartialArtRequirements } from "../types";
import ItemLink from "./ItemLink.svelte";

const _context = "Martial Art";

export let item: MartialArtRequirements;
export let buffMap: Map<string, MartialArtBuff> = new Map();

const requiredBuffs =
  typeof item.req_buffs === "string"
    ? [item.req_buffs]
    : (item.req_buffs ?? []);
</script>

<dt>{t("Required Skills")}</dt>
<dd>
  {#if item.skill_requirements?.length}
    <ul class="comma-separated and">
      {#each item.skill_requirements ?? [] as { name, level }}
        <li><ItemLink type="skill" id={name} showIcon={false} /> ({level})</li>
      {/each}
    </ul>
  {:else}
    <em>{t("none")}</em>
  {/if}
</dd>
{#if requiredBuffs.length}
  <dt>{t("Required Buffs", { _context })}</dt>
  <dd>
    <ul class="comma-separated">
      {#each requiredBuffs as buf}
        {#if buffMap.has(buf)}
          <li>{singularName(buffMap.get(buf))}</li>
        {:else}
          <li>{buf}</li>
        {/if}
      {/each}
    </ul>
  </dd>
{/if}
{#if item.wall_adjacent}
  <dt>{t("Requires Adjacent Wall", { _context })}</dt>
  <dd>{t("Yes")}</dd>
{/if}
<dt>{t("Melee Weapon Allowed", { _context })}</dt>
<dd>{item.melee_allowed ? t("Yes") : t("No")}</dd>
<dt>{t("Unarmed Allowed", { _context })}</dt>
<dd>{item.unarmed_allowed ? t("Yes") : t("No")}</dd>
<dt>{t("Unarmed Weapon Allowed", { _context })}</dt>
<dd>{(item.unarmed_weapons_allowed ?? true) ? t("Yes") : t("No")}</dd>
