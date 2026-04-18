import * as TJS from "ts-json-schema-generator";
import * as fs from "fs";
import Ajv from "ajv";
import { expect, test, describe } from "vitest";
import { makeTestCBNData } from "./data.test-helpers";
import type { ModData, ModInfo } from "./types";

type ModsMap = Record<string, ModData>;

const program = TJS.createGenerator({
  tsconfig: __dirname + "/../tsconfig.json",
  additionalProperties: true,
});

const ajv = new Ajv({ allowUnionTypes: true, verbose: true });
const typesSchema = program.createSchema("SupportedTypes");

const schemasByType = new Map(
  Object.entries(
    (typesSchema!.definitions!["SupportedTypes"] as any).properties,
  ).map(([typeName, sch]) => {
    const schemaForType = sch as TJS.Definition;
    return [
      typeName,
      ajv.compile({
        ...schemaForType,
        definitions: typesSchema!.definitions,
        $schema: typesSchema!.$schema,
      } as TJS.Definition),
    ];
  }),
);

const allMods = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/all_mods.json", "utf8"),
) as unknown;
const baseGameData = JSON.parse(
  fs.readFileSync(__dirname + "/../_test/all.json", "utf8"),
).data as any[];

function asModsMap(value: unknown): ModsMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("all_mods.json must be a top-level object map");
  }
  return value as ModsMap;
}

function getEntityId(entity: any): string | undefined {
  if (entity.id) return entity.id;
  if (entity.result) return entity.result;
  if (entity.om_terrain) return JSON.stringify(entity.om_terrain);
}

function resolveDependencyChain(
  modsMap: ModsMap,
  targetModId: string,
  visited = new Set<string>(),
): string[] {
  if (visited.has(targetModId)) return [];
  visited.add(targetModId);

  const modData = modsMap[targetModId];
  if (!modData) return [];

  const deps = (modData.info as ModInfo).dependencies ?? [];
  const chain: string[] = [];

  for (const depId of deps) {
    if (depId === "bn") continue;
    chain.push(...resolveDependencyChain(modsMap, depId, visited));
  }

  chain.push(targetModId);
  return chain;
}

type TestCase = [id: string, obj: any];
type TypeGroups = Map<string, TestCase[]>; // type -> [[id, obj], ...]
type ModGroups = Map<string, TypeGroups>; // modId -> TypeGroups

function buildModSchemaCases(modsMap: ModsMap): ModGroups {
  const groupedCases: ModGroups = new Map();

  const sortedModIds = Object.keys(modsMap)
    .filter((id) => id !== "bn")
    .sort();

  for (const modId of sortedModIds) {
    const modData = modsMap[modId];
    if (!modData) continue;

    // Expensive setup per mod
    const dependencyChain = resolveDependencyChain(modsMap, modId, new Set());
    const mergedData = [
      ...baseGameData,
      ...dependencyChain.flatMap((cid) => modsMap[cid]?.data ?? []),
    ];
    const data = makeTestCBNData(mergedData, {
      activeMods: dependencyChain,
      rawModsJSON: modsMap,
    });

    const typeMap: TypeGroups = new Map();

    for (const entity of modData.data as any[]) {
      const id = getEntityId(entity);
      if (!id || !schemasByType.has(entity.type)) continue;

      const flattened = data._flatten(entity);

      if (!typeMap.has(entity.type)) {
        typeMap.set(entity.type, []);
      }

      typeMap.get(entity.type)!.push([
        id,
        {
          ...flattened,
          __filename: entity.__filename ?? flattened.__filename,
        },
      ]);
    }

    if (typeMap.size > 0) {
      groupedCases.set(modId, typeMap);
    }
  }

  return groupedCases;
}

const modsMap = asModsMap(allMods);
const groupedCases = buildModSchemaCases(modsMap);

test("all_mods uses top-level map with {info,data} entries", () => {
  const modsMap = asModsMap(allMods);
  for (const [modId, entry] of Object.entries(modsMap)) {
    expect(entry).toBeTypeOf("object");
    expect(entry.info).toBeTypeOf("object");
    expect(Array.isArray(entry.data)).toBe(true);
    expect((entry.info as ModInfo).type).toBe("MOD_INFO");
    expect((entry.info as ModInfo).id).toBe(modId);
  }
});

test("all_mods has at most one core mod", () => {
  const modsMap = asModsMap(allMods);
  const coreCount = Object.values(modsMap).filter(
    (entry) => (entry.info as ModInfo).core,
  ).length;
  expect(coreCount).toBeLessThanOrEqual(1);
});

test("all_mods requires id/name/description/category/dependencies for non-core mods", () => {
  const modsMap = asModsMap(allMods);
  for (const entry of Object.values(modsMap)) {
    const info = entry.info as ModInfo;
    expect(typeof info.id).toBe("string");
    expect(info.name).toBeDefined();
    expect(info.description).toBeDefined();
    expect(info.category).toBeDefined();
    if (info.core) {
      continue;
    }
    expect(Array.isArray(info.dependencies)).toBe(true);
  }
});

test("bn core mod is allowed to omit dependencies", () => {
  const modsMap = asModsMap(allMods);
  const bn = modsMap.bn;
  expect(bn).toBeDefined();
  expect((bn.info as ModInfo).core).toBe(true);
});

for (const [modId, typeMap] of groupedCases) {
  describe(`Mod: ${modId}`, () => {
    for (const [type, cases] of typeMap) {
      describe(`type: ${type}`, () => {
        test.each(cases)("id:%s schema match", (id, obj) => {
          expect(obj).toMatchSchema(schemasByType.get(type)!);
        });
      });
    }
  });
}
