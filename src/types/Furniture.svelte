<script lang="ts">
import { CBNData } from "../data";
import type { Furniture } from "../types";
import { getContext, untrack } from "svelte";
import { asArray } from "../utils/collections";
import Construction from "./Construction.svelte";
import ThingLink from "./ThingLink.svelte";
import { t } from "@transifex/native";
import TerFurnActivity from "./TerFurnActivity.svelte";
import FurnitureSpawnedIn from "./item/FurnitureSpawnedIn.svelte";
import LimitedList from "../LimitedList.svelte";
import HarvestedTo from "./item/HarvestedTo.svelte";
import { gameSingular } from "../i18n/game-locale";
import TerFurnPry from "./TerFurnPry.svelte";
import { formatPercent } from "../utils/format";

const data = getContext<CBNData>("data");
const _context = "Terrain / Furniture";

interface Props {
  item: Furniture;
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
  .filter((c) => c.post_furniture === item.id);

const deconstructions = data
  .byType("construction")
  .filter(
    (c) => c.pre_special === "check_deconstruct" && c.pre_furniture === item.id,
  );

const bashedFrom = data
  .byType("furniture")
  .filter((f) => f.id && f.bash?.furn_set === item.id);

const pseudo_items: string[] = asArray(item.crafting_pseudo_item);
</script>

<h1><ThingLink type="furniture" id={item.id} link={false} /></h1>

<section>
  <h2>{t("General", { _context })}</h2>
  <dl>
    <dt>{t("Move Cost Modifier", { _context })}</dt>
    <dd>
      {#if item.move_cost_mod < 0}<em>{t("impassable", { _context })}</em
        >{:else}+{item.move_cost_mod * 50}{/if}
    </dd>
    <dt>{t("Strength Required to Drag", { _context })}</dt>
    <dd>{item.required_str >= 0 ? item.required_str : "not movable"}</dd>
    <dt>{t("Coverage", { _context })}</dt>
    <dd>{item.coverage ?? 0}%</dd>
    {#if item.comfort}
      <dt>{t("Comfort", { _context })}</dt>
      <dd>{item.comfort}</dd>
    {/if}
    {#if item.max_volume}
      <dt>{t("Max Volume", { _context })}</dt>
      <dd>{item.max_volume}</dd>
    {/if}
    {#if pseudo_items.length}
      <dt>{t("Provides", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each pseudo_items as pseudo_item}
            <li><ThingLink type="item" id={pseudo_item} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    <HarvestedTo {item} />
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
  <p style="color: var(--cata-color-gray)">{gameSingular(item.description)}</p>
</section>

<h2>{t("Dismantling")}</h2>
{#if item.boltcut}
  <section>
    <h3>
      <ThingLink type="item_action" id="BOLTCUTTERS" showIcon={false} />
    </h3>
    <TerFurnActivity act={item.boltcut} resultType="furniture" />
  </section>
{/if}
{#if item.hacksaw}
  <section>
    <h3><ThingLink type="item_action" id="HACKSAW" showIcon={false} /></h3>
    <TerFurnActivity act={item.hacksaw} resultType="furniture" />
  </section>
{/if}
{#if item.oxytorch}
  <section>
    <h3><ThingLink type="item_action" id="OXYTORCH" showIcon={false} /></h3>
    <TerFurnActivity act={item.oxytorch} resultType="furniture" />
  </section>
{/if}
{#if item.pry}
  <section>
    <h3><ThingLink type="item_action" id="CROWBAR" showIcon={false} /></h3>
    <TerFurnPry act={item.pry} resultType="furniture" />
  </section>
{/if}
{#if deconstruct.length}
  <section>
    <h3>{t("Deconstruct", { _context })}</h3>
    <dl>
      {#if item.deconstruct?.furn_set}
        {@const becomes = item.deconstruct.furn_set}
        <dt>{t("Becomes", { _context })}</dt>
        <dd>
          <ThingLink type="furniture" id={becomes} showIcon={true} />
        </dd>
      {/if}
      <dt>{t("Salvage")}</dt>
      <dd>
        <ul class="no-bullets">
          {#each deconstruct as { id, prob, count }}
            <!--        TODO: fix this ugliness-->
            <li>
              <ThingLink
                type="item"
                {id}
                showIcon={true}
                {count} />{#if prob !== 1}{formatPercent(prob)}{/if}
            </li>
          {/each}
        </ul>
      </dd>
    </dl>
  </section>
{/if}
{#if bash.length}
  <section>
    <h3>{t("Bash", { _context })}</h3>
    <dl>
      {#if item.bash?.furn_set && item.bash?.furn_set !== "f_null"}
        {@const becomes = item.bash.furn_set}
        <dt>{t("Becomes", { _context })}</dt>
        <dd>
          <ThingLink type="furniture" id={becomes} showIcon={true} />
        </dd>
      {/if}
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

{#if constructions.length}
  <h2>{t("Construction", { _context })}</h2>
  {#each constructions as construction}
    <Construction {construction} includeTitle={true} includeRequires={false} />
  {/each}
{/if}

{#if deconstructions.length}
  <h2>{t("Deconstruction", { _context })}</h2>
  {#each deconstructions as construction}
    <Construction {construction} includeTitle={false} includeRequires={false} />
  {/each}
{/if}

{#if bashedFrom.length}
  <section>
    <h2>{t("Bashed From", { _context })}</h2>
    <LimitedList items={bashedFrom}>
      {#snippet children({ item })}
        <ThingLink type="furniture" id={item.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}

<FurnitureSpawnedIn item_id={item.id} />
