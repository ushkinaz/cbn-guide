<script lang="ts">
import { setContext, untrack } from "svelte";

import { CBNData } from "./data";
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
import { asArray, groupBy } from "./utils/collections";
import { gameSingularName } from "./i18n/game-locale";
import { translateType } from "./i18n/transifex-static";
interface Props {
  type: string;
  data: CBNData;
}
let { type: sourceType, data: sourceData }: Props = $props();
const type = untrack(() => sourceType);
const data = untrack(() => sourceData);
let typeWithCorrectType = type as keyof SupportedTypesWithMapped;
setContext("data", data);

const things = data
  .byType(typeWithCorrectType)
  .filter((o) => "id" in o && o.id);

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

const categoryNameCache = new Map<string, string>();

function getCategoryName(category: string) {
  const cachedCategoryName = categoryNameCache.get(category);
  if (cachedCategoryName) return cachedCategoryName;
  const cat = data.byIdMaybe("ITEM_CATEGORY", category);
  const resolvedCategoryName = cat ? gameSingularName(cat) : category;
  categoryNameCache.set(category, resolvedCategoryName);
  return resolvedCategoryName;
}

const rawGroupingFn =
  {
    monster: (m: Monster) => [m.default_faction ?? ""],
    item: (i: Item) => [`${i.type} (${getCategoryName(getCategory(i))})`],
    vehicle_part: (vp: VehiclePart) =>
      asArray(vp.categories).length ? asArray(vp.categories) : [""],
    mutation: (m: Mutation) =>
      asArray(m.category).length ? asArray(m.category) : [""],
  }[type] ?? (() => [""]);
const groupingFn = rawGroupingFn as (item: SupportedTypeMapped) => string[];

const groupFilter = ({
  mutation: (m: Mutation) => !m.types?.includes("BACKGROUND_SURVIVAL_STORY"),
}[type] ?? (() => true)) as (t: SupportedTypeMapped) => boolean;

const entries = things
  .map((item) => ({
    item,
    displayName: gameSingularName(item),
    groupNames: groupingFn(item),
  }))
  .sort((a, b) => a.displayName.localeCompare(b.displayName))
  .filter(({ item }) => groupFilter(item));
const groups = groupBy(entries, (entry) => entry.groupNames);
const groupsList = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
</script>

<h1 class="capitalize">{translateType(typeWithCorrectType)}</h1>
{#each groupsList as [groupName, group] (groupName)}
  {#if type === "mutation" && groupName && data.byIdMaybe("mutation_category", groupName)}
    <MutationCategory
      item={data.byId("mutation_category", groupName)}
      inCatalog={true} />
  {:else}
    <section>
      {#if groupName}
        <h2>{groupName}</h2>
      {/if}
      <LimitedList
        items={group}
        limit={groupsList.length === 1 ? Infinity : 10}>
        {#snippet children({ item })}
          <ItemLink
            type={typeWithCorrectType}
            id={"id" in item.item ? item.item.id : ""}
            overrideText={item.displayName} />
        {/snippet}
      </LimitedList>
    </section>
  {/if}
{/each}
