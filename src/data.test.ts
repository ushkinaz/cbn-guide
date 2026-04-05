import { describe, expect, test } from "vitest";
import {
  CBNData,
  data,
  parseDuration,
  parseMass,
  parseVolume,
  omsName,
} from "./data";
import type { OvermapSpecial } from "./types";

import { gameSingularName } from "./i18n/game-locale";

test("flattened item group includes container item for distribution", () => {
  const data = new CBNData([
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
  const data = new CBNData([
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

  const data = new CBNData([base, modOverride]);
  const items = data.byType("item").filter((item) => item.id === "test_item");

  expect(items).toHaveLength(1);
  expect(items[0].weight).toBe(1100);
  expect(gameSingularName(items[0])).toBe("Modded item");
});

test("includes container item specified in item", () => {
  const data = new CBNData([
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

test("getDissectionSources returns monsters that provide the item via dissection", () => {
  const monster_id = "mon_test";
  const harvest_id = "harvest_test";
  const item_id = "item_test";
  const group_id = "group_test";

  const data = new CBNData([
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

  const sourcesForItem = data.getDissectionSources(item_id);
  expect(sourcesForItem).toHaveLength(1);
  expect(sourcesForItem[0].monster.id).toBe(monster_id);
  expect(sourcesForItem[0].harvest.id).toBe(harvest_id);
  expect(sourcesForItem[0].entry.drop).toBe(item_id);

  const sourcesForGroupMember = data.getDissectionSources("other_item");
  expect(sourcesForGroupMember).toHaveLength(1);
  expect(sourcesForGroupMember[0].monster.id).toBe(monster_id);
  expect(sourcesForGroupMember[0].harvest.id).toBe(harvest_id);
  expect(sourcesForGroupMember[0].entry.drop).toBe(group_id);
});

test("getDissectionSources ignores missing bionic_group references", () => {
  const data = new CBNData([
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

  expect(data.getDissectionSources("missing_group")).toEqual([]);
});

test("nested", () => {
  const data = new CBNData([
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

describe("Parsing units", () => {
  test("parseVolume", () => {
    expect(parseVolume(1)).toBe(250); //see legacy_volume_factor
    expect(parseVolume("100 ml")).toBe(100);
    expect(parseVolume("2 L")).toBe(2000);
    expect(parseVolume("1 L 500 ml")).toBe(1500);
    expect(parseVolume("83.33 ml")).toBe(83.33);
    expect(parseVolume("0.5 L")).toBe(500);
  });

  test("parseMass", () => {
    expect(parseMass(100)).toBe(100);
    expect(parseMass("1 kg")).toBe(1000);
    expect(parseMass("500 g")).toBe(500);
    expect(parseMass("50 mg")).toBe(0.05);
    expect(parseMass("1 kg 500 g")).toBe(1500);
    expect(parseMass("1.5 kg")).toBe(1500);
    expect(parseMass("0.5 g")).toBe(0.5);
  });

  test("parseDuration", () => {
    expect(parseDuration(100)).toBe(1);
    expect(parseDuration("1 turns")).toBe(1);
    expect(parseDuration("10 s")).toBe(10);
    expect(parseDuration("1 m")).toBe(60);
    expect(parseDuration("1 h")).toBe(3600);
    expect(parseDuration("1 d")).toBe(86400);
    expect(parseDuration("1 day 12 hours")).toBe(86400 + 12 * 3600);
    expect(parseDuration("1 h 7 m 30 s")).toBe(3600 + 7 * 60 + 30);
    expect(parseDuration("+1 day -23 hours 50m")).toBe(110 * 60);
    expect(parseDuration("1 turn 1 minutes 9 turns")).toBe(70);
    expect(parseDuration("-10s")).toBe(-10);
    expect(parseDuration("1.5 m")).toBe(90);
    expect(parseDuration("0.5 h")).toBe(1800);
  });
});

test("flattenItemGroup: deep nested groups", () => {
  const data = new CBNData([
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
  const data = new CBNData([
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
  const data = new CBNData([
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
  const data = new CBNData([
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
  const data = new CBNData([
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
  test("setVersion should not crash if locale JSON is malformed", async () => {
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
      await data.setVersion("latest", "fr");

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
    const data = new CBNData([]);
    const oms: OvermapSpecial = {
      type: "overmap_special",
      id: "Lab",
      subtype: "mutable",
    };
    expect(omsName(data, oms)).toBe("Lab");
  });

  test("returns singular name of center omt", () => {
    const data = new CBNData([
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
    const data = new CBNData([
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
    const data = new CBNData([
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
  const data = new CBNData([], "123", {}, "stable");
  expect(data.fetching_version).toBe("stable");
  expect(data.build_number).toBe("123");
});

describe("Detailed Locale Fallback Mechanism", () => {
  test("should fall back to geographical part if full locale missing (uk_UA -> uk)", async () => {
    const mockData = { data: [], build_number: "123", release: "test" };
    const mockLocaleUk = {
      "": { language: "uk", "plural-forms": "nplurals=3; plural=0;" },
      Stick: "Палиця",
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
          json: () => Promise.resolve({}),
        } as Response);
      }
      if (url.includes("lang/uk_UA.json")) {
        // Return 404 or just fail
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.reject(new Error("404")),
        } as Response);
      }
      if (url.includes("lang/uk.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLocaleUk),
        } as Response);
      }
      return Promise.reject(new Error("Unexpected fetch"));
    }) as any;

    try {
      (globalThis as any).__isTesting__ = true;
      // We pass metadata that only 'uk' is available
      await data.setVersion("latest", "uk_UA", ["uk"]);

      // Should NOT try uk_UA because it's not in the metadata
      expect(fetchCalls.some((url) => url.includes("lang/uk_UA.json"))).toBe(
        false,
      );
      // Should try uk because it is in the metadata as a fallback
      expect(fetchCalls.some((url) => url.includes("lang/uk.json"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });

  test("should fall back to English if both full and partial locales missing", async () => {
    const mockData = { data: [], build_number: "123", release: "test" };

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
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error("404")),
      } as Response);
    }) as any;

    try {
      (globalThis as any).__isTesting__ = true;
      // Pass metadata that NO locales are available
      await data.setVersion("latest", "zz_ZZ", []);

      // Should not try ANY locale because none are in metadata
      expect(fetchCalls.some((url) => url.includes("lang/"))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
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

  test("setVersion without active mods still loads the mod catalog", async () => {
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
      await data.setVersion("latest", null, undefined, []);
      const loaded = await getLoadedData();
      expect(fetchCalls.some((url) => url.includes("all_mods.json"))).toBe(
        true,
      );
      expect(loaded.mods.map((mod) => mod.id)).toEqual(["aftershock"]);
      expect(loaded.active_mods).toEqual([]);
      expect(Object.keys(loaded.raw_mods_json)).toEqual(["aftershock"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("setVersion with active mods filters unknown/core ids and preserves ordered active_mods", async () => {
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
      await data.setVersion("latest", null, undefined, [
        "bn",
        "unknown",
        "magiclysm",
        "aftershock",
        "magiclysm",
      ]);
      const loaded = await getLoadedData();
      expect(loaded.active_mods).toEqual(["magiclysm", "aftershock"]);
      expect(loaded.mods.map((mod) => mod.id)).toEqual([
        "aftershock",
        "magiclysm",
      ]);
      expect(Object.keys(loaded.raw_mods_json)).toEqual([
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

  test("setVersion cleans mod names and descriptions from color tags", async () => {
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
      await data.setVersion("latest", null, undefined, ["aftershock"]);
      const loaded = await getLoadedData();
      expect(loaded.mods?.[0]?.name).toBe("Aftershock");
      expect(loaded.mods?.[0]?.description).toBe("Line 1 tagged Line 2");
      expect(loaded.raw_mods_json?.aftershock.info.name).toBe("Aftershock");
      expect(loaded.raw_mods_json?.aftershock.info.description).toBe(
        "Line 1 tagged Line 2",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("setVersion handles 404 all_mods.json with empty arrays", async () => {
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
      await data.setVersion("latest", null, undefined, ["aftershock"]);
      const loaded = await getLoadedData();
      expect(loaded.mods).toEqual([]);
      expect(loaded.active_mods).toEqual([]);
      expect(loaded.raw_mods_json).toEqual({});
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("setVersion throws on invalid all_mods.json shape", async () => {
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
        data.setVersion("latest", null, undefined, ["aftershock"]),
      ).rejects.toThrow("Invalid all_mods.json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
