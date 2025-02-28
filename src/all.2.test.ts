/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render } from "@testing-library/svelte";
import { screen } from "@testing-library/dom";
import { afterEach, expect, test } from "vitest";
import * as fs from "fs";

import { CddaData, mapType } from "./data";

import Thing from "./Thing.svelte";
import {
  furnitureByOMSAppearance,
  lootByOMSAppearance,
  terrainByOMSAppearance,
} from "./types/item/spawnLocations";

const json = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/all.json", "utf8"),
);
let data: CddaData = new CddaData(json.data);
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
all.length = 20;

afterEach(cleanup);

const chunkNum = /all\.(\d+)\.test\.ts$/.exec(__filename)?.[1];
if (!chunkNum) throw new Error("No chunk index found");
const chunkIdx = parseInt(chunkNum, 10) - 1;
const numChunks = 2;

test.each(all.filter((_, i) => i % numChunks === chunkIdx))(
  "render %s %s",
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

    if (type !== "technique") {
      expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
    }
  },
  {
    // The first test sometimes times out on CI with the default 5sec timeout.
    timeout: 20000,
  },
);
