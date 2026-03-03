<script lang="ts">
import { CBNData, singularName } from "../data";
import { getContext } from "svelte";
import { topologicalSortComponentsByRank } from "../utils/toposort";
import type { Mutation } from "../types";
import ItemLink from "./ItemLink.svelte";
import { asArray } from "../utils/collections";

let data = getContext<CBNData>("data");

interface Props {
  mutations: Mutation[];
}

let { mutations }: Props = $props();
const allPrereqs = (m: Mutation) =>
  asArray(m.prereqs).concat(asArray(m.prereqs2)).concat(asArray(m.threshreq));
let sortedMutations = $derived.by(() =>
  topologicalSortComponentsByRank(mutations, (m) =>
    allPrereqs(m).map((x) => data.byId("mutation", x)),
  ).sort((a, b) => singularName(a[0][0]).localeCompare(singularName(b[0][0]))),
);
</script>

<ul>
  {#each sortedMutations as rank}
    <li>
      {#each rank as mg, i}
        {#if i > 0}&nbsp;→{/if}
        {#each mg as m, i}
          {#if i > 0},
          {/if}
          <ItemLink id={m.id} type="mutation" showIcon={false} />
        {/each}
      {/each}
    </li>
  {/each}
</ul>
