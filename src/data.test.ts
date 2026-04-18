import { describe, expect, test } from "vitest";
import { CBNData, data, omsName } from "./data";
import { makeTestCBNData } from "./data.test-helpers";
import type { OvermapSpecial } from "./types";

import { gameSingularName } from "./i18n/game-locale";
import { resolveLocale } from "./i18n/game-locale";
import type { ModInfo } from "./types";

function loadedModInfos(data: CBNData): ModInfo[] {
  return Object.values(data.allMods())
    .map((modData) => modData.info)
    .filter((mod) => !mod.core);
}

test("flattened item group includes container item for distribution", () => {
  const data = makeTestCBNData([
    {
      type: "item_group",
      id: "foo",
      subtype: "distribution",
      entries: [
        { item: "contained_thing", prob: 5, "container-item": "container" },
        { item: "other_thing", prob: 10 },
      ],
    },
  ]);
  const flat = data.flattenTopLevelItemGroup(data.byId("item_group", "foo"));
  expect(
    flat.map((x) => ({
      ...x,
      prob: x.prob.toFixed(2),
      expected: x.expected.toFixed(2),
    })),
  ).toEqual([
    { id: "container", count: [1, 1], prob: "0.33", expected: "0.33" },
    { id: "contained_thing", count: [1, 1], prob: "0.33", expected: "0.33" },
    { id: "other_thing", count: [1, 1], prob: "0.67", expected: "0.67" },
  ]);
});

test("flattened item group includes container item for collection", () => {
  const data = makeTestCBNData([
    {
      type: "item_group",
      id: "foo",
      subtype: "collection",
      entries: [
        { item: "contained_thing", prob: 5, "container-item": "container" },
        { item: "other_thing", prob: 10 },
      ],
    },
  ]);
  const flat = data.flattenTopLevelItemGroup(data.byId("item_group", "foo"));
  expect(flat.map((x) => ({ ...x, prob: x.prob.toFixed(2) }))).toEqual([
    { id: "container", count: [1, 1], prob: "0.05", expected: 0.05 },
    { id: "contained_thing", count: [1, 1], prob: "0.05", expected: 0.05 },
    { id: "other_thing", count: [1, 1], prob: "0.10", expected: 0.1 },
  ]);
});

test("byType returns canonical override entries without duplicate ids", () => {
  const base = {
    type: "GENERIC",
    id: "test_item",
    name: "Base item",
    weight: "1 kg",
  };
  const modOverride = {
    type: "GENERIC",
    id: "test_item",
    "copy-from": "test_item",
    name: "Modded item",
    relative: { weight: 100 },
  };

  const data = makeTestCBNData([base, modOverride]);
  const items = data.byType("item").filter((item) => item.id === "test_item");

  expect(items).toHaveLength(1);
  expect(items[0].weight).toBe(1100);
  expect(gameSingularName(items[0])).toBe("Modded item");
});

test("byType returns a fresh array shell around cached item snapshots", () => {
  const data = makeTestCBNData([
    {
      type: "GENERIC",
      id: "item_a",
      name: "Item A",
    },
    {
      type: "GENERIC",
      id: "item_b",
      name: "Item B",
    },
  ]);

  const first = data.byType("item");
  first.pop();

  const second = data.byType("item");

  expect(second.map((item) => item.id)).toEqual(["item_a", "item_b"]);
});

test("byType caches monster snapshots without leaking hidden monsters", () => {
  const data = makeTestCBNData([
    {
      type: "MONSTER",
      id: "mon_visible",
      name: "Visible Monster",
      species: ["SPECIES_VISIBLE"],
    },
    {
      type: "MONSTER",
      id: "mon_hidden",
      name: "Hidden Monster",
      species: ["SPECIES_HIDDEN"],
    },
    {
      type: "MONSTER_BLACKLIST",
      species: ["SPECIES_HIDDEN"],
    },
  ]);

  const first = data.byType("monster");
  const second = data.byType("monster");

  expect(first.map((monster) => monster.id)).toEqual(["mon_visible"]);
  expect(second.map((monster) => monster.id)).toEqual(["mon_visible"]);
  expect(data.byIdMaybe("monster", "mon_hidden")).toBeUndefined();
});

