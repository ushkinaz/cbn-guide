/**
 * @jest-environment jsdom
 */
import {
  collection,
  getFurnitureForMapgen,
  getLootForMapgen,
  getTerrainForMapgen,
  lootForOmSpecial,
  parseItemGroup,
  parsePalette,
  parsePlaceMappingAlternative,
  repeatChance,
} from "./spawnLocations";
import { CBNData } from "../../data";
import type { ItemGroupData, Mapgen } from "../../types";
import { describe, expect, it } from "vitest";

const emptyData = new CBNData([]);

describe("collection()", () => {
  it("returns nothing given no items", () => {
    const got = collection([]);

    expect(got).toStrictEqual(new Map());
  });
  it("given one item, returns it", () => {
    const loot = new Map([["fake_item", { prob: 1.0, expected: 1 }]]);
    const given = [loot];

    const got = collection(given);

    expect(got).toStrictEqual(loot);
  });
  it("knowns about loot chance", () => {
    const given = [new Map([["fake_item", { prob: 0.5, expected: 0.5 }]])];

    const got = collection(given);

    expect(got).toStrictEqual(
      new Map([["fake_item", { prob: 0.5, expected: 0.5 }]]),
    );
  });
  it("can add up probabilities", () => {
    const item = new Map([["fake_item", { prob: 0.5, expected: 0.5 }]]);
    const given = [item, item];

    const got = collection(given);

    expect(got).toStrictEqual(
      new Map([["fake_item", { prob: 0.75, expected: 1 }]]),
    );
  });
});

describe("parseItemGroup()", () => {
  it("basic", () => {
    const got = parseItemGroup(
      emptyData,
      {
        subtype: "collection",
        items: [["test_pants_fur", 50]],
      },
      undefined,
      1,
    );

    expect(got).toStrictEqual(
      new Map([["test_pants_fur", { prob: 0.5, expected: 0.5 }]]),
    );
  });
  it("repeat", () => {
    const got = parseItemGroup(
      emptyData,
      {
        subtype: "collection",
        items: [["test_pants_fur", 50]],
      },
      2,
      1,
    );

    expect(got).toStrictEqual(
      new Map([["test_pants_fur", { prob: 0.75, expected: 1 }]]),
    );
  });
  it("repeat 2", () => {
    const data = new CBNData([
      {
        id: "fake_item_group",
        type: "item_group",
        subtype: "collection",
        items: ["fake_item"],
      },
    ]);
    const x = parseItemGroup(data, "fake_item_group", 2, 0.5);
    expect(x).toStrictEqual(
      new Map([["fake_item", { prob: 0.75, expected: 1 }]]),
    );
  });
});

