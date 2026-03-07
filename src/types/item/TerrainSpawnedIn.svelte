<script lang="ts">
import { getContext } from "svelte";
import type { CBNData } from "../../data";
import { terrainByOMSAppearance } from "./spawnLocations";
import { t } from "@transifex/native";
import LocationTable from "./LocationTable.svelte";

interface Props {
  item_id: string;
}

let { item_id }: Props = $props();

const data = getContext<CBNData>("data");
</script>

<LocationTable
  id={item_id}
  loots={terrainByOMSAppearance(data)}
  heading={t("Found In", { _context: "Terrain/Furniture Locations" })} />
