<script lang="ts">
import { getContext } from "svelte";
import {
  CBNData,
  getVehiclePartIdAndVariant,
  normalizeVehicleMountedParts,
} from "../data";
import type { Vehicle, VehiclePart } from "../types";
import {
  resolveTileLayerUrl,
  tileData,
  type TilesetData,
  type TileInfo,
  type TilePosition,
} from "../tile-data";
import { t } from "@transifex/native";

export let item: Vehicle;

const data = getContext<CBNData>("data");
const _context = "Vehicle View";
//TODO: HitButton_iso uses isometric perspective, support that

let minX = Infinity;
let maxX = -Infinity;
let minY = Infinity;
let maxY = -Infinity;
//https://github.com/cataclysmbn/Cataclysm-BN/blob/1f1f5abf1e5135933fb2bbdbd74194d0e2dc75a8/src/veh_type.cpp#L552
const zOrder: Record<NonNullable<VehiclePart["location"]>, number> = {
  on_roof: 9,
  on_cargo: 8,
  center: 7,
  under: 6,
  structure: 5,
  engine_block: 4,
  on_battery_mount: 3,
  fuel_source: 3,
  roof: -1,
  armor: -2,
};

const zForPart = (partId: string): number => {
  const vehiclePart = data.byIdMaybe("vehicle_part", partId);
  if (!vehiclePart) {
    if (partId.startsWith("turret_")) return zForPart("turret_generic");
    return 0;
  }
  const location = vehiclePart.location ?? "";
  return zOrder[location] ?? 0;
};

type NormalizedPart = { partId: string; variant: string; fuel?: string };
type NormalizedPartList = {
  x: number;
  y: number;
  parts: NormalizedPart[];
};

const normalizedParts: NormalizedPartList[] = normalizeVehicleMountedParts(
  item,
).map((part) => {
  if (part.x < minX) minX = part.x;
  if (part.x > maxX) maxX = part.x;
  if (part.y < minY) minY = part.y;
  if (part.y > maxY) maxY = part.y;

  const parts =
    part.parts?.map(({ part, fuel }) => {
      const [partId, variant] = getVehiclePartIdAndVariant(data, part);
      return { partId, variant, fuel };
    }) ?? [];
  return { x: part.x, y: part.y, parts };
});

const finalGrid: (NormalizedPart | undefined)[][] = [];
for (let x = maxX; x >= minX; x--) {
  const row: (NormalizedPart | undefined)[] = [];
  for (let y = minY; y <= maxY; y++) {
    const cellParts = normalizedParts
      .filter((p) => p.x === x && p.y === y)
      .flatMap((p) => p.parts);
    if (!cellParts.length) {
      row.push(undefined);
      continue;
    }
    let topPart = cellParts[0];
    let topZ = zForPart(topPart.partId);
    for (const part of cellParts) {
      const z = zForPart(part.partId);
      if (z >= 0 && z > topZ) {
        topZ = z;
        topPart = part;
      }
    }
    row.push(topPart);
  }
  finalGrid.push(row);
}

$: tile_info = $tileData?.tile_info[0];

function findTile(
  tileData: TilesetData | null,
  id: string,
): TileInfo | undefined {
  if (!tileData || !id) return;
  //TODO: Cache tiles-new ranges and tile lookups per tileset to avoid per-cell scans.
  let offset = 0;
  const ranges: { from: number; to: number; chunk: any }[] = [];
  for (const chunk of tileData["tiles-new"]) {
    ranges.push({
      from: offset,
      to: offset + chunk.nx * chunk.ny,
      chunk,
    });
    offset += chunk.nx * chunk.ny;
  }
  function findRange(id: number) {
    for (const range of ranges)
      if (id >= range.from && id < range.to) return range;
  }
  function tileInfoForId(id: number | undefined): TilePosition | undefined {
    if (id == null) return;
    const range = findRange(id);
    if (!range) return;
    const offsetInFile = id - range.from;
    const fgTx = offsetInFile % range.chunk.nx;
    const fgTy = (offsetInFile / range.chunk.nx) | 0;
    return {
      file: range.chunk.file,
      file_url: range.chunk.file_url,
      source_base_url: range.chunk.source_base_url,
      // Safe to use ! because we check tileData at function entry
      width: range.chunk.sprite_width ?? tileData!.tile_info[0].width,
      height: range.chunk.sprite_height ?? tileData!.tile_info[0].height,
      offx: range.chunk.sprite_offset_x ?? 0,
      offy: range.chunk.sprite_offset_y ?? 0,
      tx: fgTx,
      ty: fgTy,
    };
  }
  const idMatches = (testId: string) =>
    testId &&
    (testId === id ||
      (testId.startsWith(id) &&
        /^_season_(autumn|spring|summer|winter)$/.test(
          testId.substring(id.length),
        )));
  for (
    let chunkIdx = tileData["tiles-new"].length - 1;
    chunkIdx >= 0;
    chunkIdx--
  ) {
    const chunk = tileData["tiles-new"][chunkIdx];
    for (const info of chunk.tiles) {
      if (
        Array.isArray(info.id) ? info.id.some(idMatches) : idMatches(info.id)
      ) {
        let fg = Array.isArray(info.fg) ? info.fg[0] : info.fg;
        let bg = Array.isArray(info.bg) ? info.bg[0] : info.bg;
        if (fg && typeof fg === "object") fg = fg.sprite;
        if (bg && typeof bg === "object") bg = bg.sprite;
        return {
          fg: tileInfoForId(fg),
          bg: tileInfoForId(bg),
        };
      }
    }
  }
}
export const MAX_INHERITANCE_DEPTH = 10;

