import { act, cleanup, render } from "@testing-library/svelte";
import { screen } from "@testing-library/dom";
import { afterEach, expect, test, vi } from "vitest";
import * as fs from "fs";

import { CBNData, mapType } from "./data";
import type { ModInfo } from "./types";

import Thing from "./Thing.svelte";
import {
  furnitureByOMSAppearance,
  lootByOMSAppearance,
  terrainByOMSAppearance,
} from "./types/item/spawnLocations";

type RawMod = {
  info?: Partial<ModInfo>;
  data?: unknown[];
};

const RENDERABLE_TYPES = [
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

type ModObjectCase = {
  modId: string;
  index: number;
  type: string;
  id: string;
  obj: Record<string, unknown>;
};

const MOD_RENDER_TIMEOUT_MS = 120_000;
const MOD_HOOK_TIMEOUT_MS = 180_000;

function resolveDependencyChain(
  modsMap: Record<string, RawMod>,
  targetModId: string,
  visited = new Set<string>(),
): string[] {
  if (visited.has(targetModId)) return [];
  visited.add(targetModId);

  const modData = modsMap[targetModId];
  if (!modData) return [];

  const deps = modData.info?.dependencies ?? [];
  const chain: string[] = [];
  for (const depId of deps) {
    if (depId === "bn") continue;
    chain.push(...resolveDependencyChain(modsMap, depId, visited));
  }
  chain.push(targetModId);
  return chain;
}

export function makeModRenderTests(chunkIdx: number, numChunks: number) {
  vi.setConfig({
    hookTimeout: MOD_HOOK_TIMEOUT_MS,
    testTimeout: MOD_RENDER_TIMEOUT_MS,
  });

  const coreJson = JSON.parse(
    fs.readFileSync(__dirname + "/../_test/all.json", "utf8"),
  ) as { data: unknown[] };
  const modsJson = JSON.parse(
    fs.readFileSync(__dirname + "/../_test/all_mods.json", "utf8"),
  ) as Record<string, RawMod>;

  const modEntries = Object.entries(modsJson).filter(
    ([, value]) => value && Array.isArray(value.data),
  );
  const modSubset = modEntries.filter((_, idx) => idx % numChunks === chunkIdx);

  const dataByMod = new Map<string, CBNData>();
  const preparedByMod = new Map<string, Promise<void>>();

  const getDataForMod = (modId: string): CBNData => {
    if (!dataByMod.has(modId)) {
      const mergedData = [...(coreJson.data ?? [])];
      const dependencyChain = resolveDependencyChain(
        modsJson,
        modId,
        new Set(),
      );
      for (const depModId of dependencyChain) {
        const depData = modsJson[depModId]?.data;
        if (depData) {
          mergedData.push(...depData);
        }
      }
      dataByMod.set(modId, new CBNData(mergedData));
    }
    return dataByMod.get(modId)!;
  };

  const prepareRenderingData = (modId: string): Promise<void> => {
    if (!preparedByMod.has(modId)) {
      const data = getDataForMod(modId);
      preparedByMod.set(
        modId,
        Promise.all([
          lootByOMSAppearance(data),
          furnitureByOMSAppearance(data),
          terrainByOMSAppearance(data),
        ]).then(() => undefined),
      );
    }
    return preparedByMod.get(modId)!;
  };

  const allModObjects: ModObjectCase[] = modSubset.flatMap(([modId, mod]) =>
    (mod.data ?? [])
      .map((obj, index) => ({ obj, index }))
      .filter(({ obj }) => !!obj && typeof obj === "object")
      .map(({ obj, index }) => {
        const typed = obj as Record<string, unknown>;
        const rawType = typeof typed.type === "string" ? typed.type : "";
        const rawId = typeof typed.id === "string" ? typed.id : "";
        return {
          modId,
          index,
          type: rawType,
          id: rawId,
          obj: typed,
        };
      }),
  );

  const renderCases = allModObjects.filter(({ modId, type, id }) => {
    if (!type || !id) return false;
    const mappedType = mapType(type as any);
    const selector = `${modId}/${mappedType}/${id}`;
    return (
      RENDERABLE_TYPES.includes(mappedType) &&
      (!process.env.TEST_ONLY || process.env.TEST_ONLY === selector)
    );
  });
  const flattenCases = modSubset.map(
    ([modId, mod]) => [modId, mod.data ?? []] as const,
  );
  const renderCaseTuples = renderCases.map(
    ({ modId, type, id }) => [modId, type, id] as const,
  );

  afterEach(cleanup);

  test.each(flattenCases)(
    "flatten mod=%s objects",
    { timeout: MOD_RENDER_TIMEOUT_MS },
    (modId, modData) => {
      const data = getDataForMod(modId);
      const failures: string[] = [];
      for (const [index, obj] of modData.entries()) {
        if (!obj || typeof obj !== "object") continue;
        const typed = obj as Record<string, unknown>;
        const rawType = typeof typed.type === "string" ? typed.type : null;
        if (!rawType) continue;
        const mappedType = mapType(rawType as any);

        try {
          if (typeof typed.id === "string" && typed.id.length > 0) {
            (data.byIdMaybe as any)(mappedType, typed.id);
            continue;
          }
          if (typeof typed.abstract === "string" && typed.abstract.length > 0) {
            (data.abstractById as any)(mappedType, typed.abstract);
            continue;
          }
          if (
            (rawType === "recipe" || rawType === "uncraft") &&
            typeof typed.result === "string" &&
            typed.result.length > 0
          ) {
            (data.byIdMaybe as any)(mappedType, typed.result);
          }
        } catch (error) {
          failures.push(`${index}:${rawType}:${String(error)}`);
        }
      }
      expect(failures).toEqual([]);
    },
  );

  test.each(renderCaseTuples)(
    "render mod=%s type=%s id=%s",
    { timeout: MOD_RENDER_TIMEOUT_MS },
    async (modId, type, id) => {
      await prepareRenderingData(modId);
      const data = getDataForMod(modId);

      (globalThis as any).__isTesting__ = true;
      const { container } = render(Thing, {
        item: { type: mapType(type as any), id },
        data,
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(screen.queryByTestId("loading-indicator")).toBe(null);
      if (type !== "technique") {
        expect(
          container.textContent,
          `Rendered output for ${modId}:${type}:${id} contains invalid placeholder text.`,
        ).not.toMatch(/undefined|NaN|object Object/);
      }
    },
  );
}
