<script lang="ts">
import { t } from "@transifex/native";

export let items: any[];

export let limit = 10;

export let grace = 4;

// In test mode, always render the expanded list to catch any render bugs that
// only show up when the full list is shown.
const isTesting =
  typeof globalThis !== undefined && (globalThis as any)?.__isTesting__;

$: initialLimit = isTesting
  ? Infinity
  : items.length <= limit + grace
    ? limit + grace
    : limit;

let expanded = false;
$: realLimit = expanded ? Infinity : initialLimit;
</script>

<ul>
  {#each items.slice(0, realLimit) as item}
    <li><slot {item} /></li>
  {/each}
</ul>
{#if items.length > initialLimit}
  {#if !expanded}
    <button
      class="disclosure"
      on:click={(e) => {
        e.preventDefault();
        expanded = true;
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
