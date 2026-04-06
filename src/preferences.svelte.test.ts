/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  _resetPreferences,
  clearSavedDefaultMods,
  initializePreferences,
  preferences,
  setDefaultMods,
  setPreferredTileset,
} from "./preferences.svelte";

const STORAGE_KEY = "cbn-guide:tileset";
const DEFAULT_MODS_STORAGE_KEY = "cbn-guide:default-mods";
const DEFAULT_TILESET = "undead_people";

function installMockStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  return storage;
}

describe("preferences", () => {
  beforeEach(() => {
    installMockStorage();
    localStorage.removeItem?.(STORAGE_KEY);
    _resetPreferences();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem?.(STORAGE_KEY);
    _resetPreferences();
  });

  test("loads the persisted tileset preference when the route omits it", () => {
    localStorage.setItem(STORAGE_KEY, "retrodays");

    expect(initializePreferences()).toEqual({
      preferredTileset: "retrodays",
      defaultMods: null,
    });
    expect(preferences).toEqual({
      preferredTileset: "retrodays",
      defaultMods: null,
    });
  });

  test("falls back to the default tileset when storage contains an invalid value", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-real-tileset");

    expect(initializePreferences()).toEqual({
      preferredTileset: DEFAULT_TILESET,
      defaultMods: null,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(DEFAULT_TILESET);
  });

  test("setPreferredTileset rejects invalid values without mutating the preference", () => {
    expect(setPreferredTileset("bad-input")).toBe(false);
    expect(preferences).toEqual({
      preferredTileset: DEFAULT_TILESET,
      defaultMods: null,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("swallows storage failures during initialization and writes", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(initializePreferences()).toEqual({
      preferredTileset: DEFAULT_TILESET,
      defaultMods: null,
    });

    expect(() => setPreferredTileset("retrodays")).not.toThrow();
    expect(preferences).toEqual({
      preferredTileset: "retrodays",
      defaultMods: null,
    });
  });
});

describe("defaultMods", () => {
  beforeEach(() => {
    installMockStorage();
    localStorage.removeItem?.(DEFAULT_MODS_STORAGE_KEY);
    _resetPreferences();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem?.(DEFAULT_MODS_STORAGE_KEY);
    _resetPreferences();
  });

  test("loads saved modset from localStorage", () => {
    localStorage.setItem(
      DEFAULT_MODS_STORAGE_KEY,
      JSON.stringify(["aftershock", "magiclysm"]),
    );

    expect(initializePreferences().defaultMods).toEqual([
      "aftershock",
      "magiclysm",
    ]);
    expect(preferences.defaultMods).toEqual(["aftershock", "magiclysm"]);
  });

  test("returns null when no key exists", () => {
    expect(initializePreferences().defaultMods).toBeNull();
    expect(preferences.defaultMods).toBeNull();
  });

  test("discards malformed JSON gracefully", () => {
    localStorage.setItem(DEFAULT_MODS_STORAGE_KEY, "{ bad json }");

    expect(initializePreferences().defaultMods).toBeNull();
    expect(preferences.defaultMods).toBeNull();
  });

  test("discards non-array JSON gracefully", () => {
    localStorage.setItem(
      DEFAULT_MODS_STORAGE_KEY,
      JSON.stringify({ mods: ["aftershock"] }),
    );

    expect(initializePreferences().defaultMods).toBeNull();
    expect(preferences.defaultMods).toBeNull();
  });

  test("setDefaultMods persists and updates state", () => {
    setDefaultMods(["aftershock"]);

    expect(preferences.defaultMods).toEqual(["aftershock"]);
    expect(localStorage.getItem(DEFAULT_MODS_STORAGE_KEY)).toBe(
      JSON.stringify(["aftershock"]),
    );
  });

  test("setDefaultMods([]) clears the preset", () => {
    localStorage.setItem(
      DEFAULT_MODS_STORAGE_KEY,
      JSON.stringify(["aftershock"]),
    );
    setDefaultMods([]);

    expect(preferences.defaultMods).toBeNull();
    expect(localStorage.getItem(DEFAULT_MODS_STORAGE_KEY)).toBeNull();
  });

  test("clearSavedDefaultMods removes key and state", () => {
    localStorage.setItem(
      DEFAULT_MODS_STORAGE_KEY,
      JSON.stringify(["aftershock"]),
    );
    clearSavedDefaultMods();

    expect(preferences.defaultMods).toBeNull();
    expect(localStorage.getItem(DEFAULT_MODS_STORAGE_KEY)).toBeNull();
  });

  test("swallows storage failures silently", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(initializePreferences().defaultMods).toBeNull();

    expect(() => setDefaultMods(["aftershock"])).not.toThrow();
    expect(preferences.defaultMods).toEqual(["aftershock"]);

    expect(() => clearSavedDefaultMods()).not.toThrow();
    expect(preferences.defaultMods).toBeNull();
  });
});
