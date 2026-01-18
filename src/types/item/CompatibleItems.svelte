<script lang="ts">
import { getContext } from "svelte";
import { t } from "../../i18n";
import { byName, CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import type { SupportedTypes } from "../../types";

export let ammo_type: string;
export let type: keyof Pick<SupportedTypes, "AMMO" | "GUN" | "MAGAZINE">;

const data = getContext<CBNData>("data");

const config = {
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
}[type];

const items = data
  .byType("item")
  .filter((i) => i.id && config.filter(i))
  .sort(byName);
</script>

{#if items.length}
  <section>
    <h1>{config.title}</h1>
    <LimitedList {items} let:item limit={5} grace={2}>
      <ItemLink type="item" id={item.id} />
    </LimitedList>
  </section>
{/if}
