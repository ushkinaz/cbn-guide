import * as fs from "fs";
import { describe, expect, test } from "vitest";
import { CBNData, data, normalizeDamageInstance } from "./data";

describe("Mod merge ordering", () => {
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

  test("appends mod data in selected mod order and preserves per-mod data order", async () => {
    const mockData = {
      data: [
        { type: "GENERIC", id: "core_1" },
        { type: "GENERIC", id: "core_2" },
      ],
      build_number: "123",
      release: "test-release",
    };
    const mockMods = {
      mod_a: {
        info: {
          type: "MOD_INFO",
          id: "mod_a",
          name: "A",
          description: "A",
          category: "content",
          dependencies: ["bn"],
        },
        data: [
          { type: "GENERIC", id: "a_1" },
          { type: "GENERIC", id: "a_2" },
        ],
      },
      mod_b: {
        info: {
          type: "MOD_INFO",
          id: "mod_b",
          name: "B",
          description: "B",
          category: "content",
          dependencies: ["bn"],
        },
        data: [{ type: "GENERIC", id: "b_1" }],
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
      await data.setVersion("latest", null, undefined, undefined, [
        "mod_b",
        "mod_a",
      ]);
      const loaded = await getLoadedData();
      const order = loaded
        .all()
        .map((obj) =>
          obj && typeof obj === "object" && "id" in obj
            ? (obj.id as string)
            : "",
        )
        .filter((id) => ["core_1", "core_2", "b_1", "a_1", "a_2"].includes(id));
      expect(order).toEqual(["core_1", "core_2", "b_1", "a_1", "a_2"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("copy-from self-looking override chain", () => {
  test("resolves Base -> Mod A -> Mod B when id and copy-from are identical", () => {
    const testData = new CBNData([
      {
        type: "GENERIC",
        id: "cattlefodder",
        weight: "1 kg",
      },
      {
        type: "GENERIC",
        id: "cattlefodder",
        "copy-from": "cattlefodder",
        relative: {
          weight: 100,
        },
      },
      {
        type: "GENERIC",
        id: "cattlefodder",
        "copy-from": "cattlefodder",
        relative: {
          weight: 200,
        },
      },
    ]);

    const flattened = testData.byId("item", "cattlefodder");
    expect(flattened.weight).toBe(1300);
  });
});

describe("DinoMod regressions", () => {
  test("mon_ztegosaurus_brute keeps valid melee damage types", () => {
    const coreJson = JSON.parse(
      fs.readFileSync(__dirname + "/../_test/all.json", "utf8"),
    );
    const modsJson = JSON.parse(
      fs.readFileSync(__dirname + "/../_test/all_mods.json", "utf8"),
    ) as Record<string, { data: unknown[] }>;
    const merged = [...coreJson.data, ...modsJson.DinoMod.data];
    const loaded = new CBNData(merged);
    const monster = loaded.byId("monster", "mon_ztegosaurus_brute");
    const meleeDamage = normalizeDamageInstance(monster.melee_damage ?? []);
    expect(meleeDamage.length).toBeGreaterThan(0);
    expect(
      meleeDamage.every(
        (unit) =>
          unit &&
          typeof unit === "object" &&
          typeof unit.damage_type === "string",
      ),
    ).toBe(true);
  });
});