test("includes container item specified in item", () => {
  const data = makeTestCBNData([
    {
      type: "item_group",
      id: "foo",
      subtype: "collection",
      entries: [{ item: "contained_thing", prob: 50 }],
    },
    {
      type: "COMESTIBLE",
      id: "contained_thing",
      container: "container",
    },
  ]);
  const flat = data.flattenTopLevelItemGroup(data.byId("item_group", "foo"));
  expect(flat.map((x) => ({ ...x, prob: x.prob.toFixed(2) }))).toEqual([
    {
      count: [1, 1],
      id: "contained_thing",
      prob: "0.50",
      expected: 0.5,
    },
    {
      count: [1, 1],
      id: "container",
      prob: "0.50",
      expected: 0.5,
    },
  ]);
});

test("dissectedFrom returns monsters that provide the item via dissection", () => {
  const monster_id = "mon_test";
  const harvest_id = "harvest_test";
  const item_id = "item_test";
  const group_id = "group_test";

  const data = makeTestCBNData([
    {
      type: "MONSTER",
      id: monster_id,
      name: "Test Monster",
      harvest: harvest_id,
    },
    {
      type: "harvest",
      id: harvest_id,
      entries: [
        { drop: item_id, type: "bionic" },
        { drop: group_id, type: "bionic_group" },
      ],
    },
    {
      type: "GENERIC",
      id: item_id,
      name: "Test Item",
    },
    {
      type: "item_group",
      id: group_id,
      items: [{ item: "other_item", prob: 100 }],
    },
  ]);

  const monstersForItem = data.dissectedFrom(item_id);
  expect(monstersForItem).toHaveLength(1);
  expect(monstersForItem[0].id).toBe(monster_id);

  const monstersForGroupMember = data.dissectedFrom("other_item");
  expect(monstersForGroupMember).toHaveLength(1);
  expect(monstersForGroupMember[0].id).toBe(monster_id);
});

test("dissectedFrom ignores missing bionic_group references", () => {
  const data = makeTestCBNData([
    {
      type: "MONSTER",
      id: "mon_test",
      name: "Test Monster",
      harvest: "harvest_test",
    },
    {
      type: "harvest",
      id: "harvest_test",
      entries: [{ drop: "missing_group", type: "bionic_group" }],
    },
  ]);

  expect(data.dissectedFrom("missing_group")).toEqual([]);
});

test("nested", () => {
  const data = makeTestCBNData([
    {
      type: "COMESTIBLE",
      id: "water_clean",
    },
    {
      type: "item_group",
      id: "foo",
      subtype: "collection",
      entries: [
        {
          distribution: [
            {
              collection: [
                {
                  item: "water_clean",
                  charges: 1,
                  "container-item": "bottle_plastic",
                  prob: 50,
                },
                {
                  item: "water_clean",
                  "container-item": "bottle_plastic",
                  count: [1, 6],
                },
              ],
              prob: 90,
            },
            { collection: [], prob: 10 },
          ],
        },
      ],
    },
  ]);
  const flat = data.flattenTopLevelItemGroup(data.byId("item_group", "foo"));
  expect(flat.map((x) => ({ ...x, prob: x.prob.toFixed(2) }))).toEqual([
    { id: "bottle_plastic", count: [2, 2], prob: "0.90", expected: 1.8 },
    { id: "water_clean", count: [2, 7], prob: "0.90", expected: 4.05 },
  ]);
});

