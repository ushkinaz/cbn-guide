<script lang="ts">
import { getContext } from "svelte";
import { t } from "@transifex/native";
import { byName, CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import type { SupportedTypes } from "../../types";

interface Props {
  ammo_type: string;
  type: keyof Pick<SupportedTypes, "AMMO" | "GUN" | "MAGAZINE">;
}

let { ammo_type, type }: Props = $props();

const data = getContext<CBNData>("data");

let config = $derived.by(
  () =>
    ({
      GUN: {
        title: t("Weapons"),
        filter: (i: any) =>
          i.type === "GUN" &&
          i.ammo &&
          (Array.isArray(i.ammo)
            ? i.ammo.includes(ammo_type)
            : i.ammo === ammo_type),
      },
      MAGAZINE: {
        title: t("Magazines"),
        filter: (i: any) =>
          i.type === "MAGAZINE" &&
          i.ammo_type &&
          (Array.isArray(i.ammo_type)
            ? i.ammo_type.includes(ammo_type)
            : i.ammo_type === ammo_type),
      },
      AMMO: {
        title: t("Ammo"),
        filter: (i: any) => i.type === "AMMO" && i.ammo_type === ammo_type,
      },
    })[type],
);

let items = $derived.by(() =>
  data
    .byType("item")
    .filter((i) => i.id && config.filter(i))
    .sort(byName),
);
</script>

{#if items.length}
  <section>
    <h2>{config.title}</h2>
    <LimitedList {items} limit={5} grace={2}>
      {#snippet children({ item })}
        <ItemLink type="item" id={item.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}
