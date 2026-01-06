/**
 * @file fetch-icons.ts
 * @description Extracts and renders icons for game entities (items, monsters, terrain, furniture, and vehicle parts)
 * using a specified tileset. It fetches the tileset and game data, resolves sprites,
 * and composes the final icons as PNG files.
 *
 * @usage
 * ```bash
 * # Basic usage
 * npx tsx scripts/fetch-icons.ts
 *
 * # With custom parameters
 * TILESET=UNDEAD_PEOPLE GAME_VERSION=v0.9.1 ICON_CONCURRENCY=16 npx tsx scripts/fetch-icons.ts --force
 * ```
 */

import path from "node:path";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { EnvHttpProxyAgent, request, setGlobalDispatcher } from "undici";

import { colorForName } from "../src/colors";
import { BUILDS_URL, getDataJsonUrl } from "../src/constants";
import { CBNData, mapType } from "../src/data";
import { getTilesetUrl, TILESETS } from "../src/tile-data";

type TilePosition = {
  file: string;
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

type TilesetChunk = {
  file: string;
  nx: number;
  ny: number;
  tiles: any[];
  ascii?: any[];
  sprite_width?: number;
  sprite_height?: number;
  sprite_offset_x?: number;
  sprite_offset_y?: number;
};

type TilesetJson = {
  "tiles-new": TilesetChunk[];
  tile_info: [{ width: number; height: number; pixelscale?: number }];
  baseUrl: string;
};

type LoadedTileset = {
  data: TilesetJson;
  chunkPathMap: Map<string, string>;
  idMap: Map<string, TileInfo>;
};

const agent = new EnvHttpProxyAgent();
setGlobalDispatcher(agent);

const cwd = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(cwd, "..");
const outputRoot = path.join(projectRoot, "tmp", "item-icons");
const tilesetName = process.env.TILESET ?? "UNDEAD_PEOPLE";
let version = process.env.GAME_VERSION;
const force = process.argv.includes("--force");
const parsedConcurrency = Number(process.env.ICON_CONCURRENCY ?? "8");
const concurrency = Number.isFinite(parsedConcurrency)
  ? Math.max(1, parsedConcurrency)
  : 8;

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function getTileCacheKey(tile: TileInfo): string {
  const parts = [];
  if (tile.fg) {
    parts.push(
      `f:${tile.fg.file}:${tile.fg.tx}:${tile.fg.ty}:${tile.fg.width}x${tile.fg.height}:${tile.fg.offx}:${tile.fg.offy}`,
    );
  }
  if (tile.bg) {
    parts.push(
      `b:${tile.bg.file}:${tile.bg.tx}:${tile.bg.ty}:${tile.bg.width}x${tile.bg.height}:${tile.bg.offx}:${tile.bg.offy}`,
    );
  }
  return parts.join("|");
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file: string) {
  const content = await fs.readFile(file, "utf8");
  return JSON.parse(content);
}

async function downloadFile(url: string, dest: string) {
  if (!force && (await fileExists(dest))) return;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const res = await request(url);
  if (res.statusCode && res.statusCode >= 400) {
    throw new Error(`Failed to fetch ${url} (${res.statusCode})`);
  }
  if (!res.body) throw new Error(`No response body for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function loadTileset(): Promise<LoadedTileset> {
  const tileset = TILESETS.find((t) => t.name === tilesetName);
  if (!tileset)
    throw new Error(
      `Tileset ${tilesetName} not found in constants.ts. Available: ${TILESETS.map((t) => t.name).join(", ")}`,
    );

  const baseUrl = getTilesetUrl(version!, tileset.path ?? ""); //Null check is actually redundant - it only applied to ASCII "tileset"
  const cacheDir = path.join(
    outputRoot,
    `${tilesetName}-${version}`,
    "tileset",
  );

  const configPath = path.join(cacheDir, "tile_config.json");
  await downloadFile(`${baseUrl}/tile_config.json`, configPath);
  const config = (await readJson(configPath)) as TilesetJson;
  config.baseUrl = baseUrl;
  config.tile_info[0].pixelscale = config.tile_info[0].pixelscale ?? 1;

  const chunkPathMap = new Map<string, string>();
  const idMap = new Map<string, TileInfo>();

  await runWithConcurrency(config["tiles-new"], concurrency, async (chunk) => {
    const chunkPath = path.join(cacheDir, chunk.file);
    chunkPathMap.set(chunk.file, chunkPath);
    await downloadFile(`${baseUrl}/${chunk.file}`, chunkPath);
    const metadata = await sharp(chunkPath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Could not read dimensions for ${chunk.file}`);
    }
    const spriteWidth = chunk.sprite_width ?? config.tile_info[0].width;
    const spriteHeight = chunk.sprite_height ?? config.tile_info[0].height;
    chunk.nx = Math.floor(metadata.width / spriteWidth);
    chunk.ny = Math.floor(metadata.height / spriteHeight);
  });

  // Build ID map
  let offset = 0;
  const ranges: { from: number; to: number; chunk: TilesetChunk }[] = [];
  for (const chunk of config["tiles-new"]) {
    ranges.push({
      from: offset,
      to: offset + chunk.nx * chunk.ny,
      chunk,
    });

    for (const info of chunk.tiles) {
      const ids = [info.id].flat();
      for (const id of ids) {
        if (!id) continue;
        let fg = Array.isArray(info.fg) ? info.fg[0] : info.fg;
        let bg = Array.isArray(info.bg) ? info.bg[0] : info.bg;
        if (fg && typeof fg === "object") fg = fg.sprite;
        if (bg && typeof bg === "object") bg = bg.sprite;

        const tileInfo: TileInfo = {
          fg: tileInfoForId(config, ranges, fg),
          bg: tileInfoForId(config, ranges, bg),
        };
        idMap.set(id, tileInfo);
      }
    }
    offset += chunk.nx * chunk.ny;
  }

  return { data: config, chunkPathMap, idMap };
}

