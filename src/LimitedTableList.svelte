<script lang="ts" generics="T">
import { t } from "@transifex/native";
import type { Snippet } from "svelte";

import { isTesting } from "./utils/env";
import { metrics } from "./metrics";

interface Props {
  items: T[];
  limit?: number;
  grace?: number;
  header?: Snippet;
  item?: Snippet<[{ item: T }]>;
}

let { items, limit = 10, grace = 4, header, item }: Props = $props();

// In test mode, always render the expanded list to catch any render bugs that
// only show up when the full list is shown.
let initialLimit = $derived(
  isTesting ? Infinity : items.length <= limit + grace ? limit + grace : limit,
);

let expanded = $state(false);
let realLimit = $derived(expanded ? Infinity : initialLimit);
</script>

<div class="table-container">
  <table class="data-table">
    <thead>
      {@render header?.()}
    </thead>
    <tbody>
      {#each items.slice(0, realLimit) as row}
        {@render item?.({ item: row })}
      {/each}
    </tbody>
  </table>
</div>
{#if items.length > initialLimit}
  <button
    class="disclosure"
    aria-expanded={expanded}
    onclick={(e) => {
      e.preventDefault();
      expanded = !expanded;
      if (expanded) {
        metrics.count("ui.table.expand", 1, { count: items.length });
      }
    }}>
    {expanded
      ? `[-] ${t("Show less")}`
      : `[...] ${t("See all {n} entries", { n: items.length.toLocaleString() })}`}
  </button>
{/if}

<style>
.table-container {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
}
</style>
