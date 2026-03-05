import { act, cleanup, render } from "@testing-library/svelte";
import { screen } from "@testing-library/dom";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import * as fs from "fs";

import { CBNData, mapType } from "./data";
import type { ModInfo } from "./types";

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

/**
 * Registers render tests for game mods.
 *
 * @param modId A mod ID string used by generated per-mod test files in
 *     `src/__mod_tests__/`. Each file runs in its own Vitest worker so only
 *     one `CBNData` instance is live at a time, preventing OOM errors.
 */
export function makeModRenderTests(modId: string): void {
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

  const modSubset = modEntries.filter(([id]) => id === modId);

  const createDataForMod = (modId: string): CBNData => {
    const mergedData = [...(coreJson.data ?? [])];
    const dependencyChain = resolveDependencyChain(modsJson, modId, new Set());
    for (const depModId of dependencyChain) {
      const depData = modsJson[depModId]?.data;
      if (depData) {
        mergedData.push(...depData);
      }
    }
    return new CBNData(mergedData);
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
  const renderCaseTuplesByMod = new Map<string, [string, string][]>();
  for (const { modId, type, id } of renderCases) {
    if (!renderCaseTuplesByMod.has(modId)) renderCaseTuplesByMod.set(modId, []);
    renderCaseTuplesByMod.get(modId)!.push([type, id]);
  }

  const renderPriority = (rawType: string): number => {
    const mappedType = mapType(rawType as any);
    if (mappedType === "overmap_special") return 0;
    if (mappedType === "item") return 2;
    return 1;
  };

  afterEach(cleanup);

  for (const [modId, mod] of modSubset) {
    const modData = mod.data ?? [];
    const tuples = [...(renderCaseTuplesByMod.get(modId) ?? [])].sort(
      ([typeA, idA], [typeB, idB]) => {
        const p = renderPriority(typeA) - renderPriority(typeB);
        if (p !== 0) return p;
        const typeCmp = mapType(typeA as any).localeCompare(
          mapType(typeB as any),
        );
        if (typeCmp !== 0) return typeCmp;
        return idA.localeCompare(idB);
      },
    );
    let Thing: any;
    let data: CBNData | undefined;

    describe(`mod=${modId}`, () => {
      beforeAll(async () => {
        data = createDataForMod(modId);
        await Promise.all([
          lootByOMSAppearance(data),
          furnitureByOMSAppearance(data),
          terrainByOMSAppearance(data),
        ]);
        const imported = await import("./Thing.svelte");
        Thing = imported.default;
      });
      afterAll(() => {
        Thing = undefined;
        data = undefined;
        // Allow singleton modules to be released before the next mod block.
        vi.resetModules();
      });

      test(
        `flatten mod=${modId} objects`,
        { timeout: MOD_RENDER_TIMEOUT_MS },
        () => {
          const failures: string[] = [];
          for (const [index, obj] of modData.entries()) {
            if (!obj || typeof obj !== "object") continue;
            const typed = obj as Record<string, unknown>;
            const rawType = typeof typed.type === "string" ? typed.type : null;
            if (!rawType) continue;
            const mappedType = mapType(rawType as any);

            try {
              if (typeof typed.id === "string" && typed.id.length > 0) {
                (data!.byIdMaybe as any)(mappedType, typed.id);
                continue;
              }
              if (
                typeof typed.abstract === "string" &&
                typed.abstract.length > 0
              ) {
                (data!.abstractById as any)(mappedType, typed.abstract);
                continue;
              }
              if (
                (rawType === "recipe" || rawType === "uncraft") &&
                typeof typed.result === "string" &&
                typed.result.length > 0
              ) {
                (data!.byIdMaybe as any)(mappedType, typed.result);
              }
            } catch (error) {
              failures.push(`${index}:${rawType}:${String(error)}`);
            }
          }
          expect(failures).toEqual([]);
        },
      );

      test.each(tuples)(
        `render mod=${modId} type=%s id=%s`,
        { timeout: MOD_RENDER_TIMEOUT_MS },
        async (type, id) => {
          (globalThis as any).__isTesting__ = true;
          const { container, unmount } = render(Thing, {
            item: { type: mapType(type as any), id },
            data: data!,
          });
          await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
          expect(screen.queryByTestId("loading-indicator")).toBe(null);
          if (type !== "technique") {
            const renderedText = container.textContent ?? "";
            if (/undefined|NaN|object Object/.test(renderedText)) {
              throw new Error(
                `Rendered output for ${modId}:${type}:${id} contains invalid placeholder text.`,
              );
            }
          }
          unmount();
        },
      );
    });
  }
}
