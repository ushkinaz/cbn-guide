import { DEFAULT_TILESET, isValidTileset } from "./tile-data";

const TILESET_STORAGE_KEY = "cbn-guide:tileset";
const DEFAULT_MODS_STORAGE_KEY = "cbn-guide:default-mods";

export type UserPreferences = {
  preferredTileset: string;
  defaultMods: string[] | null;
};

const defaultPreferences: UserPreferences = {
  preferredTileset: DEFAULT_TILESET.name,
  defaultMods: null,
};

export const preferences = $state<UserPreferences>({
  preferredTileset: defaultPreferences.preferredTileset,
  defaultMods: defaultPreferences.defaultMods,
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

function readStoredDefaultMods(): string[] | null {
  try {
    const raw = localStorage.getItem(DEFAULT_MODS_STORAGE_KEY);
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

function persistDefaultMods(mods: string[]): void {
  try {
    localStorage.setItem(DEFAULT_MODS_STORAGE_KEY, JSON.stringify(mods));
  } catch {
    // Swallow storage failures
  }
}

function clearStoredDefaultMods(): void {
  try {
    localStorage.removeItem(DEFAULT_MODS_STORAGE_KEY);
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
  let preferredTileset = readStoredTileset() ?? DEFAULT_TILESET.name;
  if (!isValidTileset(preferredTileset)) {
    //Clean up invalid tileset
    preferredTileset = DEFAULT_TILESET.name;
    persistPreferredTileset(preferredTileset);
  }

  preferences.preferredTileset = preferredTileset;
  preferences.defaultMods = readStoredDefaultMods();
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
export function setPreferredTileset(tileset: string): boolean {
  if (!isValidTileset(tileset)) return false;

  persistPreferredTileset(tileset);
  preferences.preferredTileset = tileset;
  return true;
}

export function setDefaultMods(mods: string[]): void {
  if (mods.length === 0) {
    clearStoredDefaultMods();
    preferences.defaultMods = null;
  } else {
    persistDefaultMods(mods);
    preferences.defaultMods = mods;
  }
}

export function clearSavedDefaultMods(): void {
  clearStoredDefaultMods();
  preferences.defaultMods = null;
}

/**
 *
 * Test helper: resets `preferredTileset` to the default value
 * (`defaultPreferences.preferredTileset`). Does not touch localStorage.
 * @internal test-only
 */
export function _resetPreferences(): void {
  preferences.preferredTileset = defaultPreferences.preferredTileset;
  preferences.defaultMods = defaultPreferences.defaultMods;
}