test("flattenItemGroup: deep nested groups", () => {
  const data = makeTestCBNData([
    {
      type: "item_group",
      id: "leaf",
      subtype: "collection",
      entries: [{ item: "stick", prob: 50 }],
    },
    {
      type: "item_group",
      id: "middle",
      subtype: "distribution",
      entries: [
        { group: "leaf", prob: 1 },
        { item: "stone", prob: 1 },
      ],
    },
    {
      type: "item_group",
      id: "top",
      subtype: "collection",
      entries: [{ group: "middle", count: 2 }],
    },
  ]);
  const flat = data.flattenTopLevelItemGroup(data.byId("item_group", "top"));
  // top: collection of 2 'middle'
  // middle: 50% leaf, 50% stone
  // leaf: 50% stick
  // middle spawns:
  // - stick: 0.5 * 0.5 = 0.25 (count 1)
  // - stone: 0.5 (count 1)
  // top spawns middle with count 2:
  // - stick: prob = 0.25 (prob is not increased by roll count in current implementation)
  // - stone: prob = 0.5
  expect(flat.find((x) => x.id === "stick")?.prob).toBe(0.25);
  expect(flat.find((x) => x.id === "stick")?.expected).toBe(0.5);
  expect(flat.find((x) => x.id === "stone")?.prob).toBe(0.5);
  expect(flat.find((x) => x.id === "stone")?.expected).toBe(1);
});

test("flattenItemGroup: container-item in entry", () => {
  const data = makeTestCBNData([
    {
      type: "item_group",
      id: "foo",
      subtype: "collection",
      entries: [{ item: "water", prob: 50, "container-item": "bottle" }],
    },
  ]);
  const flat = data.flattenTopLevelItemGroup(data.byId("item_group", "foo"));
  expect(flat.find((x) => x.id === "bottle")?.prob).toBe(0.5);
  expect(flat.find((x) => x.id === "water")?.prob).toBe(0.5);
});

test("flattenRequirement: basic expansion", () => {
  const data = makeTestCBNData([
    {
      type: "requirement",
      id: "req_a",
      components: [[["comp_1", 1]]],
    },
  ]);
  const flat = data.flattenRequirement([[["comp_1", 2]]], (x) => x.components);
  expect(flat).toEqual([[{ id: "comp_1", count: 2 }]]);
});

test("flattenRequirement: substitutes", () => {
  const data = makeTestCBNData([
    {
      type: "TOOL",
      id: "welder",
      sub: "welding_standard",
    },
    {
      type: "TOOL",
      id: "welder_crude",
      sub: "welding_standard",
    },
  ]);
  // replacements for 'welding_standard' should include welder and welder_crude
  // but wait, replacementTools(type: string) looks for items where item.sub === type
  const flat = data.flattenRequirement(
    [[["welding_standard", 5]]],
    (x) => x.tools,
    { expandSubstitutes: true },
  );
  expect(flat[0]).toContainEqual({ id: "welding_standard", count: 5 });
  expect(flat[0]).toContainEqual({ id: "welder", count: 5 });
  expect(flat[0]).toContainEqual({ id: "welder_crude", count: 5 });
});

test("flattenRequirement: onlyRecoverable", () => {
  const data = makeTestCBNData([
    {
      type: "item",
      id: "stick",
    },
    {
      type: "item",
      id: "glue",
      flags: ["UNRECOVERABLE"],
    },
  ]);
  const req = [
    [
      ["stick", 1],
      ["glue", 1],
    ],
  ];
  const flat = data.flattenRequirement(req, (x: any) => x.components, {
    onlyRecoverable: true,
  });
  expect(flat).toEqual([[{ id: "stick", count: 1 }]]);
});

