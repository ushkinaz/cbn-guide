import * as fs from "fs";
import { vi } from "vitest";
import type { BuildInfo } from "./routing";
import { BASE_URL } from "./utils/env";

type TestDataJson = {
  build_number: string;
  data: unknown[];
  mods: unknown[];
  release: { tag_name: string };
};

type TestModJson = {
  info: {
    type: "MOD_INFO";
    id: string;
    name: string;
    description: string;
    category: string;
    dependencies: string[];
  };
  data: unknown[];
};

let cachedTestData: TestDataJson | null = null;
let cachedTestBuilds: BuildInfo[] | null = null;

const minimalAppData: TestDataJson = {
  build_number: "2026-02-17",
  mods: [],
  release: {
    tag_name: "2026-02-17",
  },
  data: [
    {
      type: "item_group",
      id: "forage_spring",
      subtype: "distribution",
      entries: [],
      __filename: "test/forage_spring.json",
    },
    {
      type: "item_group",
      id: "forage_summer",
      subtype: "distribution",
      entries: [],
      __filename: "test/forage_summer.json",
    },
    {
      type: "item_group",
      id: "forage_autumn",
      subtype: "distribution",
      entries: [],
      __filename: "test/forage_autumn.json",
    },
    {
      type: "item_group",
      id: "forage_winter",
      subtype: "distribution",
      entries: [],
      __filename: "test/forage_winter.json",
    },
    {
      type: "item_group",
      id: "trash_forest",
      subtype: "distribution",
      entries: [],
      __filename: "test/trash_forest.json",
    },
    {
      type: "AMMO",
      id: "rock",
      symbol: "*",
      color: "light_gray",
      name: {
        str: "rock",
      },
      description:
        "A rock the size of a baseball. Makes a decent melee weapon, and is also good for throwing at enemies.",
      category: "rocks",
      material: "stone",
      ammo_type: "rock",
      weight: "500 g",
      volume: "250 ml",
      bashing: 7,
      damage: {
        damage_type: "bash",
        amount: 7,
      },
      range: 10,
      dispersion: 14,
      loudness: 0,
      to_hit: -1,
      __filename: "data/json/items/ammo.json#L261-L283",
    },
    {
      type: "ammunition_type",
      id: "rock",
      name: "rocks",
      default: "rock",
      __filename: "data/json/items/ammo_types.json#L68-L73",
    },
    {
      type: "material",
      id: "stone",
      name: "Stone",
      __filename: "data/json/materials.json#L1253-L1273",
    },
  ],
};

function readFixture<T>(filename: string): T {
  return JSON.parse(
    fs.readFileSync(__dirname + `/../_test/${filename}`, "utf8"),
  );
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function jsonResponse<T>(value: T): Response {
  return {
    ok: true,
    json: () => Promise.resolve(value),
  } as Response;
}

export function getTestData(): TestDataJson {
  cachedTestData ??= readFixture<TestDataJson>("all.json");
  return cachedTestData;
}

export function getTestBuilds(): BuildInfo[] {
  cachedTestBuilds ??= readFixture<BuildInfo[]>("builds.json");
  return cachedTestBuilds;
}

export const testModsData: Record<string, TestModJson> = {
  aftershock: {
    info: {
      type: "MOD_INFO",
      id: "aftershock",
      name: "Aftershock",
      description: "Aftershock test mod",
      category: "content",
      dependencies: ["bn"],
    },
    data: [],
  },
  magiclysm: {
    info: {
      type: "MOD_INFO",
      id: "magiclysm",
      name: "Magiclysm",
      description: "Magiclysm test mod",
      category: "total_conversion",
      dependencies: ["bn"],
    },
    data: [],
  },
  civilians: {
    info: {
      type: "MOD_INFO",
      id: "civilians",
      name: "Civilians",
      description: "Civilians test mod",
      category: "creatures",
      dependencies: ["bn"],
    },
    data: [
      {
        type: "mod_tileset",
        compatibility: ["UNDEAD_PEOPLE"],
        "tiles-new": [
          {
            file: "gfx/cops.png",
            tiles: [{ id: "mon_civilian_police", fg: 0 }],
            sprite_width: 32,
            sprite_height: 32,
          },
        ],
      },
    ],
  },
};

export function createBuildsFetchMock(): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.includes("builds.json")) {
      return Promise.resolve(jsonResponse(getTestBuilds()));
    }
    return Promise.reject(new Error(`Unmocked fetch: ${url}`));
  }) as typeof fetch;
}

export function createAppFetchMock(): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.includes("builds.json")) {
      return Promise.resolve(jsonResponse(getTestBuilds()));
    }
    if (url.includes("all.json")) {
      return Promise.resolve(jsonResponse(minimalAppData));
    }
    if (url.includes("all_mods.json")) {
      return Promise.resolve(jsonResponse(testModsData));
    }
    if (url.includes("ru_RU.json")) {
      return Promise.resolve(jsonResponse({}));
    }
    if (url.includes("tile_config.json")) {
      return Promise.resolve(
        jsonResponse({
          tile_info: [{ width: 32, height: 32, pixelscale: 1 }],
          "tiles-new": [],
        }),
      );
    }
    if (url.includes(".webp") || url.includes(".png")) {
      return Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob()),
      } as Response);
    }
    return Promise.reject(new Error(`Unmocked fetch: ${url}`));
  }) as typeof fetch;
}

export function setWindowLocation(path: string, search = ""): void {
  const baseUrl = BASE_URL || "/";
  const normalizedPath = path.replace(/^\/+/, "");
  const pathname = `${baseUrl}${normalizedPath}`;
  const origin = "http://localhost:3000";

  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: {
      href: `${origin}${pathname}${search}`,
      origin,
      pathname,
      search,
      replace(next: string | URL) {
        const url = new URL(next.toString(), origin);
        this.href = url.toString();
        this.pathname = url.pathname;
        this.search = url.search;
      },
      toString() {
        return this.href;
      },
    },
  });
}

export function dispatchPopState(): void {
  window.dispatchEvent(new PopStateEvent("popstate"));
}
