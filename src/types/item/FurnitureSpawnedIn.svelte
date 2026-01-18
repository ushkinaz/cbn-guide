<script lang="ts">
import { getContext } from "svelte";
import type { CBNData } from "../../data";
import { furnitureByOMSAppearance } from "./spawnLocations";
import { t } from "../../i18n";
import LocationTable from "./LocationTable.svelte";

export let item_id: string;

const data = getContext<CBNData>("data");
</script>

<LocationTable
  id={item_id}
  loots={furnitureByOMSAppearance(data)}
  heading={t("Found In", { _context: "Terrain/Furniture Locations" })} />
