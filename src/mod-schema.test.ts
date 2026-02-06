import * as TJS from "ts-json-schema-generator";
import * as fs from "fs";
import * as util from "util";
import type { ValidateFunction } from "ajv";
import Ajv from "ajv";
import { describe, expect, test } from "vitest";
import type { ModData, ModInfo } from "./types";

type ModsMap = Record<string, ModData>;
type EntityKey = `${string}::${string}`; // "type::id"
type EntityWithSource = {
  entity: any;
  __source__: string[];
};

// Local type mappings (same as data.ts but accepting any string)
const typeMappings = new Map<string, string>([
  ["AMMO", "item"],
  ["GUN", "item"],
  ["ARMOR", "item"],
  ["PET_ARMOR", "item"],
  ["TOOL", "item"],
  ["TOOLMOD", "item"],
  ["TOOL_ARMOR", "item"],
  ["BOOK", "item"],
  ["COMESTIBLE", "item"],
  ["CONTAINER", "item"],
  ["ENGINE", "item"],
  ["WHEEL", "item"],
  ["GUNMOD", "item"],
  ["MAGAZINE", "item"],
  ["BATTERY", "item"],
  ["GENERIC", "item"],
  ["BIONIC_ITEM", "item"],
  ["MONSTER", "monster"],
]);

const mapType = (type: string): string => typeMappings.get(type) ?? type;

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchSchema(validate: ValidateFunction): R;
    }
  }
}

expect.extend({
  toMatchSchema(obj: any, schema: ValidateFunction) {
    const valid = schema(obj);
    const errors = schema.errors?.slice();
    const filename = obj.__filename;
    return {
      pass: valid,
      message: () => {
        const errorMessages =
          errors
            ?.map(
              (e) =>
                `${e.instancePath} ${e.message}, but was ${util.inspect(e.data)}`,
            )
            .join("\n") ?? "";

        return (filename ? `[File: ${filename}]\n` : "") + errorMessages;
      },
    };
  },
});

// Load all data
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

// ============================================================================
// Simplified Copy-From Resolver
// ============================================================================

/**
 * Get entity ID (handles different ID patterns in game data)
 * Returns first ID for display/primary key purposes
 */
function getEntityId(entity: any): string | undefined {
  const id = entity.id ?? entity.abstract ?? entity.result;
  if (Array.isArray(id)) return id[0];
  return id ?? undefined;
}

/**
 * Get ALL entity IDs (handles array IDs in game data)
 * Used for building lookup so each ID variant can be found
 */
function getEntityIds(entity: any): string[] {
  const id = entity.id ?? entity.abstract ?? entity.result;
  if (!id) return [];
  if (Array.isArray(id)) return id;
  return [id];
}

/**
 * Create lookup key for entity
 */
function makeKey(type: string, id: string): EntityKey {
  return `${mapType(type)}::${id}`;
}

/**
 * Resolve mod dependencies into load order (topological sort)
 * Returns array of mod IDs in order: dependencies first, target mod last
 */
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
    if (depId === "bn") continue; // Skip core, handled separately
    chain.push(...resolveDependencyChain(modsMap, depId, visited));
  }

  chain.push(targetModId);
  return chain;
}

/**
 * Recursive copy-from resolver - resolves entire inheritance chain
 * Ignores inheritance verbs (relative, proportional, extend, delete)
 */
function applyCopyFrom(
  entity: any,
  lookup: Map<EntityKey, EntityWithSource>,
  visited = new Set<string>(),
): any {
  if (!("copy-from" in entity)) {
    return { ...entity };
  }

  const parentId = entity["copy-from"];
  const entityType = mapType(entity.type);
  const parentKey = makeKey(entityType, parentId);

  // Cycle detection
  if (visited.has(parentKey)) {
    console.warn(`Cycle detected in copy-from chain: ${parentKey}`);
    return { ...entity };
  }
  visited.add(parentKey);

  const parentEntry = lookup.get(parentKey);

  if (!parentEntry) {
    // Parent not found - return entity as-is (will fail schema validation if incomplete)
    return { ...entity };
  }

  // Recursively resolve parent's copy-from chain first
  const resolvedParent = applyCopyFrom(parentEntry.entity, lookup, visited);

  // Shallow merge: resolved parent properties first, then child overrides
  const { abstract, ...parentProps } = resolvedParent;
  return { ...parentProps, ...entity };
}

