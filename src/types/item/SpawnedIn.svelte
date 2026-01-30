<script lang="ts">
import { getContext } from "svelte";
import type { CBNData } from "../../data";
import { lootByOMSAppearance } from "./spawnLocations";
import { t } from "../../i18n";
import LocationTable from "./LocationTable.svelte";

export let item_id: string;

const data = getContext<CBNData>("data");
</script>

<LocationTable
  id={item_id}
  loots={() => lootByOMSAppearance(data)}
  heading={t("Found In", { _context: "Obtaining" })} />
