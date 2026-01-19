import { writable } from "svelte/store";
import { t } from "./i18n";
import type { CBNData } from "./data";

const fetchJson = async (url: string) => {
  const res = await fetch(`${url}/tile_config.json`, {
    mode: "cors",
  });
  if (!res.ok)
    throw new Error(
      `Error ${res.status} (${res.statusText}) fetching tile data`,
    );
  const json = await res.json();
  await Promise.all(
    json["tiles-new"].map(async (chunk: any) => {
      // ARCHITECTURE: Tileset WebP Migration (see docs/adr/001-tileset-webp-format.md)
      // The tile_config.json metadata references .png files, but the server now serves .webp.
      // We mutate chunk.file here so the correct extension is used downstream when:
      // 1. ItemSymbol.svelte constructs background-image URLs from chunk.file
      // 2. Other components reference tile metadata for rendering
      const filename = chunk.file.replace(/\.png$/, ".webp");
      chunk.file = filename;
      const blob = await fetch(`${url}/${filename}`).then((b) => b.blob());
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.src = blobUrl;
      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      const nx =
        (img.width / (chunk.sprite_width ?? json.tile_info[0].width)) | 0;
      const ny =
        (img.height / (chunk.sprite_height ?? json.tile_info[0].height)) | 0;
      chunk.nx = nx;
      chunk.ny = ny;
    }),
  );
  //Some tilesets doesn't have pixelscale defined
  json["tile_info"][0].pixelscale = json["tile_info"][0].pixelscale ?? 1;
  return json;
};

type TilesetData = {
  tile_info: { width: number; height: number; pixelscale: number }[];
  "tiles-new": any[];
  baseUrl?: string;
} | null;

const { subscribe, set } = writable<TilesetData>(null);
export const tileData = {
  subscribe,
  _setURL(url: string | null) {
    if (url) {
      fetchJson(url).then(
        (data) => set({ ...data, baseUrl: url }),
        (err) => console.error("Error fetching tiles", err),
      );
    } else {
      set(null);
    }
  },
  setTileset(data: CBNData | null, tilesetName: string) {
    const tileset =
      TILESETS.find((t) => t.name === tilesetName) ?? DEFAULT_TILESET;

    if (data?.build_number && tileset.path !== null) {
      // Data available, load tileset from URL
      const url = getTilesetUrl(data.build_number, tileset.path);
      this._setURL(url);
    } else if (!data && tileset.tile_info && tileset.path !== null) {
      // Version loading (data is null) but tileset selected - set placeholder dimensions
      // This prevents CLS during version switches
      set({
        tile_info: [tileset.tile_info],
        "tiles-new": [],
      });
    } else {
      // ASCII mode or no dimensions available
      this._setURL(null);
    }
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
  `https://data.cataclysmbn-guide.com/data/${version}/gfx/${path}`;

export const TILESETS = [
  //tileinfo prop contains pre-cached data used by initial layouting phase. Is overridden when actual data comes from the server.
  {
    name: "undead_people",
    displayName: t("Undead People (default)"),
    path: "MSX++UnDeadPeopleEdition",
    tile_info: { width: 32, height: 32, pixelscale: 1 },
  },
  {
    name: "ascii",
    displayName: t("None (ASCII)"),
    path: null,
    tile_info: { height: 16, width: 16, pixelscale: 1 },
  },
  {
    name: "brownlikebears",
    displayName: t("BrownLikeBears"),
    path: "BrownLikeBears",
    tile_info: { width: 20, height: 20, pixelscale: 1 },
  },
  {
    name: "chesthole16",
    displayName: t("ChestHole16"),
    path: "ChestHole16Tileset",
    tile_info: { width: 16, height: 16, pixelscale: 1 },
  },
  {
    name: "hitbutton",
    displayName: t("HitButton iso"),
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
    displayName: t("Hoder's"),
    path: "HoderTileset",
    tile_info: { width: 16, height: 16, pixelscale: 1 },
  },
  {
    name: "retrodays_plus",
    displayName: t("RetroDays+"),
    path: "RetroDays+Tileset",
    tile_info: { width: 10, height: 10, pixelscale: 2 },
  },
  {
    name: "retrodays",
    displayName: t("RetroDays"),
    path: "RetroDaysTileset",
    tile_info: { width: 10, height: 10, pixelscale: 2 },
  },
  {
    name: "ultica",
    displayName: t("UltiCa"),
    path: "UltimateCataclysm",
    tile_info: { width: 32, height: 32, pixelscale: 1 },
  },
];
export const DEFAULT_TILESET = TILESETS[0];
