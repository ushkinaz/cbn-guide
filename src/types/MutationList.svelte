<script lang="ts">
import { CBNData } from "../data";
import { getContext, untrack } from "svelte";
import { topologicalSortComponentsByRank } from "../utils/toposort";
import type { Mutation } from "../types";
import ItemLink from "./ItemLink.svelte";
import { asArray } from "../utils/collections";

import { gameSingularName } from "../utils/i18n";

let data = getContext<CBNData>("data");

interface Props {
  mutations: Mutation[];
}

let { mutations: sourceMutations }: Props = $props();
const mutations = untrack(() => sourceMutations);
const allPrereqs = (m: Mutation) =>
  asArray(m.prereqs).concat(asArray(m.prereqs2)).concat(asArray(m.threshreq));
let sortedMutations = topologicalSortComponentsByRank(mutations, (m) =>
  allPrereqs(m).map((x) => data.byId("mutation", x)),
).sort((a, b) =>
  gameSingularName(a[0][0]).localeCompare(gameSingularName(b[0][0])),
);
</script>

<ul class="no-bullets">
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
