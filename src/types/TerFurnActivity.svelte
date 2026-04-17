<script lang="ts">
import { t } from "@transifex/native";
import type { ActivityDataCommon } from "src/types";
import ThingLink from "./ThingLink.svelte";
import { untrack } from "svelte";

interface Props {
  act: ActivityDataCommon;
  resultType: "terrain" | "furniture";
}

let { act, resultType }: Props = $props();

function visibleResult(
  value: ActivityDataCommon,
  resultType: "terrain" | "furniture",
): string | undefined {
  if (value.result === (resultType === "terrain" ? "t_null" : "f_null")) {
    return undefined;
  }
  return value.result;
}

const activity = untrack(() => act);
const result = untrack(() => visibleResult(act, resultType));

const _context = "Terrain / Furniture";
const _comment = "activity (oxytorch, hacksaw, boltcut, etc.)";
</script>

<dl>
  {#if result}
    <dt>{t("Becomes", { _context, _comment })}</dt>
    <dd>
      <ThingLink id={result} type={resultType} showIcon={true} />
    </dd>
  {/if}
  {#if activity.byproducts}
    <dt>{t("Byproducts", { _context, _comment })}</dt>
    <dd>
      <ul class="no-bullets">
        {#each activity.byproducts ?? [] as { item: i, count }}
          <li>
            <ThingLink id={i} type="item" showIcon={true} {count} />
          </li>
        {/each}
      </ul>
    </dd>
  {/if}
  <dt>{t("Duration", { _context, _comment })}</dt>
  <dd>{activity.duration ?? "1 s"}</dd>
</dl>
