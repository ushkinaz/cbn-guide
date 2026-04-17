<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";

import { CBNData, formatPercent } from "../data";
import type { Terrain } from "../types";
import Construction from "./Construction.svelte";
import ThingLink from "./ThingLink.svelte";
import TerFurnActivity from "./TerFurnActivity.svelte";
import TerrainSpawnedIn from "./item/TerrainSpawnedIn.svelte";
import HarvestedTo from "./item/HarvestedTo.svelte";
import { gameSingular } from "../i18n/game-locale";
import TerFurnPry from "./TerFurnPry.svelte";

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

<h1><ThingLink type="terrain" id={item.id} link={false} /></h1>

<section>
  <dl>
    <dt>{t("Move Cost", { _context })}</dt>
    <dd>{item.move_cost ?? 100}</dd>
    <dt>{t("Coverage", { _context })}</dt>
    <dd>{item.coverage ?? 0}%</dd>
    {#if item.transforms_into}
      <dt>{t("Transforms Into", { _context })}</dt>
      <dd>
        <ThingLink id={item.transforms_into} type="terrain" />
      </dd>
    {/if}
    <dt>{t("Flags")}</dt>
    <dd>
      <ul class="comma-separated">
        {#each item.flags ?? [] as flag}
          <li><ThingLink type="json_flag" id={flag} showIcon={false} /></li>
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

<h2>{t("Dismantling")}</h2>
{#if item.boltcut}
  <section>
    <h3>
      <ThingLink type="item_action" id="BOLTCUTTERS" showIcon={false} />
    </h3>
    <TerFurnActivity act={item.boltcut} resultType="terrain" />
  </section>
{/if}
{#if item.hacksaw}
  <section>
    <h3><ThingLink type="item_action" id="HACKSAW" showIcon={false} /></h3>
    <TerFurnActivity act={item.hacksaw} resultType="terrain" />
  </section>
{/if}
{#if item.oxytorch}
  <section>
    <h3><ThingLink type="item_action" id="OXYTORCH" showIcon={false} /></h3>
    <TerFurnActivity act={item.oxytorch} resultType="terrain" />
  </section>
{/if}
{#if item.pry}
  <section>
    <h3><ThingLink type="item_action" id="CROWBAR" showIcon={false} /></h3>
    <TerFurnPry act={item.pry} resultType="terrain" />
  </section>
{/if}
{#if deconstruct.length || item.deconstruct?.ter_set}
  <section>
    <h3>{t("Deconstruct", { _context })}</h3>
    <dl>
      {#if item.deconstruct?.ter_set}
        {@const becomes = item.deconstruct.ter_set}
        <dt>{t("Becomes", { _context })}</dt>
        <dd>
          <ThingLink type="terrain" id={becomes} showIcon={true} />
        </dd>
      {/if}
      {#if deconstruct.length}
        <dt>{t("Salvage")}</dt>
        <dd>
          <ul class="no-bullets">
            {#each deconstruct as { id, prob, count }}
              <li>
                <ThingLink
                  type="item"
                  {id}
                  showIcon={true}
                  {count} />{#if prob !== 1}({formatPercent(prob)}){/if}
              </li>
            {/each}
          </ul>
        </dd>
      {/if}
    </dl>
  </section>
{/if}
{#if bash.length}
  <section>
    <h3>{t("Bash", { _context })}</h3>
    <dl>
      <dt>{t("Salvage")}</dt>
      <dd>
        <ul class="no-bullets">
          {#each bash as { id, prob, count }}
            <li>
              <ThingLink
                type="item"
                {id}
                showIcon={true}
                {count} />{#if prob !== 1}({formatPercent(prob)}){/if}
            </li>
          {/each}
        </ul>
      </dd>
      <dt>{t("Min Str", { _context })}</dt>
      <dd>{item.bash?.str_min ?? 0}</dd>
      {#if item.bash?.str_max}
        <dt>{t("Max Str", { _context })}</dt>
        <dd>{item.bash?.str_max ?? 0}</dd>
      {/if}
    </dl>
  </section>
{/if}
<HarvestedTo {item} />
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
