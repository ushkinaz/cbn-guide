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

/**
 * @internal
 * Test-only helper that resets `preferredTileset` to the default value
 * (`defaultPreferences.preferredTileset`). Does not touch localStorage.
 */
export function _resetPreferences(): void {
  preferences.preferredTileset = defaultPreferences.preferredTileset;
}
