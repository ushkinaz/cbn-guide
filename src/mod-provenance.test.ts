import { describe, expect, test } from "vitest";
import { CBNData } from "./data";
import type { ModData } from "./types";

function makeModData(modId: string, entries: unknown[]): ModData {
  return {
    info: {
      type: "MOD_INFO",
      id: modId,
      name: modId,
      description: modId,
      category: "content",
      dependencies: ["bn"],
    },
    data: entries,
  };
}

describe("Mod provenance sidecar", () => {
  test("getContributingModsForId returns deterministic override order", () => {
    const base = {
      type: "GENERIC",
      id: "cattlefodder",
      weight: "1 kg",
    };
    const modAOverride = {
      type: "GENERIC",
      id: "cattlefodder",
      "copy-from": "cattlefodder",
      relative: { weight: 100 },
    };
    const modBOverride = {
      type: "GENERIC",
      id: "cattlefodder",
      "copy-from": "cattlefodder",
      relative: { weight: 200 },
    };

    const rawModsJson: Record<string, ModData> = {
      mod_a: makeModData("mod_a", [modAOverride]),
      mod_b: makeModData("mod_b", [modBOverride]),
    };

    const data = new CBNData(
      [base, modAOverride, modBOverride],
      undefined,
      undefined,
      undefined,
      "en",
      "en",
      [rawModsJson.mod_a.info, rawModsJson.mod_b.info],
      ["mod_a", "mod_b"],
      rawModsJson,
    );

    expect(data.byId("item", "cattlefodder").weight).toBe(1300);
    expect(
      data
        .getContributingModsForId("item", "cattlefodder")
        .map((mod) => mod.id),
    ).toEqual(["mod_a", "mod_b"]);
  });

  test("getContributingModsForId tracks self-looking copy-from lineage", () => {
    const base = {
      type: "GENERIC",
      id: "core_parent",
      weight: "1 kg",
    };
    const modAParent = {
      type: "GENERIC",
      id: "core_parent",
      "copy-from": "core_parent",
      relative: { weight: 100 },
    };
    const modBChild = {
      type: "GENERIC",
      id: "mod_child",
      "copy-from": "core_parent",
      relative: { weight: 200 },
    };

    const rawModsJson: Record<string, ModData> = {
      mod_a: makeModData("mod_a", [modAParent]),
      mod_b: makeModData("mod_b", [modBChild]),
    };

    const data = new CBNData(
      [base, modAParent, modBChild],
      undefined,
      undefined,
      undefined,
      "en",
      "en",
      [rawModsJson.mod_a.info, rawModsJson.mod_b.info],
      ["mod_a", "mod_b"],
      rawModsJson,
    );

    expect(data.byId("item", "mod_child").weight).toBe(1300);
    expect(
      data.getContributingModsForId("item", "mod_child").map((mod) => mod.id),
    ).toEqual(["mod_a", "mod_b"]);
  });

  test("does not mutate domain objects with provenance metadata", () => {
    const base = { type: "GENERIC", id: "foo" };
    const mod = {
      type: "GENERIC",
      id: "foo",
      "copy-from": "foo",
      relative: { volume: 10 },
    };
    const rawModsJson: Record<string, ModData> = {
      mod_a: makeModData("mod_a", [mod]),
    };

    const data = new CBNData(
      [base, mod],
      undefined,
      undefined,
      undefined,
      "en",
      "en",
      [rawModsJson.mod_a.info],
      ["mod_a"],
      rawModsJson,
    );
    const resolved = data.byId("item", "foo");
    data.getContributingModsForId("item", "foo");

    expect(Object.hasOwn(base, "__source__")).toBe(false);
    expect(Object.hasOwn(mod, "__source__")).toBe(false);
    expect(Object.hasOwn(resolved as object, "__source__")).toBe(false);
  });

  test("getDirectModsForId returns only direct touches", () => {
    const base = {
      type: "GENERIC",
      id: "core_parent",
      weight: "1 kg",
    };
    const modAParent = {
      type: "GENERIC",
      id: "core_parent",
      "copy-from": "core_parent",
      relative: { weight: 100 },
    };
    const modBChild = {
      type: "GENERIC",
      id: "mod_child",
      "copy-from": "core_parent",
      relative: { weight: 200 },
    };

    const rawModsJson: Record<string, ModData> = {
      mod_a: makeModData("mod_a", [modAParent]),
      mod_b: makeModData("mod_b", [modBChild]),
    };

    const data = new CBNData(
      [base, modAParent, modBChild],
      undefined,
      undefined,
      undefined,
      "en",
      "en",
      [rawModsJson.mod_a.info, rawModsJson.mod_b.info],
      ["mod_a", "mod_b"],
      rawModsJson,
    );

    expect(
      data.getDirectModsForId("item", "mod_child").map((mod) => mod.id),
    ).toEqual(["mod_b"]);
    expect(
      data.getContributingModsForId("item", "mod_child").map((mod) => mod.id),
    ).toEqual(["mod_a", "mod_b"]);
  });

  test("provenance works for recipe keys (result + optional suffix)", () => {
    const baseRecipe = {
      type: "recipe",
      result: "herbal_tea",
      skill_used: "cooking",
      difficulty: 1,
    };
    const modRecipeOverride = {
      type: "recipe",
      result: "herbal_tea",
      "copy-from": "herbal_tea",
      difficulty: 2,
    };

    const rawModsJson: Record<string, ModData> = {
      mod_a: makeModData("mod_a", [modRecipeOverride]),
    };

    const data = new CBNData(
      [baseRecipe, modRecipeOverride],
      undefined,
      undefined,
      undefined,
      "en",
      "en",
      [rawModsJson.mod_a.info],
      ["mod_a"],
      rawModsJson,
    );

    expect(
      data.getDirectModsForId("recipe", "herbal_tea").map((mod) => mod.id),
    ).toEqual(["mod_a"]);
    expect(
      data
        .getContributingModsForId("recipe", "herbal_tea")
        .map((mod) => mod.id),
    ).toEqual(["mod_a"]);
  });

  test("provenance works for monstergroup keys (name)", () => {
    const baseGroup = {
      type: "monstergroup",
      name: "GROUP_BASE",
      default: "mon_zombie",
      monsters: [{ monster: "mon_zombie", freq: 100 }],
    };
    const modAGroupOverride = {
      type: "monstergroup",
      name: "GROUP_BASE",
      "copy-from": "GROUP_BASE",
      default: "mon_zombie_fast",
    };
    const modBChildGroup = {
      type: "monstergroup",
      name: "GROUP_CHILD",
      "copy-from": "GROUP_BASE",
      default: "mon_zombie_brute",
    };

    const rawModsJson: Record<string, ModData> = {
      mod_a: makeModData("mod_a", [modAGroupOverride]),
      mod_b: makeModData("mod_b", [modBChildGroup]),
    };

    const data = new CBNData(
      [baseGroup, modAGroupOverride, modBChildGroup],
      undefined,
      undefined,
      undefined,
      "en",
      "en",
      [rawModsJson.mod_a.info, rawModsJson.mod_b.info],
      ["mod_a", "mod_b"],
      rawModsJson,
    );

    expect(
      data
        .getDirectModsForId("monstergroup", "GROUP_CHILD")
        .map((mod) => mod.id),
    ).toEqual(["mod_b"]);
    expect(
      data
        .getContributingModsForId("monstergroup", "GROUP_CHILD")
        .map((mod) => mod.id),
    ).toEqual(["mod_a", "mod_b"]);
  });
});
