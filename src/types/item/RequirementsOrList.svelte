<script lang="ts">
import { t } from "@transifex/native";
import { type Snippet } from "svelte";

const _context = "List of items";

interface Props {
  items: any[];
  hideLabelWhenSingle?: boolean;
  children?: Snippet<[any]>;
}

let { items, hideLabelWhenSingle = true, children }: Props = $props();

// Compute visibility once
let isSingleHidden = $derived(hideLabelWhenSingle && items.length === 1);
</script>

<div class="or-container" class:single={isSingleHidden}>
  {#if !isSingleHidden}
    <div class="or-label">
      {t("Any of", { _context })}
    </div>
  {/if}
  <ul class="or-list">
    {#each items as item}
      <li>{@render children?.({ item })}</li>
    {/each}
  </ul>
</div>

<style>
.or-container {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.or-label {
  font-variant-caps: all-small-caps;
  font-size: 0.9rem;
  font-weight: bold;
  color: var(--cata-color-gray);
  letter-spacing: 0.05em;
}

ul.or-list {
  border-left: 1px solid
    color-mix(in srgb, var(--cata-color-cyan) 50%, transparent);
  border-radius: 0 4px 4px 0;
  padding: 0 0.4rem;
  margin-left: 0.4rem;
  list-style-type: none;
}

.single ul.or-list {
  background-color: transparent;
  border-left: none;
  padding: 0;
  margin: 0;
}
</style>
