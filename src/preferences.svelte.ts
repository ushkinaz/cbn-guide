import { DEFAULT_TILESET, isValidTileset } from "./tile-data";

const TILESET_STORAGE_KEY = "cbn-guide:tileset";

export type UserPreferences = {
  preferredTileset: string;
};

const defaultPreferences: UserPreferences = {
  preferredTileset: DEFAULT_TILESET.name,
};

export const preferences = $state<UserPreferences>({
  preferredTileset: defaultPreferences.preferredTileset,
});

function readStoredTileset(): string | undefined {
  try {
    return localStorage.getItem(TILESET_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function persistPreferredTileset(tileset: string): void {
  try {
    localStorage.setItem(TILESET_STORAGE_KEY, tileset);
  } catch {
    // Swallow storage failures in restricted browser modes.
  }
}

export function initializePreferences(): UserPreferences {
  let preferredTileset = readStoredTileset() ?? DEFAULT_TILESET.name;
  if (!isValidTileset(preferredTileset)) {
    //Clean up invalid tileset
    preferredTileset = DEFAULT_TILESET.name;
    persistPreferredTileset(preferredTileset);
  }

  preferences.preferredTileset = preferredTileset;
  return preferences;
}

export function setPreferredTileset(tileset: string): boolean {
  if (!isValidTileset(tileset)) return false;

  persistPreferredTileset(tileset);
  preferences.preferredTileset = tileset;
  return true;
}

export function _resetPreferences(): void {
  preferences.preferredTileset = defaultPreferences.preferredTileset;
}