describe("parsePalette()", () => {
  it("perses empty palette", () => {
    const got = parsePalette(new CBNData([]), {});
    expect(got).toStrictEqual(new Map());
  });

  it("knows about .items", () => {
    const data = new CBNData([
      {
        id: "fake_item_group",
        type: "item_group",
        subtype: "collection",
        items: [["test_pants_fur", 50]],
      },
    ]);
    const rawPalette = {
      items: { X: { item: "fake_item_group" } },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([
        ["X", new Map([["test_pants_fur", { prob: 0.5, expected: 0.5 }]])],
      ]),
    );
  });

  it("knows about arrays in .items", () => {
    const data = new CBNData([
      {
        id: "gr0",
        type: "item_group",
        subtype: "collection",
        items: [["fake_item", 50]],
      },
      {
        id: "gr1",
        type: "item_group",
        subtype: "collection",
        items: [["fake_item", 50]],
      },
    ]);
    const rawPalette = {
      items: { X: [{ item: "gr0" }, { item: "gr1" }] },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([["X", new Map([["fake_item", { prob: 0.75, expected: 1 }]])]]),
    );
  });

  it("knows about chance in .items", () => {
    const data = new CBNData([
      {
        id: "fake_item_group",
        type: "item_group",
        subtype: "collection",
        items: [["test_pants_fur", 50]],
      },
    ]);
    const rawPalette = {
      items: { X: { item: "fake_item_group", chance: 50 } },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([
        ["X", new Map([["test_pants_fur", { prob: 0.25, expected: 0.25 }]])],
      ]),
    );
  });

  it("knows about repeat in .items", () => {
    const data = new CBNData([
      {
        id: "fake_item_group",
        type: "item_group",
        subtype: "collection",
        items: ["fake_item"],
      },
    ]);
    const rawPalette = {
      items: { X: { item: "fake_item_group", chance: 50, repeat: 2 } },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([["X", new Map([["fake_item", { prob: 0.75, expected: 1 }]])]]),
    );
  });
  it("knows anout .palettes", () => {
    const data = new CBNData([
      {
        type: "palette",
        id: "fake_palette",
        items: { X: { item: "fake_item_group" } },
      },
      {
        id: "fake_item_group",
        type: "item_group",
        subtype: "collection",
        items: [["fake_item", 50]],
      },
    ]);
    const rawPalette = {
      palettes: ["fake_palette"],
      items: { X: { item: "fake_item_group" } },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([["X", new Map([["fake_item", { prob: 0.75, expected: 1 }]])]]),
    );
  });
  it("parses inline item group", () => {
    const data = new CBNData([]);
    const rawPalette = {
      items: {
        X: {
          item: {
            subtype: "collection" as const,
            items: [["fake_item", 50] as [string, number]],
          },
        },
      },
    };

    const got = parsePalette(data, rawPalette);
    expect(got).toStrictEqual(
      new Map([["X", new Map([["fake_item", { prob: 0.5, expected: 0.5 }]])]]),
    );
  });
  it("parses inline item collections", () => {
    const data = new CBNData([]);
    const rawPalette = {
      items: {
        X: {
          item: [{ item: "fake_item" }],
        },
      },
    };
    const got = parsePalette(data, rawPalette);
    expect(got).toStrictEqual(
      new Map([["X", new Map([["fake_item", { prob: 1, expected: 1 }]])]]),
    );
  });
  it("knows about .item", () => {
    const data = new CBNData([]);
    const rawPalette = {
      item: {
        X: { item: "i0", chance: 50, repeat: 2 },
        Y: [{ item: "i1" }, { item: "i2" }],
      },
    };
    const got = parsePalette(data, rawPalette);
    expect(got).toStrictEqual(
      new Map([
        ["X", new Map([["i0", { prob: 0.75, expected: 1 }]])],
        [
          "Y",
          new Map([
            ["i1", { prob: 1, expected: 1 }],
            ["i2", { prob: 1, expected: 1 }],
          ]),
        ],
      ]),
    );
  });
  it("knows about .sealed_item.[].items", () => {
    const data = new CBNData([
      {
        id: "fake_item_group",
        type: "item_group",
        subtype: "collection",
        items: ["fake_item"],
      },
    ]);
    const common = { items: { item: "fake_item_group" }, furniture: "fake" };
    const rawPalette = {
      sealed_item: {
        X: common,
        Y: { ...common, chance: 50 },
      },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([
        ["X", new Map([["fake_item", { prob: 1, expected: 1 }]])],
        ["Y", new Map([["fake_item", { prob: 0.5, expected: 0.5 }]])],
      ]),
    );
  });
  it("knows about .sealed_item | .[].items | {repeat, chance}", () => {
    const data = new CBNData([
      {
        id: "fake_item_group",
        type: "item_group",
        subtype: "collection",
        items: ["fake_item"],
      },
    ]);
    const rawPalette = {
      sealed_item: {
        X: {
          items: { item: "fake_item_group", chance: 50, repeat: 2 },
          furniture: "fake",
        },
      },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([["X", new Map([["fake_item", { prob: 0.75, expected: 1 }]])]]),
    );
  });
  it("knows about .sealed_item | .[].item", () => {
    const data = new CBNData([]);
    const rawPalette = {
      sealed_item: {
        X: {
          item: { item: "fake_item" },
          furniture: "fake",
        },
        Y: {
          item: { item: "fake_item" },
          furniture: "fake",
          chance: 50,
        },
        Z: {
          item: { item: "fake_item", chance: 50 },
          furniture: "fake",
        },
        A: {
          item: { item: "fake_item", chance: 50, repeat: 2 },
          furniture: "fake",
        },
      },
    };

    const got = parsePalette(data, rawPalette);

    expect(got).toStrictEqual(
      new Map([
        ["X", new Map([["fake_item", { prob: 1, expected: 1 }]])],
        ["Y", new Map([["fake_item", { prob: 0.5, expected: 0.5 }]])],
        ["Z", new Map([["fake_item", { prob: 0.5, expected: 0.5 }]])],
        ["A", new Map([["fake_item", { prob: 0.75, expected: 1 }]])],
      ]),
    );
  });
});

