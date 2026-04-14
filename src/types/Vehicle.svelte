<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";

import {
  CBNData,
  itemGroupFromVehicle,
  normalizeVehicleMountedParts,
} from "../data";
import LimitedList from "../LimitedList.svelte";

import type { Vehicle } from "../types";
import { groupBy } from "../utils/collections";
import ThingLink from "./ThingLink.svelte";
import ItemTable from "./item/ItemTable.svelte";
import VehicleView from "./VehicleView.svelte";

import { gameSingularName } from "../i18n/game-locale";

interface Props {
  item: Vehicle;
}

let { item: sourceItem }: Props = $props();
const item = untrack(() => sourceItem);

const data = getContext<CBNData>("data");
const _context = "Vehicle";

const parts = normalizeVehicleMountedParts(item)
  .flatMap((mountedPart) => mountedPart.parts)
  .filter((x) => data.byIdMaybe("vehicle_part", x.part)); // TODO: turrets?
const partsGrouped = groupBy(parts, (p) => [p.part]);
const partsCounted = [...partsGrouped.entries()].map(([id, list]) => ({
  id,
  count: list.length,
}));
partsCounted.sort((a, b) => {
  if (a.count === b.count)
    return gameSingularName(data.byId("vehicle_part", a.id)).localeCompare(
      gameSingularName(data.byId("vehicle_part", b.id)),
    );
  else return b.count - a.count;
});
</script>

<h1>{gameSingularName(item)}</h1>

<VehicleView {item} />

{#if partsCounted.length}
  <section>
    <h2>{t("Parts", { _context })}</h2>
    <LimitedList items={partsCounted}>
      {#snippet children({ item: { id, count } })}
        <ThingLink {id} type="vehicle_part" /> ({count})
      {/snippet}
    </LimitedList>
  </section>
{/if}

<ItemTable loot={data.flattenItemGroupLoot(itemGroupFromVehicle(item))} />