function tileInfoForId(
  tileData: TilesetJson,
  ranges: { from: number; to: number; chunk: TilesetChunk }[],
  id: number | undefined,
): TilePosition | undefined {
  if (id == null) return;
  const range = ranges.find((r) => id >= r.from && id < r.to);
  if (!range) return;
  const offsetInFile = id - range.from;
  const tx = offsetInFile % range.chunk.nx;
  const ty = Math.floor(offsetInFile / range.chunk.nx);
  return {
    file: range.chunk.file,
    width: range.chunk.sprite_width ?? tileData.tile_info[0].width,
    height: range.chunk.sprite_height ?? tileData.tile_info[0].height,
    offx: range.chunk.sprite_offset_x ?? 0,
    offy: range.chunk.sprite_offset_y ?? 0,
    tx,
    ty,
  };
}

function findTile(tileset: LoadedTileset, id: string): TileInfo | undefined {
  if (!tileset || !id) return;
  const exact = tileset.idMap.get(id);
  if (exact) return exact;

  // Slow path for season variants if not found directly
  const seasonSuffix = ["autumn", "spring", "summer", "winter"].find((s) =>
    tileset.idMap.has(`${id}_season_${s}`),
  );
  if (seasonSuffix) {
    return tileset.idMap.get(`${id}_season_${seasonSuffix}`);
  }
}

function parseEntryColor(color: string) {
  switch (color) {
    case "BLACK":
      return 0;
    case "RED":
      return 1;
    case "GREEN":
      return 2;
    case "YELLOW":
      return 3;
    case "BLUE":
      return 4;
    case "MAGENTA":
      return 5;
    case "CYAN":
      return 6;
    case "WHITE":
      return 7;
    default:
      return -1;
  }
}

function fallbackTile(
  tileData: TilesetJson,
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
        const ty = Math.floor(index / chunk.nx);
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
}

