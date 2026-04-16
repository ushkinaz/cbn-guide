<script lang="ts">
import { t } from "@transifex/native";
import { formatPercent } from "../data";
import type {
  FurniturePryData,
  ItemGroupEntry,
  TerrainPryData,
} from "src/types";
import { untrack } from "svelte";
import ThingLink from "./ThingLink.svelte";

type PryData = TerrainPryData | FurniturePryData;
type PryItemEntry = ItemGroupEntry & { item: string };

interface Props {
  act: PryData;
  resultType: "terrain" | "furniture";
}

let { act, resultType }: Props = $props();

const pry = untrack(() => act);
const result = untrack(() => visibleResult(act, resultType));
const pryItems = untrack(() => (act.pry_items ?? []).filter(isItemEntry));
const breakItems = untrack(() => (act.break_items ?? []).filter(isItemEntry));

function isItemEntry(entry: ItemGroupEntry): entry is PryItemEntry {
  return "item" in entry;
}

function formatAmount(
  value?: number | [number, number],
  hideOne = false,
): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "number") {
    return hideOne && value === 1 ? undefined : String(value);
  }
  if (value[0] === value[1]) {
    return hideOne && value[0] === 1 ? undefined : String(value[0]);
  }
  return `${value[0]}–${value[1]}`;
}

function formatProbability(prob?: number): string | undefined {
  if (prob == null || prob === 1) {
    return undefined;
  }
  return prob > 1 ? `${prob}%` : formatPercent(prob);
}

function visibleResult(
  value: PryData,
  resultType: "terrain" | "furniture",
): string | undefined {
  let result = undefined;
  if (resultType === "terrain") {
    result = "new_ter_type" in value ? value.new_ter_type : undefined;
  } else if (resultType === "furniture") {
    result = "new_furn_type" in value ? value.new_furn_type : undefined;
  }
  if (result === (resultType === "terrain" ? "t_null" : "f_null")) {
    return undefined;
  }
  return result;
}

const _context = "Terrain / Furniture";
const _comment = "prying";
</script>

<dl>
  <dt>{t("Difficulty", { _context, _comment })}</dt>
  <dd>{pry.difficulty ?? 1}</dd>
  <dt>{t("Requires", { _context, _comment })}</dt>
  <dd>
    <ThingLink id="PRY" type="tool_quality" showIcon={false} />
    {pry.pry_quality ?? 0}
  </dd>
  <dt>{t("Noisy", { _context, _comment })}</dt>
  <dd>{(pry.noise ?? 0) > 0 ? t("Yes") : t("No")}</dd>
  <dt>{t("Alarm", { _context, _comment })}</dt>
  <dd>{pry.alarm ? t("Yes") : t("No")}</dd>
  <dt>{t("Breakable", { _context, _comment })}</dt>
  <dd>{pry.breakable ? t("Yes") : t("No")}</dd>
  {#if result}
    <dt>{t("Result", { _context, _comment })}</dt>
    <dd>
      <ThingLink id={result} type={resultType} showIcon={false} />
    </dd>
  {/if}
  {#if pryItems.length}
    <dt>{t("Pry Items", { _context, _comment })}</dt>
    <dd>
      <ul class="comma-separated">
        {#each pryItems as entry}
          {@const amount =
            formatAmount(entry.count, true) ?? formatAmount(entry.charges)}
          {@const probability = formatProbability(entry.prob)}
          <li>
            <ThingLink
              id={entry.item}
              type="item"
              showIcon={false} />{#if amount}&nbsp;({amount}){/if}{#if probability}&nbsp;({probability}){/if}
          </li>
        {/each}
      </ul>
    </dd>
  {/if}
  {#if breakItems.length}
    <dt>{t("Break Items", { _context, _comment })}</dt>
    <dd>
      <ul class="comma-separated">
        {#each breakItems as entry}
          {@const amount =
            formatAmount(entry.count, true) ?? formatAmount(entry.charges)}
          {@const probability = formatProbability(entry.prob)}
          <li>
            <ThingLink
              id={entry.item}
              type="item"
              showIcon={false} />{#if amount}&nbsp;({amount}){/if}{#if probability}&nbsp;({probability}){/if}
          </li>
        {/each}
      </ul>
    </dd>
  {/if}
</dl>
