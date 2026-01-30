<script lang="ts">
import { getContext } from "svelte";
import {
  CBNData,
  countsByCharges,
  omsName,
  pluralName,
  singular,
  singularName,
} from "../data";
import { getVersionedBasePath, page } from "../routing";
import type { SupportedTypesWithMapped } from "../types";
import MutationColor from "./MutationColor.svelte";
import ItemSymbol from "./item/ItemSymbol.svelte";

type ItemSymbolItem = {
  id: string;
  looks_like?: string;
  color?: string | string[];
  bgcolor?: string | [string] | [string, string, string, string];
  symbol?: string | string[];
  type: string;
};

export let type: keyof SupportedTypesWithMapped;
export let id: string;
export let plural: boolean = false;
export let count: number | [number, number] | undefined = undefined;
export let overrideText: string | undefined = undefined;
export let showIcon: boolean = true;
export let showText: boolean = true;
export let link: boolean = true;

function countToString(count: number | [number, number]): string {
  if (typeof count === "number") return count.toString();
  if (count[0] === count[1]) return count[0].toString();
  return `${count[0]}–${count[1]}`;
}

function countIsPlural(count: number | [number, number]): boolean {
  if (typeof count === "number") return count !== 1;
  if (count[0] === count[1]) return count[0] !== 1;
  return true;
}

/**
 * Generates display text for an item link.
 * Special handling for addiction_type (uses type_name) and overmap_special (uses omsName).
 */
function linkText(item: any, plural: boolean): string {
  if (overrideText) return overrideText;
  if (item) {
    if (item.type === "addiction_type") return singular(item.type_name);
    if (item.type === "overmap_special") return omsName(data, item);
    return (plural ? pluralName : singularName)(item);
  }
  return id;
}

function isSymbolItem(value: any): value is ItemSymbolItem {
  return (
    value &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.type === "string"
  );
}

const data = getContext<CBNData>("data");

$: item = data.byIdMaybe(type, id);
let linkItem: typeof item;
$: {
  linkItem = item;
  if (linkItem?.type === "vehicle_part" && !linkItem.name && linkItem.item)
    linkItem = data.byId("item", linkItem.item);
}

// For overmap_special, use the roadmap item's icon instead of the overmap_special's own symbol
$: iconItem = isSymbolItem(item)
  ? type === "overmap_special"
    ? data.byIdMaybe("item", "roadmap")
    : item
  : null;
// Use $page.url to trigger updates when the URL changes
$: href = `${getVersionedBasePath()}${type}/${id}${
  $page.url.search || location.search
}`;
</script>

<span class="item-link" class:item-link--count={count != null}>
  <svelte:element
    this={link ? "a" : "span"}
    class="item-link"
    class:item-link--icon={showIcon}
    href={link ? href : undefined}>
    {#if showIcon && iconItem}
      <ItemSymbol item={iconItem} />
    {/if}
    {#if showText}
      <span class="item-link__text">
        {linkText(
          linkItem,
          count != null
            ? countIsPlural(count) && !countsByCharges(linkItem)
            : plural,
        )}
      </span>
    {/if}
  </svelte:element>
  {#if count != null}
    <span class="item-link__count">
      {#if !countsByCharges(linkItem)}
        {countToString(count)}
      {:else}
        ({countToString(count)})
      {/if}
    </span>
  {/if}
  {#if showText && linkItem?.type === "mutation"}
    <MutationColor mutation={linkItem} />
  {/if}
</span>

<style>
.item-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  text-decoration: none;
  vertical-align: middle;
}

a.item-link:hover,
a.item-link:focus-visible {
  text-decoration: none;
}

.item-link__text {
  text-decoration: none;
}

a.item-link:hover .item-link__text,
a.item-link:focus-visible .item-link__text {
  text-decoration: underline;
}
</style>
