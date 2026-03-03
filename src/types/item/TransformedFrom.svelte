<script lang="ts">
import { t } from "@transifex/native";
import type {
  DelayedTransformUseFunction,
  Item,
  TransformUseFunction,
} from "../../types";

import { getContext } from "svelte";
import {
  asHumanReadableDuration,
  CBNData,
  normalizeUseAction,
} from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

const data = getContext<CBNData>("data");
let transformedFrom = $derived(data.transformedFrom(item_id));
const getTransformAction = (item: Item) =>
  normalizeUseAction(item.use_action).find(
    (a) => "target" in a && a.target === item_id,
  ) as TransformUseFunction | DelayedTransformUseFunction;
</script>

{#if transformedFrom.length}
  <section>
    <h2>{t("Transformed From", { _context: "Obtaining" })}</h2>
    <LimitedList items={transformedFrom}>
      {#snippet children({ item })}
        {@const ua = getTransformAction(item)}
        <ItemLink
          type="item"
          id={item.id} />{#if ua.type === "delayed_transform" && ua.transform_age}{" "}({asHumanReadableDuration(
            ua.transform_age * 100,
          )}){/if}
      {/snippet}
    </LimitedList>
  </section>
{/if}
