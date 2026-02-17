<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import type { Harvest } from "../../types";
import ItemLink from "../ItemLink.svelte";
import ItemTable from "./ItemTable.svelte";

export let item_id: string;

let data = getContext<CBNData>("data");
const mons = new Map(
  data.byType("monster").flatMap((mon) => {
    if (!mon.id) return [];
    const deathDrops = data.flatDeathDrops(mon.id);
    const dd = deathDrops.get(item_id);
    if (dd) return [[mon.id, { prob: dd.prob, expected: dd.expected }]];
    return [];
  }),
);

const itemsFromHarvest = (h: Harvest): string[] =>
  h.entries?.flatMap((e) =>
    e.type && data.byIdMaybe("harvest_drop_type", e.type)?.group
      ? data
          .flattenTopLevelItemGroup(data.byId("item_group", e.drop))
          .map((x) => x.id)
      : [e.drop],
  ) ?? [];

const harvests = data
  .byType("harvest")
  .filter((h) => itemsFromHarvest(h).some((e) => e === item_id));
const harvestableFrom = data
  .byType("monster")
  .filter((m) => m.id && harvests.some((h) => h.id === m.harvest));
</script>

<ItemTable
  type="monster"
  loot={mons}
  heading={t("Dropped By", { _context: "Obtaining" })} />

{#if harvestableFrom.length}
  <section>
    <h2>{t("Butcher", { _context: "Obtaining" })}</h2>
    <LimitedList items={harvestableFrom} let:item={m}>
      <ItemLink id={m.id} type="monster" />
    </LimitedList>
  </section>
{/if}
