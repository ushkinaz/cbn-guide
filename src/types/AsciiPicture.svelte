<script lang="ts">
import { untrack } from "svelte";
import type { AsciiArt } from "../types";

interface Props {
  picture: AsciiArt;
}

let { picture: sourcePicture }: Props = $props();
const picture = untrack(() => sourcePicture);

let color = ["white"];
const parsed: { string: string; color: string }[][] = [];
for (const line of picture.picture) {
  const spans: { string: string; color: string }[] = [];
  let remaining = line;
  while (true) {
    const nextColorTag = remaining.match(/<\/?color([^>]*?)>/);
    if (nextColorTag && nextColorTag.index != null) {
      if (nextColorTag.index > 0)
        spans.push({
          string: remaining.substring(0, nextColorTag.index),
          color: color[0],
        });
      if (nextColorTag[0][1] === "/" && color.length > 1) {
        color.shift();
      } else {
        color.unshift(nextColorTag[1].substring(1));
      }
      remaining = remaining.substring(
        nextColorTag.index + nextColorTag[0].length,
      );
    } else break;
  }
  if (remaining.length) {
    spans.push({ string: remaining, color: color[0] });
  }
  const remainingWidth = 41 - spans.reduce((m, s) => m + s.string.length, 0);
  if (remainingWidth > 0) {
    spans.push({ string: " ".repeat(remainingWidth), color: color[0] });
  }
  parsed.push(spans);
}
</script>

<pre style="font-family: var(--font-mono-game); line-height: 1">
{#each parsed as line}{#each line as span}<span class="c_{span.color}"
        >{span.string}</span
      >{/each}{"\n"}{/each}
</pre>