describe("repeatChance()", () => {
  it.each([1.0, 0.5])("repeats once (chance: %d)", (chance) => {
    expect(repeatChance(1, chance)).toBe(chance);
  });
  it.each([
    [2, 0.75],
    [3, 1 - 0.125],
  ])("repeats %d times", (repeat, expected) => {
    expect(repeatChance(repeat, 0.5)).toBe(expected);
  });
  it("handles repeat ranges", () => {
    expect(repeatChance([1, 2], 0.5)).toBe((0.5 + 0.75) / 2);
  });
  it("handles one-element ranges", () => {
    expect(repeatChance([2], 0.5)).toBe(0.75);
  });
  it.each([undefined, null])("handles %s repeat as 1", (nullish) => {
    expect(repeatChance(nullish as any, 0.5)).toBe(0.5);
  });
});

describe("loot", () => {
  it("place_loot", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: [],
          place_loot: [
            { group: "test_group", x: 0, y: 0, repeat: 4, chance: 75 },
          ],
        },
      } as Mapgen,
      {
        type: "item_group",
        id: "test_group",
        items: [
          ["item_a", 50],
          ["item_b", 100],
        ],
      } as ItemGroupData,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);
    // prob for item_a:
    //   4x 75% chances for a 1/3 chance to spawn.
    //   = 4x (75%*1/3 = 25%) chances to spawn
    //   so prob(spawn) = 1-(1-25%)^4
    //   ~= 68%
    expect(loot.get("item_a")!.prob.toFixed(2)).toEqual("0.68");
    // expected for item_a:
    //   4x 75% chances for a 1/3 chance to spawn.
    //   e.v. for one chance = 75% * 1/3 = 0.25
    //   4x 0.25 = 1
    expect(loot.get("item_a")!.expected.toFixed(2)).toEqual("1.00");
    // prob for item_b:
    //   4x 75% chances for a 2/3 chance to spawn.
    //   = 4x 75%*2/3 = 50% chances to spawn
    //   so prob(spawn) = 1-(1-50%)^4
    //   ~= 93%
    expect(loot.get("item_b")!.prob.toFixed(2)).toEqual("0.94");
    // expected for item_b:
    //   4x 75% chances for a 2/3 chance to spawn.
    //   e.v. for one chance = 75% * 2/3 = 0.5
    //   4x 0.5 = 2
    expect(loot.get("item_b")!.expected.toFixed(2)).toEqual("2.00");
  });

  it("place_loot item respects repeat", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: [],
          place_loot: [
            { item: "test_item", x: 0, y: 0, repeat: 5, chance: 50 },
          ],
        },
      } as Mapgen,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);
    const entry = loot.get("test_item")!;
    // prob: 1 - (1 - 0.5)^5 = 1 - 0.03125 = 0.96875
    expect(entry.prob).toBeCloseTo(0.96875);
    // expected: 5 * 0.5 = 2.5
    expect(entry.expected).toBeCloseTo(2.5);
  });

  it("handles overmap specials with no mapgens", async () => {
    const data = new CBNData([
      {
        type: "overmap_special",
        id: "test_special",
        subtype: "fixed",
        overmaps: [{ point: [0, 0, 0], overmap: "field_north" }],
      },
    ]);

    const loot = await lootForOmSpecial(
      data,
      data.byId("overmap_special", "test_special"),
      () => new Map(),
    );

    expect(loot).toStrictEqual(new Map());
  });

  it("place_item respects amount", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: [],
          place_item: [
            { item: "test_item", x: 0, y: 0, amount: [5, 10], chance: 50 },
          ],
        },
      } as Mapgen,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);
    const entry = loot.get("test_item")!;
    // prob: 0.5
    expect(entry.prob).toBeCloseTo(0.5);
    // expected: 0.5 * avg(5, 10) = 0.5 * 7.5 = 3.75
    expect(entry.expected).toBeCloseTo(3.75);
  });

  it("symbol item mapping respects amount", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: ["I"],
          item: {
            I: { item: "test_item", amount: 10, chance: 50 },
          },
        },
      } as Mapgen,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);
    const entry = loot.get("test_item")!;
    // prob: 0.5
    expect(entry.prob).toBeCloseTo(0.5);
    // expected: 0.5 * 10 = 5
    expect(entry.expected).toBeCloseTo(5);
  });

  it("mapping.item respects amount", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: ["I"],
          mapping: {
            I: { item: { item: "test_item", amount: [2, 4] } },
          },
        },
      } as Mapgen,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);
    const entry = loot.get("test_item")!;
    // prob: 1.0 (default chance)
    expect(entry.prob).toBeCloseTo(1.0);
    // expected: 1.0 * avg(2, 4) = 3
    expect(entry.expected).toBeCloseTo(3);
  });
});

