import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { CBNData } from "./data";
import {
  TILESETS,
  collectActiveModTilesets,
  collectExternalTilesets,
  getTilesetCompatibilityIdentities,
  isContributionCompatible,
  loadMergedTileset,
  resolveExternalChunkUrl,
  resolveModChunkUrl,
} from "./tile-data";

function fakeData(overrides: Partial<CBNData>): CBNData {
  return {
    active_mods: [],
    raw_mods_json: {},
    ...overrides,
  } as unknown as CBNData;
}

describe("tile-data mod_tileset support", () => {
  const originalFetch = globalThis.fetch;
  const OriginalImage = globalThis.Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();

    class MockImage {
      width = 64;
      height = 64;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    globalThis.Image = MockImage as unknown as typeof Image;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Image = OriginalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  test("collectActiveModTilesets reads only active mods in order", () => {
    const data = fakeData({
      active_mods: ["a", "b"],
      raw_mods_json: {
        a: {
          info: {
            type: "MOD_INFO",
            id: "a",
            name: "A",
            description: "A",
            category: "content",
            dependencies: ["bn"],
          },
          data: [
            {
              type: "mod_tileset",
              compatibility: ["UNDEAD_PEOPLE"],
              "tiles-new": [{ file: "gfx/a.png", tiles: [] }],
            },
          ],
        },
        b: {
          info: {
            type: "MOD_INFO",
            id: "b",
            name: "B",
            description: "B",
            category: "content",
            dependencies: ["bn"],
          },
          data: [
            {
              type: "mod_tileset",
              compatibility: ["UltimateCataclysm"],
              "tiles-new": [{ file: "gfx/b.png", tiles: [] }],
            },
          ],
        },
        c: {
          info: {
            type: "MOD_INFO",
            id: "c",
            name: "C",
            description: "C",
            category: "content",
            dependencies: ["bn"],
          },
          data: [
            {
              type: "mod_tileset",
              compatibility: ["UNDEAD_PEOPLE"],
              "tiles-new": [{ file: "gfx/c.png", tiles: [] }],
            },
          ],
        },
      },
    });

    const collected = collectActiveModTilesets(data);
    expect(collected.map((entry) => entry.modId)).toEqual(["a", "b"]);
    expect(collected[0].chunks[0].file).toBe("gfx/a.png");
    expect(collected[1].chunks[0].file).toBe("gfx/b.png");
  });

  test("compatibility identities include explicit aliases", () => {
    const undead = getTilesetCompatibilityIdentities("undead_people");
    const ultica = getTilesetCompatibilityIdentities("ultica");

    expect(undead.has("undead_people")).toBe(true);
    expect(undead.has("msx++dead_people")).toBe(true);
    expect(undead.has("mshockrealxotto")).toBe(true);

    expect(ultica.has("ultimatecataclysm")).toBe(true);
    expect(ultica.has("ulticashell")).toBe(true);
    expect(ultica.has("chibi_ultica")).toBe(true);
  });

  test("isContributionCompatible matches aliases case-insensitively", () => {
    const aliases = getTilesetCompatibilityIdentities("undead_people");

    expect(
      isContributionCompatible(
        { compatibility: new Set(["UNDEAD_PEOPLE_BASE".toLowerCase()]) },
        aliases,
      ),
    ).toBe(true);

    expect(
      isContributionCompatible(
        { compatibility: new Set(["ultimatecataclysm"]) },
        aliases,
      ),
    ).toBe(false);
  });

  test("resolveModChunkUrl resolves mod path and webp conversion", () => {
    expect(resolveModChunkUrl("v0.10.0", "civilians", "gfx/cops.png")).toBe(
      "https://data.cataclysmbn-guide.com/data/v0.10.0/mods/civilians/gfx/cops.webp",
    );

    expect(
      resolveModChunkUrl(
        "v0.10.0",
        "udp_redux",
        "../../../gfx/MSX++UnDeadPeopleEdition/normal_character.png",
      ),
    ).toBe(
      "https://data.cataclysmbn-guide.com/data/gfx/MSX%2B%2BUnDeadPeopleEdition/normal_character.webp",
    );
  });

  test("resolveExternalChunkUrl resolves external tileset path and webp conversion", () => {
    expect(
      resolveExternalChunkUrl(
        "v0.10.0",
        "external_tileset/rabbit_mutations/rabbit_ears.png",
      ),
    ).toBe(
      "https://data.cataclysmbn-guide.com/data/v0.10.0/external_tileset/rabbit_mutations/rabbit_ears.webp",
    );
  });

  test("collectExternalTilesets reads built-in external tileset entries", () => {
    const data = fakeData({
      all: (() => [
        {
          type: "mod_tileset",
          compatibility: ["UNDEAD_PEOPLE"],
          "tiles-new": [{ file: "external_tileset/a.png", tiles: [] }],
        },
        {
          type: "mod_tileset",
          compatibility: ["UNDEAD_PEOPLE"],
          "tiles-new": [{ file: "gfx/not-external.png", tiles: [] }],
        },
      ]) as unknown as CBNData["all"],
    });

    const collected = collectExternalTilesets(data);
    expect(collected).toHaveLength(1);
    expect(collected[0].source).toBe("external_tileset");
    expect(collected[0].chunks[0].file).toBe("external_tileset/a.png");
  });

  test("loadMergedTileset appends mod chunks and offsets sprite indices", async () => {
    const fetchSpy = vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("tile_config.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              tile_info: [{ width: 32, height: 32, pixelscale: 1 }],
              "tiles-new": [
                {
                  file: "base.png",
                  tiles: [],
                  sprite_width: 32,
                  sprite_height: 32,
                },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      } as Response);
    });
    globalThis.fetch = fetchSpy as typeof fetch;

    const data = fakeData({
      all: () => [],
      active_mods: ["mod_a", "mod_b"],
      raw_mods_json: {
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
            {
              type: "mod_tileset",
              compatibility: ["UNDEAD_PEOPLE"],
              "tiles-new": [{ file: "gfx/a.png", tiles: [{ id: "a", fg: 0 }] }],
            },
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
          data: [
            {
              type: "mod_tileset",
              compatibility: ["UNDEAD_PEOPLE"],
              "tiles-new": [{ file: "gfx/b.png", tiles: [{ id: "b", fg: 0 }] }],
            },
          ],
        },
      },
    });

    const tileset = TILESETS.find((entry) => entry.name === "undead_people")!;
    const merged = await loadMergedTileset(data, "v0.10.0-test-order", tileset);

    expect(merged["tiles-new"][0].file).toBe("base.webp");
    expect(merged["tiles-new"][1].file).toBe("gfx/a.webp");
    expect(merged["tiles-new"][2].file).toBe("gfx/b.webp");
    expect(merged["tiles-new"][1].tiles[0].fg).toBe(4);
    expect(merged["tiles-new"][2].tiles[0].fg).toBe(8);
    expect(
      fetchSpy.mock.calls.some(([arg]) =>
        String(arg).includes("/mods/mod_b/gfx/b.webp"),
      ),
    ).toBe(true);
  });

  test("loadMergedTileset skips failed mod chunk and continues", async () => {
    const fetchSpy = vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("tile_config.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              tile_info: [{ width: 32, height: 32, pixelscale: 1 }],
              "tiles-new": [],
            }),
        } as Response);
      }
      if (url.includes("bad.webp")) {
        return Promise.reject(new Error("network"));
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      } as Response);
    });
    globalThis.fetch = fetchSpy as typeof fetch;

    const data = fakeData({
      all: () => [],
      active_mods: ["civilians"],
      raw_mods_json: {
        civilians: {
          info: {
            type: "MOD_INFO",
            id: "civilians",
            name: "Civilians",
            description: "Civilians",
            category: "content",
            dependencies: ["bn"],
          },
          data: [
            {
              type: "mod_tileset",
              compatibility: ["UNDEAD_PEOPLE"],
              "tiles-new": [
                { file: "gfx/good.png", tiles: [{ id: "ok", fg: 0 }] },
                { file: "gfx/bad.png", tiles: [{ id: "bad", fg: 1 }] },
              ],
            },
          ],
        },
      },
    });

    const tileset = TILESETS.find((entry) => entry.name === "undead_people")!;
    const merged = await loadMergedTileset(data, "v0.10.0-test-fail", tileset);

    expect(merged["tiles-new"].map((chunk) => chunk.file)).toContain(
      "gfx/good.webp",
    );
    expect(merged["tiles-new"].map((chunk) => chunk.file)).not.toContain(
      "gfx/bad.webp",
    );
  }, 20_000);

  test("loadMergedTileset can recover after initial base tileset failure", async () => {
    let tileConfigCalls = 0;
    const fetchSpy = vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("tile_config.json")) {
        tileConfigCalls += 1;
        if (tileConfigCalls === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              tile_info: [{ width: 32, height: 32, pixelscale: 1 }],
              "tiles-new": [
                {
                  file: "base.png",
                  tiles: [],
                  sprite_width: 32,
                  sprite_height: 32,
                },
              ],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      } as Response);
    });
    globalThis.fetch = fetchSpy as typeof fetch;

    const data = fakeData({
      all: () => [],
      active_mods: [],
      raw_mods_json: {},
    });

    const tileset = TILESETS.find((entry) => entry.name === "undead_people")!;
    await expect(
      loadMergedTileset(data, "v0.10.0-test-retry-base-fail", tileset),
    ).rejects.toThrow();

    const merged = await loadMergedTileset(
      data,
      "v0.10.0-test-retry-base-fail",
      tileset,
    );
    expect(merged["tiles-new"][0].file).toBe("base.webp");
    expect(tileConfigCalls).toBe(2);
  });

  test("loadMergedTileset loads built-in external tileset chunks", async () => {
    const fetchSpy = vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("tile_config.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              tile_info: [{ width: 32, height: 32, pixelscale: 1 }],
              "tiles-new": [],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      } as Response);
    });
    globalThis.fetch = fetchSpy as typeof fetch;

    const data = fakeData({
      all: (() => [
        {
          type: "mod_tileset",
          compatibility: ["UNDEAD_PEOPLE"],
          "tiles-new": [
            {
              file: "external_tileset/custom.png",
              tiles: [{ id: "external", fg: 0 }],
            },
          ],
        },
      ]) as unknown as CBNData["all"],
      active_mods: [],
      raw_mods_json: {},
    });

    const tileset = TILESETS.find((entry) => entry.name === "undead_people")!;
    const merged = await loadMergedTileset(
      data,
      "v0.10.0-test-external",
      tileset,
    );

    expect(merged["tiles-new"].map((chunk) => chunk.file)).toContain(
      "external_tileset/custom.webp",
    );
    expect(
      fetchSpy.mock.calls.some(([arg]) =>
        String(arg).includes("/external_tileset/custom.webp"),
      ),
    ).toBe(true);
  });
});
