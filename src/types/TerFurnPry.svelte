<script lang="ts">
import { t } from "@transifex/native";
import { CBNData } from "../data";
import type { FurniturePryData, TerrainPryData } from "src/types";
import { getContext, untrack } from "svelte";
import ThingLink from "./ThingLink.svelte";

type PryData = TerrainPryData | FurniturePryData;

interface Props {
  act: PryData;
  resultType: "terrain" | "furniture";
}

let { act, resultType }: Props = $props();
const data = getContext<CBNData>("data");

const pry = untrack(() => act);
const result = untrack(() => visibleResult(act, resultType));
const brokeResult = untrack(() => visibleBreakResult(act, resultType));

const pryItems = untrack(() =>
  data.flattenItemGroup({
    subtype: "collection",
    entries: act.pry_items ?? [],
  }),
);
const breakItems = untrack(() =>
  data.flattenItemGroup({
    subtype: "collection",
    entries: act.break_items ?? [],
  }),
);

function visibleResult(
  value: PryData,
  resultType: "terrain" | "furniture",
): string | undefined {
  const result =
    resultType === "terrain"
      ? (value as TerrainPryData).new_ter_type
      : (value as FurniturePryData).new_furn_type;
  if (result === (resultType === "terrain" ? "t_null" : "f_null")) {
    return undefined;
  }
  return result;
}

function visibleBreakResult(
  value: PryData,
  resultType: "terrain" | "furniture",
): string | undefined {
  const result =
    resultType === "terrain"
      ? (value as TerrainPryData).break_ter_type
      : (value as FurniturePryData).break_furn_type;
  if (result === (resultType === "terrain" ? "t_null" : "f_null")) {
    return undefined;
  }
  return result;
}

const _context = "Terrain / Furniture";
const _comment = "prying";
</script>

<dl>
  {#if result}
    <dt>{t("Becomes", { _context, _comment })}</dt>
    <dd>
      <ThingLink id={result} type={resultType} showIcon={true} />
    </dd>
  {/if}
  <dt>{t("Requires", { _context, _comment })}</dt>
  <dd>
    <ThingLink id="PRY" type="tool_quality" showIcon={false} />
    {pry.pry_quality ?? 0}
  </dd>
  <dt>{t("Difficulty", { _context, _comment })}</dt>
  <dd>{pry.difficulty ?? 1}</dd>
  <dt>{t("Alarm", { _context, _comment })}</dt>
  <dd>{pry.alarm ? t("Yes") : t("No")}</dd>
  <dt>{t("Noise", { _context, _comment })}</dt>
  <dd>{pry.noise ?? 0}</dd>
  {#if pry.breakable}
    <dt>{t("Breakable", { _context, _comment })}</dt>
    <dd>{pry.breakable ? t("Yes") : t("No")}</dd>
    {#if brokeResult}
      <dt>{t("Breaks into", { _context, _comment })}</dt>
      <dd>
        <ThingLink id={brokeResult} type={resultType} showIcon={true} />
      </dd>
    {/if}
    <dt>{t("Break noise", { _context, _comment })}</dt>
    <dd>{pry.break_noise ?? 0}</dd>
    {#if breakItems.length}
      <dt>{t("Debris", { _context, _comment })}</dt>
      <dd>
        <ul class="no-bullets">
          {#each breakItems as entry}
            <li>
              <ThingLink
                id={entry.id}
                type="item"
                showIcon={false}
                count={entry.count} />
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
  {/if}
  {#if pryItems.length}
    <dt>{t("Pry Items", { _context, _comment })}</dt>
    <dd>
      <ul class="no-bullets">
        {#each pryItems as entry}
          <li>
            <ThingLink
              id={entry.id}
              type="item"
              showIcon={false}
              count={entry.count} />
          </li>
        {/each}
      </ul>
    </dd>
  {/if}
</dl>
