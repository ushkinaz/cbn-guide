import * as Sentry from "@sentry/browser";
import { writable } from "svelte/store";
import type { CBNData } from "./data";
import { mapType } from "./data";
import { CBN_DATA_BASE_URL } from "./constants";
import { HTTPError, isHTTPError } from "./utils/http-errors";
import { retry } from "./utils/retry";

type TileInfoMeta = { width: number; height: number; pixelscale: number };

type RawTileChunk = {
  file: string;
  sprite_width?: number;
  sprite_height?: number;
  sprite_offset_x?: number;
  sprite_offset_y?: number;
  tiles?: TileEntry[];
};

type RawTilesetConfig = {
  tile_info: Array<Partial<TileInfoMeta>>;
  "tiles-new": RawTileChunk[];
};

type ModTilesetEntity = {
  type: "mod_tileset";
  compatibility?: string[];
  "tiles-new": RawTileChunk[];
};

type ModTilesetContribution = {
  source: "mod";
  modId: string;
  compatibility: Set<string>;
  chunks: RawTileChunk[];
};

type ExternalTilesetContribution = {
  source: "external_tileset";
  compatibility: Set<string>;
  chunks: RawTileChunk[];
};

type TilesetContribution = ModTilesetContribution | ExternalTilesetContribution;

type TilesetDefinition = {
  name: string;
  displayName: string;
  path: string | null;
  tile_info: {
    width: number;
    height: number;
    pixelscale: number;
    iso?: boolean;
  };
  compatibilityAliases?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function isRawTileChunk(value: unknown): value is RawTileChunk {
  return isRecord(value) && typeof value.file === "string";
}

function isModTilesetEntity(value: unknown): value is ModTilesetEntity {
  if (!isRecord(value) || value.type !== "mod_tileset") {
    return false;
  }
  if (!Array.isArray(value["tiles-new"])) {
    return false;
  }
  return value["tiles-new"].every((chunk) => isRawTileChunk(chunk));
}

function normalizeTileFilename(filename: string): string {
  return filename.replace(/\.png$/i, ".webp");
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toNormalizedSet(values: Iterable<string>): Set<string> {
  const normalized = new Set<string>();
  for (const value of values) {
    normalized.add(value.trim().toLowerCase());
  }
  return normalized;
}

function getChunkSourceBase(fileUrl: string): string {
  const parsed = new URL(fileUrl);
  parsed.pathname = parsed.pathname.replace(/\/[^/]*$/, "/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function totalSpritesInChunks(chunks: Pick<TileChunk, "nx" | "ny">[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.nx * chunk.ny, 0);
}

function offsetSpriteRef(value: unknown, offset: number): unknown {
  if (typeof value === "number") {
    return value + offset;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => offsetSpriteRef(entry, offset));
  }
  if (isRecord(value) && typeof value.sprite === "number") {
    return {
      ...value,
      sprite: value.sprite + offset,
    };
  }
  return value;
}

function offsetTileEntryIndices(entry: TileEntry, offset: number): TileEntry {
  return {
    ...entry,
    fg: offsetSpriteRef(entry.fg, offset),
    bg: offsetSpriteRef(entry.bg, offset),
  };
}

function offsetContributionIndices(
  chunks: TileChunk[],
  offset: number,
): TileChunk[] {
  if (offset === 0) return chunks;
  return chunks.map((chunk) => ({
    ...chunk,
    tiles: chunk.tiles.map((entry) => offsetTileEntryIndices(entry, offset)),
  }));
}

function resolvePath(baseUrl: string, file: string): string {
  const encoded = encodePath(file);
  return new URL(encoded, ensureTrailingSlash(baseUrl)).toString();
}

function getModBaseUrl(version: string, modId: string): string {
  return `${CBN_DATA_BASE_URL}/data/${version}/mods/${encodeURIComponent(modId)}`;
}

function getDataBaseUrl(version: string): string {
  return `${CBN_DATA_BASE_URL}/data/${version}`;
}

/**
 * @internal
 */
export function resolveModChunkUrl(
  version: string,
  modId: string,
  file: string,
): string {
  return resolvePath(
    getModBaseUrl(version, modId),
    normalizeTileFilename(file),
  );
}

/**
 * @internal
 */
export function resolveExternalChunkUrl(version: string, file: string): string {
  return resolvePath(
    getDataBaseUrl(version),
    `gfx/${normalizeTileFilename(file)}`,
  );
}

function normalizeTileInfo(raw: RawTilesetConfig): TileInfoMeta[] {
  const first = raw.tile_info[0] ?? {};
  return [
    {
      width: typeof first.width === "number" ? first.width : 32,
      height: typeof first.height === "number" ? first.height : 32,
      pixelscale: typeof first.pixelscale === "number" ? first.pixelscale : 1,
    },
  ];
}

async function readImageDimensions(
  fileUrl: string,
): Promise<{ width: number; height: number }> {
  const blob = await retry(async () => {
    const res = await fetch(fileUrl, { mode: "cors", credentials: "omit" });
    if (!res.ok) {
      throw new HTTPError(
        `HTTP ${res.status} (${res.statusText}) fetching ${fileUrl}`,
        res.status,
        fileUrl,
      );
    }
    return res.blob();
  });
  const blobUrl = URL.createObjectURL(blob);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        img.onload = null;
        img.onerror = null;
        reject(new Error(`Timed out decoding tile image: ${fileUrl}`));
      }, 10_000);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        img.onload = null;
        img.onerror = null;
        resolve();
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        img.onload = null;
        img.onerror = null;
        reject(new Error(`Failed to decode tile image: ${fileUrl}`));
      };
      img.src = blobUrl;
    });
    return { width: img.width, height: img.height };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function hydrateChunk(
  chunk: RawTileChunk,
  tileInfo: TileInfoMeta,
  fileUrl: string,
  sourceBaseUrl: string,
): Promise<TileChunk> {
  const filename = normalizeTileFilename(chunk.file);
  const dimensions = await readImageDimensions(fileUrl);
  const nx = (dimensions.width / (chunk.sprite_width ?? tileInfo.width)) | 0;
  const ny = (dimensions.height / (chunk.sprite_height ?? tileInfo.height)) | 0;

  return {
    file: filename,
    file_url: fileUrl,
    source_base_url: sourceBaseUrl,
    nx,
    ny,
    sprite_width: chunk.sprite_width,
    sprite_height: chunk.sprite_height,
    sprite_offset_x: chunk.sprite_offset_x,
    sprite_offset_y: chunk.sprite_offset_y,
    tiles: chunk.tiles ?? [],
  };
}

