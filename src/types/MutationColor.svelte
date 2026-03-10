<script lang="ts">
import type { Mutation } from "src/types";

interface Props {
  mutation: Mutation;
  children?: import("svelte").Snippet;
}

let { mutation, children }: Props = $props();

let displayColor = $derived(
  (mutation.points ?? 0) > 0
    ? "light_green"
    : (mutation.points ?? 0) < 0
      ? "light_red"
      : "white",
);
</script>

<span style={`color: var(--cata-color-${displayColor})`}
  >{#if children}{@render children()}{:else}{mutation.points ?? 0}{/if}</span>
