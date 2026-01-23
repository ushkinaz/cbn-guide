<script lang="ts">
import { t } from "../i18n";

import { getContext } from "svelte";

import {
  CBNData,
  getVehiclePartIdAndVariant,
  itemGroupFromVehicle,
  singularName,
} from "../data";
import LimitedList from "../LimitedList.svelte";

import type { Vehicle } from "../types";
import { groupBy } from "../utils/collections";
import ItemLink from "./ItemLink.svelte";
import ItemTable from "./item/ItemTable.svelte";
import VehicleView from "./VehicleView.svelte";

export let item: Vehicle;

const data = getContext<CBNData>("data");
const _context = "Vehicle";

const normalizedParts = item.parts.map((part) => {
  const parts =
    (part.part
      ? [{ part: part.part, fuel: part.fuel }]
      : part.parts?.map((part) => (typeof part === "string" ? { part } : part))
    )?.map(({ part, fuel }) => {
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
const partsCounted = [...partsGrouped.entries()].map(([id, list]) => ({
  id,
  count: list.length,
}));
partsCounted.sort((a, b) => {
  if (a.count === b.count)
    return singularName(data.byId("vehicle_part", a.id)).localeCompare(
      singularName(data.byId("vehicle_part", b.id)),
    );
  else return b.count - a.count;
});
</script>

<h1>{singularName(item)}</h1>

<VehicleView {item} />

{#if partsCounted.length}
  <section>
    <h1>{t("Parts", { _context })}</h1>
    <LimitedList items={partsCounted} let:item={{ id, count }}>
      <ItemLink {id} type="vehicle_part" showIcon={false} /> ({count})
    </LimitedList>
  </section>
{/if}

<ItemTable loot={data.flattenItemGroupLoot(itemGroupFromVehicle(item))} />
