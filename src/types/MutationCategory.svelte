<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";

import { byName, CBNData, singularName } from "../data";
import type { MutationCategory } from "../types";
import MutationList from "./MutationList.svelte";
import ItemLink from "./ItemLink.svelte";

let data = getContext<CBNData>("data");
const _context = "Mutation";

interface Props {
  item: MutationCategory;
  inCatalog?: boolean;
}

let { item: sourceItem, inCatalog = false }: Props = $props();
const item = untrack(() => sourceItem);

const mutationsInCategory = data
  .byType("mutation")
  .filter((m) => (m.category ?? []).includes(item.id))
  .sort(byName);
const preThreshold = mutationsInCategory.filter(
  (t) => !t.threshreq || t.threshreq.length === 0,
);
const postThreshold = mutationsInCategory.filter(
  (t) => !(!t.threshreq || t.threshreq.length === 0),
);
</script>

{#if !inCatalog}
  <h1>{t("Mutation Category")}: {singularName(item)}</h1>
{/if}

<section>
  {#if inCatalog}
    <h2>{singularName(item)}</h2>
  {/if}
  <dl>
    {#if preThreshold.length}
      <dt>{t("Pre-Threshold", { _context })}</dt>
      <dd>
        <MutationList mutations={preThreshold} />
      </dd>
    {/if}
    {#if item.threshold_mut}
      <dt>{t("Threshold", { _context })}</dt>
      <dd>
        <ItemLink id={item.threshold_mut} type="mutation" showIcon={false} />
      </dd>
    {/if}
    {#if postThreshold.length}
      <dt>{t("Post-Threshold", { _context })}</dt>
      <dd>
        <MutationList mutations={postThreshold} />
      </dd>
    {/if}
  </dl>
</section>
