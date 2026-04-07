import { DEFAULT_TILESET, isValidTileset } from "./tile-data";

/**
 * @internal
 */
export const TILESET_STORAGE_KEY = "cbn-guide:tileset";
/**
 * @internal
 */
export const MODS_STORAGE_KEY = "cbn-guide:mods";

export type UserPreferences = {
  tileset: string;
  mods: string[];
};

const defaultPreferences: UserPreferences = {
  tileset: DEFAULT_TILESET.name,
  mods: [],
};

export const preferences = $state<UserPreferences>({
  tileset: defaultPreferences.tileset,
  mods: defaultPreferences.mods,
});

function readStoredTileset(): string | undefined {
  try {
    return localStorage.getItem(TILESET_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function persistTileset(tileset: string): void {
  try {
    localStorage.setItem(TILESET_STORAGE_KEY, tileset);
  } catch {
    // Swallow storage failures in restricted browser modes.
  }
}

function readStoredMods(): string[] | null {
  try {
    const raw = localStorage.getItem(MODS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((val) => typeof val === "string")
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function persistMods(mods: string[]): void {
  try {
    localStorage.setItem(MODS_STORAGE_KEY, JSON.stringify(mods));
  } catch {
    // Swallow storage failures
  }
}

function clearStoredDefaultMods(): void {
  try {
    localStorage.removeItem(MODS_STORAGE_KEY);
  } catch {
    // Swallow storage failures
  }
}
/**
 * Reads persisted user preferences from localStorage and initializes the
 * reactive `preferences` state.
 *
 * If a persisted tileset value is invalid, it is repaired by resetting to
 * `DEFAULT_TILESET` and persisting the corrected value back to storage.
 *
 * Storage errors during read or write are silently swallowed (not thrown).
 *
 * @returns The initialized `UserPreferences` object.
 */
export function initializePreferences(): UserPreferences {
  let preferredTileset = readStoredTileset() ?? defaultPreferences.tileset;
  if (!isValidTileset(preferredTileset)) {
    //Clean up invalid tileset
    preferredTileset = defaultPreferences.tileset;
    persistTileset(preferredTileset);
  }

  preferences.tileset = preferredTileset;
  preferences.mods = readStoredMods() ?? defaultPreferences.mods;
  return preferences;
}

/**
 * Sets the preferred tileset after validating it against known tilesets.
 *
 * @param tileset - The tileset name to set.
 * @returns `true` if the tileset is valid and was persisted/updated; `false` if validation failed.
 *
 * Persistence and state updates only occur on validation success.
 */
export function setTileset(tileset: string): boolean {
  if (!isValidTileset(tileset)) return false;

  persistTileset(tileset);
  preferences.tileset = tileset;
  return true;
}

export function setMods(mods: string[]): void {
  if (mods.length === 0) {
    clearStoredDefaultMods();
    preferences.mods = [];
  } else {
    persistMods(mods);
    preferences.mods = mods;
  }
}

export function clearSavedMods(): void {
  clearStoredDefaultMods();
  preferences.mods = [];
}

/**
 *
 * Test helper: resets `preferredTileset` to the default value
 * (`defaultPreferences.preferredTileset`). Does not touch localStorage.
 * @internal test-only
 */
export function _resetPreferences(): void {
  preferences.tileset = defaultPreferences.tileset;
  preferences.mods = defaultPreferences.mods;
}