function findTileOrLooksLike(
  tileset: LoadedTileset,
  data: CBNData,
  item: any,
  jumps: number = 10,
): TileInfo | undefined {
  function resolveId(id: string): string {
    return item.type === "vehicle_part" && !id.startsWith("vp_")
      ? `vp_${id}`
      : id;
  }
  const idTile = findTile(tileset, resolveId(item.id ?? item.abstract));
  if (idTile) return idTile;
  const looksLikeId = item.looks_like ?? item["copy-from"];
  if (!looksLikeId) return;
  const looksLikeTile = findTile(tileset, resolveId(looksLikeId));
  if (looksLikeTile) return looksLikeTile;
  if (jumps > 0) {
    const parent =
      data.byIdMaybe(mapType(item.type), looksLikeId) ??
      data.abstractById(mapType(item.type), looksLikeId);
    if (parent) return findTileOrLooksLike(tileset, data, parent, jumps - 1);
  }
}

type RenderedLayer = {
  buffer: Buffer;
  left: number;
  top: number;
  width: number;
  height: number;
};

async function renderLayer(
  tileData: TilesetJson,
  tile: TilePosition,
  chunkPathMap: Map<string, string>,
  cache: Map<string, Buffer>,
): Promise<RenderedLayer> {
  const pixelscale = tileData.tile_info[0].pixelscale ?? 1;
  const cacheKey = `${tile.file}:${tile.tx}:${tile.ty}:${tile.width}x${tile.height}:s${pixelscale}`;
  let buffer = cache.get(cacheKey);
  if (!buffer) {
    const tilePath = chunkPathMap.get(tile.file);
    if (!tilePath) throw new Error(`Missing tile chunk for ${tile.file}`);
    const left = tile.tx * tile.width;
    const top = tile.ty * tile.height;
    const sharpPipeline = sharp(tilePath).extract({
      left,
      top,
      width: tile.width,
      height: tile.height,
    });
    buffer =
      pixelscale === 1
        ? await sharpPipeline.png().toBuffer()
        : await sharpPipeline
            .resize({
              width: tile.width * pixelscale,
              height: tile.height * pixelscale,
              kernel: "nearest",
            })
            .png()
            .toBuffer();
    cache.set(cacheKey, buffer);
  }
  return {
    buffer,
    left: tile.offx * pixelscale,
    top: tile.offy * pixelscale,
    width: tile.width * pixelscale,
    height: tile.height * pixelscale,
  };
}

async function composeIcon(
  tileData: TilesetJson,
  tile: TileInfo,
  chunkPathMap: Map<string, string>,
  cache: Map<string, Buffer>,
): Promise<Buffer> {
  const baseWidth =
    (tileData.tile_info[0].width ?? 0) *
    (tileData.tile_info[0].pixelscale ?? 1);
  const baseHeight =
    (tileData.tile_info[0].height ?? 0) *
    (tileData.tile_info[0].pixelscale ?? 1);
  const layers: RenderedLayer[] = [];
  if (tile.bg)
    layers.push(await renderLayer(tileData, tile.bg, chunkPathMap, cache));
  if (tile.fg)
    layers.push(await renderLayer(tileData, tile.fg, chunkPathMap, cache));

  let minLeft = 0;
  let minTop = 0;
  let maxRight = baseWidth;
  let maxBottom = baseHeight;
  for (const layer of layers) {
    minLeft = Math.min(minLeft, layer.left);
    minTop = Math.min(minTop, layer.top);
    maxRight = Math.max(maxRight, layer.left + layer.width);
    maxBottom = Math.max(maxBottom, layer.top + layer.height);
  }

  const width = Math.ceil(maxRight - minLeft);
  const height = Math.ceil(maxBottom - minTop);
  const offsetX = Math.round(-minLeft);
  const offsetY = Math.round(-minTop);

  const compositeLayers = layers.map((layer) => ({
    input: layer.buffer,
    left: Math.round(layer.left + offsetX),
    top: Math.round(layer.top + offsetY),
  }));

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeLayers)
    .png()
    .toBuffer();
}

