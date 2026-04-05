<script lang="ts">
import { getContext } from "svelte";
import { CBNData } from "../../data";
import type { OvermapSpecial } from "../../types";

import { gameSingular } from "../../i18n/game-locale";

const data = getContext<CBNData>("data");

interface Props {
  overmapSpecial: OvermapSpecial;
  showZ?: number;
}

let { overmapSpecial, showZ = 0 }: Props = $props();

let overmaps = $derived([
  ...(overmapSpecial.subtype !== "mutable"
    ? (overmapSpecial.overmaps ?? [])
    : []),
]);
type OvermapEntry = (typeof overmaps)[number];

let appearanceState = $derived.by(() => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const overmapsByPoint = new Map<string, OvermapEntry>();
  for (const om of overmaps) {
    const [x, y, z] = om.point;
    if (om.overmap) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      overmapsByPoint.set(`${x}|${y}|${z}`, om);
    }
  }
  return { minX, minY, maxX, maxY, overmapsByPoint };
});

function makeAppearanceGrid(z: number) {
  const appearanceGrid: { sym?: string; color: string; name: string }[][] = [];
  for (let y = appearanceState.minY; y <= appearanceState.maxY; y++) {
    const appearanceRow: { sym?: string; color: string; name: string }[] = [];
    for (let x = appearanceState.minX; x <= appearanceState.maxX; x++) {
      const om = appearanceState.overmapsByPoint.get(`${x}|${y}|${z}`);
      if (om?.overmap) {
        const [, omt_id, dir] = /^(.+?)(?:_(north|south|east|west))?$/.exec(
          om.overmap,
        )!;
        const appearance = omtAppearance(omt_id, dir || "north");
        appearanceRow.push(appearance);
      } else {
        appearanceRow.push({ color: "black", sym: " ", name: "" });
      }
    }
    appearanceGrid.push(appearanceRow);
  }

  return appearanceGrid;
}

function rotateSymbol(symbol: string, dir: string) {
  const dirNum =
    dir === "north"
      ? 0
      : dir === "east"
        ? 1
        : dir === "south"
          ? 2
          : dir === "west"
            ? 3
            : 0;
  if (dirNum === 0) return symbol;
  const rotatable = data
    .byType("rotatable_symbol")
    .find((r) => r.tuple.some((x) => x === symbol));
  if (!rotatable) return symbol;
  return rotatable.tuple[
    (rotatable.tuple.indexOf(symbol) + dirNum) % rotatable.tuple.length
  ];
}

function omtAppearance(
  omt_id: string,
  dir: string = "north",
): {
  color: string;
  sym: string;
  name: string;
} {
  const omt = data.byIdMaybe("overmap_terrain", omt_id);
  return omt
    ? {
        color: omt.color ?? "black",
        sym: rotateSymbol(omt.sym ?? "\u00a0" /* LINE_XOXO_C */, dir),
        name: gameSingular(omt.name),
      }
    : { color: "black", sym: " ", name: "" };
}
</script>

<div class="appearance-grid">
  {#each makeAppearanceGrid(showZ) as row}{#each row as omt}<span
        class="c_{omt.color}"
        title={omt.name}>{omt.sym ?? "\u00a0"}</span
      >{/each}<br />{/each}
</div>

<style>
.appearance-grid {
  font-family: UnifontSubset, monospace;
  line-height: 1;
  white-space: pre;
}
</style>
