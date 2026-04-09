import * as fs from "fs";
import { describe, expect, test } from "vitest";
import { makeTestCBNData } from "./data.test-helpers";
import { buildSearchIndex } from "./search-engine";
import type { ModData, Monster } from "./types";

describe("monster policy filtering", () => {
  test("applies blacklist selectors and whitelist overrides for monster/species/categories", () => {
    const data = makeTestCBNData([
      {
        type: "MONSTER",
        id: "mon_blacklisted_direct",
        species: ["ZOMBIE"],
        categories: ["CLASSIC"],
      },
      {
        type: "MONSTER",
        id: "mon_blacklisted_species",
        species: ["FUNGUS"],
      },
      {
        type: "MONSTER",
        id: "mon_blacklisted_category",
        categories: ["WILDLIFE"],
      },
      {
        type: "MONSTER",
        id: "mon_visible",
      },
      {
        type: "MONSTER_BLACKLIST",
        monsters: ["mon_blacklisted_direct"],
        species: ["FUNGUS"],
        categories: ["WILDLIFE", "TEST_BLACKLIST"],
      },
      {
        type: "MONSTER_WHITELIST",
        monsters: ["mon_blacklisted_direct"],
      },
    ]);

    expect(data.byIdMaybe("monster", "mon_blacklisted_direct")).toBeDefined();
    expect(
      data.byIdMaybe("monster", "mon_blacklisted_species"),
    ).toBeUndefined();
    expect(
      data.byIdMaybe("monster", "mon_blacklisted_category"),
    ).toBeUndefined();
    expect(data.byIdMaybe("monster", "mon_visible")).toBeDefined();

    expect(
      data
        .byType("monster")
        .map((monster) => monster.id)
        .sort(),
    ).toEqual(["mon_blacklisted_direct", "mon_visible"]);
  });

  test("normalizes string species and categories for policy filtering", () => {
    const data = makeTestCBNData([
      {
        type: "MONSTER",
        id: "mon_string_species",
        species: "FUNGUS", // as string
      },
      {
        type: "MONSTER",
        id: "mon_string_category",
        categories: "WILDLIFE", // as string
      },
      {
        type: "MONSTER_BLACKLIST",
        species: ["FUNGUS"],
      },
      {
        type: "MONSTER_WHITELIST",
        mode: "EXCLUSIVE",
        categories: ["WILDLIFE"],
      },
    ]);

    // mon_string_species is blacklisted by species FUNGUS
    expect(data.byIdMaybe("monster", "mon_string_species")).toBeUndefined();
    // mon_string_category is whitelisted by category WILDLIFE (and it's EXCLUSIVE mode)
    expect(data.byIdMaybe("monster", "mon_string_category")).toBeDefined();
  });

  test("blocks alias lookup for hidden monsters", () => {
    const data = makeTestCBNData([
      {
        type: "MONSTER",
        id: "mon_hidden",
        alias: ["mon_hidden_alias"],
      },
      {
        type: "MONSTER_BLACKLIST",
        monsters: ["mon_hidden"],
      },
    ]);

    expect(data.byIdMaybe("monster", "mon_hidden")).toBeUndefined();
    expect(data.byIdMaybe("monster", "mon_hidden_alias")).toBeUndefined();
  });

  test("enforces whitelist exclusive mode and keeps search inputs in sync", () => {
    const data = makeTestCBNData([
      {
        type: "MONSTER",
        id: "mon_wildlife",
        categories: ["WILDLIFE"],
      },
      {
        type: "MONSTER",
        id: "mon_robot",
        species: ["ROBOT"],
      },
      {
        type: "MONSTER",
        id: "mon_plain",
      },
      {
        type: "MONSTER_BLACKLIST",
        monsters: ["mon_wildlife"],
      },
      {
        type: "MONSTER_WHITELIST",
        mode: "EXCLUSIVE",
        categories: ["WILDLIFE"],
      },
    ]);

    expect(data.byIdMaybe("monster", "mon_wildlife")).toBeDefined();
    expect(data.byIdMaybe("monster", "mon_robot")).toBeUndefined();
    expect(data.byIdMaybe("monster", "mon_plain")).toBeUndefined();

    const indexIds = buildSearchIndex(data)
      .filter((x) => x.type === "monster")
      .map((x) => x.id);
    expect(indexIds).toEqual(["mon_wildlife"]);
  });

  test("keeps visibility stable across policy object order permutations", () => {
    const baseMonsters = [
      { type: "MONSTER", id: "mon_zed", species: ["ZOMBIE"] },
      { type: "MONSTER", id: "mon_zed_hero", species: ["ZOMBIE"] },
      { type: "MONSTER", id: "mon_bird", species: ["BIRD"] },
    ];

    const blacklist = {
      type: "MONSTER_BLACKLIST",
      species: ["ZOMBIE"],
    };
    const whitelist = {
      type: "MONSTER_WHITELIST",
      monsters: ["mon_zed_hero"],
    };

    const a = makeTestCBNData([...baseMonsters, blacklist, whitelist]);
    const b = makeTestCBNData([...baseMonsters, whitelist, blacklist]);

    expect(
      a
        .byType("monster")
        .map((x) => x.id)
        .sort(),
    ).toEqual(
      b
        .byType("monster")
        .map((x) => x.id)
        .sort(),
    );
    expect(
      a
        .byType("monster")
        .map((x) => x.id)
        .sort(),
    ).toEqual(["mon_bird", "mon_zed_hero"]);
  });

  test("isMonsterVisible evaluates selectors dynamically from cached policy sets", () => {
    const data = makeTestCBNData([
      {
        type: "MONSTER",
        id: "mon_blacklisted_species",
        species: ["FUNGUS"],
        categories: ["WILDLIFE"],
      },
      {
        type: "MONSTER",
        id: "mon_whitelisted_direct",
        species: ["ZOMBIE"],
      },
      {
        type: "MONSTER_BLACKLIST",
        species: ["FUNGUS"],
      },
      {
        type: "MONSTER_WHITELIST",
        monsters: ["mon_whitelisted_direct"],
      },
    ]);

    expect(
      data.isMonsterVisible({
        id: "mon_blacklisted_species",
        species: ["FUNGUS"],
        categories: ["WILDLIFE"],
      } as Monster),
    ).toBe(false);
    expect(
      data.isMonsterVisible({
        id: "mon_whitelisted_direct",
        species: ["ZOMBIE"],
      } as Monster),
    ).toBe(true);
    expect(
      data.isMonsterVisible({
        id: "mon_other",
        species: ["HUMAN"],
      } as Monster),
    ).toBe(true);
  });

  test("resolves categories policies once and reuses cached selectors in visibility checks", () => {
    const data = makeTestCBNData([
      {
        type: "MONSTER",
        id: "mon_cat_hidden",
        categories: ["CLASSIC"],
      },
      {
        type: "MONSTER",
        id: "mon_cat_visible",
        categories: ["TREE"],
      },
      {
        type: "MONSTER_BLACKLIST",
        categories: ["CLASSIC"],
      },
      {
        type: "MONSTER_WHITELIST",
        monsters: ["TREE"],
      },
    ]);

    expect(
      data.isMonsterVisible({
        id: "mon_cat_hidden",
        categories: ["CLASSIC"],
      } as Monster),
    ).toBe(false);
    expect(
      data.isMonsterVisible({
        id: "mon_cat_visible",
        categories: ["TREE"],
        species: ["HUMAN"],
      } as Monster),
    ).toBe(true);
  });
});