/**
 * Build lookup map with all entities, resolving copy-from inheritance
 * as each mod is loaded in dependency order.
 */
function buildEntityLookup(modsMap: ModsMap): Map<EntityKey, EntityWithSource> {
  const lookup = new Map<EntityKey, EntityWithSource>();

  // 1. Load base game data (source: 'bn')
  // Register each ID separately for array-ID entities
  for (const entity of baseGameData) {
    const ids = getEntityIds(entity);
    if (ids.length === 0) continue;

    const entry: EntityWithSource = {
      entity: { ...entity },
      __source__: ["bn"],
    };
    for (const id of ids) {
      const key = makeKey(entity.type, id);
      lookup.set(key, entry);
    }
  }

  // 2. Get all unique mod IDs and their dependency chains
  const allModIds = Object.keys(modsMap).filter((id) => id !== "bn");
  const processedMods = new Set<string>();

  // Process all mods, respecting dependencies
  for (const modId of allModIds) {
    const chain = resolveDependencyChain(modsMap, modId, new Set());

    for (const chainModId of chain) {
      if (processedMods.has(chainModId)) continue;
      processedMods.add(chainModId);

      const modData = modsMap[chainModId];
      if (!modData) continue;

      for (const entity of modData.data as any[]) {
        const id = getEntityId(entity);
        if (!id) continue;

        const key = makeKey(entity.type, id);
        const existing = lookup.get(key);

        // Handle self-referential copy-from (mod copies from same ID in base)
        // We need to resolve BEFORE updating the lookup
        let resolved: any;
        const copyFromId = entity["copy-from"];
        if (copyFromId && copyFromId === id && existing) {
          // Self-reference: merge with existing entry (the one being overridden)
          const resolvedExisting = applyCopyFrom(existing.entity, lookup);
          const { abstract, ...existingProps } = resolvedExisting;
          resolved = { ...existingProps, ...entity };
        } else {
          resolved = applyCopyFrom(entity, lookup);
        }

        if (existing) {
          // Mod overriding existing entity
          lookup.set(key, {
            entity: resolved,
            __source__: [...existing.__source__, chainModId],
          });
        } else {
          // New entity from mod
          lookup.set(key, {
            entity: resolved,
            __source__: [chainModId],
          });
        }
      }
    }
  }

  return lookup;
}

// ============================================================================
// Build test data
// ============================================================================

const modsMap = asModsMap(allMods);
const entityLookup = buildEntityLookup(modsMap);

// Collect all mod objects for validation (only entities touched by each mod)
const allModObjects: Array<[string, string, string, any]> = [];

for (const [key, value] of entityLookup.entries()) {
  const entity = value.entity;
  const type = mapType(entity.type);

  // Skip base-only entities (not touched by any mod)
  const modSources = value.__source__.filter((s) => s !== "bn");
  if (modSources.length === 0) continue;

  // Skip types we don't have schemas for
  if (!schemasByType.has(type)) continue;

  // Skip abstract entities - they're templates, not complete entities
  if (entity.abstract) continue;

  const id = getEntityId(entity);
  if (!id) continue;

  // Add test case for the last mod that touched this entity
  const lastMod = modSources[modSources.length - 1];
  allModObjects.push([lastMod, type, id, entity]);
}

const skipped = new Set<string>([]);

// ============================================================================
// Tests
// ============================================================================

describe("all_mods schema", () => {
  test("uses top-level map with {info,data} entries", () => {
    const modsMap = asModsMap(allMods);
    for (const [modId, entry] of Object.entries(modsMap)) {
      expect(entry).toBeTypeOf("object");
      expect(entry.info).toBeTypeOf("object");
      expect(Array.isArray(entry.data)).toBe(true);
      expect((entry.info as ModInfo).type).toBe("MOD_INFO");
      expect((entry.info as ModInfo).id).toBe(modId);
    }
  });

  test("has at most one core mod", () => {
    const modsMap = asModsMap(allMods);
    const coreCount = Object.values(modsMap).filter(
      (entry) => (entry.info as ModInfo).core,
    ).length;
    expect(coreCount).toBeLessThanOrEqual(1);
  });

  test("requires id/name/description/category/dependencies for non-core mods", () => {
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
});

test.each(allModObjects)(
  "mod %s: schema matches %s %s",
  (modId, type, objId, obj) => {
    if (skipped.has(JSON.stringify(objId))) {
      return;
    }
    expect(obj).toMatchSchema(schemasByType.get(type)!);
  },
);