describe("terrain", () => {
  it("fills with fill_ter when rows are missing", () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
        },
      } as Mapgen,
    ]);
    const loot = getTerrainForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("t_floor")).toEqual({ prob: 1, expected: 1 * 1 * 24 * 24 });
  });

  it("uses mapgensize when rows are missing", () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          mapgensize: [12, 12],
        },
      } as Mapgen,
    ]);
    const loot = getTerrainForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("t_floor")).toEqual({
      prob: 1,
      expected: 12 * 12 * 24 * 24,
    });
  });
});

describe("nested mapgen", () => {
  it("reads place_nested", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: [],
          place_nested: [{ chunks: ["test_chunk"], x: 0, y: 0 }],
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "test_chunk",
        object: {
          mapgensize: [1, 1],
          rows: ["L"],
          item: {
            L: { item: "test_item" },
          },
        },
      } as Mapgen,
    ]);
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    expect([...loot.entries()]).toEqual([
      ["test_item", { prob: 1, expected: 1 }],
    ]);
  });

  it("reads place_nested else_chunks fallback", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: [],
          place_nested: [
            {
              else_chunks: ["test_else_chunk"],
              neighbors: { north: ["lab"] },
              x: 0,
              y: 0,
            },
          ],
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "test_else_chunk",
        object: {
          mapgensize: [1, 1],
          rows: ["L"],
          item: {
            L: { item: "test_item_else" },
          },
        },
      } as Mapgen,
    ]);
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    expect([...loot.entries()]).toEqual([
      ["test_item_else", { prob: 0.5, expected: 0.5 }],
    ]);
  });

  it("handles chunk weights", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: [],
          place_nested: [
            {
              chunks: [
                ["test_chunk", 10],
                ["test_chunk_2", 30],
              ],
              x: 0,
              y: 0,
            },
          ],
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "test_chunk",
        object: {
          mapgensize: [1, 1],
          rows: ["L"],
          item: {
            L: { item: "test_item" },
          },
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "test_chunk_2",
        object: {
          mapgensize: [1, 1],
          rows: ["L"],
          item: {
            L: { item: "test_item_2" },
          },
        },
      } as Mapgen,
    ]);
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    expect([...loot.entries()]).toEqual([
      ["test_item", { prob: 0.25, expected: 0.25 }],
      ["test_item_2", { prob: 0.75, expected: 0.75 }],
    ]);
  });

  it("handles repeat", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: [],
          place_nested: [{ chunks: ["test_chunk"], x: 0, y: 0, repeat: 2 }],
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "test_chunk",
        object: {
          mapgensize: [1, 1],
          rows: ["L"],
          item: {
            L: { item: "test_item", chance: 30 },
          },
        },
      } as Mapgen,
    ]);
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    expect([...loot.entries()]).toEqual([
      ["test_item", { prob: 0.51, expected: 0.6 }],
    ]);
  });

  it.todo("handles repeat range");

  it("handles deep nested chains", async () => {
    const chain = Array.from(
      { length: 5 },
      (_, i) =>
        ({
          type: "mapgen",
          method: "json",
          ...(i === 0
            ? { om_terrain: "test_ter" }
            : { nested_mapgen_id: `mg${i}` }),
          object: {
            mapgensize: [1, 1],
            rows: ["X"],
            ...(i < 4
              ? { place_nested: [{ x: 0, y: 0, chunks: [`mg${i + 1}`] }] }
              : { item: { X: { item: "deep_item" } } }),
          },
        }) as Mapgen,
    );
    const data = new CBNData(chain);
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    expect([...loot.entries()]).toEqual([
      ["deep_item", { prob: 1, expected: 1 }],
    ]);
  });

  it("reads nested", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: ["f"],
          nested: {
            f: { chunks: ["test_chunk"] },
          },
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "test_chunk",
        object: {
          mapgensize: [1, 1],
          rows: ["L"],
          item: {
            L: { item: "test_item" },
          },
        },
      } as Mapgen,
    ]);
    // NB, lootByOmSpecial is what handles mapgen offsets, so we have to call through that.
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    expect([...loot.entries()]).toEqual([
      ["test_item", { prob: 1, expected: 1 }],
    ]);
  });
});