function findTileOrLooksLike(
  tileData: TilesetData | null,
  partId: string,
  jumps: number = MAX_INHERITANCE_DEPTH,
): TileInfo | undefined {
  const id = `vp_${partId}`;
  const idTile = findTile(tileData, id);
  if (idTile) return idTile;

  const vehiclePart = data.byIdMaybe("vehicle_part", partId);
  if (!vehiclePart) return;

  const looksLikeId = vehiclePart.looks_like ?? vehiclePart["copy-from"];
  if (!looksLikeId) return;

  const looksLikeTile = findTile(tileData, `vp_${looksLikeId}`);
  if (looksLikeTile) return looksLikeTile;

  if (jumps > 0) {
    const parent = (data.byIdMaybe("vehicle_part", looksLikeId) ??
      data.abstractById("vehicle_part", looksLikeId)) as
      | VehiclePart
      | undefined;
    if (parent)
      return findTileOrLooksLike(
        tileData,
        parent.id ?? parent.abstract,
        jumps - 1,
      );
  }
}

const standardSymbols = {
  cover: "^",
  cross: "c",
  horizontal: "h",
  horizontal_2: "=",
  vertical: "j",
  vertical_2: "H",
  ne: "u",
  nw: "y",
  se: "n",
  sw: "b",
};
const LINE = {
  XOXO: "│",
  OXOX: "─",
  XXOO: "└",
  OXXO: "┌",
  OOXX: "┐",
  XOOX: "┘",
  XXXO: "├",
  XXOX: "┴",
  XOXX: "┤",
  OXXX: "┬",
  XXXX: "┼",
};
const specialSymbol = (symbol: string): string => {
  switch (symbol) {
    case "j":
      return LINE.XOXO;
    case "h":
      return LINE.OXOX;
    case "c":
      return LINE.XXXX;
    case "y":
      return LINE.OXXO;
    case "u":
      return LINE.OOXX;
    case "n":
      return LINE.XOOX;
    case "b":
      return LINE.XXOO;
    default:
      return symbol;
  }
};

function getFallback(partId: string, variant: string) {
  const vehiclePart = data.byIdMaybe("vehicle_part", partId);
  if (!vehiclePart) return { symbol: "?", color: "white" };
  const symbol = vehiclePart.symbol ?? "=";
  const symbols: Record<string, string> = {
    ...(vehiclePart.standard_symbols ? standardSymbols : {}),
    ...vehiclePart.symbols,
  };
  return {
    symbol: specialSymbol(symbols[variant] ?? symbol),
    color: vehiclePart.color ?? "white",
  };
}
</script>

<section>
  <h1>{t("Render", { _context })}</h1>
  <div
    class="vehicle-view"
    style="grid-template-columns: repeat({maxY - minY + 1}, auto)">
    {#each finalGrid as row}
      {#each row as part}
        <div class="cell">
          {#if part}
            {@const tile = $tileData
              ? findTileOrLooksLike($tileData, part.partId)
              : null}
            {#if tile && tile_info}
              <div
                style="
                width: {tile_info.width * tile_info.pixelscale}px;
                height: {tile_info.height * tile_info.pixelscale}px;
              "
                class="tile-icon"
                title={part.partId}>
                {#if tile.bg != null}
                  <div
                    class="icon-layer bg"
                    style="
                    width: {tile.bg.width}px;
                    height: {tile.bg.height}px;
                    background-image: url({resolveTileLayerUrl(
                      $tileData,
                      tile.bg,
                    )});
                    background-position: {-tile.bg.tx * tile.bg.width}px
                      {-tile.bg.ty * tile.bg.height}px;
                    transform: scale({tile_info.pixelscale})
                    translate({tile.bg.offx}px, {tile.bg.offy}px);
                  " />
                {/if}
                {#if tile.fg != null}
                  <div
                    class="icon-layer fg"
                    style="
                    width: {tile.fg.width}px;
                    height: {tile.fg.height}px;
                    background-image: url({resolveTileLayerUrl(
                      $tileData,
                      tile.fg,
                    )});
                    background-position: {-tile.fg.tx * tile.fg.width}px {-tile
                      .fg.ty * tile.fg.height}px;
                    transform: scale({tile_info.pixelscale}) translate({tile.fg
                      .offx}px, {tile.fg.offy}px);
                  " />
                {/if}
              </div>
            {:else}
              {@const fallback = getFallback(part.partId, part.variant)}
              <span
                class="tile-icon c_{fallback.color}"
                title={part.partId}
                style="
                width: {tile_info?.width
                  ? tile_info.width * tile_info.pixelscale
                  : 16}px;
                height: {tile_info?.height
                  ? tile_info.height * tile_info.pixelscale
                  : 16}px;
                line-height: {tile_info?.height
                  ? tile_info.height * tile_info.pixelscale
                  : 16}px;
              ">{fallback.symbol}</span>
            {/if}
          {/if}
        </div>
      {/each}
    {/each}
  </div>
</section>

<style>
.vehicle-view {
  display: grid;
  padding: 8px;
  width: fit-content;
  margin-bottom: 1em;
}
.cell {
  width: auto;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tile-icon {
  vertical-align: middle;
  display: inline-block;
  position: relative;
  font-family: UnifontSubset, monospace;
  text-align: center;
}

.icon-layer {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  image-rendering: pixelated;
}
</style>