describe("monster policy fixtures from local all_mods.json", () => {
  function loadFixture(): {
    core: { data: unknown[] };
    mods: Record<string, ModData>;
  } {
    const core = JSON.parse(
      fs.readFileSync(__dirname + "/../_test/all.json", "utf8"),
    ) as {
      data: unknown[];
    };
    const mods = JSON.parse(
      fs.readFileSync(__dirname + "/../_test/all_mods.json", "utf8"),
    ) as Record<string, ModData>;
    return { core, mods };
  }

  test("No_Wasps blacklist hides known wasp monsters", () => {
    const { core, mods } = loadFixture();
    const merged = [...core.data, ...mods.No_Wasps.data];
    const data = makeTestCBNData(merged);

    expect(data.byIdMaybe("monster", "mon_wasp")).toBeUndefined();
    expect(data.byIdMaybe("monster", "mon_wasp_queen")).toBeUndefined();
    expect(data.byIdMaybe("monster", "mon_chicken")).toBeDefined();
  });

  test("classic_zombies exclusive whitelist hides non-whitelisted categories", () => {
    const { core, mods } = loadFixture();
    const merged = [...core.data, ...mods.classic_zombies.data];
    const data = makeTestCBNData(merged);

    expect(data.byIdMaybe("monster", "mon_chicken")).toBeDefined();
    expect(data.byIdMaybe("monster", "mon_copbot")).toBeUndefined();
  });
});