async function fetchBaseTileset(
  url: string,
): Promise<NonNullable<TilesetData>> {
  const res = await retry(async () => {
    const response = await fetch(`${url}/tile_config.json`, { mode: "cors" });
    if (!response.ok) {
      throw new HTTPError(
        `HTTP ${response.status} (${response.statusText}) fetching ${url}/tile_config.json`,
        response.status,
        `${url}/tile_config.json`,
      );
    }
    return response;
  });

  const raw = (await res.json()) as RawTilesetConfig;
  const tile_info = normalizeTileInfo(raw);

  let hadTransientFailure = false;
  const results: Array<TileChunk | null> = await Promise.all(
    raw["tiles-new"].map(async (chunk) => {
      const filename = normalizeTileFilename(chunk.file);
      const fileUrl = resolvePath(url, filename);
      try {
        return await hydrateChunk(
          chunk,
          tile_info[0],
          fileUrl,
          ensureTrailingSlash(url),
        );
      } catch (err) {
        if (isHTTPError(err) && err.isPermanent) {
          console.warn("Missing base tileset chunk (404), skipping", {
            url,
            filename,
          });
          return null;
        }

        console.warn("Failed to load base tileset chunk", {
          url,
          filename,
          error: err,
        });
        hadTransientFailure = true;
        return null;
      }
    }),
  );

  const chunks = results.filter((chunk): chunk is TileChunk => chunk !== null);

  if (hadTransientFailure) {
    throw new Error(`Transient failure loading base tileset: ${url}`);
  }

  return {
    tile_info,
    "tiles-new": chunks,
    baseUrl: ensureTrailingSlash(url).replace(/\/$/, ""),
  };
}

const baseTilesetCache = new Map<string, Promise<NonNullable<TilesetData>>>();
const mergedTilesetCache = new Map<string, Promise<NonNullable<TilesetData>>>();

