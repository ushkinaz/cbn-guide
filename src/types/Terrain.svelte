<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";

import { CBNData, formatPercent } from "../data";
import type { Terrain } from "../types";
import Construction from "./Construction.svelte";
import ItemLink from "./ItemLink.svelte";
import TerFurnActivity from "./TerFurnActivity.svelte";
import TerrainSpawnedIn from "./item/TerrainSpawnedIn.svelte";
import HarvestedTo from "./item/HarvestedTo.svelte";
import { gameSingular } from "../i18n/gettext";

const data = getContext<CBNData>("data");
const _context = "Terrain / Furniture";

interface Props {
  item: Terrain;
}

let { item: sourceItem }: Props = $props();
const item = untrack(() => sourceItem);

const deconstruct = item.deconstruct?.items
  ? data.flattenItemGroup({
      subtype: "collection",
      entries:
        typeof item.deconstruct.items === "string"
          ? [{ group: item.deconstruct.items }]
          : item.deconstruct.items,
    })
  : [];

const bash = item.bash?.items
  ? data.flattenItemGroup({
      subtype: "collection",
      entries:
        typeof item.bash.items === "string"
          ? [{ group: item.bash.items }]
          : item.bash.items,
    })
  : [];

const constructions = data
  .byType("construction")
  .filter((c) => c.post_terrain === item.id);

const deconstructions = data
  .byType("construction")
  .filter(
    (c) => c.pre_special === "check_deconstruct" && c.pre_terrain === item.id,
  );
</script>

<h1><ItemLink type="terrain" id={item.id} link={false} /></h1>

<section>
  <dl>
    <dt>{t("Move Cost", { _context })}</dt>
    <dd>{item.move_cost ?? 100}</dd>
    <dt>{t("Coverage", { _context })}</dt>
    <dd>{item.coverage ?? 0}%</dd>
    {#if item.transforms_into}
      <dt>{t("Transforms Into", { _context })}</dt>
      <dd>
        <ItemLink id={item.transforms_into} type="terrain" />
      </dd>
    {/if}
    {#if item.boltcut}
      <dt><ItemLink type="item_action" id="BOLTCUTTERS" showIcon={false} /></dt>
      <dd>
        <TerFurnActivity act={item.boltcut} resultType="terrain" />
      </dd>
    {/if}
    {#if item.hacksaw}
      <dt><ItemLink type="item_action" id="HACKSAW" showIcon={false} /></dt>
      <dd>
        <TerFurnActivity act={item.hacksaw} resultType="terrain" />
      </dd>
    {/if}
    {#if item.oxytorch}
      <dt><ItemLink type="item_action" id="OXYTORCH" showIcon={false} /></dt>
      <dd>
        <TerFurnActivity act={item.oxytorch} resultType="terrain" />
      </dd>
    {/if}
    {#if item.prying}
      <dt><ItemLink type="item_action" id="CROWBAR" showIcon={false} /></dt>
      <dd>
        <TerFurnActivity act={item.prying} resultType="terrain" />
      </dd>
    {/if}
    {#if deconstruct.length || item.deconstruct?.ter_set}
      <dt>{t("Deconstruct", { _context })}</dt>
      <dd>
        {#if deconstruct.length}
          <ul class="comma-separated">
            <!-- prettier-ignore -->
            {#each deconstruct as {id, prob, count}}
            <li><span style="white-space: nowrap"><ItemLink type="item" {id}  showIcon={false} />{
              ''}{#if count[0] === count[1]}{#if count[0] !== 1}&nbsp;({count[0]}){/if}{:else}&nbsp;({count[0]}–{count[1]}){/if}{
              ''}{#if prob !== 1}&nbsp;({formatPercent(prob)}){/if}</span></li>
            {/each}
          </ul>
        {/if}
        {#if item.deconstruct?.ter_set}
          {@const becomes = item.deconstruct.ter_set}
          <dl>
            <dt>{t("Becomes", { _context })}</dt>
            <dd>
              <ItemLink type="terrain" id={becomes} />
            </dd>
          </dl>
        {/if}
      </dd>
    {/if}
    {#if bash.length}
      <dt>{t("Bash", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          <!-- prettier-ignore -->
          {#each bash as {id, prob, count}}
            <li><span style="white-space: nowrap"><ItemLink type="item" {id}  showIcon={false} />{
              ''}{#if count[0] === count[1]}{#if count[0] !== 1}&nbsp;({count[0]}){/if}{:else}&nbsp;({count[0]}–{count[1]}){/if}{
              ''}{#if prob !== 1}&nbsp;({formatPercent(prob)}){/if}</span></li>
            {/each}
        </ul>
      </dd>
    {/if}
    <HarvestedTo {item} />
    <dt>{t("Flags")}</dt>
    <dd>
      <ul class="comma-separated">
        {#each item.flags ?? [] as flag}
          <li><ItemLink type="json_flag" id={flag} showIcon={false} /></li>
        {:else}
          <li><em>{t("none")}</em></li>
        {/each}
      </ul>
    </dd>
  </dl>
  <p style="color: var(--cata-color-gray); margin-bottom: 0;">
    {gameSingular(item.description)}
  </p>
</section>

{#if constructions.length}
  <h2>{t("Construction", { _context })}</h2>
  {#each constructions as construction}
    <Construction {construction} includeTitle />
  {/each}
{/if}

{#if deconstructions.length}
  <h2>{t("Deconstruction", { _context })}</h2>
  {#each deconstructions as construction}
    <Construction {construction} includeTitle={false} includeRequires={false} />
  {/each}
{/if}

<TerrainSpawnedIn item_id={item.id} />
