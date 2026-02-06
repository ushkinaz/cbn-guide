<script lang="ts">
import { getContext } from "svelte";
import { CBNData, itemGroupFromVehicle } from "../../data";
import { formatPercent } from "../../utils/format";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import { t } from "@transifex/native";

export let item_id: string;

const data = getContext<CBNData>("data");

const vehiclesAndProbabilities = data
  .byType("vehicle")
  .filter((i) => i.id)
  .flatMap((vehicle) => {
    const group = itemGroupFromVehicle(vehicle);
    const flatGroup = data.flattenItemGroup(group);
    const self = flatGroup.find((e) => e.id === item_id);
    if (self) return [{ vehicle, prob: self.prob, count: self.count }];
    else return [];
  });
vehiclesAndProbabilities.sort((a, b) => b.prob - a.prob);
</script>

{#if vehiclesAndProbabilities.length}
  <section>
    <h1>{t("In Vehicle", { _context: "Obtaining" })}</h1>
    <LimitedList items={vehiclesAndProbabilities} let:item={{ vehicle, prob }}>
      <ItemLink id={vehicle.id} type="vehicle" showIcon={false} /> ({formatPercent(
        prob,
      )})
    </LimitedList>
  </section>
{/if}
