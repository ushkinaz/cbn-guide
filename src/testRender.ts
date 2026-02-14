import { act, cleanup, render } from "@testing-library/svelte";
import { screen } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";
import * as fs from "fs";

import { CBNData, mapType } from "./data";

import Thing from "./Thing.svelte";
import {
  furnitureByOMSAppearance,
  lootByOMSAppearance,
  terrainByOMSAppearance,
} from "./types/item/spawnLocations";

const RENDER_TEST_TIMEOUT_MS = 120_000;
const RENDER_HOOK_TIMEOUT_MS = 180_000;

export function makeRenderTests(chunkIdx: number, numChunks: number) {
  vi.setConfig({
    hookTimeout: RENDER_HOOK_TIMEOUT_MS,
    testTimeout: RENDER_TEST_TIMEOUT_MS,
  });

  const json = JSON.parse(
    fs.readFileSync(__dirname + "/../_test/all.json", "utf8"),
  );
  let data: CBNData = new CBNData(json.data);
  const types = [
    "ammunition_type",
    "bionic",
    "construction_group",
    "fault",
    "furniture",
    "item",
    "item_action",
    "json_flag",
    "martial_art",
    "material",
    "monster",
    "mutation",
    "mutation_category",
    "mutation_type",
    "overmap_special",
    "skill",
    "technique",
    "terrain",
    "tool_quality",
    "vehicle",
    "vehicle_part",
    "vitamin",
    "weapon_category",
  ];

  const all = data._raw
    .filter(
      (x) =>
        x.id &&
        types.includes(mapType(x.type)) &&
        (!process.env.TEST_ONLY ||
          process.env.TEST_ONLY === `${mapType(x.type)}/${x.id}`),
    )
    .map((x) => [mapType(x.type), x.id]);

  afterEach(cleanup);

  test.each(all.filter((_, i) => i % numChunks === chunkIdx))(
    "render %s %s",
    {
      // The first test sometimes times out on CI with the default 5sec timeout.
      timeout: RENDER_TEST_TIMEOUT_MS,
    },
    async (type, id) => {
      // Prefill the loot tables, so we don't have to mess with waiting for async load...
      await lootByOMSAppearance(data);
      await furnitureByOMSAppearance(data);
      await terrainByOMSAppearance(data);

      // This lets LimitedList always render expanded.
      (globalThis as any).__isTesting__ = true;
      const { container } = render(Thing, { item: { type, id }, data });
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(screen.queryByTestId("loading-indicator")).toBe(null);

      // Check for common data binding errors, such as
      // accidental object rendering ([object Object]).
      // Note: "technique" types are excluded as they may contain these strings legitimately
      // or are handled via a different rendering path.
      if (type !== "technique") {
        expect(
          container.textContent,
          `Rendered output for ${type}:${id} contains "undefined", "NaN", or "[object Object]". This usually indicates a data binding error or a missing property.`,
        ).not.toMatch(/undefined|NaN|object Object/);
      }
    },
  );
}
