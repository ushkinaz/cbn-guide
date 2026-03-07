<script lang="ts">
import type { Snippet } from "svelte";

type RenderablePart = { text: string } | { slot: number };

interface Props {
  str: string;
  slot0?: string | null;
  slot1?: string | null;
  slot2?: string | null;
  slot3?: string | null;
  slot4?: string | null;
  slot5?: string | null;
  slot6?: string | null;
  slot7?: string | null;
  _0?: Snippet;
  _1?: Snippet;
  _2?: Snippet;
  _3?: Snippet;
  _4?: Snippet;
  _5?: Snippet;
  _6?: Snippet;
  _7?: Snippet;
}

let {
  str,
  slot0 = null,
  slot1 = null,
  slot2 = null,
  slot3 = null,
  slot4 = null,
  slot5 = null,
  slot6 = null,
  slot7 = null,
  _0,
  _1,
  _2,
  _3,
  _4,
  _5,
  _6,
  _7,
}: Props = $props();

let slotNameToNumber = $derived.by(() => {
  const map = new Map<string, number>();
  if (slot0) map.set(slot0, 0);
  if (slot1) map.set(slot1, 1);
  if (slot2) map.set(slot2, 2);
  if (slot3) map.set(slot3, 3);
  if (slot4) map.set(slot4, 4);
  if (slot5) map.set(slot5, 5);
  if (slot6) map.set(slot6, 6);
  if (slot7) map.set(slot7, 7);
  return map;
});

let parts = $derived.by(() => {
  const parsed: RenderablePart[] = [];
  const re = /\{([^}]+)\}/gms;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(str))) {
    const before = str.substring(index, match.index);
    if (before.length > 0) parsed.push({ text: before });
    const slot = slotNameToNumber.get(match[1]);
    if (slot !== undefined) parsed.push({ slot });
    index = match.index + match[0].length;
  }
  if (index < str.length) parsed.push({ text: str.substring(index) });
  return parsed;
});
</script>

{#each parts as part}
  {#if "text" in part}
    {part.text}
  {:else if part.slot === 0}
    {@render _0?.()}
  {:else if part.slot === 1}
    {@render _1?.()}
  {:else if part.slot === 2}
    {@render _2?.()}
  {:else if part.slot === 3}
    {@render _3?.()}
  {:else if part.slot === 4}
    {@render _4?.()}
  {:else if part.slot === 5}
    {@render _5?.()}
  {:else if part.slot === 6}
    {@render _6?.()}
  {:else if part.slot === 7}
    {@render _7?.()}
  {/if}
{/each}
