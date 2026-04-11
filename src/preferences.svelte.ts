import { DEFAULT_TILESET, isValidTileset } from "./tile-data";

/**
 * @internal
 */
export const TILESET_STORAGE_KEY = "cbn-guide:tileset";
/**
 * @internal
 */
export const MODS_STORAGE_KEY = "cbn-guide:mods";

const NEXT_SEEN_WARNING_STORAGE_KEY = "cbn-guide:next-warning-seen";
const NEXT_DISABLE_STORAGE_KEY = "cbn-guide:next-warning-disabled";

export type UserPreferences = {
  tileset: string;
  mods: string[];
  nextWarning: {
    disabled: boolean;
    seen: boolean;
  };
};

const defaultPreferences: UserPreferences = {
  tileset: DEFAULT_TILESET.name,
  mods: [],
  nextWarning: {
    disabled: false,
    seen: false,
  },
};

export const preferences = $state<UserPreferences>(
  structuredClone(defaultPreferences),
);

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

function readNextWarning() {
  try {
    const disabled = localStorage.getItem(NEXT_DISABLE_STORAGE_KEY) === "true";
    const seen =
      sessionStorage.getItem(NEXT_SEEN_WARNING_STORAGE_KEY) === "true";
    return {
      disabled,
      seen,
    };
  } catch (error) {
    return {
      disabled: false,
      seen: false,
    };
  }
}

export function setNextWarningSeen() {
  sessionStorage.setItem(NEXT_SEEN_WARNING_STORAGE_KEY, "true");
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
  preferences.mods = [...(readStoredMods() ?? defaultPreferences.mods)];
  preferences.nextWarning = readNextWarning();
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
    const nextMods = [...mods];
    persistMods(nextMods);
    preferences.mods = nextMods;
  }
}

export function clearSavedMods(): void {
  clearStoredDefaultMods();
  preferences.mods = [];
}

/**
 * Test helper: resets preferences to the default values
 * Does not touch localStorage.
 * @internal test-only
 */
export function _resetPreferences(): void {
  Object.assign(preferences, structuredClone(defaultPreferences));
}
