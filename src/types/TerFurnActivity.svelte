<script lang="ts">
import { t } from "@transifex/native";
import type { CBNData } from "src/data";
import type { ActivityDataCommon } from "src/types";
import { getContext } from "svelte";
import ThingLink from "./ThingLink.svelte";

interface Props {
  act: ActivityDataCommon & { result?: string };
  resultType: "terrain" | "furniture";
}

let { act, resultType }: Props = $props();

const data = getContext<CBNData>("data");

const _context = "Terrain / Furniture";
const _comment = "activity (prying, hacksawing, etc.)";
</script>

<ul class="comma-separated">
  {#each act.byproducts ?? [] as { item: i, count }}
    <li>
      <ThingLink
        id={i}
        type="item"
        showIcon={false} />{#if typeof count === "number"}&nbsp;({count}){:else if Array.isArray(count)}&nbsp;({count[0]}–{count[1]}){/if}
    </li>
  {/each}
</ul>
<dl>
  <dt>{t("Duration", { _context, _comment })}</dt>
  <dd>{act.duration ?? "1 s"}</dd>
  {#if act.prying_data}
    <dt>{t("Difficulty", { _context, _comment })}</dt>
    <dd>{act.prying_data.difficulty ?? 0}</dd>
    <dt>{t("Requires", { _context, _comment })}</dt>
    <dd>
      <ThingLink id="PRY" type="tool_quality" showIcon={false} />
      {act.prying_data.prying_level ?? 0}{#if act.prying_data.prying_nails}, <ThingLink
          id="PRYING_NAIL"
          type="tool_quality"
          showIcon={false} />&nbsp;1{/if}
    </dd>
    <dt>{t("Noisy", { _context, _comment })}</dt>
    <dd>{act.prying_data.noisy ? t("Yes") : t("No")}</dd>
    <dt>{t("Alarm", { _context, _comment })}</dt>
    <dd>{act.prying_data.alarm ? t("Yes") : t("No")}</dd>
    <dt>{t("Breakable", { _context, _comment })}</dt>
    <dd>{act.prying_data.breakable ? t("Yes") : t("No")}</dd>
  {/if}
  {#if act.result && act.result !== "t_null"}
    <dt>{t("Result", { _context, _comment })}</dt>
    <dd>
      <ThingLink id={act.result} type={resultType} />
    </dd>
  {/if}
</dl>
