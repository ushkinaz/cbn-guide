<script lang="ts">
import { getContext } from "svelte";
import { CBNData, countsByCharges, omsName } from "../data";
import type { SupportedTypesWithMapped } from "../types";
import MutationColor from "./MutationColor.svelte";
import ItemSymbol from "./item/ItemSymbol.svelte";
import { t } from "@transifex/native";
import {
  gamePluralName,
  gameSingular,
  gameSingularName,
} from "../i18n/game-locale";
import { buildLinkTo } from "../navigation.svelte";

type ItemSymbolItem = {
  id: string;
  looks_like?: string;
  color?: string | string[];
  bgcolor?: string | [string] | [string, string, string, string];
  symbol?: string | string[];
  type: string;
  level: number;
};

interface Props {
  type: keyof SupportedTypesWithMapped;
  id: string;
  plural?: boolean;
  count?: number | [number, number];
  overrideText?: string;
  showIcon?: boolean;
  showText?: boolean;
  link?: boolean;
  level?: number;
}

let {
  type,
  id,
  plural = false,
  count = undefined,
  overrideText = undefined,
  showIcon = true,
  showText = true,
  link = true,
  level = undefined,
}: Props = $props();

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
    if (item.type === "addiction_type") return gameSingular(item.type_name);
    if (item.type === "overmap_special") return omsName(data, item);
    return (plural ? gamePluralName : gameSingularName)(item);
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

let item = $derived(data.byIdMaybe(type, id));
let linkItem = $derived.by(() => {
  let resolvedItem = item;
  if (
    resolvedItem?.type === "vehicle_part" &&
    !resolvedItem.name &&
    resolvedItem.item
  ) {
    resolvedItem = data.byId("item", resolvedItem.item);
  }
  return resolvedItem;
});

// For overmap_special, use the roadmap item's icon instead of the overmap_special's own symbol
let iconItem = $derived(
  isSymbolItem(item)
    ? type === "overmap_special"
      ? data.byIdMaybe("item", "roadmap")
      : item
    : null,
);
</script>

<span class="thing-link" class:item-link--count={count != null}>
  {#if showIcon && iconItem}
    <ItemSymbol item={iconItem} />
  {/if}
  <span class="th-text-group">
    <svelte:element
      this={link ? "a" : "span"}
      class="item-link"
      class:item-link--icon={showIcon}
      href={link ? buildLinkTo({ kind: "item", type, id }) : undefined}>
      {#if showText}
        <span class="th-link-text">
          {linkText(
            linkItem,
            count != null
              ? countIsPlural(count) && !countsByCharges(linkItem)
              : plural,
          )}
        </span>
      {/if}
    </svelte:element>
    {#if /obsolet/.test(item?.__filename ?? "")}
      <abbr class="tl-obsolete">{t("†")}</abbr>
    {/if}
    {#if count != null}
      <span class="th-link-count">
        x{countToString(count)}
      </span>
    {/if}
    {#if showText && linkItem?.type === "mutation"}
      <MutationColor mutation={linkItem} />
    {/if}
    {#if level != null}
      <span class="th-level">{t("lvl")}{level}</span>
    {/if}
  </span>
</span>

<style>
.thing-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  text-decoration: none;
  vertical-align: baseline;
  min-width: 0;
}

.th-text-group {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25em;
}

.tl-obsolete {
  color: var(--cata-color-gray);
  font-family: var(--font-mono-game);
}

.th-link-text {
  min-width: 0;
  word-break: break-word;
}

.th-link-count {
  font-variant-caps: all-small-caps;
}

.th-level {
  font-variant-caps: all-small-caps;
}
</style>
