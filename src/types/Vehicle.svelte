<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";

import {
  CBNData,
  getVehiclePartIdAndVariant,
  itemGroupFromVehicle,
  normalizeVehicleMountedParts,
  singularName,
} from "../data";
import LimitedList from "../LimitedList.svelte";

import type { Vehicle } from "../types";
import { groupBy } from "../utils/collections";
import ItemLink from "./ItemLink.svelte";
import ItemTable from "./item/ItemTable.svelte";
import VehicleView from "./VehicleView.svelte";

interface Props {
  item: Vehicle;
}

let { item }: Props = $props();

const data = getContext<CBNData>("data");
const _context = "Vehicle";

let partsCounted = $derived.by(() => {
  const normalizedParts = normalizeVehicleMountedParts(item).map((part) => {
    const parts =
      part.parts?.map(({ part, fuel }) => {
        const [partId, variant] = getVehiclePartIdAndVariant(data, part);
        return {
          partId,
          variant,
          fuel,
        };
      }) ?? [];
    return {
      x: part.x,
      y: part.y,
      parts,
    };
  });

  const parts = normalizedParts
    .flatMap((np) => np.parts)
    .filter((x) => data.byIdMaybe("vehicle_part", x.partId)); // TODO: turrets?
  const partsGrouped = groupBy(parts, (p) => [p.partId]);
  const partsCountedValue = [...partsGrouped.entries()].map(([id, list]) => ({
    id,
    count: list.length,
  }));
  partsCountedValue.sort((a, b) => {
    if (a.count === b.count)
      return singularName(data.byId("vehicle_part", a.id)).localeCompare(
        singularName(data.byId("vehicle_part", b.id)),
      );
    else return b.count - a.count;
  });
  return partsCountedValue;
});
</script>

<h1>{singularName(item)}</h1>

<VehicleView {item} />

{#if partsCounted.length}
  <section>
    <h2>{t("Parts", { _context })}</h2>
    <LimitedList items={partsCounted}>
      {#snippet children({ item: { id, count } })}
        <ItemLink {id} type="vehicle_part" showIcon={false} /> ({count})
      {/snippet}
    </LimitedList>
  </section>
{/if}

<ItemTable loot={data.flattenItemGroupLoot(itemGroupFromVehicle(item))} />
