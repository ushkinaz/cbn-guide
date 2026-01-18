<script lang="ts">
import { t } from "../i18n";
import type { CBNData } from "src/data";
import type { ActivityDataCommon } from "src/types";
import { getContext } from "svelte";
import ItemLink from "./ItemLink.svelte";

export let act: ActivityDataCommon & { result?: string };
export let resultType: "terrain" | "furniture";

const data = getContext<CBNData>("data");

const _context = "Terrain / Furniture";
const _comment = "activity (prying, hacksawing, etc.)";
</script>

<ul class="comma-separated">
  {#each act.byproducts ?? [] as { item: i, count }}
    <li>
      <ItemLink
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
      <ItemLink id="PRY" type="tool_quality" showIcon={false} />
      {act.prying_data.prying_level ?? 0}{#if act.prying_data.prying_nails}, <ItemLink
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
      <ItemLink id={act.result} type={resultType} />
    </dd>
  {/if}
</dl>
