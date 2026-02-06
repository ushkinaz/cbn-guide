import * as fs from "fs";
import { describe, expect, test } from "vitest";
import type { ModData, ModInfo } from "./types";

type ModsMap = Record<string, ModData>;

const allMods = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/all_mods.json", "utf8"),
) as unknown;

function asModsMap(value: unknown): ModsMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("all_mods.json must be a top-level object map");
  }
  return value as ModsMap;
}

describe("all_mods schema", () => {
  test("uses top-level map with {info,data} entries", () => {
    const modsMap = asModsMap(allMods);
    for (const [modId, entry] of Object.entries(modsMap)) {
      expect(entry).toBeTypeOf("object");
      expect(entry.info).toBeTypeOf("object");
      expect(Array.isArray(entry.data)).toBe(true);
      expect((entry.info as ModInfo).type).toBe("MOD_INFO");
      expect((entry.info as ModInfo).id).toBe(modId);
    }
  });

  test("has at most one core mod", () => {
    const modsMap = asModsMap(allMods);
    const coreCount = Object.values(modsMap).filter(
      (entry) => (entry.info as ModInfo).core === true,
    ).length;
    expect(coreCount).toBeLessThanOrEqual(1);
  });

  test("requires id/name/description/category/dependencies for non-core mods", () => {
    const modsMap = asModsMap(allMods);
    for (const entry of Object.values(modsMap)) {
      const info = entry.info as ModInfo;
      expect(typeof info.id).toBe("string");
      expect(info.name).toBeDefined();
      expect(info.description).toBeDefined();
      expect(info.category).toBeDefined();
      if (info.core) {
        continue;
      }
      expect(Array.isArray(info.dependencies)).toBe(true);
    }
  });

  test("bn core mod is allowed to omit dependencies", () => {
    const modsMap = asModsMap(allMods);
    const bn = modsMap.bn;
    expect(bn).toBeDefined();
    expect((bn.info as ModInfo).core).toBe(true);
  });
});
