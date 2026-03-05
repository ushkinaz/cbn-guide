<script lang="ts">
import { getContext } from "svelte";
import { CBNData, singular } from "../../data";
import type { OvermapSpecial } from "../../types";

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

let overmapLayout = $derived.by(() => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let overmapsByPoint = new Map<string, OvermapEntry>();

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
  const { minX, minY, maxX, maxY, overmapsByPoint } = overmapLayout;
  const appearanceGrid: { sym?: string; color: string; name: string }[][] = [];
  for (let y = minY; y <= maxY; y++) {
    const appearanceRow: { sym?: string; color: string; name: string }[] = [];
    for (let x = minX; x <= maxX; x++) {
      const om = overmapsByPoint.get(`${x}|${y}|${z}`);
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
  if (!data.hasById("overmap_terrain", omt_id))
    return { color: "black", sym: " ", name: "" };

  const color = data.resolveOneById("overmap_terrain", omt_id, "color");
  const sym = data.resolveOneById("overmap_terrain", omt_id, "sym");
  const name = data.resolveOneById("overmap_terrain", omt_id, "name");

  return {
    color: typeof color === "string" ? color : "black",
    sym: rotateSymbol(
      typeof sym === "string" ? sym : "\u00a0" /* LINE_XOXO_C */,
      dir,
    ),
    name: name ? singular(name as any) : "",
  };
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
