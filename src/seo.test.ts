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

  expect(desc).toBe(
    "Zombie (mon_zombie) stats. MONSTER with HP 120, Speed 90 & Diff 4. Size MEDIUM, Wt 50 kg, Mat flesh, Flags SEES/HEARS",
  );
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

  expect(desc).toContain("AMMO with Dmg 40 & Type 9mm.");
  expect(desc).not.toContain("AP");
  expect(desc.indexOf("Dmg 40")).toBeGreaterThanOrEqual(0);
  expect(desc.indexOf("Dmg 40")).toBeLessThan(120);
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
    "Test Rifle (rifle_test) stats. WEAPON with Dmg 55, Disp 120 & Clip 30. Range 20, Recoil 300 Reliable rifle for testing.",
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

  expect(desc).toBe(
    "Test Vest (armor_test) stats. ARMOR with Bash 10, Cut 24, Enc 12 & Cov 90. Flags WATERPROOF, EP 5",
  );
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

  expect(desc).toBe(
    "Test Counter (furn_test) stats. FURNITURE with Dur 200 & Flags TRANSPARENT/FLAMMABLE. ReqStr 6, Move -10 test",
  );
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

  expect(desc).toBe(
    "Test Engine (vpart_test) stats. VEHICLE_PART with Dur 1000 & Flags BOARDABLE. Item part_steel, Power 2000",
  );
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

  expect(desc).toBe(
    "Test Tool (tool_test) stats. TOOL with Qual COOK 1, CUT 2 & Flags WATERPROOF.",
  );
});

test("cleans color tags and newlines from names", () => {
  const item: Named<SupportedTypes["GENERIC"]> = {
    type: "GENERIC",
    id: "hot_rod",
    name: "<color_red>Hot\nRod</color>",
  };

  const desc = buildMetaDescription(item);

  expect(desc).toContain("Hot Rod (hot_rod)");
  expect(desc).not.toContain("<color");
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
  const base = "Beast (beast) stats. MONSTER with HP 999, Speed 120 & Diff 10.";

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
