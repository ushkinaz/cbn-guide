<script lang="ts">
import { t } from "../../i18n";

import { getContext } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ItemLink from "../ItemLink.svelte";
import type { Furniture, Terrain, VehiclePart } from "src/types";

export let item_id: string;

const data = getContext<CBNData>("data");

let vparts = data
  .byType("vehicle_part")
  .filter((vp) => vp.id && vp.item === item_id);
let deconstructibleFrom = (
  data.deconstructFrom(item_id) as (Furniture | Terrain | VehiclePart)[]
).concat(vparts);
</script>

{#if deconstructibleFrom.length}
  <section>
    <h1>{t("Deconstruct", { _context: "Obtaining" })}</h1>
    <LimitedList items={deconstructibleFrom} let:item={f}>
      <ItemLink id={f.id} type={f.type} />
    </LimitedList>
  </section>
{/if}
