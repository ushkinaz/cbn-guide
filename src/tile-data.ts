import { writable } from "svelte/store";
import * as Sentry from "@sentry/browser";
import type { CBNData } from "./data";

const DATA_HOST = "https://data.cataclysmbn-guide.com";

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
  modId: string;
  compatibility: Set<string>;
  chunks: RawTileChunk[];
};

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
  const dirname = parsed.pathname.replace(/\/[^/]*$/, "/");
  parsed.pathname = dirname;
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
  return `${DATA_HOST}/data/${version}/mods/${encodeURIComponent(modId)}`;
}

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

/**
 * Retry a promise-generating function with exponential backoff.
 * Max 3 attempts with increasing delays: 2s, 4s, 8s.
 */
async function retry<T>(promiseGenerator: () => Promise<T>): Promise<T> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await promiseGenerator();
    } catch (e) {
      console.error(`Attempt ${attempt}/${MAX_RETRIES} failed:`, e);

      if (attempt === MAX_RETRIES) {
        throw e;
      }

      // Exponential backoff: 2s, 4s, 8s
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`Retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // TypeScript flow analysis should never reach here
  throw new Error("Unexpected: retry loop exhausted");
}

async function readImageDimensions(
  fileUrl: string,
): Promise<{ width: number; height: number }> {
  const blob = await retry(() =>
    fetch(fileUrl, { mode: "cors", credentials: "omit" }).then((b) => b.blob()),
  );
  const blobUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.src = blobUrl;
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
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
      throw new Error(
        `Error ${response.status} (${response.statusText}) fetching tile data`,
      );
    }
    return response;
  });

  const raw = (await res.json()) as RawTilesetConfig;
  const tile_info = normalizeTileInfo(raw);
  const chunkPromises = raw["tiles-new"].map(async (chunk) => {
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
      Sentry.captureException(err, {
        extra: {
          url,
          filename,
        },
      });
      throw err;
    }
  });

  const chunks = await Promise.all(chunkPromises);
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

export function collectActiveModTilesets(
  data: Pick<CBNData, "active_mods" | "raw_mods_json">,
): ModTilesetContribution[] {
  const activeMods = data.active_mods ?? [];
  const rawMods = data.raw_mods_json ?? {};
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
        modId,
        compatibility,
        chunks: entry["tiles-new"],
      });
    }
  }

  return result;
}

export function isContributionCompatible(
  contribution: Pick<ModTilesetContribution, "compatibility">,
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
  data: Pick<CBNData, "active_mods" | "raw_mods_json">,
): string {
  const activeMods = (data.active_mods ?? []).join(",");
  const aliasSignature = [...aliases].sort().join(",");
  const modsLoaded = data.raw_mods_json
    ? `loaded:${Object.keys(data.raw_mods_json).length}`
    : "loaded:none";
  return `${version}|${tileset.path ?? "ascii"}|${activeMods}|${aliasSignature}|${modsLoaded}`;
}

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

    const contributions = collectActiveModTilesets(data).filter(
      (contribution) => isContributionCompatible(contribution, aliases),
    );

    if (contributions.length === 0) {
      return {
        ...base,
        "tiles-new": [...base["tiles-new"]],
      };
    }

    const modChunks: TileChunk[] = [];
    let nextSpriteOffset = totalSpritesInChunks(base["tiles-new"]);

    for (const contribution of contributions) {
      const hydratedContributionChunks: TileChunk[] = [];
      for (const chunk of contribution.chunks) {
        const fileUrl = resolveModChunkUrl(
          version,
          contribution.modId,
          chunk.file,
        );
        try {
          const hydrated = await hydrateChunk(
            chunk,
            base.tile_info[0],
            fileUrl,
            getChunkSourceBase(fileUrl),
          );
          hydratedContributionChunks.push(hydrated);
        } catch (err) {
          console.warn("Failed to load mod tileset chunk", {
            modId: contribution.modId,
            chunkFile: chunk.file,
            resolvedUrl: fileUrl,
          });
          Sentry.captureException(err, {
            extra: {
              modId: contribution.modId,
              chunkFile: chunk.file,
              resolvedUrl: fileUrl,
            },
          });
        }
      }
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

const { subscribe, set } = writable<TilesetData>(null);

let requestToken = 0;

export const tileData = {
  subscribe,
  _setNull() {
    set(null);
  },
  setTileset(data: CBNData | null, tilesetName: string) {
    requestToken += 1;
    const token = requestToken;
    const tileset =
      TILESETS.find((entry) => entry.name === tilesetName) ?? DEFAULT_TILESET;

    if (data?.build_number && tileset.path !== null) {
      const version = data.fetching_version ?? data.build_number;
      loadMergedTileset(data, version, tileset)
        .then((loaded) => {
          if (token !== requestToken) return;
          set(loaded);
        })
        .catch((err) => {
          if (token !== requestToken) return;
          console.error("Error fetching tiles", err);
          Sentry.captureException(err, {
            extra: {
              tileset: tileset.name,
              version,
              active_mods: data.active_mods ?? [],
            },
          });
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

    this._setNull();
  },
};

export function isValidTileset(tilesetID: string | null) {
  return TILESETS.some((t) => t.name === tilesetID);
}

/**
 * @param {string} version
 * @param {string} path
 * @returns {string}
 */
export const getTilesetUrl = (version: string, path: string): string =>
  `${DATA_HOST}/data/${version}/gfx/${path}`;

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
