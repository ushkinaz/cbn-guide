/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  _resetPreferences,
  clearSavedMods,
  initializePreferences,
  MODS_STORAGE_KEY,
  preferences,
  setMods,
  setTileset,
  TILESET_STORAGE_KEY,
} from "./preferences.svelte";

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

describe("tileset", () => {
  beforeEach(() => {
    installMockStorage();
    localStorage.removeItem?.(TILESET_STORAGE_KEY);
    _resetPreferences();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem?.(TILESET_STORAGE_KEY);
    _resetPreferences();
  });

  test("loads the persisted tileset preference when the route omits it", () => {
    localStorage.setItem(TILESET_STORAGE_KEY, "retrodays");

    expect(initializePreferences()).toEqual({
      tileset: "retrodays",
      mods: [],
    });
    expect(preferences).toEqual({
      tileset: "retrodays",
      mods: [],
    });
  });

  test("falls back to the default tileset when storage contains an invalid value", () => {
    localStorage.setItem(TILESET_STORAGE_KEY, "not-a-real-tileset");

    expect(initializePreferences()).toEqual({
      tileset: DEFAULT_TILESET,
      mods: [],
    });
    expect(localStorage.getItem(TILESET_STORAGE_KEY)).toBe(DEFAULT_TILESET);
  });

  test("setTileset rejects invalid values without mutating the preference", () => {
    expect(setTileset("bad-input")).toBe(false);
    expect(preferences).toEqual({
      tileset: DEFAULT_TILESET,
      mods: [],
    });
    expect(localStorage.getItem(TILESET_STORAGE_KEY)).toBeNull();
  });

  test("swallows storage failures during initialization and writes", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage denied");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage denied");
    });

    expect(initializePreferences()).toEqual({
      tileset: DEFAULT_TILESET,
      mods: [],
    });

    expect(() => setTileset("retrodays")).not.toThrow();
    expect(preferences).toEqual({
      tileset: "retrodays",
      mods: [],
    });
  });
});

describe("mods", () => {
  beforeEach(() => {
    installMockStorage();
    localStorage.removeItem?.(MODS_STORAGE_KEY);
    _resetPreferences();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem?.(MODS_STORAGE_KEY);
    _resetPreferences();
  });

  test("loads saved modset from localStorage", () => {
    localStorage.setItem(
      MODS_STORAGE_KEY,
      JSON.stringify(["aftershock", "magiclysm"]),
    );

    expect(initializePreferences().mods).toEqual(["aftershock", "magiclysm"]);
    expect(preferences.mods).toEqual(["aftershock", "magiclysm"]);
  });

  test("returns empty array when no key exists", () => {
    expect(initializePreferences().mods).toEqual([]);
    expect(preferences.mods).toEqual([]);
  });

  test("discards malformed JSON gracefully", () => {
    localStorage.setItem(MODS_STORAGE_KEY, "{ bad json }");

    expect(initializePreferences().mods).toEqual([]);
    expect(preferences.mods).toEqual([]);
  });

  test("discards non-array JSON gracefully", () => {
    localStorage.setItem(
      MODS_STORAGE_KEY,
      JSON.stringify({ mods: ["aftershock"] }),
    );

    expect(initializePreferences().mods).toEqual([]);
    expect(preferences.mods).toEqual([]);
  });

  test("setMods persists and updates state", () => {
    setMods(["aftershock"]);

    expect(preferences.mods).toEqual(["aftershock"]);
    expect(localStorage.getItem(MODS_STORAGE_KEY)).toBe(
      JSON.stringify(["aftershock"]),
    );
  });

  test("setMods([]) clears the preset", () => {
    localStorage.setItem(MODS_STORAGE_KEY, JSON.stringify(["aftershock"]));
    setMods([]);

    expect(preferences.mods).toEqual([]);
    expect(localStorage.getItem(MODS_STORAGE_KEY)).toBeNull();
  });

  test("clearSavedMods removes key and state", () => {
    localStorage.setItem(MODS_STORAGE_KEY, JSON.stringify(["aftershock"]));
    clearSavedMods();

    expect(preferences.mods).toEqual([]);
    expect(localStorage.getItem(MODS_STORAGE_KEY)).toBeNull();
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

    expect(initializePreferences().mods).toEqual([]);

    expect(() => setMods(["aftershock"])).not.toThrow();
    expect(preferences.mods).toEqual(["aftershock"]);

    expect(() => clearSavedMods()).not.toThrow();
    expect(preferences.mods).toEqual([]);
  });
});