describe("furniture", () => {
  it("furniture", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: ["."],
          furniture: {
            ".": "f_test_furn",
          },
        },
      } as Mapgen,
    ]);
    const loot = getFurnitureForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("f_test_furn")).toEqual({ prob: 1, expected: 1 });
  });

  it("place_furniture", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: ["."],
          place_furniture: [{ x: 0, y: 0, furn: "f_test_furn" }],
        },
      } as Mapgen,
    ]);
    const loot = getFurnitureForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("f_test_furn")).toEqual({ prob: 1, expected: 1 });
  });

  it("place_furniture repeat", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: ["."],
          place_furniture: [{ x: 0, y: 0, furn: "f_test_furn", repeat: 3 }],
        },
      } as Mapgen,
    ]);
    const loot = getFurnitureForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("f_test_furn")).toEqual({ prob: 1, expected: 3 });
  });

  it("place_furniture repeat range", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: ["."],
          place_furniture: [
            { x: 0, y: 0, furn: "f_test_furn", repeat: [10, 25] },
          ],
        },
      } as Mapgen,
    ]);
    const loot = getFurnitureForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("f_test_furn")?.prob).toBeCloseTo(1);
    expect(loot.get("f_test_furn")?.expected).toBeCloseTo(17.5);
  });
});

describe("mapping", () => {
  it("includes mapping items", () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: ["X"],
          mapping: {
            X: { items: { item: "test_group" } },
          },
        },
      } as Mapgen,
      {
        type: "item_group",
        id: "test_group",
        subtype: "collection",
        items: ["item_a"],
      } as ItemGroupData,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("item_a")).toEqual({ prob: 1, expected: 1 });
  });

  it("includes mapping furniture", () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: ["X"],
          mapping: {
            X: { furniture: "f_test_furn" },
          },
        },
      } as Mapgen,
    ]);
    const loot = getFurnitureForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("f_test_furn")).toEqual({ prob: 1, expected: 1 });
  });

  it("includes mapping terrain and respects fill_ter", () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: ["X."],
          mapping: {
            X: { terrain: "t_rock" },
          },
        },
      } as Mapgen,
    ]);
    const loot = getTerrainForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.get("t_rock")).toEqual({ prob: 1, expected: 1 });
    expect(loot.get("t_floor")).toEqual({ prob: 1, expected: 1 });
  });

  it("set furniture", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: [],
          set: [
            {
              point: "furniture",
              id: "f_test_furn",
              x: [1, 22],
              y: [1, 22],
              chance: 50,
              repeat: [2, 4],
            },
          ],
        },
      } as Mapgen,
    ]);
    const loot = getFurnitureForMapgen(data, data.byType("mapgen")[0]);
    const entry = loot.get("f_test_furn")!;
    expect(entry.prob).toBeCloseTo(0.8541667, 5);
    expect(entry.expected).toBeCloseTo(1.5, 5);
  });
});

