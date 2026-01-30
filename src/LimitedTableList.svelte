<script lang="ts">
import { t } from "./i18n";
import { isTesting } from "./utils/env";
import { metrics } from "./metrics";

export let items: any[];

export let limit = 10;

export let grace = 4;

// In test mode, always render the expanded list to catch any render bugs that
// only show up when the full list is shown.
$: initialLimit = isTesting
  ? Infinity
  : items.length <= limit + grace
    ? limit + grace
    : limit;

let expanded = false;
$: {
  items;
  expanded = false;
}
$: realLimit = expanded ? Infinity : initialLimit;
</script>

<div class="table-container">
  <table>
    <slot name="header" />
    <tbody>
      {#each items.slice(0, realLimit) as item}
        <slot name="item" {item} />
      {/each}
    </tbody>
  </table>
</div>
{#if items.length > initialLimit}
  {#if !expanded}
    <button
      class="disclosure"
      on:click={(e) => {
        e.preventDefault();
        expanded = true;
        metrics.count("ui.table.expand", 1, { count: items.length });
      }}
      >{t("See all {n}...", {
        n: Number(items.length).toLocaleString(),
      })}</button>
  {:else}
    <button
      class="disclosure"
      on:click={(e) => {
        e.preventDefault();
        expanded = false;
      }}>{t("Show less")}</button>
  {/if}
{/if}

<style>
.table-container {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
}
</style>
