import { describe, expect, test } from "vitest";
import { buildMetaDescription } from "./seo";
import type { SupportedTypes } from "./types";

type Named<T> = T & { name: string };

test("monster description includes primary stats and secondary info", () => {
  const monster: Named<SupportedTypes["MONSTER"]> = {
    type: "MONSTER",
    id: "mon_zombie",
    name: "Zombie",
    color: "white",
    symbol: "Z",
    default_faction: "zombie",
    hp: 120,
    speed: 90,
    diff: 4,
    size: "MEDIUM",
    weight: "50 kg",
    material: ["flesh"],
    flags: ["SEES", "HEARS"],
  };

  const desc = buildMetaDescription(monster);

  expect(desc).toBe("Monster: HP 120 & Speed 90.");
});

test("monster description handles non-array species without crashing", () => {
  const monster: Named<SupportedTypes["MONSTER"]> = {
    type: "MONSTER",
    id: "mon_test_species",
    name: "Test Monster",
    color: "white",
    symbol: "M",
    default_faction: "zombie",
    hp: 100,
    speed: 80,
    species: "MAMMAL" as any,
  };

  const desc = buildMetaDescription(monster);
  expect(desc).toContain("Monster:");
  expect(desc).toContain("HP 100");
  expect(desc).toContain("Speed 80");
});

test("ammo description skips missing stats and keeps key stats early", () => {
  const ammo: Named<SupportedTypes["AMMO"]> = {
    type: "AMMO",
    id: "ammo_9mm",
    name: "9mm FMJ",
    ammo_type: "9mm",
    damage: {
      damage_type: "bullet",
      amount: 40,
    },
    range: 60,
  };

  const desc = buildMetaDescription(ammo);

  expect(desc).toContain("Ammo: rng 60 & dmg 40.");
  expect(desc).not.toContain("AP");
  expect(desc.indexOf("dmg 40")).toBeGreaterThanOrEqual(0);
  expect(desc.indexOf("dmg 40")).toBeLessThan(120);
});

test("weapon description uses damage, dispersion, and clip size", () => {
  const gun: Named<SupportedTypes["GUN"]> = {
    type: "GUN",
    id: "rifle_test",
    name: "Test Rifle",
    description: "Reliable rifle for testing.",
    skill: "rifle",
    ranged_damage: {
      damage_type: "bullet",
      amount: 55,
    },
    dispersion: 120,
    clip_size: 30,
    range: 20,
    recoil: 300,
  };

  const desc = buildMetaDescription(gun);

  expect(desc).toBe(
    "Gun: rifle, dmg 55, disp 120 & clip 30. Reliable rifle for testing.",
  );
});

test("armor description includes protection values before mobility", () => {
  const armor: Named<SupportedTypes["ARMOR"]> = {
    type: "ARMOR",
    id: "armor_test",
    name: "Test Vest",
    armor_bash: 10,
    armor_cut: 24,
    encumbrance: 12,
    coverage: 90,
    warmth: 20,
    material: ["cotton", "leather"],
    environmental_protection: 5,
    flags: ["WATERPROOF"],
  } as any;

  const desc = buildMetaDescription(armor);

  expect(desc).toBe("Armor: enc 12 & cov 90.");
});

test("furniture description uses durability and flags", () => {
  const furniture: Named<SupportedTypes["furniture"]> = {
    type: "furniture",
    id: "furn_test",
    name: "Test Counter",
    symbol: "#",
    color: "white",
    description: "test",
    move_cost_mod: -10,
    required_str: 6,
    coverage: 50,
    bash: {
      str_max: 200,
    },
    flags: ["TRANSPARENT", "FLAMMABLE"],
  };

  const desc = buildMetaDescription(furniture);

  expect(desc).toBe("Furniture: cov 50 & flags TRANSPARENT:FLAMMABLE. test");
});

test("vehicle part description uses durability and flags", () => {
  const part: Named<SupportedTypes["vehicle_part"]> = {
    type: "vehicle_part",
    id: "vpart_test",
    name: "Test Engine",
    item: "part_steel",
    durability: 1000,
    power: 2000,
    flags: ["BOARDABLE"],
  };

  const desc = buildMetaDescription(part);

  expect(desc).toBe("Vehicle Part: dur 1000 & flags BOARDABLE.");
});

test("tool-like description shows qualities and flags", () => {
  const tool: Named<SupportedTypes["TOOL"]> = {
    type: "TOOL",
    id: "tool_test",
    name: "Test Tool",
    qualities: [["COOK", 1]],
    charged_qualities: [["CUT", 2]],
    material: "steel",
    flags: ["WATERPROOF"],
  };

  const desc = buildMetaDescription(tool);

  expect(desc).toBe("Tool: qual COOK 1, CUT 2 & flags WATERPROOF.");
});

test("cleans color tags and newlines from names", () => {
  const item: Named<SupportedTypes["GENERIC"]> = {
    type: "GENERIC",
    id: "hot_rod",
    name: "<color_red>Hot\nRod</color>",
  };

  const desc = buildMetaDescription(item);

  expect(desc).toContain("Generic.");
  expect(desc).not.toContain("Hot Rod");
  expect(desc).not.toContain("(hot_rod)");
});

test("truncates long secondary info but keeps base intact", () => {
  const monster: Named<SupportedTypes["MONSTER"]> = {
    type: "MONSTER",
    id: "beast",
    name: "Beast",
    color: "white",
    symbol: "B",
    default_faction: "beast",
    hp: 999,
    speed: 120,
    diff: 10,
    size: "HUGE",
    weight: "999 kg",
    material: ["chitin"],
    flags: [
      "FLAG_ONE_LONG",
      "FLAG_TWO_LONG",
      "FLAG_THREE_LONG",
      "FLAG_FOUR_LONG",
      "FLAG_FIVE_LONG",
      "FLAG_SIX_LONG",
    ],
  };

  const desc = buildMetaDescription(monster);
  const base = "Monster: HP 999 & Speed 120.";
  expect(desc.startsWith(base)).toBe(true);
  expect(desc.length).toBeLessThanOrEqual(160);
});

describe("seo length limits", () => {
  test("never exceeds 160 characters", () => {
    const monster: Named<SupportedTypes["MONSTER"]> = {
      type: "MONSTER",
      id: "mega_beast",
      name: "Mega Beast",
      color: "white",
      symbol: "M",
      default_faction: "beast",
      hp: 500,
      speed: 150,
      diff: 12,
      size: "HUGE",
      weight: "1000 kg",
      material: ["chitin"],
      flags: ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON", "ZETA", "ETA"],
    };

    const desc = buildMetaDescription(monster);

    expect(desc.length).toBeLessThanOrEqual(160);
  });
});
