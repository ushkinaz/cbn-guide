<script lang="ts">
import { t } from "@transifex/native";
import { onMount, setContext, type Component, untrack } from "svelte";

import type { CBNData } from "./data";
import Monster from "./types/Monster.svelte";
import Item from "./types/Item.svelte";
import Unknown from "./types/Unknown.svelte";
import Material from "./types/Material.svelte";
import AmmunitionType from "./types/AmmunitionType.svelte";
import ToolQuality from "./types/ToolQuality.svelte";
import Furniture from "./types/Furniture.svelte";
import Skill from "./types/Skill.svelte";
import Flag from "./types/Flag.svelte";
import Fault from "./types/Fault.svelte";
import Vitamin from "./types/Vitamin.svelte";
import VehiclePart from "./types/VehiclePart.svelte";
import MartialArt from "./types/MartialArt.svelte";
import Mutation from "./types/Mutation.svelte";
import MutationCategory from "./types/MutationCategory.svelte";
import MutationType from "./types/MutationType.svelte";
import Vehicle from "./types/Vehicle.svelte";
import Terrain from "./types/Terrain.svelte";
import Trap from "./types/Trap.svelte";
import WeaponCategory from "./types/WeaponCategory.svelte";
import ConstructionGroup from "./types/ConstructionGroup.svelte";
import Achievement from "./types/Achievement.svelte";
import ObsoletionWarning from "./ObsoletionWarning.svelte";
import Bionic from "./types/Bionic.svelte";
import type { SupportedTypes } from "./types";
import JsonView from "./JsonView.svelte";
import OvermapSpecial from "./types/OvermapSpecial.svelte";
import ItemAction from "./types/ItemAction.svelte";
import Technique from "./types/Technique.svelte";
import { metrics } from "./metrics";
import { nowTimeStamp } from "./utils/perf";

interface Props {
  item: { id: string; type: string };
  data: CBNData;
}

let { item: sourceItem, data: sourceData }: Props = $props();
const item = untrack(() => sourceItem);
const data = untrack(() => sourceData);
setContext("data", data);

function defaultItem(id: string, type: string) {
  if (type === "json_flag") {
    return { id, type, __filename: "" };
  } else {
    return undefined;
  }
}

const renderStart = nowTimeStamp();

onMount(() => {
  metrics.distribution(
    "ui.item.render_duration_ms",
    nowTimeStamp() - renderStart,
    {
      unit: "millisecond",
      type: item.type,
    },
  );
});

let obj =
  data.byIdMaybe(item.type as keyof SupportedTypes, item.id) ??
  defaultItem(item.id, item.type);

const displays: Record<string, Component<any>> = {
  MONSTER: Monster,
  AMMO: Item,
  GUN: Item,
  ARMOR: Item,
  PET_ARMOR: Item,
  TOOL: Item,
  TOOLMOD: Item,
  TOOL_ARMOR: Item,
  BOOK: Item,
  COMESTIBLE: Item,
  CONTAINER: Item,
  ENGINE: Item,
  WHEEL: Item,
  GUNMOD: Item,
  MAGAZINE: Item,
  BATTERY: Item,
  GENERIC: Item,
  BIONIC_ITEM: Item,
  material: Material,
  ammunition_type: AmmunitionType,
  tool_quality: ToolQuality,
  furniture: Furniture,
  skill: Skill,
  json_flag: Flag,
  fault: Fault,
  vitamin: Vitamin,
  vehicle_part: VehiclePart,
  martial_art: MartialArt,
  mutation: Mutation,
  mutation_category: MutationCategory,
  mutation_type: MutationType,
  vehicle: Vehicle,
  terrain: Terrain,
  trap: Trap,
  weapon_category: WeaponCategory,
  construction_group: ConstructionGroup,
  achievement: Achievement,
  bionic: Bionic,
  overmap_special: OvermapSpecial,
  city_building: OvermapSpecial,
  item_action: ItemAction,
  technique: Technique,
};

const display = (obj && displays[obj.type]) ?? Unknown;
</script>

{#if !obj}
  {t("Unknown object: {id}", {
    id: `${item.type}/${item.id}`,
    _comment: "Error message when an object is not found in the data",
  })}
{:else}
  {#if /obsolet/.test(obj.__filename)}
    <ObsoletionWarning item={obj} />
  {/if}
  {@const SvelteComponent = display}
  <SvelteComponent item={obj} />
{/if}

<JsonView {obj} buildNumber={data.build_number} />
