<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";

import { CddaData, showProbability, singular, singularName } from "../data";
import type { Terrain } from "../types";
import Construction from "./Construction.svelte";
import ItemSymbol from "./item/ItemSymbol.svelte";
import TerFurnActivity from "./TerFurnActivity.svelte";
import ThingLink from "./ThingLink.svelte";
import TerrainSpawnedIn from "./item/TerrainSpawnedIn.svelte";
import HarvestedTo from "./item/HarvestedTo.svelte";

const data = getContext<CddaData>("data");
const _context = "Terrain / Furniture";

export let item: Terrain;

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

const bits = [
  [t("Deconstruct", { _context }), deconstruct],
  [t("Bash", { _context }), bash],
] as const;

const constructions = data
  .byType("construction")
  .filter((c) => c.post_terrain === item.id);
</script>

<h1>
  <ItemSymbol {item} />
  {singularName(item)}
</h1>

<section>
  <dl>
    <dt>{t("Move Cost", { _context })}</dt>
    <dd>{item.move_cost ?? 100}</dd>
    <dt>{t("Coverage", { _context })}</dt>
    <dd>{item.coverage ?? 0}%</dd>
    {#if item.transforms_into}
      <dt>{t("Transforms Into", { _context })}</dt>
      <dd>
        <ItemSymbol item={data.byId("terrain", item.transforms_into)} />
        <ThingLink id={item.transforms_into} type="terrain" />
      </dd>
    {/if}
    {#if item.boltcut}
      <dt><ThingLink type="item_action" id="BOLTCUTTERS" /></dt>
      <dd>
        <TerFurnActivity act={item.boltcut} resultType="terrain" />
      </dd>
    {/if}
    {#if item.hacksaw}
      <dt><ThingLink type="item_action" id="HACKSAW" /></dt>
      <dd>
        <TerFurnActivity act={item.hacksaw} resultType="terrain" />
      </dd>
    {/if}
    {#if item.oxytorch}
      <dt><ThingLink type="item_action" id="OXYTORCH" /></dt>
      <dd>
        <TerFurnActivity act={item.oxytorch} resultType="terrain" />
      </dd>
    {/if}
    {#if item.prying}
      <dt><ThingLink type="item_action" id="CROWBAR" /></dt>
      <dd>
        <TerFurnActivity act={item.prying} resultType="terrain" />
      </dd>
    {/if}
    {#each bits as [title, arr]}
      {#if arr.length}
        <dt>{title}</dt>
        <dd>
          <ul class="comma-separated">
            <!-- prettier-ignore -->
            {#each arr as {id, prob, count}}
            <li><span style="white-space: nowrap"><ThingLink type="item" {id} />{
              ''}{#if count[0] === count[1]}{#if count[0] !== 1}&nbsp;({count[0]}){/if}{:else}&nbsp;({count[0]}–{count[1]}){/if}{
              ''}{#if prob !== 1}&nbsp;({showProbability(prob)}){/if}</span></li>
            {/each}
          </ul>
        </dd>
      {/if}
    {/each}
    <HarvestedTo {item} />
    <dt>{t("Flags")}</dt>
    <dd>
      <ul class="comma-separated">
        {#each item.flags ?? [] as flag}
          <li><ThingLink type="json_flag" id={flag} /></li>
        {:else}
          <li><em>{t("none")}</em></li>
        {/each}
      </ul>
    </dd>
  </dl>
  <p style="color: var(--cata-color-gray); margin-bottom: 0;">
    {singular(item.description)}
  </p>
</section>

{#if constructions.length}
  <h2>{t("Construction", { _context })}</h2>
  {#each constructions as construction}
    <Construction {construction} includeTitle />
  {/each}
{/if}

<TerrainSpawnedIn item_id={item.id} />
