<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import type { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import type { Furniture, Terrain, VehiclePart } from "../../types";
import ItemLink from "../ItemLink.svelte";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

const data = getContext<CBNData>("data");

let bashFrom = (
  data.bashFromFurniture(item_id) as (Furniture | Terrain | VehiclePart)[]
).concat(data.bashFromTerrain(item_id), data.bashFromVehiclePart(item_id));
</script>

{#if bashFrom.length}
  <section>
    <h2>{t("Bash", { _context: "Obtaining" })}</h2>
    <LimitedList items={bashFrom}>
      {#snippet children({ item: f })}
        <ItemLink id={f.id} type={f.type} />
        {#if f.bash?.str_min}
          <span style="color: var(--cata-color-gray)">
            (≥ {f.bash.str_min} STR)
          </span>
        {/if}
      {/snippet}
    </LimitedList>
  </section>
{/if}
