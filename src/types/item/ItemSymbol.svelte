<script lang="ts">
import { resolveTileLayerUrl, tileData } from "../../tile-data";
import { colorForName } from "../../colors";
import { CBNData, mapType } from "../../data";
import { getContext } from "svelte";

export let item: {
  id: string;
  looks_like?: string;
  color?: string | string[];
  bgcolor?: string | [string] | [string, string, string, string];
  symbol?: string | string[];
  type: string;
};
export let width: number | undefined = undefined;
export let height: number | undefined = undefined;
export let centered: boolean = false;

let data: CBNData = getContext("data");

$: tile_info = $tileData?.tile_info[0];
$: tile = typeHasTile(item)
  ? (findTileOrLooksLike($tileData, item) ??
    fallbackTile($tileData, item.symbol, item.color ?? "white"))
  : null;

$: finalWidth =
  width ?? (tile_info?.width ?? 32) * (tile_info?.pixelscale ?? 1);
$: finalHeight =
  height ?? (tile_info?.height ?? 32) * (tile_info?.pixelscale ?? 1);

$: scaleX = finalWidth / (tile_info?.width ?? 32);
$: scaleY = finalHeight / (tile_info?.height ?? 32);

const sym = [item.symbol].flat()[0] ?? " ";
const symbol = /^LINE_/.test(sym) ? "|" : sym;
const color = item.color
  ? typeof item.color === "string"
    ? item.color
    : item.color[0]
  : item.bgcolor
    ? colorFromBgcolor(item.bgcolor)
    : "white";

function typeHasTile(item: any): boolean {
  return ["item", "monster", "terrain", "furniture", "vehicle_part"].includes(
    mapType(item.type),
  );
}

function colorFromBgcolor(
  color: string | [string] | [string, string, string, string],
): string {
  return typeof color === "string" ? `i_${color}` : colorFromBgcolor(color[0]);
}

function findTileOrLooksLike(
  tileData: any,
  item: any,
  jumps: number = 10,
): TileInfo | undefined {
  function resolveId(id: string): string {
    return item.type === "vehicle_part" ? `vp_${id}` : id;
  }
  const idTile = findTile(tileData, resolveId(item.id ?? item.abstract));
  if (idTile) return idTile;
  const looksLikeId = item.looks_like ?? item["copy-from"];
  if (!looksLikeId) return;
  const looksLikeTile = findTile(tileData, resolveId(looksLikeId));
  if (looksLikeTile) return looksLikeTile;
  if (jumps > 0) {
    const parent =
      data.byIdMaybe(mapType(item.type), looksLikeId) ??
      data.abstractById(mapType(item.type), looksLikeId);
    if (parent) return findTileOrLooksLike(tileData, parent, jumps - 1);
  }
}

type TilePosition = {
  file: string;
  file_url?: string;
  source_base_url?: string;
  tx: number;
  ty: number;
  width: number;
  height: number;
  offx: number;
  offy: number;
};
type TileInfo = {
  fg?: TilePosition;
  bg?: TilePosition;
};

function layerUrl(tile: TilePosition | undefined): string {
  return resolveTileLayerUrl($tileData, tile) ?? "";
}

function findTile(tileData: any, id: string): TileInfo | undefined {
  if (!tileData || !id) return;
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
      width: range.chunk.sprite_width ?? tileData.tile_info[0].width,
      height: range.chunk.sprite_height ?? tileData.tile_info[0].height,
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
    offset += chunk.nx * chunk.ny;
  }
}

function fallbackTile(
  tileData: any,
  symbolMaybeArr: string | string[] | undefined,
  color: string | string[],
): TileInfo | undefined {
  if (!tileData) return;
  const symbol = [symbolMaybeArr].flat()[0];
  const sym = !symbol ? " " : /^LINE_/.test(symbol) ? "|" : symbol;
  const c = colorForName(Array.isArray(color) ? color[0] : color).fg;
  for (const chunk of tileData["tiles-new"]) {
    for (const entry of chunk.ascii ?? []) {
      const fg = parseEntryColor(entry.color) + (entry.bold ? 8 : 0);
      if (fg === c) {
        const index = entry.offset + sym.charCodeAt(0);
        const tx = index % chunk.nx;
        const ty = (index / chunk.nx) | 0;
        return {
          fg: {
            file: chunk.file,
            tx,
            ty,
            width: tileData.tile_info[0].width,
            height: tileData.tile_info[0].height,
            offx: 0,
            offy: 0,
          },
        };
      }
    }
  }

  function parseEntryColor(color: string) {
    if (color === "BLACK") {
      return 0;
    } else if (color === "RED") {
      return 1;
    } else if (color === "GREEN") {
      return 2;
    } else if (color === "YELLOW") {
      return 3;
    } else if (color === "BLUE") {
      return 4;
    } else if (color === "MAGENTA") {
      return 5;
    } else if (color === "CYAN") {
      return 6;
    } else if (color === "WHITE") {
      return 7;
    } else return -1;
  }
}
</script>

{#if tile && tile_info}
  <div
    style="
      width: {finalWidth}px;
      height: {finalHeight}px;
    "
    class="tile-icon">
    {#if tile.bg != null}
      <div
        class="icon-layer bg"
        style="
          width: {tile.bg.width}px;
          height: {tile.bg.height}px;
          background-image: url({layerUrl(tile.bg)});
          background-position: {-tile.bg.tx * tile.bg.width}px
            {-tile.bg.ty * tile.bg.height}px;
          {centered ? 'left: 50%; top: 50%;' : ''}
          transform: scale({scaleX}, {scaleY})
            {centered
          ? ''
          : `translate(${tile.bg.offx}px, ${tile.bg.offy}px)`}{centered
          ? ' translate(-50%, -50%)'
          : ''};
        " />
    {/if}
    {#if tile.fg != null}
      <div
        class="icon-layer fg"
        style="
          width: {tile.fg.width}px;
          height: {tile.fg.height}px;
          background-image: url({layerUrl(tile.fg)});
          background-position: {-tile.fg.tx * tile.fg.width}px {-tile.fg.ty *
          tile.fg.height}px;
          {centered ? 'left: 50%; top: 50%;' : ''}
          transform: scale({scaleX}, {scaleY})
            {centered
          ? ''
          : `translate(${tile.fg.offx}px, ${tile.fg.offy}px)`}{centered
          ? ' translate(-50%, -50%)'
          : ''};
        " />
    {/if}
  </div>
{:else if tile_info}
  <!-- Sized ASCII fallback: We have cached tileset dimensions but tile data hasn't loaded yet.
       This prevents layout shift during initial page load or version switching. -->
  <span
    class="tile-icon c_{color}"
    style="
      width: {finalWidth}px;
      height: {finalHeight}px;
      line-height: {finalHeight}px;
      font-size: {finalHeight}px;
      {centered
      ? 'display: flex; align-items: center; justify-content: center;'
      : ''}
    ">{symbol}</span>
  <!--    class="-&#45;&#45;c_{color}">&nbsp;</span>-->
{:else}
  <span
    class="tile-icon c_{color}"
    style="
      width: {finalWidth}px;
      height: {finalHeight}px;
      line-height: {finalHeight}px;
      font-size: {finalHeight}px;
      {centered
      ? 'display: flex; align-items: center; justify-content: center;'
      : ''}
    ">{symbol}</span>
{/if}

<style>
.tile-icon {
  vertical-align: middle;
  display: inline-block;
  position: relative;
  font-family: UnifontSubset, monospace;
  text-align: center;
}

.icon-layer {
  position: absolute;
  transform-origin: top left;
  image-rendering: pixelated;
}
</style>
