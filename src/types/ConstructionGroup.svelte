<script lang="ts">
import { getContext } from "svelte";
import { CBNData } from "../data";
import type { ConstructionGroup } from "../types";
import Construction from "./Construction.svelte";

import { gameSingularName } from "../i18n/gettext";

interface Props {
  item: ConstructionGroup;
}

let { item }: Props = $props();

const data = getContext<CBNData>("data");

const constructions = data
  .byType("construction")
  .filter((x) => x.group === item.id);
</script>

<h1>{gameSingularName(item)}</h1>

{#each constructions as construction}
  <Construction {construction} />
{/each}
