/**
 * @vitest-environment happy-dom
 */

import { act, cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PageMeta from "./PageMeta.svelte";
import { data } from "./data";
import {
  buildsState,
  _resetBuildsState,
  type BuildInfo,
} from "./builds.svelte";
import { UI_GUIDE_NAME } from "./constants";
import { _resetRouting } from "./routing.svelte";
import { setWindowLocation } from "./routing.test-helpers";

type MockThing = {
  type: string;
  id: string;
  name?: string | { str: string };
  description?: string;
  hp?: number;
  speed?: number;
  [key: string]: unknown;
};

type PageMetaComponent = {
  buildMetaDescription: (item: MockThing) => string;
};

function requestHref(url: string | URL | Request): string {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.toString();
  return url.url;
}

function clearHeadMetadata(): void {
  document.title = "";
  for (const element of document.head.querySelectorAll(
    'title, link[rel="canonical"], link[rel="alternate"], meta[name="description"], meta[property="og:title"], meta[property="og:description"]',
  )) {
    element.remove();
  }
}

function setBuildState(
  builds: BuildInfo[] = [
    {
      build_number: "2026-03-01",
      prerelease: false,
      created_at: "2026-03-01T00:00:00Z",
      langs: ["en", "ru_RU"],
    },
    {
      build_number: "2026-03-02",
      prerelease: true,
      created_at: "2026-03-02T00:00:00Z",
      langs: ["en"],
    },
  ],
): void {
  buildsState.current = {
    builds,
    latestStableBuild: builds.find((build) => !build.prerelease) ?? builds[0],
    latestNightlyBuild: builds.find((build) => build.prerelease) ?? builds[0],
  };
}

function renderPageMeta(path = "stable/") {
  setWindowLocation(path);
  _resetRouting();
  return render(PageMeta);
}

function descriptionBuilder() {
  const view = renderPageMeta();
  return (view.component as unknown as PageMetaComponent).buildMetaDescription;
}

describe("PageMeta", () => {
  beforeEach(() => {
    clearHeadMetadata();
    setWindowLocation("stable/");
    _resetRouting();
    _resetBuildsState();
    data._reset();
    setBuildState();
  });

  afterEach(() => {
    cleanup();
    clearHeadMetadata();
    _resetRouting();
    _resetBuildsState();
    data._reset();
    vi.restoreAllMocks();
  });

  test("reacts when item data arrives after mount", async () => {
    const monster: MockThing = {
      type: "MONSTER",
      id: "mon_zombie",
      name: "Zombie",
      hp: 120,
      speed: 90,
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const href = requestHref(url);

      if (href.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [monster],
              build_number: "2026-03-01",
              release: "test-release",
            }),
        } as Response);
      }

      return Promise.reject(new Error(`Unexpected fetch: ${href}`));
    }) as unknown as typeof fetch;

    try {
      renderPageMeta("stable/monster/mon_zombie");

      expect(document.title).toBe(UI_GUIDE_NAME);

      await act(async () => {
        await data.setVersion("stable", null, undefined, []);
      });

      await waitFor(() => {
        expect(document.title).toBe(`Zombie | ${UI_GUIDE_NAME}`);
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("renders catalog metadata from the route", async () => {
    renderPageMeta("stable/item");

    await waitFor(() => {
      expect(document.title).toBe(`Items | ${UI_GUIDE_NAME}`);
    });
  });

  test("renders search metadata from the route", async () => {
    renderPageMeta("stable/search/rock");

    await waitFor(() => {
      expect(document.title).toBe(`Search: rock | ${UI_GUIDE_NAME}`);
    });
  });

  test("renders canonical and alternate links with current mods", async () => {
    setWindowLocation("stable/item/rock", "?mods=aftershock");
    _resetRouting();
    render(PageMeta);

    await waitFor(() => {
      expect(
        document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      ).toBe("http://localhost:3000/stable/item/rock?mods=aftershock");
    });

    const alternateLinks = Array.from(
      document.querySelectorAll('link[rel="alternate"]'),
    );
    expect(alternateLinks.length).toBeGreaterThan(0);
    expect(
      alternateLinks.every((link) =>
        link.getAttribute("href")?.includes("mods=aftershock"),
      ),
    ).toBe(true);
  });

  test("omits default locale and default tileset from canonical and english alternate links", async () => {
    setWindowLocation(
      "stable/item/rock",
      "?lang=en&t=undead_people&mods=aftershock",
    );
    _resetRouting();
    render(PageMeta);

    await waitFor(() => {
      expect(
        document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      ).toBe("http://localhost:3000/stable/item/rock?mods=aftershock");
    });

    expect(
      document
        .querySelector('link[rel="alternate"][hreflang="en"]')
        ?.getAttribute("href"),
    ).toBe("http://localhost:3000/stable/item/rock?mods=aftershock");
    expect(
      document
        .querySelector('link[rel="alternate"][hreflang="ru-RU"]')
        ?.getAttribute("href"),
    ).toBe("http://localhost:3000/stable/item/rock?lang=ru_RU&mods=aftershock");
  });

  test("monster description includes primary stats and secondary info", () => {
    const buildMetaDescription = descriptionBuilder();
    const monster: MockThing = {
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

    expect(buildMetaDescription(monster)).toBe("Monster: HP 120 & Speed 90.");
  });

  test("monster description handles non-array species without crashing", () => {
    const buildMetaDescription = descriptionBuilder();
    const monster: MockThing = {
      type: "MONSTER",
      id: "mon_test_species",
      name: "Test Monster",
      color: "white",
      symbol: "M",
      default_faction: "zombie",
      hp: 100,
      speed: 80,
      species: "MAMMAL",
    };

    const desc = buildMetaDescription(monster);
    expect(desc).toContain("Monster:");
    expect(desc).toContain("HP 100");
    expect(desc).toContain("Speed 80");
  });

  test("ammo description skips missing stats and keeps key stats early", () => {
    const buildMetaDescription = descriptionBuilder();
    const ammo: MockThing = {
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
    const buildMetaDescription = descriptionBuilder();
    const gun: MockThing = {
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

    expect(buildMetaDescription(gun)).toBe(
      "Gun: rifle, dmg 55, disp 120 & clip 30. Reliable rifle for testing.",
    );
  });

  test("weapon description handles numeric ranged_damage without crashing", () => {
    const buildMetaDescription = descriptionBuilder();
    const gun: MockThing = {
      type: "GUN",
      id: "revolver_test",
      name: "Test Revolver",
      skill: "pistol",
      ranged_damage: 1,
      dispersion: 120,
      clip_size: 6,
    };

    const desc = buildMetaDescription(gun);
    expect(desc).toContain("Gun:");
    expect(desc).toContain("dmg 1");
  });

  test("ammo description handles numeric damage without crashing", () => {
    const buildMetaDescription = descriptionBuilder();
    const ammo: MockThing = {
      type: "AMMO",
      id: "ammo_numeric",
      name: "Numeric Ammo",
      ammo_type: "9mm",
      damage: 3,
      range: 10,
    };

    const desc = buildMetaDescription(ammo);
    expect(desc).toContain("Ammo:");
    expect(desc).toContain("dmg 3");
  });

  test("weapon description preserves explicit zero numeric ranged_damage", () => {
    const buildMetaDescription = descriptionBuilder();
    const gun: MockThing = {
      type: "GUN",
      id: "zero_damage_test",
      name: "Zero Damage Test",
      skill: "pistol",
      ranged_damage: 0,
    };

    const desc = buildMetaDescription(gun);
    expect(desc).toContain("Gun:");
    expect(desc).toContain("dmg 0");
  });

  test("ammo description accepts object damage without damage_type", () => {
    const buildMetaDescription = descriptionBuilder();
    const ammo: MockThing = {
      type: "AMMO",
      id: "ammo_object_no_type",
      name: "Object Damage Ammo",
      ammo_type: "9mm",
      damage: {
        amount: 7,
        armor_penetration: 2,
      },
    };

    const desc = buildMetaDescription(ammo);
    expect(desc).toContain("Ammo:");
    expect(desc).toContain("dmg 7");
    expect(desc).toContain("ap 2");
  });

  test("armor description includes protection values before mobility", () => {
    const buildMetaDescription = descriptionBuilder();
    const armor: MockThing = {
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
    };

    expect(buildMetaDescription(armor)).toBe("Armor: enc 12 & cov 90.");
  });

  test("furniture description uses durability and flags", () => {
    const buildMetaDescription = descriptionBuilder();
    const furniture: MockThing = {
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

    expect(buildMetaDescription(furniture)).toBe(
      "Furniture: cov 50 & flags TRANSPARENT:FLAMMABLE. test",
    );
  });

  test("vehicle part description uses durability and flags", () => {
    const buildMetaDescription = descriptionBuilder();
    const part: MockThing = {
      type: "vehicle_part",
      id: "vpart_test",
      name: "Test Engine",
      item: "part_steel",
      durability: 1000,
      power: 2000,
      flags: ["BOARDABLE"],
    };

    expect(buildMetaDescription(part)).toBe(
      "Vehicle Part: dur 1000 & flags BOARDABLE.",
    );
  });

  test("tool-like description shows qualities and flags", () => {
    const buildMetaDescription = descriptionBuilder();
    const tool: MockThing = {
      type: "TOOL",
      id: "tool_test",
      name: "Test Tool",
      qualities: [["COOK", 1]],
      material: "steel",
      flags: ["WATERPROOF"],
    };

    expect(buildMetaDescription(tool)).toBe(
      "Tool: qual COOK 1 & flags WATERPROOF.",
    );
  });

  test("cleans color tags and newlines from names", () => {
    const buildMetaDescription = descriptionBuilder();
    const item: MockThing = {
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
    const buildMetaDescription = descriptionBuilder();
    const monster: MockThing = {
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

  test("never exceeds 160 characters", () => {
    const buildMetaDescription = descriptionBuilder();
    const monster: MockThing = {
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

    expect(buildMetaDescription(monster).length).toBeLessThanOrEqual(160);
  });
});
