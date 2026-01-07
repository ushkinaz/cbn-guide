<script lang="ts">
import { getContext } from "svelte";
import {
  CBNData,
  countsByCharges,
  pluralName,
  singular,
  singularName,
} from "../data";
import { getVersionedBasePath } from "../routing";
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

function linkText(item: any, plural: boolean): string {
  if (overrideText) return overrideText;
  if (item) {
    if (item.type === "addiction_type") return singular(item.type_name);
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

const item = data.byIdMaybe(type, id);
let linkItem = item;
if (linkItem?.type === "vehicle_part" && !linkItem.name && linkItem.item)
  linkItem = data.byId("item", linkItem.item);

const iconItem = isSymbolItem(item) ? item : null;
const href = `${getVersionedBasePath()}${type}/${id}${location.search}`;
</script>

<span class="item-link__wrap" class:item-link__wrap--count={count != null}>
  {#if count != null}
    {#if !countsByCharges(linkItem)}{countToString(count)}{/if}
  {/if}
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
  {#if count != null && countsByCharges(linkItem)}{" "}({countToString(
      count,
    )}){/if}
  {#if showText && linkItem?.type === "mutation"}&nbsp;<MutationColor
      mutation={linkItem} />{/if}
</span>

<!--suppress CssUnusedSymbol -->
<style>
.item-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  text-decoration: none;
}

.item-link--icon {
  white-space: nowrap;
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

.item-link__wrap--count {
  white-space: nowrap;
}
</style>
