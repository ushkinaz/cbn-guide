<script lang="ts">
import { t } from "@transifex/native";
import { getContext, untrack } from "svelte";
import { countsByCharges, type CBNData } from "../data";
import type { Trap, TrapDrop } from "../types";
import LimitedList from "../LimitedList.svelte";
import ItemLink from "./ItemLink.svelte";

const data = getContext<CBNData>("data");
const _context = "Trap";

interface Props {
  item: Trap;
}

let { item: sourceItem }: Props = $props();
const item = untrack(() => sourceItem);

const actionNames: Record<string, string> = {
  none: t("None", { _context: "Trap action" }),
  crossbow: t("Crossbow Shot", { _context: "Trap action" }),
  board: t("Spiked Board", { _context: "Trap action" }),
  beartrap: t("Bear Trap", { _context: "Trap action" }),
  landmine: t("Landmine Explosion", { _context: "Trap action" }),
  shotgun: t("Shotgun Blast", { _context: "Trap action" }),
  blade: t("Blade", { _context: "Trap action" }),
  caltrops: t("Caltrops", { _context: "Trap action" }),
  tripwire: t("Tripwire", { _context: "Trap action" }),
  pit: t("Pit", { _context: "Trap action" }),
  lava: t("Lava", { _context: "Trap action" }),
  snake: t("Snake Ambush", { _context: "Trap action" }),
};

const actionTitle = actionNames[item.action] || item.action;
const constructingItems = data.constructsTrap(item.id);

function dropCount(drop: Exclude<TrapDrop, string>): number | undefined {
  if (!drop.item) return undefined;
  const linkedItem = data.byIdMaybe("item", drop.item);
  if (
    linkedItem &&
    drop.quantity != null &&
    drop.charges != null &&
    countsByCharges(linkedItem)
  ) {
    return drop.quantity * drop.charges;
  }
  return drop.quantity ?? drop.charges;
}
</script>

<h1><ItemLink type="trap" id={item.id} link={false} /></h1>

<section>
  <dl>
    {#if item.action}
      <dt>{t("Action", { _context })}</dt>
      <dd>{actionTitle}</dd>
    {/if}

    {#if item.always_invisible}
      <dt>{t("Always Invisible", { _context })}</dt>
      <dd>{t("Yes")}</dd>
    {/if}

    <dt>{t("Visibility", { _context })}</dt>
    <dd>
      {item.visibility < 0
        ? t("Always visible", { _context })
        : item.visibility}
    </dd>

    <dt>{t("Avoidance", { _context })}</dt>
    <dd>{item.avoidance}</dd>

    <dt>{t("Difficulty", { _context })}</dt>
    <dd>{item.difficulty}</dd>

    {#if item.benign}
      <dt>{t("Benign", { _context })}</dt>
      <dd>{t("Yes")}</dd>
    {/if}

    {#if item.trigger_weight}
      <dt>{t("Trigger Weight", { _context })}</dt>
      <dd>{item.trigger_weight}</dd>
    {/if}

    {#if item.remove_on_trigger}
      <dt>{t("Remove on trigger", { _context })}</dt>
      <dd>{t("Yes")}</dd>
    {/if}

    {#if item.trap_radius && item.trap_radius > 0}
      <dt>{t("Trap Radius", { _context })}</dt>
      <dd>{item.trap_radius}</dd>
    {/if}

    {#if item.funnel_radius && item.funnel_radius > 0}
      <dt>{t("Funnel Radius", { _context })}</dt>
      <dd>{item.funnel_radius} {t("mm", { _context })}</dd>
    {/if}

    {#if item.comfort && item.comfort !== 0}
      <dt>{t("Comfort", { _context })}</dt>
      <dd>{item.comfort}</dd>
    {/if}

    {#if item.floor_bedding_warmth && item.floor_bedding_warmth !== 0}
      <dt>{t("Floor Bedding Warmth", { _context })}</dt>
      <dd>{item.floor_bedding_warmth}</dd>
    {/if}

    {#if item.drops && item.drops.length > 0}
      <dt>{t("Disarm drops", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.drops as drop}
            <li>
              {#if typeof drop === "string"}
                <ItemLink type="item" id={drop} />
              {:else if drop.item}
                <ItemLink type="item" id={drop.item} count={dropCount(drop)} />
              {/if}
            </li>
          {/each}
        </ul>
      </dd>
    {/if}

    {#if item.trigger_items && item.trigger_items.length > 0}
      <dt>{t("Trigger drops", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.trigger_items as drop}
            <li>
              {#if typeof drop === "string"}
                <ItemLink type="item" id={drop} />
              {:else if drop.item}
                <ItemLink type="item" id={drop.item} count={dropCount(drop)} />
              {/if}
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
  </dl>
</section>

{#if constructingItems.length}
  <section>
    <h2>{t("Construction", { _context })}</h2>
    <LimitedList items={constructingItems}>
      {#snippet children({ item: constructionItem })}
        <ItemLink type="item" id={constructionItem.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}