function getCachedBaseTileset(url: string): Promise<NonNullable<TilesetData>> {
  const key = ensureTrailingSlash(url).replace(/\/$/, "");
  const existing = baseTilesetCache.get(key);
  if (existing) return existing;
  const created = fetchBaseTileset(key).catch((err: unknown) => {
    baseTilesetCache.delete(key);
    throw err;
  });
  baseTilesetCache.set(key, created);
  return created;
}

/**
 * @internal
 */
export function collectActiveModTilesets(
  data: CBNData,
): ModTilesetContribution[] {
  const activeMods = data.activeMods();
  const rawMods = data.allMods();
  const result: ModTilesetContribution[] = [];

  for (const modId of activeMods) {
    const modData = rawMods[modId];
    if (!modData || !Array.isArray(modData.data)) continue;
    for (const entry of modData.data) {
      if (!isModTilesetEntity(entry)) continue;
      const compatibility = hasStringArray(entry.compatibility)
        ? toNormalizedSet(entry.compatibility)
        : new Set<string>();
      result.push({
        source: "mod",
        modId,
        compatibility,
        chunks: entry["tiles-new"],
      });
    }
  }

  return result;
}

function isExternalTilesetChunk(file: string): boolean {
  return file.startsWith("external_tileset/");
}

/**
 * @internal
 */
export function collectExternalTilesets(
  data: Pick<CBNData, "all">,
): ExternalTilesetContribution[] {
  const result: ExternalTilesetContribution[] = [];

  for (const entry of data.all() as unknown[]) {
    if (!isModTilesetEntity(entry)) continue;
    const hasExternalChunk = entry["tiles-new"].some((chunk) =>
      isExternalTilesetChunk(chunk.file),
    );
    if (!hasExternalChunk) continue;

    const compatibility = hasStringArray(entry.compatibility)
      ? toNormalizedSet(entry.compatibility)
      : new Set<string>();

    result.push({
      source: "external_tileset",
      compatibility,
      chunks: entry["tiles-new"],
    });
  }

  return result;
}

/**
 * @internal
 */
export function isContributionCompatible(
  contribution: Pick<TilesetContribution, "compatibility">,
  selectedAliases: Set<string>,
): boolean {
  if (contribution.compatibility.size === 0) {
    return true;
  }
  for (const alias of selectedAliases) {
    if (contribution.compatibility.has(alias)) {
      return true;
    }
  }
  return false;
}

/**
 * @internal
 */
export function getTilesetCompatibilityIdentities(
  tilesetName: string,
): Set<string> {
  const tileset = TILESETS.find((candidate) => candidate.name === tilesetName);
  if (!tileset) return new Set();

  const aliases = new Set<string>([
    tileset.name,
    ...(tileset.path ? [tileset.path] : []),
    ...(tileset.compatibilityAliases ?? []),
  ]);

  return toNormalizedSet(aliases);
}

function getMergeCacheKey(
  version: string,
  tileset: TilesetDefinition,
  aliases: Set<string>,
  data: CBNData,
): string {
  const activeMods = data.activeMods().join(",");
  const aliasSignature = [...aliases].sort().join(",");
  const modsLoaded = `loaded:${Object.keys(data.allMods()).length}`;
  return `${version}|${tileset.path ?? "ascii"}|${activeMods}|${aliasSignature}|${modsLoaded}`;
}

/**
 * @internal
 */
