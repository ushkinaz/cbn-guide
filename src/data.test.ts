import { describe, expect, test } from "vitest";
import {
  CBNData,
  data,
  parseDuration,
  parseMass,
  parseVolume,
  singularName,
  omsName,
} from "./data";
import type { OvermapSpecial } from "./types";

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

test("_flatten: copy-from inheritance", () => {
  const data = new CBNData([
    { type: "item", abstract: "parent", weight: "1 kg", volume: "1 L" },
    { type: "item", id: "child", "copy-from": "parent", weight: "2 kg" },
  ]);
  const child = data.byId("item", "child");
  expect(child.weight).toBe("2 kg");
  expect(child.volume).toBe("1 L");
});

test("_flatten: relative", () => {
  const data = new CBNData([
    {
      type: "item",
      abstract: "parent",
      weight: "1 kg",
      volume: "1 L",
      melee_damage: { damage_type: "bash", amount: 10 },
      qualities: [["CUT", 1]],
    },
    {
      type: "item",
      id: "child",
      "copy-from": "parent",
      relative: {
        weight: 500, // weight is in grams
        volume: 250, // volume is in 250ml units if number? No, looking at code: (parseVolume(ret[k]) ?? 0) + ret.relative[k]
        melee_damage: { amount: 5 },
        qualities: [["CUT", 1]],
      },
    },
  ]);
  const child = data.byId("item", "child");
  expect(child.weight).toBe(1500); // 1kg (1000) + 500
  expect(child.volume).toBe(1250); // 1L (1000) + 250
  expect(child.melee_damage).toEqual({ damage_type: "bash", amount: 15 });
  expect(child.qualities).toEqual([["CUT", 2]]);
});

test("_flatten: proportional", () => {
  const data = new CBNData([
    { type: "item", abstract: "parent", weight: "1 kg", volume: "1 L" },
    {
      type: "item",
      id: "child",
      "copy-from": "parent",
      proportional: {
        weight: 1.5,
        volume: 2,
      },
    },
  ]);
  const child = data.byId("item", "child");
  // code: ret[k] *= ret.proportional[k]; ret[k] = ret[k] | 0;
  // wait, ret[k] here is still "1kg".
  // Looking at code:
  // if (typeof ret[k] === "string") {
  //   const m = /^\s*(\d+)\s*(.+)$/.exec(ret[k]);
  //   if (m) {
  //     const [, num, unit] = m;
  //     ret[k] = `${Number(num) * ret.proportional[k]} ${unit}`;
  //   }
  // }
  expect(child.weight).toBe("1.5 kg");
  expect(child.volume).toBe("2 L");
});

test("_flatten: extend and delete", () => {
  const data = new CBNData([
    {
      type: "item",
      abstract: "parent",
      flags: ["A", "B"],
      qualities: [
        ["CUT", 1],
        ["DIG", 1],
      ],
    },
    {
      type: "item",
      id: "child",
      "copy-from": "parent",
      extend: {
        flags: ["B", "C"],
      },
      delete: {
        qualities: [["DIG", 1]],
      },
    },
  ]);
  const child = data.byId("item", "child");
  expect(child.flags).toEqual(["A", "B", "C"]);
  expect(child.qualities).toEqual([["CUT", 1]]);
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
      expect(singularName(d?.byId("item", "stick"))).toBe("Stick");
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
