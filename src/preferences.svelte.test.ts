/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  _resetPreferences,
  initializePreferences,
  preferences,
  setPreferredTileset,
} from "./preferences.svelte";

const STORAGE_KEY = "cbn-guide:tileset";
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
    localStorage.removeItem?.(STORAGE_KEY);
    _resetPreferences();
    vi.restoreAllMocks();
  });

  test("loads the persisted tileset preference when the route omits it", () => {
    localStorage.setItem(STORAGE_KEY, "retrodays");

    expect(initializePreferences()).toEqual({
      preferredTileset: "retrodays",
    });
    expect(preferences).toEqual({
      preferredTileset: "retrodays",
    });
  });

  test("falls back to the default tileset when storage contains an invalid value", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-real-tileset");

    expect(initializePreferences()).toEqual({
      preferredTileset: DEFAULT_TILESET,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(DEFAULT_TILESET);
  });

  test("setPreferredTileset rejects invalid values without mutating the preference", () => {
    expect(setPreferredTileset("bad-input")).toBe(false);
    expect(preferences).toEqual({
      preferredTileset: DEFAULT_TILESET,
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
    });

    expect(() => setPreferredTileset("retrodays")).not.toThrow();
    expect(preferences).toEqual({
      preferredTileset: "retrodays",
    });
  });
});