export async function loadMergedTileset(
  data: CBNData,
  version: string,
  tileset: TilesetDefinition,
): Promise<NonNullable<TilesetData>> {
  if (!tileset.path) {
    return {
      tile_info: [tileset.tile_info],
      "tiles-new": [],
    };
  }

  const aliases = getTilesetCompatibilityIdentities(tileset.name);
  const mergeKey = getMergeCacheKey(version, tileset, aliases, data);
  const cached = mergedTilesetCache.get(mergeKey);
  if (cached) return cached;

  const promise = (async () => {
    const baseUrl = getTilesetUrl(version, tileset.path!);
    const base = await getCachedBaseTileset(baseUrl);

    const contributions: TilesetContribution[] = [
      ...collectExternalTilesets(data),
      ...collectActiveModTilesets(data),
    ].filter((contribution) => isContributionCompatible(contribution, aliases));

    if (contributions.length === 0) {
      return {
        ...base,
        "tiles-new": [...base["tiles-new"]],
      };
    }

    const modChunks: TileChunk[] = [];
    let nextSpriteOffset = totalSpritesInChunks(base["tiles-new"]);

    const hydratedContributions = await Promise.all(
      contributions.map(async (contribution) => {
        const hydratedContributionChunks = await Promise.all(
          contribution.chunks.map(async (chunk) => {
            const resolvedUrl =
              contribution.source === "mod"
                ? resolveModChunkUrl(version, contribution.modId, chunk.file)
                : resolveExternalChunkUrl(version, chunk.file);
            try {
              return await hydrateChunk(
                chunk,
                base.tile_info[0],
                resolvedUrl,
                getChunkSourceBase(resolvedUrl),
              );
            } catch (err) {
              if (isHTTPError(err) && err.isPermanent) {
                console.warn("Missing contribution chunk (404), skipping", {
                  source: contribution.source,
                  modId:
                    contribution.source === "mod"
                      ? contribution.modId
                      : undefined,
                  chunkFile: chunk.file,
                  resolvedUrl,
                });
              } else {
                console.warn("Failed to load tileset contribution chunk", {
                  source: contribution.source,
                  modId:
                    contribution.source === "mod"
                      ? contribution.modId
                      : undefined,
                  chunkFile: chunk.file,
                  resolvedUrl,
                  error: err,
                });
              }
              return null;
            }
          }),
        );
        return hydratedContributionChunks.filter(
          (chunk): chunk is TileChunk => chunk !== null,
        );
      }),
    );

    for (const hydratedContributionChunks of hydratedContributions) {
      const offsetChunks = offsetContributionIndices(
        hydratedContributionChunks,
        nextSpriteOffset,
      );
      modChunks.push(...offsetChunks);
      nextSpriteOffset += totalSpritesInChunks(hydratedContributionChunks);
    }

    return {
      ...base,
      "tiles-new": [...base["tiles-new"], ...modChunks],
    };
  })().catch((err: unknown) => {
    mergedTilesetCache.delete(mergeKey);
    throw err;
  });

  mergedTilesetCache.set(mergeKey, promise);
  return promise;
}