describe("Language Loading Fallback", () => {
  test("loadData should not crash if locale JSON is malformed", async () => {
    const mockData = {
      data: [{ type: "item", id: "stick", name: "Stick" }],
      build_number: "123",
      release: "test-release",
    };

    const mockLocale = {
      // Missing required "" header for gettext.js
      Stick: "Bâton",
    };

    // Backup and mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      }
      if (url.includes("lang/fr.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLocale),
        } as Response);
      }
      return Promise.reject(new Error("Unexpected fetch"));
    }) as any;

    try {
      // Mock progress store
      (globalThis as any).__isTesting__ = true;

      // This should NOT throw "Wrong JSON, it must have an empty key ("") ..."
      await data.loadData("latest", "fr");

      // Verify data is still loaded
      const d = await new Promise<CBNData | null>((resolve) => {
        let unsubscribe: () => void;
        unsubscribe = data.subscribe((val) => {
          if (val) {
            if (unsubscribe) unsubscribe();
            resolve(val);
          }
        });
      });

      expect(d).toBeDefined();
      expect(d?.byId("item", "stick")).toBeDefined();
      // Should fall back to English name if locale failed to load/parse
      expect(gameSingularName(d?.byId("item", "stick"))).toBe("Stick");
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });
});

describe("omsName", () => {
  test("returns oms.id if subtype is mutable", () => {
    const data = makeTestCBNData([]);
    const oms: OvermapSpecial = {
      type: "overmap_special",
      id: "Lab",
      subtype: "mutable",
    };
    expect(omsName(data, oms)).toBe("Lab");
  });

  test("returns singular name of center omt", () => {
    const data = makeTestCBNData([
      {
        type: "overmap_terrain",
        id: "house_01",
        name: "House",
      },
    ]);
    const oms: OvermapSpecial = {
      type: "overmap_special",
      id: "HouseSpecial",
      overmaps: [{ point: [0, 0, 0], overmap: "house_01_north" }],
    };
    expect(omsName(data, oms)).toBe("House");
  });

  test("strips direction suffix correctly", () => {
    const data = makeTestCBNData([
      {
        type: "overmap_terrain",
        id: "house_01",
        name: "House",
      },
    ]);
    const oms: OvermapSpecial = {
      type: "overmap_special",
      id: "HouseSpecial",
      overmaps: [{ point: [0, 0, 0], overmap: "house_01_south" }],
    };
    expect(omsName(data, oms)).toBe("House");
  });

  test("ignores non-ground level overmaps", () => {
    const data = makeTestCBNData([
      {
        type: "overmap_terrain",
        id: "house_01",
        name: "House",
      },
      {
        type: "overmap_terrain",
        id: "bunker",
        name: "Bunker",
      },
    ]);
    const oms: OvermapSpecial = {
      type: "overmap_special",
      id: "HouseSpecial",
      overmaps: [
        { point: [0, 0, 1], overmap: "bunker_north" }, // z=1, ignored
        { point: [0, 0, 0], overmap: "house_01_north" },
      ],
    };
    expect(omsName(data, oms)).toBe("House");
  });
});

test("CBNData stores fetching_version", () => {
  const data = makeTestCBNData([], {
    buildVersion: "123",
    fetchVersion: "stable",
  });
  expect(data.fetchVersion()).toBe("stable");
  expect(data.buildVersion()).toBe("123");
});

describe("Detailed Locale Fallback Mechanism", () => {
  test("resolveLocale prefers the geographical fallback when available", () => {
    expect(resolveLocale("uk_UA", ["uk"])).toBe("uk");
  });

  test("resolveLocale falls back to English when no locale matches", () => {
    expect(resolveLocale("zz_ZZ", [])).toBe("en");
  });
});

