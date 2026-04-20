<script lang="ts">
import { type Snippet } from "svelte";

interface Props {
  items: any[];
  horizontal?: boolean;
  children?: Snippet<[any]>;
}

let { items, horizontal = false, children }: Props = $props();
</script>

<div class="and-container">
  <ul class="and-list" class:comma-separated={horizontal}>
    {#each items as item}
      <li>{@render children?.({ item })}</li>
    {/each}
  </ul>
</div>

<style>
.and-container {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
}

ul.and-list {
  list-style-type: square;
  padding-left: 0.5rem;
  margin-left: 0.3rem;
}

ul.and-list.comma-separated {
  padding-left: 0;
  margin-left: 0;
}
ul.and-list li {
  margin-left: 0;
}
</style>