async function loadData(): Promise<{ gameData: CBNData; version: string }> {
  if (!version) {
    console.log(`Fetching latest builds from ${BUILDS_URL}...`);
    const res = await request(BUILDS_URL);
    const builds = (await res.body.json()) as any[];
    const stable = builds.find((b) => !b.prerelease);
    if (!stable) throw new Error("No stable build found in builds.json");
    version = stable.build_number;
    console.log(`Latest stable version identified as ${version}`);
  }

  const cacheDir = path.join(projectRoot, "tmp", "data-cache");
  await fs.mkdir(cacheDir, { recursive: true });
  const localAllJson = path.join(cacheDir, `all-${version}.json`);

  if (!(await fileExists(localAllJson))) {
    const url = getDataJsonUrl(version!, "all.json");
    console.log(`Downloading ${url}...`);
    await downloadFile(url, localAllJson);
  }

  const { data, build_number, release } = await readJson(localAllJson);
  return {
    gameData: new CBNData(data, build_number, release),
    version: version!,
  };
}

function collectEntities(
  gameData: CBNData,
): { id: string; type: string; item: any }[] {
  const seen = new Set<string>();
  const out: { id: string; type: string; item: any }[] = [];
  const types = ["item", "monster", "terrain", "furniture", "vehicle_part"];

  for (const type of types) {
    for (const item of gameData.byType(type as any)) {
      const ids: string[] = Array.isArray(item.id)
        ? item.id
        : typeof item.id === "string"
          ? [item.id]
          : [item.abstract].filter(Boolean);

      for (const id of ids) {
        if (!id) continue;
        const key = `${type}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id, type, item: { ...item, id: id } });
      }
    }
  }
  return out;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const current = index++;
      await fn(items[current], current);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const { gameData, version: effectiveVersion } = await loadData();
  version = effectiveVersion;

  const tilesetDir = path.join(outputRoot, `${tilesetName}-${version}`);
  const iconsDir = path.join(tilesetDir, "icons");
  await fs.mkdir(iconsDir, { recursive: true });

  const tileset = await loadTileset();
  const entities = collectEntities(gameData);
  const layerCache = new Map<string, Buffer>();
  const iconCache = new Map<string, Buffer>();
  const missing: string[] = [];
  let written = 0;
  let cached = 0;

  console.log(
    `Rendering ${entities.length} entities using tileset ${tilesetName} @ ${version}...`,
  );

  // Cleanup root icons if any (leftovers from old script)
  const rootFiles = await fs.readdir(iconsDir, { withFileTypes: true });
  for (const f of rootFiles) {
    if (f.isFile() && f.name.endsWith(".png")) {
      await fs.unlink(path.join(iconsDir, f.name));
    }
  }

  const types = Array.from(new Set(entities.map((e: any) => e.type)));
  for (const t of types) {
    await fs.mkdir(path.join(iconsDir, t), { recursive: true });
  }

  await runWithConcurrency(
    entities,
    concurrency,
    async ({ id, type, item }, idx) => {
      const tile =
        findTileOrLooksLike(tileset, gameData, item) ??
        fallbackTile(tileset.data, item.symbol, item.color ?? "white");

      if (!tile) {
        missing.push(`${type}:${id}`);
        return;
      }
      const outFile = path.join(iconsDir, type, `${sanitizeId(id)}.png`);
      if (!force && (await fileExists(outFile))) {
        return;
      }

      const cacheKey = getTileCacheKey(tile);
      let buffer = iconCache.get(cacheKey);
      if (!buffer) {
        buffer = await composeIcon(
          tileset.data,
          tile,
          tileset.chunkPathMap,
          layerCache,
        );
        iconCache.set(cacheKey, buffer);
      } else {
        cached++;
      }

      await fs.writeFile(outFile, buffer);
      written++;
      if (idx % 250 === 0) {
        console.log(
          `...${idx + 1}/${entities.length} done (${cached} from cache)`,
        );
      }
    },
  );

  const manifest = {
    tileset: tilesetName,
    version,
    iconsDir,
    totalEntities: entities.length,
    written,
    cached,
    missing: missing.length,
    missingIds: missing,
  };
  await fs.writeFile(
    path.join(tilesetDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  console.log(
    `Icon export finished. Saved ${written} icons (${cached} reused from cache) to ${iconsDir}. Missing tiles: ${missing.length}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