describe("Mod Data Loading", () => {
  async function getLoadedData(): Promise<CBNData> {
    return await new Promise<CBNData>((resolve) => {
      let unsubscribe: (() => void) | null = null;
      unsubscribe = data.subscribe((value) => {
        if (!value) return;
        unsubscribe?.();
        resolve(value);
      });
    });
  }

  test("loadData without active mods still loads the mod catalog", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };
    const mockMods = {
      aftershock: {
        info: {
          type: "MOD_INFO",
          id: "aftershock",
          name: "Aftershock",
          description: "Aftershock",
          category: "content",
          dependencies: ["bn"],
        },
        data: [],
      },
    };

    const originalFetch = globalThis.fetch;
    const fetchCalls: string[] = [];
    globalThis.fetch = ((url: string) => {
      fetchCalls.push(url);
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMods),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as any;

    try {
      await data.loadData("latest", "en", []);
      const loaded = await getLoadedData();
      expect(fetchCalls.some((url) => url.includes("all_mods.json"))).toBe(
        true,
      );
      expect(loadedModInfos(loaded).map((mod) => mod.id)).toEqual([
        "aftershock",
      ]);
      expect(loaded.activeMods()).toEqual([]);
      expect(Object.keys(loaded.allMods())).toEqual(["aftershock"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("loadData with active mods filters unknown/core ids and preserves ordered active_mods", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };
    const mockMods = {
      aftershock: {
        info: {
          type: "MOD_INFO",
          id: "aftershock",
          name: "Aftershock",
          description: "Aftershock",
          category: "content",
          dependencies: ["bn"],
        },
        data: [{ type: "GENERIC", id: "aftershock_item" }],
      },
      bn: {
        info: {
          type: "MOD_INFO",
          id: "bn",
          name: "Bright Nights",
          description: "Core",
          category: "core",
          core: true,
          dependencies: [],
        },
        data: [],
      },
      magiclysm: {
        info: {
          type: "MOD_INFO",
          id: "magiclysm",
          name: "Magiclysm",
          description: "Magic",
          category: "content",
          dependencies: ["bn"],
        },
        data: [{ type: "GENERIC", id: "magic_item" }],
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMods),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as any;

    try {
      await data.loadData("latest", "en", [
        "bn",
        "unknown",
        "magiclysm",
        "aftershock",
        "magiclysm",
      ]);
      const loaded = await getLoadedData();
      expect(loaded.activeMods()).toEqual(["magiclysm", "aftershock"]);
      expect(loadedModInfos(loaded).map((mod) => mod.id)).toEqual([
        "aftershock",
        "magiclysm",
      ]);
      expect(Object.keys(loaded.allMods())).toEqual([
        "aftershock",
        "bn",
        "magiclysm",
      ]);
      expect(loaded.byId("item", "magic_item")).toBeDefined();
      expect(loaded.byId("item", "aftershock_item")).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("loadData cleans mod names and descriptions from color tags", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };
    const mockMods = {
      aftershock: {
        info: {
          type: "MOD_INFO",
          id: "aftershock",
          name: "<color_red>Aftershock</color>",
          description: "Line 1 <good>tagged</good>\nLine 2",
          category: "content",
          dependencies: ["bn"],
        },
        data: [{ type: "GENERIC", id: "aftershock_item" }],
      },
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMods),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as any;

    try {
      await data.loadData("latest", "en", ["aftershock"]);
      const loaded = await getLoadedData();
      expect(loadedModInfos(loaded)[0]?.name).toBe("Aftershock");
      expect(loadedModInfos(loaded)[0]?.description).toBe(
        "Line 1 tagged Line 2",
      );
      expect(loaded.allMods()?.aftershock.info.name).toBe("Aftershock");
      expect(loaded.allMods()?.aftershock.info.description).toBe(
        "Line 1 tagged Line 2",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("loadData handles 404 all_mods.json with empty arrays", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.reject(new Error("404")),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as any;

    try {
      await data.loadData("latest", "en", ["aftershock"]);
      const loaded = await getLoadedData();
      expect(Object.keys(loaded.allMods())).toEqual([]);
      expect(loaded.activeMods()).toEqual([]);
      expect(loaded.allMods()).toEqual({});
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("loadData throws on invalid all_mods.json shape", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((url: string) => {
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as any;

    try {
      await expect(
        data.loadData("latest", "en", ["aftershock"]),
      ).rejects.toThrow("Invalid all_mods.json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
