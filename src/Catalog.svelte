<script lang="ts">
import { setContext } from "svelte";
import { t } from "@transifex/native";

import { byName, CBNData, singularName, pluralName, plural } from "./data";
import LimitedList from "./LimitedList.svelte";
import type {
  Item,
  Monster,
  Mutation,
  SupportedTypeMapped,
  SupportedTypesWithMapped,
  VehiclePart,
} from "./types";
import MutationCategory from "./types/MutationCategory.svelte";
import ItemLink from "./types/ItemLink.svelte";
import { groupBy } from "./utils/collections";
import OvermapAppearance from "./types/item/OvermapAppearance.svelte";

export let type: string;
export let data: CBNData;
let typeWithCorrectType = type as keyof SupportedTypesWithMapped;
setContext("data", data);

const things = data
  .byType(type as keyof SupportedTypesWithMapped)
  .filter((o) => "id" in o && o.id)
  .sort(byName);

// Ref https://github.com/CleverRaven/Cataclysm-DDA/blob/658bbe419fb652086fd4d46bf5bbf9e137228464/src/item_factory.cpp#L4774
function getCategory(i: Item) {
  if (i.category) return i.category.toLowerCase();
  if (i.type === "GUN") return "guns";
  if (i.type === "MAGAZINE") return "magazines";
  if (i.type === "AMMO") return "ammo";
  if (i.type === "TOOL") return "tools";
  if (i.type === "ARMOR") return "clothing";
  if (i.type === "COMESTIBLE")
    return i.comestible_type === "MED" ? "drugs" : "food";
  if (i.type === "BOOK") return "books";
  if (i.type === "GUNMOD") return "mods";
  if (i.type === "BIONIC_ITEM") return "bionics";
  if (i.bashing || i.cutting) return "weapons";
  return "other";
}

function getCategoryName(category: string) {
  const cat = data.byIdMaybe("ITEM_CATEGORY", category);
  return cat ? singularName(cat) : category;
}

const groupingFn =
  {
    monster: (m: Monster) => [m.default_faction ?? ""],
    item: (i: Item) => [`${i.type} (${getCategoryName(getCategory(i))})`],
    vehicle_part: (vp: VehiclePart) => vp.categories ?? [""],
    mutation: (m: Mutation) => m.category ?? [""],
  }[type] ?? (() => [""]);

const groups = groupBy(
  things,
  groupingFn as (t: SupportedTypeMapped) => string[],
);
const groupsList = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

const groupFilter = ({
  mutation: (m: Mutation) =>
    !/Fake\d$/.test(m.id) &&
    !m.types?.includes("BACKGROUND_OTHER_SURVIVORS_STORY") &&
    !m.types?.includes("BACKGROUND_SURVIVAL_STORY"),
}[type] ?? (() => true)) as (t: SupportedTypeMapped) => boolean;
</script>

<h1 class="capitalize">{t(plural(type))}</h1>
{#each groupsList as [groupName, group]}
  {#if type === "mutation" && groupName && data.byIdMaybe("mutation_category", groupName)}
    <MutationCategory
      item={data.byId("mutation_category", groupName)}
      inCatalog={true} />
  {:else}
    <section>
      {#if groupName}
        <h1>{groupName}</h1>
      {/if}
      <LimitedList
        items={group.filter(groupFilter)}
        let:item
        limit={groupsList.length === 1 ? Infinity : 10}>
        {#if (type === "overmap_special" || type === "city_building") && item.subtype !== "mutable"}
          <OvermapAppearance overmapSpecial={item} />
        {/if}
        <ItemLink
          type={typeWithCorrectType}
          id={item.id}
          showIcon={type === "item" ||
            type === "terrain" ||
            type === "furniture" ||
            type === "monster" ||
            type === "vehicle_part"} />
      </LimitedList>
    </section>
  {/if}
{/each}
