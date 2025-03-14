<script lang="ts">
import { getContext } from "svelte";
import {
  CddaData,
  countsByCharges,
  pluralName,
  singular,
  singularName,
} from "../data";
import type { SupportedTypesWithMapped } from "../types";
import MutationColor from "./MutationColor.svelte";

export let type: keyof SupportedTypesWithMapped;
export let id: string;
export let plural: boolean = false;
export let count: number | [number, number] | undefined = undefined;
export let overrideText: string | undefined = undefined;

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

const data = getContext<CddaData>("data");

let item = data.byIdMaybe(type, id);
if (item?.type === "vehicle_part" && !item.name && item.item)
  item = data.byId("item", item.item);
</script>

{#if count != null}
  <span style="white-space: nowrap">
    {#if !countsByCharges(item)}{countToString(count)}{/if}
    <svelte:self
      {type}
      {id}
      plural={countIsPlural(count) &&
        !countsByCharges(
          item,
        )} />{#if countsByCharges(item)}{" "}({countToString(
        count,
      )}){/if}</span>
{:else}
  <a href="{import.meta.env.BASE_URL}{type}/{id}{location.search}"
    >{overrideText
      ? overrideText
      : item
        ? item.type === "addiction_type"
          ? singular(item.type_name)
          : (plural ? pluralName : singularName)(item)
        : id}</a
  >{#if item?.type === "mutation"}&nbsp;<MutationColor mutation={item} />{/if}
{/if}
