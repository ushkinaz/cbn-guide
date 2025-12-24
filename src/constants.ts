export const GUIDE_NAME =
  "The Hitchhiker's Guide to the Cataclysm: Bright Nights";

const CBN_DATA_BASE_URL =
  "https://raw.githubusercontent.com/mythosmod/cbn-data/main";

export const BUILDS_URL = `${CBN_DATA_BASE_URL}/builds.json`;

/**
 * @param {string} version
 * @param {string} path
 * @returns {string}
 */
export const getDataJsonUrl = (version: string, path: string): string =>
  `${CBN_DATA_BASE_URL}/data/${version}/${path}`;

const GAME_REPO_PATH = "cataclysmbn/Cataclysm-BN";

export const GAME_REPO_URL = `https://github.com/${GAME_REPO_PATH}`;

/**
 * @param {string} version
 * @param {string} path
 * @returns {string}
 */
export const getTilesetUrl = (version: string, path: string): string =>
  `https://raw.githubusercontent.com/${GAME_REPO_PATH}/${version}/gfx/${path}`;

export const TILESETS = [
  {
    name: "BrownLikeBears",
    path: "BrownLikeBears",
  },
  {
    name: "ChestHole16",
    path: "ChestHole16Tileset",
  },
  {
    name: "HitButton iso",
    path: "HitButton_iso",
  },
  {
    name: "Hoder's",
    path: "HoderTileset",
  },
  {
    name: "UNDEAD_PEOPLE",
    path: "MSX++UnDeadPeopleEdition",
  },
  {
    name: "RetroDays+",
    path: "RetroDays+Tileset",
  },
  {
    name: "RetroDays",
    path: "RetroDaysTileset",
  },
  {
    name: "UltiCa",
    path: "UltimateCataclysm",
  },
];
