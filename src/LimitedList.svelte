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

<ul class="no-bullets">
  {#each items.slice(0, realLimit) as item}
    <li><slot {item} /></li>
  {/each}
</ul>
{#if items.length > initialLimit}
  <button
    class="disclosure"
    aria-expanded={expanded}
    on:click={(e) => {
      e.preventDefault();
      expanded = !expanded;
      if (expanded) {
        metrics.count("ui.list.expand", 1, { count: items.length });
      }
    }}>
    {expanded
      ? t("Show less")
      : t("See all {n}...", {
          n: Number(items.length).toLocaleString(),
        })}
  </button>{/if}
