import { writable } from "svelte/store";
import { GAME_REPO_PATH } from "./constants";

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
      const blob = await fetch(`${url}/${chunk.file}`).then((b) => b.blob());
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
  setURL(url: string | null) {
    if (url) {
      fetchJson(url).then(
        (data) => set({ ...data, baseUrl: url }),
        (err) => console.error("Error fetching tiles", err),
      );
    } else {
      set(null);
    }
  },
};
/**
 * @param {string} version
 * @param {string} path
 * @returns {string}
 */
export const getTilesetUrl = (version: string, path: string): string =>
  `https://raw.githubusercontent.com/${GAME_REPO_PATH}/${version}/gfx/${path}`;
export const TILESETS = [
  {
    name: "None (ASCII)",
    path: "",
    tile_info: { height: 16, width: 16, pixelscale: 1 },
  },
  {
    name: "BrownLikeBears",
    path: "BrownLikeBears",
    tile_info: { width: 20, height: 20, pixelscale: 1 },
  },
  {
    name: "ChestHole16",
    path: "ChestHole16Tileset",
    tile_info: { width: 16, height: 16, pixelscale: 1 },
  },
  {
    name: "HitButton iso",
    path: "HitButton_iso",
    tile_info: {
      height: 20,
      width: 16,
      iso: true,
      pixelscale: 2,
    },
  },
  {
    name: "Hoder's",
    path: "HoderTileset",
    tile_info: { width: 16, height: 16, pixelscale: 1 },
  },
  {
    name: "UNDEAD_PEOPLE",
    path: "MSX++UnDeadPeopleEdition",
    tile_info: { width: 32, height: 32, pixelscale: 1 },
  },
  {
    name: "RetroDays+",
    path: "RetroDays+Tileset",
    tile_info: { width: 10, height: 10, pixelscale: 2 },
  },
  {
    name: "RetroDays",
    path: "RetroDaysTileset",
    tile_info: { width: 10, height: 10, pixelscale: 2 },
  },
  {
    name: "UltiCa",
    path: "UltimateCataclysm",
    tile_info: { width: 32, height: 32, pixelscale: 1 },
  },
];
