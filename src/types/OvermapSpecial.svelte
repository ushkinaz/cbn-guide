<script lang="ts">
import { type CBNData } from "../data";
import type { OvermapSpecial } from "../types";
import { getContext, untrack } from "svelte";
import type { Action } from "svelte/action";
import {
  getFurnitureForMapgen,
  getLootForMapgen,
  getOMSByAppearance,
  getTerrainForMapgen,
  lootForOmSpecial,
  overmapAppearance,
} from "./item/spawnLocations";
import ItemLink from "./ItemLink.svelte";
import { t } from "@transifex/native";
import OvermapAppearance from "./item/OvermapAppearance.svelte";
import ItemTable from "./item/ItemTable.svelte";

import { gameSingularName } from "../i18n/gettext";

const data = getContext<CBNData>("data");

interface Props {
  item: OvermapSpecial;
}

let { item: sourceItem }: Props = $props();
const item = untrack(() => sourceItem);
const mevels =
  item.subtype === "mutable"
    ? [0]
    : (item.overmaps?.map((om) => om.point[2]) ?? [0]);
const minLevel = Math.min(...mevels);
const maxLevel = Math.max(...mevels);
const levels = Array.from(
  { length: maxLevel - minLevel + 1 },
  (_, i) => i + minLevel,
);

const lookalikeIds = (
  getOMSByAppearance(data).get(overmapAppearance(data, item)) ?? []
).sort((a, b) => a.localeCompare(b));

const _context = "Overmap Special";

function resetParentStyles(parent: HTMLElement): void {
  parent.style.width = "";
  parent.style.height = "";
  parent.style.position = "";
  parent.style.left = "";
  parent.style.top = "";
}

const fitTight: Action<HTMLElement> = (node) => {
  function makeFitTight(): void {
    const parent = node.parentElement;
    if (!parent) return;

    const { x, y, width, height } = node.getBoundingClientRect();
    parent.style.width = `${width}px`;
    parent.style.height = `${height}px`;
    const parentBox = parent.getBoundingClientRect();
    parent.style.position = "relative";
    parent.style.left = `${parentBox.x - x}px`;
    parent.style.top = `${parentBox.y - y}px`;
  }

  const observer = new ResizeObserver(makeFitTight);
  observer.observe(node);
  makeFitTight();

  return {
    destroy(): void {
      observer.disconnect();
      if (node.parentElement) {
        resetParentStyles(node.parentElement);
      }
    },
  };
};
</script>

<h1>{gameSingularName(item)}</h1>

<section>
  {#if item.subtype === "mutable"}
    <p>
      {t("This location's appearance is dynamically generated.", { _context })}
    </p>
  {:else if item.overmaps?.length}
    <div class="om-appearance">
      {#if levels.length > 1}
        {#each [...levels].reverse() as level, i (level)}
          <div class={`level ${level === 0 ? "ground-level" : ""}`}>
            <div class="label">
              <span style={level === 0 ? "" : "visibility: hidden"}>Z=</span
              >{level}
            </div>
            <div class="layer-container">
              <div class="layer" use:fitTight>
                <OvermapAppearance overmapSpecial={item} showZ={level} />
              </div>
            </div>
          </div>
        {/each}
      {:else}
        <div class={`level ${levels[0] === 0 ? "ground-level" : ""}`}>
          <div class="label">
            Z={levels[0]}
          </div>
          <div class="layer-flat">
            <OvermapAppearance overmapSpecial={item} showZ={levels[0]} />
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <dl>
    {#if item.locations?.length}
      <dt>{t("Locations", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.locations ?? [] as location (location)}
            <li>{location}</li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if item.flags?.length}
      <dt>{t("Flags")}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.flags as flag}
            <li><ItemLink type="json_flag" id={flag} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if lookalikeIds.length > 1}
      <dt>{t("Lookalikes", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          <!-- prettier-ignore -->
          {#each lookalikeIds as id (id)}<li>{#if id === item.id}{id}{:else}<ItemLink type="overmap_special" {id} showIcon={false} />{/if}</li>{/each}
        </ul>
      </dd>
    {/if}
  </dl>
</section>

<ItemTable
  loot={lootForOmSpecial(data, item, (mg) => getLootForMapgen(data, mg))} />
<ItemTable
  type="terrain"
  loot={lootForOmSpecial(data, item, (mg) => getTerrainForMapgen(data, mg))} />
<ItemTable
  type="furniture"
  loot={lootForOmSpecial(data, item, (mg) =>
    getFurnitureForMapgen(data, mg),
  )} />

<style>
.om-appearance {
  display: flex;
  flex-direction: column;
  align-items: start;
}
.om-appearance > .level {
  display: flex;
  flex-direction: row;
  align-items: center;
  color: var(--cata-color-gray);
  font-weight: bold;
}
.om-appearance > .ground-level {
  color: white;
}
.om-appearance > .level > .label {
  width: 1.5em;
  margin-right: 1em;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.om-appearance > .level > .layer-container > .layer {
  transform-origin: center;
  transform: rotate3d(1, 0, 0, 45deg) translate(50%) rotate(45deg);
}
.layer,
.layer-container {
  width: min-content;
}
</style>
