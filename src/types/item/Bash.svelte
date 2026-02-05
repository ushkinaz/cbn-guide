<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import type { Furniture, Terrain, VehiclePart } from "../../types";
import ItemLink from "../ItemLink.svelte";

export let item_id: string;

const data = getContext<CBNData>("data");

let bashFrom = (
  data.bashFromFurniture(item_id) as (Furniture | Terrain | VehiclePart)[]
).concat(data.bashFromTerrain(item_id), data.bashFromVehiclePart(item_id));
</script>

{#if bashFrom.length}
  <section>
    <h1>{t("Bash", { _context: "Obtaining" })}</h1>
    <LimitedList items={bashFrom} let:item={f}>
      <ItemLink id={f.id} type={f.type} />
      {#if f.bash?.str_min}
        <span style="color: var(--cata-color-gray)">
          (≥ {f.bash.str_min} STR)
        </span>
      {/if}
    </LimitedList>
  </section>
{/if}