describe("terrain", () => {
  it("set terrain", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: [],
          set: [
            {
              point: "terrain",
              id: "t_test_ter",
              x: [0, 23],
              y: [0, 23],
              chance: 25,
              repeat: [1, 3],
            },
          ],
        },
      } as Mapgen,
    ]);
    const loot = getTerrainForMapgen(data, data.byType("mapgen")[0]);
    const entry = loot.get("t_test_ter")!;
    expect(entry.prob).toBeCloseTo(0.421875, 5);
    expect(entry.expected).toBeCloseTo(0.5, 5);
  });

  it("place_loot respects ammo and magazine", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: [],
          place_loot: [
            {
              item: "test_gun",
              x: 0,
              y: 0,
              ammo: 100,
              magazine: 100,
              chance: 50,
            },
          ],
        },
      } as Mapgen,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);

    const gun = loot.get("test_gun")!;
    expect(gun.prob).toBeCloseTo(0.5);
    expect(gun.expected).toBeCloseTo(0.5);

    // Ammo and magazine should spawn with 100% chance IF the gun spawns.
    // So their total probability in the loot map should be the same as the gun's probability (0.5).
    const ammo = loot.get("test_gun_ammo");
    // NOTE: In a real scenario, it would be the actual ammo ID.
    // For this test, let's assume our implementation will add "test_gun_ammo" and "test_gun_magazine"
    // or similar, or we can just check if multiple entries are present in the loot.
    // Let's keep it simple: we expect 3 entries in the loot map.
    expect(loot.size).toBe(3);
    expect(loot.get("test_gun_ammo")?.prob).toBeCloseTo(0.5);
    expect(loot.get("test_gun_magazine")?.prob).toBeCloseTo(0.5);
  });

  it("items mapping respects ammo and magazine", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          rows: ["G"],
          items: {
            G: {
              item: { subtype: "collection", entries: [{ item: "test_gun" }] },
              ammo: 100,
              magazine: 100,
              chance: 50,
            },
          },
        },
      } as Mapgen,
    ]);
    const loot = getLootForMapgen(data, data.byType("mapgen")[0]);
    expect(loot.size).toBe(3);
    expect(loot.get("test_gun")?.prob).toBeCloseTo(0.5);
    expect(loot.get("test_gun_ammo")?.prob).toBeCloseTo(0.5);
    expect(loot.get("test_gun_magazine")?.prob).toBeCloseTo(0.5);
  });

  it("counts fill_ter correctly when rows are missing", () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_dirt",
        },
      } as any,
    ]);
    const loot = getTerrainForMapgen(data, data.byType("mapgen")[0]);
    const entry = loot.get("t_dirt")!;
    // 1x1 submap = 24x24 = 576 tiles
    expect(entry.expected).toBe(576);
  });

  it("treats conditional nested chunks as conditional (averages chunks and else_chunks)", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: [],
          place_nested: [
            {
              chunks: ["chunk_a"],
              else_chunks: ["chunk_b"],
              neighbors: { north: ["lab"] },
              x: 0,
              y: 0,
            },
          ],
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "chunk_a",
        object: {
          mapgensize: [1, 1],
          rows: ["A"],
          item: { A: { item: "item_a" } },
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "chunk_b",
        object: {
          mapgensize: [1, 1],
          rows: ["B"],
          item: { B: { item: "item_b" } },
        },
      } as Mapgen,
    ]);
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    // Should contain both item_a and item_b with 0.5 prob/expected
    expect(loot.get("item_a")).toEqual({ prob: 0.5, expected: 0.5 });
    expect(loot.get("item_b")).toEqual({ prob: 0.5, expected: 0.5 });
  });

  it("handles conditional nested chunks with only chunks", async () => {
    const data = new CBNData([
      {
        type: "mapgen",
        method: "json",
        om_terrain: "test_ter",
        object: {
          fill_ter: "t_floor",
          rows: [],
          place_nested: [
            {
              chunks: ["chunk_a"],
              neighbors: { north: ["lab"] },
              x: 0,
              y: 0,
            },
          ],
        },
      } as Mapgen,
      {
        type: "mapgen",
        method: "json",
        nested_mapgen_id: "chunk_a",
        object: {
          mapgensize: [1, 1],
          rows: ["A"],
          item: { A: { item: "item_a" } },
        },
      } as Mapgen,
    ]);
    const loot = await getLootForMapgen(data, data.byType("mapgen")[0]);
    // Only item_a with 0.5 prob/expected (since else_chunks is missing)
    expect(loot.get("item_a")).toEqual({ prob: 0.5, expected: 0.5 });
  });
});

describe("parsePlaceMappingAlternative", () => {
  it("sums probabilities for repeated items (weighted choice)", () => {
    const data = new CBNData([]);
    // ["t_grass", "t_grass", "t_grass", "t_grass", "t_dirt"]
    // total = 5, t_grass weight = 4, t_dirt weight = 1
    // expected: t_grass prob = 0.8, t_dirt prob = 0.2
    const mapping = {
      ".": ["t_grass", "t_grass", "t_grass", "t_grass", "t_dirt"],
    };
    const got = parsePlaceMappingAlternative(mapping, (ter) => [
      new Map([[ter, { prob: 1, expected: 1 }]]),
    ]);

    const grass = got.get(".")!.get("t_grass")!;
    const dirt = got.get(".")!.get("t_dirt")!;

    expect(grass.prob).toBeCloseTo(0.8);
    expect(dirt.prob).toBeCloseTo(0.2);
  });
});
