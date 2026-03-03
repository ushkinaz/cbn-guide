<script lang="ts">
import { t } from "@transifex/native";
import { isTesting } from "./utils/env";
import { metrics } from "./metrics";

interface Props {
  items: any[];
  limit?: number;
  grace?: number;
  children?: import("svelte").Snippet<[any]>;
}

let { items, limit = 10, grace = 4, children }: Props = $props();

// In test mode, always render the expanded list to catch any render bugs that
// only show up when the full list is shown.
let initialLimit = $derived(
  isTesting ? Infinity : items.length <= limit + grace ? limit + grace : limit,
);

let expanded = $state(false);
$effect(() => {
  items;
  expanded = false;
});
let realLimit = $derived(expanded ? Infinity : initialLimit);
</script>

<ul class="no-bullets">
  {#each items.slice(0, realLimit) as item}
    <li>{@render children?.({ item })}</li>
  {/each}
</ul>

{#if items.length > initialLimit}
  <button
    class="disclosure"
    aria-expanded={expanded}
    onclick={(e) => {
      e.preventDefault();
      expanded = !expanded;
      if (expanded) {
        metrics.count("ui.list.expand", 1, { count: items.length });
      }
    }}>
    {expanded
      ? `[-] ${t("Show less")}`
      : `[...] ${t("See all {n} entries", { n: items.length.toLocaleString() })}`}
  </button>
{/if}
