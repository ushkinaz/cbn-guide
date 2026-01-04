export const GUIDE_NAME =
  "The Hitchhiker's Guide to the Cataclysm: Bright Nights";

export const UI_GUIDE_NAME = "Cataclysm: Bright Nights Guide";

export const CANONICAL_URL = "https://cbn-guide.pages.dev";

export const CBN_DATA_BASE_URL = "https://cbn-data.pages.dev";

export const BUILDS_URL = `${CBN_DATA_BASE_URL}/builds.json`;

/**
 * @param {string} version
 * @param {string} path
 * @returns {string}
 */
export const getDataJsonUrl = (version: string, path: string): string =>
  `${CBN_DATA_BASE_URL}/data/${version}/${path}`;

export const GAME_REPO_PATH = "cataclysmbn/Cataclysm-BN";

export const GAME_REPO_URL = `https://github.com/${GAME_REPO_PATH}`;