export type TilePosition = {
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

export type TileInfo = {
  fg?: TilePosition;
  bg?: TilePosition;
};

export type TileEntry = {
  id: string | string[];
  fg?: unknown;
  bg?: unknown;
};

export type TileChunk = {
  file: string;
  file_url?: string;
  source_base_url?: string;
  nx: number;
  ny: number;
  sprite_width?: number;
  sprite_height?: number;
  sprite_offset_x?: number;
  sprite_offset_y?: number;
  tiles: TileEntry[];
  ascii?: { color: string; bold?: boolean; offset: number }[];
};

export type TilesetData = {
  tile_info: TileInfoMeta[];
  "tiles-new": TileChunk[];
  baseUrl?: string;
} | null;

type IndexedTilesetData = NonNullable<TilesetData>;
type TileLookupIndex = Map<string, TileInfo>;
const tileLookupIndexCache = new WeakMap<IndexedTilesetData, TileLookupIndex>();

export function resolveTileLayerUrl(
  tileset: TilesetData,
  layer: TilePosition | undefined,
): string | null {
  if (!tileset || !layer) return null;
  if (layer.file_url) return layer.file_url;

  const base = layer.source_base_url ?? tileset.baseUrl;
  if (!base) return null;
  return resolvePath(base, layer.file);
}

export function findTile(
  tileData: TilesetData | null,
  id: string,
): TileInfo | undefined {
  if (!tileData || !id) return;
  return getTileLookupIndex(tileData).get(id);
}

function getTileLookupIndex(tileData: IndexedTilesetData): TileLookupIndex {
  const cached = tileLookupIndexCache.get(tileData);
  if (cached) return cached;

  const indexed = buildTileLookupIndex(tileData);
  tileLookupIndexCache.set(tileData, indexed);
  return indexed;
}

function buildTileLookupIndex(tileData: IndexedTilesetData): TileLookupIndex {
  let offset = 0;
  const ranges = tileData["tiles-new"].map((chunk) => {
    const range = {
      from: offset,
      to: offset + chunk.nx * chunk.ny,
      chunk,
    };
    offset = range.to;
    return range;
  });

  function findRange(spriteId: number) {
    for (const range of ranges) {
      if (spriteId >= range.from && spriteId < range.to) return range;
    }
  }

  function tileInfoForSprite(
    spriteId: number | undefined,
  ): TilePosition | undefined {
    if (spriteId == null) return;
    const range = findRange(spriteId);
    if (!range) return;
    const offsetInFile = spriteId - range.from;
    return {
      file: range.chunk.file,
      file_url: range.chunk.file_url,
      source_base_url: range.chunk.source_base_url,
      width: range.chunk.sprite_width ?? tileData.tile_info[0].width,
      height: range.chunk.sprite_height ?? tileData.tile_info[0].height,
      offx: range.chunk.sprite_offset_x ?? 0,
      offy: range.chunk.sprite_offset_y ?? 0,
      tx: offsetInFile % range.chunk.nx,
      ty: (offsetInFile / range.chunk.nx) | 0,
    };
  }

  function firstSpriteRef(value: unknown): number | undefined {
    const maybeArrayHead = Array.isArray(value) ? value[0] : value;
    if (typeof maybeArrayHead === "number") return maybeArrayHead;
    if (
      typeof maybeArrayHead === "object" &&
      maybeArrayHead !== null &&
      typeof maybeArrayHead.sprite === "number"
    ) {
      return maybeArrayHead.sprite;
    }
  }

  function tileInfoForEntry(entry: TileEntry): TileInfo {
    return {
      fg: tileInfoForSprite(firstSpriteRef(entry.fg)),
      bg: tileInfoForSprite(firstSpriteRef(entry.bg)),
    };
  }

  const exact = new Map<string, TileInfo>();

  for (const chunk of tileData["tiles-new"]) {
    for (let idx = chunk.tiles.length - 1; idx >= 0; idx--) {
      const entry = chunk.tiles[idx];
      const tileInfo = tileInfoForEntry(entry);
      for (const entryId of Array.isArray(entry.id) ? entry.id : [entry.id]) {
        exact.set(entryId, tileInfo);
      }
    }
  }

  return exact;
}

const MAX_INHERITANCE_DEPTH = 10;

export function findTileOrLooksLike(
  data: CBNData,
  tileData: TilesetData | null,
  item: any,
  jumps: number = MAX_INHERITANCE_DEPTH,
): TileInfo | undefined {
  if (!item || !tileData) return;
  function resolveId(id: string): string {
    return item.type === "vehicle_part" ? `vp_${id}` : id;
  }
  const selfId = item.id ?? item.abstract;
  if (selfId) {
    const idTile = findTile(tileData, resolveId(selfId));
    if (idTile) return idTile;
  }
  const looksLikeId = item.looks_like ?? item["copy-from"];
  if (!looksLikeId) return;
  const looksLikeTile = findTile(tileData, resolveId(looksLikeId));
  if (looksLikeTile) return looksLikeTile;
  if (jumps > 0) {
    const mappedType = mapType(item.type);
    const parent =
      data.byIdMaybe(mappedType, looksLikeId) ??
      data.abstractById(mappedType, looksLikeId);
    if (parent) return findTileOrLooksLike(data, tileData, parent, jumps - 1);
  }
}

const { subscribe, set } = writable<TilesetData>(null);

/**
 * Monotonic generation token used to invalidate stale async work for tileset loading.
 *
 * Incremented on every `reset()` or `setTileset()` start, so older in-flight
 * loads exit before mutating the singleton store.
 */
let _requestToken = 0;

export const tileData = {
  subscribe,
  reset() {
    _requestToken++;
    set(null);
  },
  setTileset(data: CBNData | null, tilesetName: string) {
    _requestToken++;
    const requestToken = _requestToken;
    const tileset =
      TILESETS.find((entry) => entry.name === tilesetName) ?? DEFAULT_TILESET;

    if (data?.fetchVersion() && tileset.path !== null) {
      const version = data.fetchVersion();
      loadMergedTileset(data, version, tileset)
        .then((loaded) => {
          if (requestToken !== _requestToken) return;
          set(loaded);
          return loaded;
        })
        .catch((err) => {
          if (requestToken !== _requestToken) return;
          const extra = {
            tileset: tileset.name,
            version,
            active_mods: data.activeMods() ?? [],
          };
          Sentry.withScope((scope) => {
            scope.setTag("tileset", tileset.name);
            scope.setExtra("version", version);
            scope.setExtra("active_mods", data.activeMods() ?? []);
            scope.setExtra("tileset_error", err);
            Sentry.captureException(err);
          });
          console.warn("Error fetching tiles", { ...extra, error: err });
          return;
        });
      return;
    }

    if (!data && tileset.tile_info && tileset.path !== null) {
      set({
        tile_info: [tileset.tile_info],
        "tiles-new": [],
      });
      return;
    }

    tileData.reset();
  },
};

/**
 * Test helper: reset module cache state between app mounts in routing tests.
 * @internal test-only
 */
export function _resetTilesetData() {
  baseTilesetCache.clear();
  mergedTilesetCache.clear();
}

export function isValidTileset(tilesetID?: string) {
  return TILESETS.some((t) => t.name === tilesetID);
}

/**
 * @param {string} version
 * @param {string} path
 * @returns {string}
 */
export const getTilesetUrl = (version: string, path: string): string =>
  `${CBN_DATA_BASE_URL}/data/${version}/gfx/${path}`;

export const TILESETS: TilesetDefinition[] = [
  //tileinfo prop contains pre-cached data used by the initial layouting phase. Is overridden when actual data comes from the server.
  {
    name: "undead_people",
    displayName: "Undead People",
    path: "MSX++UnDeadPeopleEdition",
    tile_info: { width: 32, height: 32, pixelscale: 1 },
    compatibilityAliases: [
      "UNDEAD_PEOPLE",
      "UNDEAD_PEOPLE_BASE",
      "UNDEAD_PEOPLE_LIGHT",
      "UNDEAD_PEOPLE_LEGACY",
      "MSX++DEAD_PEOPLE",
      "MshockRealXotto",
      "MshockXottoplus",
      "MshockXottoplus12",
      "MXplus12_for_cosmetics",
      "MSXotto+",
    ],
  },
  {
    name: "ascii",
    displayName: "ASCII",
    path: null,
    tile_info: { height: 16, width: 16, pixelscale: 1 },
  },
  {
    name: "brownlikebears",
    displayName: "BrownLikeBears",
    path: "BrownLikeBears",
    tile_info: { width: 20, height: 20, pixelscale: 1 },
  },
  {
    name: "chesthole16",
    displayName: "ChestHole16",
    path: "ChestHole16Tileset",
    tile_info: { width: 16, height: 16, pixelscale: 1 },
  },
  {
    name: "hitbutton",
    displayName: "HitButton iso",
    path: "HitButton_iso",
    tile_info: {
      height: 20,
      width: 16,
      iso: true,
      pixelscale: 2,
    },
  },
  {
    name: "hoder",
    displayName: "Hoder's",
    path: "HoderTileset",
    tile_info: { width: 16, height: 16, pixelscale: 1 },
  },
  {
    name: "retrodays_plus",
    displayName: "RetroDays+",
    path: "RetroDays+Tileset",
    tile_info: { width: 10, height: 10, pixelscale: 2 },
  },
  {
    name: "retrodays",
    displayName: "RetroDays",
    path: "RetroDaysTileset",
    tile_info: { width: 10, height: 10, pixelscale: 2 },
  },
  {
    name: "ultica",
    displayName: "UltiCa",
    path: "UltimateCataclysm",
    tile_info: { width: 32, height: 32, pixelscale: 1 },
    compatibilityAliases: ["UltimateCataclysm", "UlticaShell", "Chibi_Ultica"],
  },
];
export const DEFAULT_TILESET = TILESETS[0];

export function resolveTileset(
  preferredTileset: string,
  routeTilesetParam?: string,
): string {
  if (routeTilesetParam && isValidTileset(routeTilesetParam)) {
    return routeTilesetParam;
  }

  return preferredTileset;
}
