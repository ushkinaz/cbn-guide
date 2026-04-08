/**
 * Core data layer for Cataclysm: Bright Nights game data.
 *
 * ARCHITECTURE:
 * - **Singleton pattern**: `CBNData` is instantiated once per loaded data context
 * - **Data identity changes reload**: Build version, locale, and active mods
 *   replace the dataset with a full navigation because they point at different
 *   payloads (see `docs/routing.md`, ADR-002)
 * - **Display preferences stay soft**: Tileset changes are presentation-only and
 *   are handled by SPA navigation without rebuilding the data singleton
 * - **Incremental Mod Resolution**: Mods are resolved via top-to-bottom
 *   unfurling during flattening (see ADR-003)
 * - **Immutable after construction**: All data is frozen after initial load
 *   (~30MB, 30K+ objects)
 * - **Caching**: Maps and WeakMaps never need invalidation because their
 *   lifetime matches the published data instance
 *
 * This split is intentional: route changes that select different source data
 * rebuild the singleton, while display-only navigation keeps the existing
 * instance alive.
 */
import { writable } from "svelte/store";
import * as perf from "./utils/perf";
import { isTesting } from "./utils/env";

import type {
  Bionic,
  DamageInstance,
  DamageUnit,
  Harvest,
  HarvestEntry,
  Item,
  ItemGroup,
  ItemGroupData,
  ItemGroupEntry,
  Mapgen,
  ModData,
  ModInfo,
  Monster,
  MonsterGroup,
  OvermapSpecial,
  QualityRequirement,
  Recipe,
  Requirement,
  RequirementData,
  SupportedTypeMapped,
  SupportedTypesWithMapped,
  Trap,
  Translation,
  UseFunction,
  Vehicle,
  VehicleMountedPartDefinition,
} from "./types";
import type { Loot } from "./types/item/spawnLocations";
import {
  furnitureByOMSAppearance,
  lootByOMSAppearance,
  terrainByOMSAppearance,
} from "./types/item/spawnLocations";
import { cleanText, formatKg, formatL } from "./utils/format";
import { yieldUntilIdle } from "./utils/idle";
import { asArray } from "./utils/collections";
import {
  byName,
  resetI18n,
  gameSingularName,
  applyLocaleJSON,
} from "./i18n/game-locale";
import { loadRawDataset } from "./data-loader";

import { DEFAULT_LOCALE } from "./constants";

export { formatKg, formatL, formatPercent } from "./utils/format";

const typeMappings = new Map<string, keyof SupportedTypesWithMapped>([
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
  ["city_building", "overmap_special"],
]);

export const mapType = (
  type: keyof SupportedTypesWithMapped,
): keyof SupportedTypesWithMapped => typeMappings.get(type) ?? type;

const VOLUME_REGEX = /([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g;
const VOLUME_UNIT_MAP: Record<string, number> = {
  ml: 1,
  L: 1000,
};

// Returns ml
export function parseVolume(string: string | number): number {
  if (typeof string === "undefined") return 0;
  if (typeof string === "number") return string * 250;
  let val = 0;
  VOLUME_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VOLUME_REGEX.exec(string))) {
    const [_, numStr, unit] = m;
    const unitVal = VOLUME_UNIT_MAP[unit];
    if (unitVal !== undefined) {
      val += parseFloat(numStr) * unitVal;
    }
  }
  return val;
}

// with g as 1
const massUnits: Record<string, number> = {
  μg: 1e-6,
  ug: 1e-6,
  mcg: 1e-6,
  mg: 1e-3,
  g: 1,
  kg: 1e3,
};

const MASS_REGEX = /([+-]?\d+(?:\.\d+)?)\s*([a-zA-Zμ]+)/g;

// Returns grams
export function parseMass(string: string | number): number {
  if (typeof string === "undefined") return 0;
  if (typeof string === "number") return string;
  let val = 0;
  // Reset regex lastIndex for global regex reuse
  MASS_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASS_REGEX.exec(string))) {
    const [_, numStr, unit] = m;
    const unitVal = massUnits[unit];
    if (unitVal !== undefined) {
      val += parseFloat(numStr) * unitVal;
    }
  }
  return val;
}

const durationUnits: Record<string, number> = {
  turns: 1,
  turn: 1,
  t: 1,
  seconds: 1,
  second: 1,
  s: 1,
  minutes: 60,
  minute: 60,
  m: 60,
  hours: 3600,
  hour: 3600,
  h: 3600,
  days: 86400,
  day: 86400,
  d: 86400,
};

const DURATION_REGEX = /([+-]?\d+(?:\.\d+)?)\s*([a-z]+)/g;

const DIRECTION_SUFFIX_REGEX = /_(north|south|east|west)$/;

// Returns seconds
export function parseDuration(duration: string | number): number {
  if (typeof duration === "undefined") return 0;
  if (typeof duration === "number") return duration / 100;
  let val = 0;
  DURATION_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DURATION_REGEX.exec(duration))) {
    const [_, numStr, unit] = m;
    const unitVal = durationUnits[unit];
    if (unitVal !== undefined) {
      val += parseFloat(numStr) * unitVal;
    }
  }
  return val;
}

export function asMinutes(duration: string | number) {
  const seconds = parseDuration(duration);
  return `${Math.round(seconds / 60)} m`;
}

export function asHumanReadableDuration(duration: string | number) {
  let seconds = parseDuration(duration);
  let minutes = (seconds / 60) | 0;
  seconds -= minutes * 60;
  let hours = (minutes / 60) | 0;
  minutes -= hours * 60;
  let days = (hours / 24) | 0;
  hours -= days * 24;
  return (
    [
      [days, "d"],
      [hours, "h"],
      [minutes, "m"],
      [seconds, "s"],
    ] as [number, string][]
  )
    .filter(([n]) => n)
    .map((x) => x.join(""))
    .join(" ");
}

export function asLiters(string: string | number): string {
  const ml = parseVolume(string);
  return formatL(ml);
}

export function asKilograms(string: string | number): string {
  const g = parseMass(string);
  return formatKg(g);
}

type DissectionSource = {
  monster: Monster;
  harvest: Harvest;
  entry: HarvestEntry;
};

/**
 * Central data store for the application.
 * Handles loading, indexing, and accessing game data.
 * Implements lazy flattening of objects (resolving inheritance).
 */
export class CBNData {
  _raw: any[];
  /**
   * A record containing mods data, where each key is a string identifier for a specific mod
   * and the value is an object representing the corresponding mod's data.
   *
   * @property {string} key - The unique identifier for the mod.
   * @property {ModData} value - The data object containing configuration and metadata for the mod.
   */
  _rawModsJSON: Record<string, ModData>;
  /** Concrete build number from the game data (e.g., "v0.9.1") */
  _buildVersion: string;
  /** Original version slug used for fetching (e.g., "stable", "nightly") */
  _fetchVersion: string;
  /** Ordered active non-core mod ids. */
  _activeMods: string[];
  /** Effective locale actually loaded and applied to the i18n singleton. */
  _locale: string;

  _byType: Map<string, any[]> = new Map();
  _byTypeById: Map<string, Map<string, any>> = new Map();
  _abstractsByType: Map<string, Map<string, any>> = new Map();
  _overrides: Map<any, any> = new Map();
  _toolReplacements: Map<string, string[]> = new Map();
  _craftingPseudoItems: Map<string, string> = new Map();
  _migrations: Map<string, string> = new Map();
  _flattenCache: Map<any, any> = new Map();
  _nestedMapgensById: Map<string, Mapgen[]> = new Map();
  /**
   * Precomputed visibility for monsters after applying MONSTER_BLACKLIST /
   * MONSTER_WHITELIST policy objects from the merged dataset.
   *
   * @internal
   */
  _monsterVisibilityById: Map<string, boolean> = new Map();

  /**
   * Reverse index for "Dissected From" functionality.
   * Maps item_id or item_group_id to a list of monsters that provide it.
   * @internal
   */
  _dissectionSources: Map<string, DissectionSource[]> = new Map();

  constructor(
    rawJSON: unknown[],
    buildVersion: string,
    fetchVersion: string,
    locale: string,
    localeJSON: unknown | undefined,
    pinyinJSON: unknown | undefined,
    activeMods: string[],
    rawModsJSON: Record<string, ModData>,
  ) {
    const p = perf.mark("CBNData.constructor");

    const raw = rawJSON as any[];

    this._buildVersion = buildVersion;
    this._fetchVersion = fetchVersion;
    this._activeMods = activeMods;
    this._locale = locale;
    this._rawModsJSON = rawModsJSON;

    // Apply locale to the shared i18n singleton before any data method runs.
    if (locale !== DEFAULT_LOCALE) {
      try {
        applyLocaleJSON(localeJSON, pinyinJSON ?? null, this._locale);
      } catch (e) {
        console.warn("Failed to apply locale JSON in CBNData constructor:", e);
        resetI18n(DEFAULT_LOCALE);
        this._locale = DEFAULT_LOCALE;
      }
    }

    // For some reason O—G has the string "mapgen" as one of its objects.
    this._raw = raw.filter((x) => typeof x === "object");
    for (const obj of raw) {
      if (!Object.hasOwnProperty.call(obj, "type")) continue;
      if (obj.type === "MIGRATION") {
        for (const id of typeof obj.id === "string" ? [obj.id] : obj.id) {
          const { replace } = obj;
          this._migrations.set(id, replace);
        }
        continue;
      }
      const mappedType = mapType(obj.type);
      if (!this._byType.has(mappedType)) this._byType.set(mappedType, []);
      this._byType.get(mappedType)!.push(obj);
      if (Object.hasOwnProperty.call(obj, "id")) {
        if (!this._byTypeById.has(mappedType))
          this._byTypeById.set(mappedType, new Map());
        if (typeof obj.id === "string") {
          const byTypeById = this._byTypeById.get(mappedType)!;
          const previous = byTypeById.get(obj.id);
          if (previous) {
            this._overrides.set(obj, previous);
          }
          byTypeById.set(obj.id, obj);
        } else if (Array.isArray(obj.id))
          for (const id of obj.id)
            this._byTypeById.get(mappedType)!.set(id, obj);

        // TODO: proper alias handling. We want to e.g. be able to collapse them in loot tables.
        if (Array.isArray(obj.alias))
          for (const id of obj.alias)
            this._byTypeById.get(mappedType)!.set(id, obj);
        else if (typeof obj.alias === "string")
          this._byTypeById.get(mappedType)!.set(obj.alias, obj);
      }
      // recipes are id'd by their result
      if (
        (mappedType === "recipe" || mappedType === "uncraft") &&
        Object.hasOwnProperty.call(obj, "result")
      ) {
        if (!this._byTypeById.has(mappedType))
          this._byTypeById.set(mappedType, new Map());
        const id = obj.result + (obj.id_suffix ? "_" + obj.id_suffix : "");
        this._byTypeById.get(mappedType)!.set(id, obj);
      }
      if (
        mappedType === "monstergroup" &&
        Object.hasOwnProperty.call(obj, "name")
      ) {
        if (!this._byTypeById.has(mappedType))
          this._byTypeById.set(mappedType, new Map());
        const id = obj.name;
        this._byTypeById.get(mappedType)!.set(id, obj);
      }
      if (Object.hasOwnProperty.call(obj, "abstract")) {
        if (!this._abstractsByType.has(mappedType))
          this._abstractsByType.set(mappedType, new Map());
        // Track previous abstract if it exists (mod override pattern)
        const previous = this._abstractsByType
          .get(mappedType)!
          .get(obj.abstract);
        if (previous) {
          this._overrides.set(obj, previous);
        }
        this._abstractsByType.get(mappedType)!.set(obj.abstract, obj);
      }

      if (Object.hasOwnProperty.call(obj, "crafting_pseudo_item")) {
        if (Array.isArray(obj.crafting_pseudo_item)) {
          for (const pseudo_id of obj.crafting_pseudo_item) {
            this._craftingPseudoItems.set(pseudo_id, obj.id);
          }
        } else this._craftingPseudoItems.set(obj.crafting_pseudo_item, obj.id);
      }

      if (Object.hasOwnProperty.call(obj, "nested_mapgen_id")) {
        if (!this._nestedMapgensById.has(obj.nested_mapgen_id))
          this._nestedMapgensById.set(obj.nested_mapgen_id, []);
        this._nestedMapgensById.get(obj.nested_mapgen_id)!.push(obj);
      }

      // Build tool replacements index inline (TOOL items with 'sub' field)
      if (obj.type === "TOOL" && obj.sub) {
        if (!this._toolReplacements.has(obj.sub))
          this._toolReplacements.set(obj.sub, []);
        this._toolReplacements.get(obj.sub)!.push(obj.id);
      }
    }
    this._byTypeById
      .get("item_group")
      ?.set("EMPTY_GROUP", { id: "EMPTY_GROUP", entries: [] });
    this._indexMonsterVisibilityPolicy();
    this._indexDissectionSources();
    p.finish();
  }

  _collectStringArrayValues(
    obj: Record<string, unknown>,
    key: string,
  ): string[] {
    const value = obj[key];
    if (!Array.isArray(value)) return [];
    return value.filter((x): x is string => typeof x === "string");
  }

  _resolveMonstersFromGroup(
    groupId: string,
    cache: Map<string, Set<string>>,
    stack: Set<string> = new Set(),
  ): Set<string> {
    const cached = cache.get(groupId);
    if (cached) return cached;
    if (stack.has(groupId)) return new Set();
    stack.add(groupId);

    const result = new Set<string>();
    const group = this.byIdMaybe("monstergroup", groupId) as
      | (MonsterGroup & { __filename: string })
      | undefined;

    if (group) {
      if (typeof group.default === "string") result.add(group.default);
      for (const entry of group.monsters ?? []) {
        if (typeof entry.monster === "string") result.add(entry.monster);
        if (typeof entry.group === "string") {
          for (const member of this._resolveMonstersFromGroup(
            entry.group,
            cache,
            stack,
          )) {
            result.add(member);
          }
        }
      }
    }

    stack.delete(groupId);
    cache.set(groupId, result);
    return result;
  }

  /**
   * Indexes `MONSTER_BLACKLIST` and `MONSTER_WHITELIST` objects to compute
   * a final visibility map for all monsters.
   *
   * Logic:
   * 1. Collects all explicit IDs, Species, and Categories from policy objects.
   * 2. Resolves monster groups to individual monster IDs.
   * 3. Iterates over all monsters and determines visibility based on:
   *    - WHITELIST (if present): defaults to visible unless EXCLUSIVE mode.
   *    - BLACKLIST: overrides default visibility.
   *
   * This is called once during data construction.
   *
   * @internal
   */
  _indexMonsterVisibilityPolicy(): void {
    const allMonsterRows = this._byType.get("monster") ?? [];
    if (allMonsterRows.length === 0) return;

    const monsters: Monster[] = allMonsterRows
      .map((raw) => this._flatten(raw) as Monster)
      .filter((monster) => typeof monster.id === "string");
    if (monsters.length === 0) return;

    const blacklists = this._byType.get("MONSTER_BLACKLIST") ?? [];
    const whitelists = this._byType.get("MONSTER_WHITELIST") ?? [];

    const explicitBlacklisted = new Set<string>();
    const blacklistedSpecies = new Set<string>();
    const blacklistedCategories = new Set<string>();

    const explicitWhitelisted = new Set<string>();
    const whitelistedSpecies = new Set<string>();
    const whitelistedCategories = new Set<string>();

    let hasExclusiveWhitelist = false;

    for (const raw of blacklists) {
      if (typeof raw !== "object" || raw === null) continue;
      const policy = raw as Record<string, unknown>;
      for (const id of this._collectStringArrayValues(policy, "monsters")) {
        explicitBlacklisted.add(id);
      }
      for (const species of this._collectStringArrayValues(policy, "species")) {
        blacklistedSpecies.add(species);
      }
      for (const category of this._collectStringArrayValues(
        policy,
        "categories",
      )) {
        blacklistedCategories.add(category);
      }
    }

    for (const raw of whitelists) {
      if (typeof raw !== "object" || raw === null) continue;
      const policy = raw as Record<string, unknown>;
      if (typeof policy.mode === "string" && policy.mode === "EXCLUSIVE") {
        hasExclusiveWhitelist = true;
      }
      for (const id of this._collectStringArrayValues(policy, "monsters")) {
        explicitWhitelisted.add(id);
      }
      for (const species of this._collectStringArrayValues(policy, "species")) {
        whitelistedSpecies.add(species);
      }
      for (const category of this._collectStringArrayValues(
        policy,
        "categories",
      )) {
        whitelistedCategories.add(category);
      }
    }

    const groupCache = new Map<string, Set<string>>();
    const blacklistedViaGroups = new Set<string>();
    const whitelistedViaGroups = new Set<string>();
    const monsterGroupIds = this._byTypeById.get("monstergroup");

    for (const category of blacklistedCategories) {
      if (!monsterGroupIds?.has(category)) continue;
      for (const id of this._resolveMonstersFromGroup(category, groupCache)) {
        blacklistedViaGroups.add(id);
      }
    }
    for (const category of whitelistedCategories) {
      if (!monsterGroupIds?.has(category)) continue;
      for (const id of this._resolveMonstersFromGroup(category, groupCache)) {
        whitelistedViaGroups.add(id);
      }
    }

    for (const monster of monsters) {
      const monsterCategories = new Set(asArray(monster.categories));
      const monsterSpecies = new Set(asArray(monster.species));

      const isWhitelisted =
        explicitWhitelisted.has(monster.id) ||
        whitelistedViaGroups.has(monster.id) ||
        [...monsterSpecies].some((species) =>
          whitelistedSpecies.has(species),
        ) ||
        [...monsterCategories].some((category) =>
          whitelistedCategories.has(category),
        );

      const isBlacklisted =
        explicitBlacklisted.has(monster.id) ||
        blacklistedViaGroups.has(monster.id) ||
        [...monsterSpecies].some((species) =>
          blacklistedSpecies.has(species),
        ) ||
        [...monsterCategories].some((category) =>
          blacklistedCategories.has(category),
        );

      const isVisible = hasExclusiveWhitelist
        ? isWhitelisted
        : isWhitelisted || !isBlacklisted;
      this._monsterVisibilityById.set(monster.id, isVisible);
    }
  }

  /**
   * Checks if a monster ID is visible according to the loaded policy.
   *
   * @param id The monster ID to check.
   * @returns true if visible (default), false if blacklisted/not whitelisted.
   */
  isMonsterVisible(id: string): boolean {
    if (typeof id !== "string") return false;
    const visible = this._monsterVisibilityById.get(id);
    return visible ?? true;
  }

  /** @internal */
  _indexDissectionSources(): void {
    const monsters = this.byType("monster");
    for (const monster of monsters) {
      if (!monster.harvest) continue;
      const harvest = this.byIdMaybe("harvest", monster.harvest);
      if (!harvest || !harvest.entries) continue;

      for (const entry of harvest.entries) {
        if (
          entry.type === "bionic" ||
          entry.type === "bionic_group" ||
          entry.type === "bionic_faulty"
        ) {
          let dropIds: string[];
          if (entry.type === "bionic_group") {
            const group = this.byIdMaybe("item_group", entry.drop);
            if (!group) continue;
            dropIds = this.flattenTopLevelItemGroup(group).map((x) => x.id);
          } else {
            dropIds = [entry.drop];
          }

          for (const dropId of dropIds) {
            let sources = this._dissectionSources.get(dropId);
            if (!sources) {
              sources = [];
              this._dissectionSources.set(dropId, sources);
            }
            sources.push({
              monster,
              harvest,
              entry,
            });
          }
        }
      }
    }
  }

  /**
   * Returns a list of monsters that provide the given item (or group) via dissection.
   *
   * @param id The item ID or item group ID to search for.
   * @returns A list of dissection sources.
   */
  getDissectionSources(id: string): DissectionSource[] {
    return this._dissectionSources.get(id) ?? [];
  }

  /**
   * Retrieves an object by type and ID, resolving inheritance.
   * Returns undefined if the object is not found.
   *
   * @param type The type of the object (e.g., 'item', 'monster').
   * @param id The ID of the object.
   * @returns The flattened object or undefined.
   */
  byIdMaybe<TypeName extends keyof SupportedTypesWithMapped>(
    type: TypeName,
    id: string,
  ): (SupportedTypesWithMapped[TypeName] & { __filename: string }) | undefined {
    if (typeof id !== "string") {
      throw new Error(
        `Requested non-string id. Current id is of type: ${typeof id}`,
      );
    }
    const byId = this._byTypeById.get(type);
    if (type === "item" && !byId?.has(id) && this._migrations.has(id))
      return this.byIdMaybe(type, this._migrations.get(id)!);
    const obj = byId?.get(id);
    if (obj) {
      const flattened = this._flatten(
        obj,
      ) as SupportedTypesWithMapped[TypeName];
      if (type === "monster") {
        const canonicalId =
          typeof (flattened as { id?: unknown }).id === "string"
            ? ((flattened as { id: string }).id as string)
            : id;
        if (!this.isMonsterVisible(canonicalId)) return undefined;
      }
      return flattened as SupportedTypesWithMapped[TypeName] & {
        __filename: string;
      };
    }
  }

  /**
   * Retrieves an object by type and ID, resolving inheritance.
   * Throws an error if the object is not found.
   *
   * @param type The type of the object.
   * @param id The ID of the object.
   * @returns The flattened object.
   * @throws {Error} If the object is not found.
   */
  byId<TypeName extends keyof SupportedTypesWithMapped>(
    type: TypeName,
    id: string,
  ): SupportedTypesWithMapped[TypeName] & { __filename: string } {
    const ret = this.byIdMaybe(type, id);
    if (!ret)
      throw new Error('unknown object "' + id + '" of type "' + type + '"');
    return ret;
  }

  /**
   * Retrieves all objects of a given type.
   * For keyed object families, mod overrides are collapsed so each canonical key
   * appears once (later entries win, stable order preserved).
   *
   * @param type The type of objects to retrieve.
   * @returns An array of flattened objects.
   */
  byType<TypeName extends keyof SupportedTypesWithMapped>(
    type: TypeName,
  ): SupportedTypesWithMapped[TypeName][] {
    const raws = this._byType.get(type) ?? [];
    const canonicalRaws: unknown[] = [];
    const keyedIndex = new Map<string, number>();

    for (const raw of raws) {
      const key = this._provenanceKeyForObject(type, raw);
      if (key == null) {
        canonicalRaws.push(raw);
        continue;
      }

      const existingIndex = keyedIndex.get(key);
      if (existingIndex == null) {
        keyedIndex.set(key, canonicalRaws.length);
        canonicalRaws.push(raw);
      } else {
        // Keep stable order but replace earlier entry with later override.
        canonicalRaws[existingIndex] = raw;
      }
    }

    const flattened = canonicalRaws.map((x) =>
      this._flatten(x),
    ) as SupportedTypesWithMapped[TypeName][];
    if (type !== "monster") return flattened;
    return flattened.filter(
      (monster) =>
        typeof (monster as { id?: unknown }).id === "string" &&
        this.isMonsterVisible((monster as { id: string }).id),
    );
  }

  abstractById<TypeName extends keyof SupportedTypesWithMapped>(
    type: TypeName,
    id: string,
  ): object | undefined /* abstracts don't have ids, for instance */ {
    if (typeof id !== "string") throw new Error("Requested non-string id");
    const obj = this._abstractsByType.get(type)?.get(id);
    if (obj) return this._flatten(obj);
  }

  replacementTools(type: string): string[] {
    if (!this._toolReplacements) {
      const p = perf.mark("CBNData.replacementTools.build");
      this._toolReplacements = new Map();
      for (const obj of this.byType("item")) {
        if (
          obj.type === "TOOL" &&
          Object.hasOwnProperty.call(obj, "sub") &&
          obj.sub
        ) {
          if (!this._toolReplacements.has(obj.sub))
            this._toolReplacements.set(obj.sub, []);
          this._toolReplacements.get(obj.sub)!.push(obj.id);
        }
      }
      p.finish();
    }
    return this._toolReplacements.get(type) ?? [];
  }

  craftingPseudoItem(id: string): string | undefined {
    return this._craftingPseudoItems.get(id);
  }

  nestedMapgensById(id: string): Mapgen[] | undefined {
    return this._nestedMapgensById.get(id);
  }

  all(): SupportedTypeMapped[] {
    return this._raw;
  }

  allMods() {
    return this._rawModsJSON;
  }

  activeMods() {
    return this._activeMods;
  }

  buildVersion(): string {
    return this._buildVersion;
  }

  locale(): string {
    return this._locale;
  }

  fetchVersion(): string {
    return this._fetchVersion;
  }

  /**
   * Builds the canonical provenance key for a raw object in a mapped type family.
   *
   * Important:
   * - `recipe` / `uncraft` are keyed by `result + optional id_suffix`.
   * - `monstergroup` is keyed by `name`.
   * - other families use `id`, falling back to `abstract`.
   *
   * This aligns provenance lookups with the same key strategy used by `_byTypeById`
   * for non-`id` keyed object families.
   */
  _provenanceKeyForObject(
    mappedType: keyof SupportedTypesWithMapped,
    obj: unknown,
  ): string | null {
    if (typeof obj !== "object" || obj === null) return null;
    const raw = obj as Record<string, unknown>;

    if (mappedType === "recipe" || mappedType === "uncraft") {
      if (typeof raw.result === "string") {
        return `${raw.result}${
          typeof raw.id_suffix === "string" ? `_${raw.id_suffix}` : ""
        }`;
      }
      return typeof raw.abstract === "string" ? raw.abstract : null;
    }

    if (mappedType === "monstergroup") {
      return typeof raw.name === "string"
        ? raw.name
        : typeof raw.id === "string"
          ? raw.id
          : typeof raw.abstract === "string"
            ? raw.abstract
            : null;
    }

    if (typeof raw.id === "string") return raw.id;
    if (typeof raw.abstract === "string") return raw.abstract;
    return null;
  }

  /**
   * Returns the current raw object for a mapped type + provenance key.
   * Supports both concrete keyed objects and abstract templates.
   * Handles item migrations if the key is missing from the main maps.
   *
   * ARCHITECTURE: Follows ADR-005 (Robust inheritance: Migrations and Self-Copy Handling)
   * traversal of migration maps.
   *
   * @param mappedType Mapped type family to search in.
   * @param key Provenance key (identifier or abstract).
   * @returns The raw game object or null if entries are missing.
   */
  _objectForProvenanceKey(
    mappedType: keyof SupportedTypesWithMapped,
    key: string,
  ): Record<string, unknown> | null {
    // Follow item migrations to the final ID
    if (
      mappedType === "item" &&
      !this._byTypeById.get("item")?.has(key) &&
      this._migrations.has(key)
    ) {
      return this._objectForProvenanceKey("item", this._migrations.get(key)!);
    }

    return (
      this._byTypeById.get(mappedType)?.get(key) ??
      this._abstractsByType.get(mappedType)?.get(key) ??
      null
    );
  }

  /**
   * ARCHITECTURE: ADR-005 (Robust inheritance: Migrations and Self-Copy Handling).
   * Resolves the parent object for a given object, specifically handling
   * "self-copy" overrides by looking up the previous version in the override stack.
   */
  _resolveCopyFromParent(obj: any): any | null {
    if (!("copy-from" in obj)) return null;

    const parentId = obj["copy-from"];
    const mappedType = mapType(obj.type);
    let parent = this._objectForProvenanceKey(mappedType, parentId);

    // For "self-looking" copy-from patterns in layered mod overrides, use the
    // previous object for this id instead of resolving to self.
    if (
      typeof obj.id === "string" &&
      typeof parentId === "string" &&
      obj.id === parentId &&
      this._overrides.has(obj)
    ) {
      parent = this._overrides.get(obj);
    } else if (
      typeof obj.abstract === "string" &&
      typeof parentId === "string" &&
      obj.abstract === parentId &&
      this._overrides.has(obj)
    ) {
      // For abstract self-copies in layered mod overrides, use the previous object
      parent = this._overrides.get(obj);
    } else if (parent === obj && this._overrides.has(obj)) {
      parent = this._overrides.get(obj);
    }

    return parent;
  }

  /**
   * Resolves a single inherited field by walking the `copy-from` chain until a
   * concrete value is found.
   *
   * Returns `undefined` when the field is absent across the full inheritance
   * chain or when a cycle is encountered.
   */
  resolveOne(obj: any, key: string): any {
    let current = obj;
    const visited = new Set<any>();
    while (current) {
      if (visited.has(current)) {
        console.warn("Cycle detected while resolving inherited field:", key);
        break;
      }
      visited.add(current);
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        return current[key];
      }
      current = this._resolveCopyFromParent(current);
    }
    return undefined;
  }

  /**
   * Internal method to flatten an object by resolving its 'copy-from' inheritance.
   * Applies relative, proportional, extend, and delete modifiers.
   * Caches the result.
   *
   * ARCHITECTURE: Leverages top-down unfurling for performance (see ADR-003 and ADR-004)
   *
   * @param _obj The raw object to flatten.
   * @param stack Recursion stack for inheritance cycle detection.
   * @returns The flattened object.
   */
  _flatten<T = any>(_obj: T, stack: Set<any> = new Set()): T {
    const obj: any = _obj;
    if (this._flattenCache.has(obj)) {
      return this._flattenCache.get(obj);
    }

    if (stack.has(obj)) {
      console.warn("Cycle detected in copy-from inheritance:", obj);
      return obj;
    }
    stack.add(obj);

    const parent = this._resolveCopyFromParent(obj);
    if ("copy-from" in obj && !parent)
      console.warn(
        `Missing parent in ${
          obj.id ?? obj.abstract ?? obj.result ?? JSON.stringify(obj)
        }`,
      );
    if (parent === obj) {
      // Working around bad data upstream, see: https://github.com/CleverRaven/Cataclysm-DDA/pull/53930
      console.warn("Object copied from itself:", obj);
      this._flattenCache.set(obj, obj);
      stack.delete(obj);
      return obj;
    }
    if (!parent) {
      this._flattenCache.set(obj, obj);
      stack.delete(obj);
      return obj;
    }
    const { abstract, ...parentProps } = this._flatten(parent, stack);
    stack.delete(obj);
    const ret = { ...parentProps, ...obj };
    if (parentProps.vitamins && obj.vitamins) {
      ret.vitamins = [
        ...parentProps.vitamins.filter(
          (x: any) => !obj.vitamins.some((y: any) => y[0] === x[0]),
        ),
        ...obj.vitamins,
      ];
    }
    if (obj.type === "vehicle" && parentProps.parts && obj.parts) {
      ret.parts = [...parentProps.parts, ...obj.parts];
    }
    for (const k of Object.keys(ret.relative ?? {})) {
      if (typeof ret.relative[k] === "number") {
        if (k === "weight") {
          ret[k] = (parseMass(ret[k]) ?? 0) + ret.relative[k];
        } else if (k === "volume") {
          ret[k] = (parseVolume(ret[k]) ?? 0) + ret.relative[k];
        } else {
          ret[k] = (ret[k] ?? 0) + ret.relative[k];
        }
      } else if (
        (k === "damage" || k === "ranged_damage") &&
        ret[k] &&
        isDamageInstanceLike(ret[k]) &&
        isDamageInstanceLike(ret.relative[k])
      ) {
        // See docs/copy-from-modifiers.md for which fields support this
        ret[k] = applyRelativeDamageInstance(ret[k], ret.relative[k]);
      } else if (k === "armor" && ret.type === "MONSTER" && ret[k]) {
        ret[k] = { ...ret[k] };
        for (const k2 of Object.keys(ret.relative[k])) {
          ret[k][k2] = (ret[k][k2] ?? 0) + ret.relative[k][k2];
        }
      } else if (k === "qualities") {
        ret[k] = cloneQualities(ret[k]);
        for (const [q, l] of ret.relative[k]) {
          const existing = ret[k].find((x: any) => x[0] === q);
          existing[1] += l;
        }
      }
      // TODO: vitamins, mass, volume, time
    }
    delete ret.relative;
    for (const k of Object.keys(ret.proportional ?? {})) {
      if (typeof ret.proportional[k] === "number") {
        if (k === "attack_cost" && !(k in ret)) ret[k] = 100;
        if (typeof ret[k] === "string") {
          const m = /^\s*(\d+)\s*(.+)$/.exec(ret[k]);
          if (m) {
            const [, num, unit] = m;
            ret[k] = `${Number(num) * ret.proportional[k]} ${unit}`;
          }
        } else {
          ret[k] *= ret.proportional[k];
          ret[k] = ret[k] | 0; // most things are ints.. TODO: what keys are float?
        }
      } else if (
        (k === "damage" || k === "ranged_damage") &&
        ret[k] &&
        isDamageInstanceLike(ret[k]) &&
        isDamageInstanceLike(ret.proportional[k])
      ) {
        // See docs/copy-from-modifiers.md for which fields support this
        ret[k] = applyProportionalDamageInstance(ret[k], ret.proportional[k]);
      } else if (k === "armor" && ret.type === "MONSTER" && ret[k]) {
        ret[k] = { ...ret[k] };
        for (const k2 of Object.keys(ret.proportional[k])) {
          ret[k][k2] *= ret.proportional[k][k2];
          ret[k][k2] = ret[k][k2] | 0; // most things are ints.. TODO: what keys are float?
        }
      }
      // TODO: mass, volume, time (need to check the base value's type)
    }
    delete ret.proportional;
    for (const k of Object.keys(ret.extend ?? {})) {
      if (Array.isArray(ret.extend[k])) {
        if (k === "flags")
          // Unique
          ret[k] = (ret[k] ?? []).concat(
            ret.extend[k].filter((x: any) => !ret[k]?.includes(x)),
          );
        else ret[k] = (ret[k] ?? []).concat(ret.extend[k]);
      }
    }
    delete ret.extend;
    for (const k of Object.keys(ret.delete ?? {})) {
      if (Array.isArray(ret.delete[k])) {
        // Some 'delete' entries delete qualities, which are arrays. As a rough
        // heuristic, compare recursively.
        const isEqual = (x: any, y: any): boolean =>
          x === y ||
          (Array.isArray(x) &&
            Array.isArray(y) &&
            x.length === y.length &&
            x.every((j, i) => isEqual(j, y[i])));
        ret[k] = (ret[k] ?? []).filter(
          (x: any) => !ret.delete[k].some((y: any) => isEqual(y, x)),
        );
      } else {
        // For non-array properties (like objects), delete the entire property
        delete ret[k];
      }
    }
    delete ret.delete;
    this._flattenCache.set(obj, ret);
    return ret;
  }

  _cachedDeathDrops: Map<string, Loot> = new Map();
  flatDeathDrops(mon_id: string): Loot {
    if (this._cachedDeathDrops.has(mon_id))
      return this._cachedDeathDrops.get(mon_id)!;
    const mon = this.byId("monster", mon_id);
    const ret = mon.death_drops
      ? this.flattenItemGroupLoot(
          this.normalizeItemGroup(mon.death_drops, "distribution") ?? {
            subtype: "collection",
            entries: [],
          },
        )
      : new Map();
    this._cachedDeathDrops.set(mon_id, ret);
    return ret;
  }

  _cachedUncraftRecipes: Map<string, Recipe> | null = null;
  uncraftRecipe(item_id: string): Recipe | undefined {
    if (!this._cachedUncraftRecipes) {
      this._cachedUncraftRecipes = new Map();
      for (const recipe of this.byType("recipe"))
        if (recipe.result && recipe.reversible)
          this._cachedUncraftRecipes.set(recipe.result, recipe);
      for (const recipe of this.byType("uncraft"))
        if (recipe.result)
          this._cachedUncraftRecipes.set(recipe.result, recipe);
    }
    return this._cachedUncraftRecipes.get(item_id);
  }

  // Top-level item groups can have the "old" subtype (which is the default if
  // no other subtype is specified).
  _convertedTopLevelItemGroups = new Map<ItemGroup, ItemGroupData>();
  convertTopLevelItemGroup(group: ItemGroup): ItemGroupData {
    if (group.subtype === "distribution" || group.subtype === "collection") {
      return group;
    } else if (
      !("subtype" in group) ||
      !group.subtype ||
      group.subtype === "old"
    ) {
      if (this._convertedTopLevelItemGroups.has(group))
        return this._convertedTopLevelItemGroups.get(group)!;
      // Convert old-style item groups to new-style
      const normalizedEntries: ItemGroupEntry[] = [];
      for (const item of group.items ?? [])
        if (Array.isArray(item))
          normalizedEntries.push({ item: item[0], prob: item[1] });
        else normalizedEntries.push(item);
      const ret: ItemGroupData = {
        subtype: "distribution",
        entries: normalizedEntries,
      };
      this._convertedTopLevelItemGroups.set(group, ret);
      return ret;
    } else throw new Error("unknown item group subtype: " + group.subtype);
  }

  flattenTopLevelItemGroup(group: ItemGroup) {
    return this.flattenItemGroup(this.convertTopLevelItemGroup(group));
  }

  // This is a WeakMap because flattenItemGroup is sometimes called with temporary objects
  _flattenItemGroupCache = new WeakMap<
    ItemGroupData,
    { id: string; prob: number; expected: number; count: [number, number] }[]
  >();
  /**
   * In the result, each |id| will be spawned with probability |prob|. If the item
   * is spawned, it will be spawned between |count[0]| and |count[1]| times.
   */
  flattenItemGroup(
    group: ItemGroupData,
  ): { id: string; prob: number; expected: number; count: [number, number] }[] {
    if (this._flattenItemGroupCache.has(group))
      return this._flattenItemGroupCache.get(group)!;
    const p = perf.mark(`CBNData.flattenItemGroup`, true);
    const retMap = new Map<
      string,
      { prob: number; expected: number; count: [number, number] }
    >();

    function addOne({
      id,
      prob,
      count,
    }: {
      id: string;
      prob: number;
      count: [number, number];
    }) {
      if (id === "null") return;
      const {
        prob: prevProb,
        count: prevCount,
        expected: prevExpected,
      } = retMap.get(id) ?? {
        prob: 0,
        count: [0, 0],
        expected: 0,
      };
      const newProb = 1 - (1 - prevProb) * (1 - prob);

      const newCount: [number, number] = [
        count[0] + prevCount[0],
        count[1] + prevCount[1],
      ];

      const newExpected = prevExpected + (prob * (count[0] + count[1])) / 2;

      retMap.set(id, { prob: newProb, expected: newExpected, count: newCount });
    }

    function add(
      ...args: { id: string; prob: number; count: [number, number] }[]
    ) {
      args.forEach(addOne);
    }

    function normalizeContainerItem(id: string | { item: string }) {
      return typeof id === "string" ? id : id.item;
    }
    if ("container-item" in group && group["container-item"])
      add({
        id: normalizeContainerItem(group["container-item"]),
        prob: 1,
        count: [1, 1],
      });

    let normalizedEntries: ItemGroupEntry[] = [];
    for (const entry of "entries" in group && group.entries
      ? group.entries
      : [])
      if (Array.isArray(entry))
        normalizedEntries.push({ item: entry[0], prob: entry[1] });
      else normalizedEntries.push(entry);
    for (const item of group.items ?? [])
      if (Array.isArray(item))
        normalizedEntries.push({ item: item[0], prob: item[1] });
      else if (typeof item === "string")
        normalizedEntries.push({ item, prob: 100 });
      else normalizedEntries.push(item);
    for (const g of "groups" in group && group.groups ? group.groups : [])
      if (Array.isArray(g)) normalizedEntries.push({ group: g[0], prob: g[1] });
      else if (typeof g === "string")
        normalizedEntries.push({ group: g, prob: 100 });
      else normalizedEntries.push(g);
    normalizedEntries = normalizedEntries.filter(
      (e) => !("event" in e) || !e.event,
    );

    function prod(
      p: { id: string; prob: number; count: [number, number] },
      prob: number,
      count: [number, number],
    ): { id: string; prob: number; count: [number, number] } {
      return {
        id: p.id,
        prob: p.prob * prob,
        count: [p.count[0] * count[0], p.count[1] * count[1]],
      };
    }

    const data = this;
    function normalizeCount(entry: ItemGroupEntry): [number, number] {
      if (entry.count)
        if (typeof entry.count === "number") return [entry.count, entry.count];
        else return entry.count;
      else if (
        "item" in entry &&
        entry.charges &&
        countsByCharges(data.byId("item", entry.item))
      )
        if (typeof entry.charges === "number")
          return [entry.charges, entry.charges];
        else return entry.charges;
      return [1, 1];
    }

    if (group.subtype === "collection") {
      for (const entry of normalizedEntries) {
        const { prob = 100 } = entry;
        const nProb = Math.min(prob, 100) / 100;
        const nCount = normalizeCount(entry);
        for (const subrefItem of [
          "container-item",
          "ammo-item",
          "contents-item",
        ] as const) {
          const ids = entry[subrefItem];
          if (ids)
            for (const id of [ids].flat())
              add({
                id: normalizeContainerItem(id),
                prob: nProb,
                count: [1, 1],
              });
        }
        for (const subrefGroup of [
          "container-group",
          "ammo-group",
          "contents-group",
        ] as const) {
          const ids = entry[subrefGroup];
          if (ids)
            for (const id of [ids].flat())
              add(
                ...this.flattenTopLevelItemGroup(
                  this.byId("item_group", id),
                ).map((p) => prod(p, nProb, nCount)),
              );
        }
        if ("item" in entry) {
          add({ id: entry.item, prob: nProb, count: nCount });
          const item = this.byIdMaybe("item", entry.item);
          if (item && item.container)
            add({
              id: item.container,
              prob: nProb,
              count: countsByCharges(item) ? [1, 1] : nCount,
            });
        } else if ("group" in entry) {
          add(
            ...this.flattenTopLevelItemGroup(
              this.byId("item_group", entry.group),
            ).map((p) => prod(p, nProb, nCount)),
          );
        } else if ("collection" in entry) {
          add(
            ...this.flattenItemGroup({
              subtype: "collection",
              entries: entry.collection,
            }).map((p) => prod(p, nProb, nCount)),
          );
        } else if ("distribution" in entry) {
          add(
            ...this.flattenItemGroup({
              subtype: "distribution",
              entries: entry.distribution,
            }).map((p) => prod(p, nProb, nCount)),
          );
        } else {
          console.warn(`unknown item group entry: ${JSON.stringify(entry)}`);
        }
      }
    } else {
      // distribution
      let totalProb = 0;
      for (const entry of normalizedEntries) totalProb += entry.prob ?? 100;
      for (const entry of normalizedEntries) {
        const nProb = (entry.prob ?? 100) / totalProb;
        const nCount = normalizeCount(entry);
        for (const subrefItem of [
          "container-item",
          "ammo-item",
          "contents-item",
        ] as const) {
          const ids = entry[subrefItem];
          if (ids)
            for (const id of [ids].flat())
              add({
                id: normalizeContainerItem(id),
                prob: nProb,
                count: [1, 1],
              });
        }
        for (const subrefGroup of [
          "container-group",
          "ammo-group",
          "contents-group",
        ] as const) {
          const ids = entry[subrefGroup];
          if (ids)
            for (const id of [ids].flat())
              add(
                ...this.flattenTopLevelItemGroup(
                  this.byId("item_group", id),
                ).map((p) => prod(p, nProb, nCount)),
              );
        }
        if ("item" in entry) {
          add({ id: entry.item, prob: nProb, count: nCount });
        } else if ("group" in entry) {
          add(
            ...this.flattenTopLevelItemGroup(
              this.byId("item_group", entry.group),
            ).map((p) => prod(p, nProb, nCount)),
          );
        } else if ("collection" in entry) {
          add(
            ...this.flattenItemGroup({
              subtype: "collection",
              entries: entry.collection,
            }).map((p) => prod(p, nProb, nCount)),
          );
        } else if ("distribution" in entry) {
          add(
            ...this.flattenItemGroup({
              subtype: "distribution",
              entries: entry.distribution,
            }).map((p) => prod(p, nProb, nCount)),
          );
        } else {
          console.warn(`unknown item group entry: ${JSON.stringify(entry)}`);
        }
      }
    }

    const r = [...retMap.entries()].map(([id, v]) => ({ id, ...v }));
    this._flattenItemGroupCache.set(group, r);
    p.finish();
    return r;
  }

  flattenItemGroupLoot(group: ItemGroupData): Loot {
    return new Map(
      this.flattenItemGroup(group).map(({ id, prob, expected }) => [
        id,
        { prob, expected },
      ]),
    );
  }

  _flatRequirementCache = new WeakMap<any, { id: string; count: number }[][]>();
  _flatRequirementCacheExpandSubs = new WeakMap<
    any,
    { id: string; count: number }[][]
  >();
  _flatRequirementCacheOnlyRecoverable = new WeakMap<
    any,
    { id: string; count: number }[][]
  >();
  _flatRequirementCacheForOpts(opts?: {
    expandSubstitutes?: boolean;
    onlyRecoverable?: boolean;
  }): WeakMap<any, { id: string; count: number }[][]> {
    if (opts?.expandSubstitutes && opts?.onlyRecoverable)
      throw new Error(
        "didn't expect to see expandSubstitutes && onlyRecoverable",
      );
    if (opts?.expandSubstitutes) return this._flatRequirementCacheExpandSubs;
    if (opts?.onlyRecoverable) return this._flatRequirementCacheOnlyRecoverable;
    return this._flatRequirementCache;
  }
  flattenRequirement<T>(
    required: (T | T[])[],
    get: (x: Requirement) => (T | T[])[] | undefined,
    opts?: { expandSubstitutes?: boolean; onlyRecoverable?: boolean },
  ): { id: string; count: number }[][] {
    const cache = this._flatRequirementCacheForOpts(opts);
    if (cache.has(required)) return cache.get(required)!;
    const {
      expandSubstitutes: doExpandSubstitutes = false,
      onlyRecoverable = false,
    } = opts ?? {};
    const maybeExpandSubstitutes: (
      x: { id: string; count: number }[],
    ) => { id: string; count: number }[] = doExpandSubstitutes
      ? (x) => x.flatMap((y) => expandSubstitutes(this, y))
      : (x) => x;
    const ret = normalize(required)
      .map((x) =>
        maybeExpandSubstitutes(
          flattenChoices(
            this,
            x,
            (q) => normalize(get(q) ?? []),
            onlyRecoverable,
          ),
        ),
      )
      .map((x) =>
        onlyRecoverable
          ? x.filter(
              (c) =>
                !(this.byId("item", c.id).flags ?? []).includes(
                  "UNRECOVERABLE",
                ),
            )
          : x,
      )
      .filter((x) => x.length);
    cache.set(required, ret);
    return ret;
  }

  _normalizeRequirementsCache = new Map<
    RequirementData & { using?: Recipe["using"] },
    ReturnType<typeof this.normalizeRequirementsForDisassembly>
  >();
  normalizeRequirementsForDisassembly(
    requirement: RequirementData & { using?: Recipe["using"] },
  ): {
    tools: [string, number][][];
    qualities: QualityRequirement[][];
    components: [string, number][][];
  } {
    if (this._normalizeRequirementsCache.has(requirement))
      return this._normalizeRequirementsCache.get(requirement)!;
    const p = perf.mark(`CBNData.normalizeRequirementsForDisassembly`, true);
    const { tools, qualities, components } = this.normalizeRequirements(
      requirement,
      { onlyRecoverable: true },
    );
    let removeFire = false;
    const newQualities: typeof qualities = [];
    for (const toolOpts of tools) {
      for (const [toolId, _count] of toolOpts) {
        if (
          [
            "welder",
            "welder_crude",
            "oxy_torch",
            "forge",
            "char_forge",
          ].includes(toolId)
        ) {
          toolOpts.length = 0;
          newQualities.push([{ id: "SAW_M_FINE", level: 1 }]);
          break;
        }
        if (["sewing_kit", "mold_plastic"].includes(toolId)) {
          toolOpts.length = 0;
          newQualities.push([{ id: "CUT", level: 1 }]);
          break;
        }
        if (toolId === "crucible") {
          toolOpts.length = 0;
          break;
        }
        if (toolId === "press") {
          toolOpts.length = 0;
          removeFire = true;
          newQualities.push([{ id: "PULL", level: 1 }]);
          break;
        }
        if (toolId === "fire" && removeFire) {
          toolOpts.length = 0;
          break;
        }
      }
    }
    const filteredTools = tools.filter((t) => t.length);

    for (const qualityOpts of qualities) {
      for (const quality of qualityOpts) {
        if (quality.id === "SEW") {
          newQualities.push([{ id: "CUT", level: quality.level }]);
          qualityOpts.length = 0;
          break;
        }
        if (quality.id === "GLARE" || quality.id === "KNIT") {
          qualityOpts.length = 0;
          break;
        }
      }
    }
    const filteredQualities = qualities.filter((t) => t.length);

    const finalQualities = filteredQualities.concat(
      newQualities.filter(
        (q) => !filteredQualities.some((q2) => q2[0].id === q[0].id),
      ),
    );

    const filteredComponents = components
      .map((c) =>
        c.filter(
          (c) => !this.byId("item", c[0])?.flags?.includes("UNRECOVERABLE"),
        ),
      )
      .filter((c) => c.length);

    const ret = {
      tools: filteredTools,
      qualities: finalQualities,
      components: filteredComponents,
    };

    this._normalizeRequirementsCache.set(requirement, ret);
    p.finish();

    return ret;
  }

  normalizeRequirementUsing(
    requirements: (readonly [RequirementData, number])[],
    opts?: { onlyRecoverable?: boolean },
  ): {
    components: [string, number][][];
    qualities: QualityRequirement[][];
    tools: [string, number][][];
  } {
    const tools = requirements.flatMap(([req, count]) =>
      this.flattenRequirement(req.tools ?? [], (x) => x.tools, {
        expandSubstitutes: true,
      }).map((x) => x.map((x) => [x.id, x.count * count] as [string, number])),
    );
    const qualities = requirements.flatMap(([req, _count]) =>
      (req.qualities ?? []).map((x) => asArray(x)),
    );
    const components = requirements.flatMap(([req, count]) =>
      this.flattenRequirement(
        req.components ?? [],
        (x) => x.components,
        opts,
      ).map((x) => x.map((x) => [x.id, x.count * count] as [string, number])),
    );
    return { tools, qualities, components };
  }

  normalizeRequirements(
    requirement: RequirementData & { using?: Recipe["using"] },
    opts?: { onlyRecoverable?: boolean },
  ) {
    const using =
      typeof requirement.using === "string"
        ? ([[requirement.using, 1]] as const)
        : requirement.using;

    const requirements = (using ?? [])
      .map(
        ([id, count]) =>
          [
            this.byIdMaybe("requirement", id) as RequirementData,
            count as number,
          ] as const,
      )
      .filter((x) => x[0])
      .concat([[requirement, 1] as const])
      .filter((x) => x[0]); // NB. to cope with some data errors in obsolete parts

    return this.normalizeRequirementUsing(requirements, opts);
  }

  _itemComponentCache: {
    byTool: Map<string, Set<string>>;
    byComponent: Map<string, Set<string>>;
  } | null = null;
  getItemComponents() {
    if (this._itemComponentCache) return this._itemComponentCache;
    const p = perf.mark("CBNData.getItemComponents");
    const itemsByTool = new Map<string, Set<string>>();
    const itemsByComponent = new Map<string, Set<string>>();

    this.byType("recipe").forEach((recipe) => {
      if (!recipe.result || !this.byIdMaybe("item", recipe.result))
        return false;
      const using =
        typeof recipe.using === "string"
          ? ([[recipe.using, 1]] as const)
          : recipe.using;

      const requirements = (using ?? [])
        .map(
          ([id, count]) =>
            [
              this.byId("requirement", id) as RequirementData,
              count as number,
            ] as const,
        )
        .concat([[recipe, 1] as const]);
      const tools = requirements.flatMap(([req]) =>
        this.flattenRequirement(req.tools ?? [], (x) => x.tools),
      );
      for (const toolOptions of tools)
        for (const tool of toolOptions) {
          if (!itemsByTool.has(tool.id)) itemsByTool.set(tool.id, new Set());
          itemsByTool.get(tool.id)!.add(recipe.result);
        }
      const components = requirements.flatMap(([req]) =>
        this.flattenRequirement(
          req.components ?? [],
          (x) => x.components ?? [],
        ),
      );
      for (const componentOptions of components)
        for (const component of componentOptions) {
          if (!itemsByComponent.has(component.id))
            itemsByComponent.set(component.id, new Set());
          itemsByComponent.get(component.id)!.add(recipe.result);
        }
    });
    this._itemComponentCache = {
      byTool: itemsByTool,
      byComponent: itemsByComponent,
    };
    p.finish();
    return this._itemComponentCache;
  }

  _constructionComponentCache: {
    byTool: Map<string, Set<string>>;
    byComponent: Map<string, Set<string>>;
  } | null = null;
  getConstructionComponents() {
    if (this._constructionComponentCache)
      return this._constructionComponentCache;
    const p = perf.mark("CBNData.getConstructionComponents");
    const constructionsByComponent = new Map<string, Set<string>>();
    const constructionsByTool = new Map<string, Set<string>>();
    for (const c of this.byType("construction")) {
      const { components, tools } = this.normalizeRequirements(c);
      for (const componentOptions of components)
        for (const [component] of componentOptions) {
          if (!constructionsByComponent.has(component))
            constructionsByComponent.set(component, new Set());
          constructionsByComponent.get(component)!.add(c.id);
        }
      for (const toolOptions of tools)
        for (const [tool] of toolOptions) {
          if (!constructionsByTool.has(tool))
            constructionsByTool.set(tool, new Set());
          constructionsByTool.get(tool)!.add(c.id);
        }
    }
    this._constructionComponentCache = {
      byTool: constructionsByTool,
      byComponent: constructionsByComponent,
    };
    p.finish();
    return this._constructionComponentCache;
  }

  normalizeItemGroup(
    g: undefined | string | ItemGroupData | ItemGroupEntry[],
    subtype: "collection" | "distribution",
  ): ItemGroupData {
    if (g) {
      if (typeof g === "string") {
        return this.convertTopLevelItemGroup(this.byId("item_group", g));
      } else if (Array.isArray(g)) {
        return { subtype, entries: g };
      } else {
        return { subtype, ...g };
      }
    }
    return { subtype, entries: [] };
  }

  itemForBionic(bionic: Bionic): Item | undefined {
    return (
      this.byType("item").find(
        (i) => "bionic_id" in i && i.id && i.bionic_id === bionic.id,
      ) ?? this.byIdMaybe("item", bionic.id)
    );
  }

  #grownFromIndex = new ReverseIndex(this, "item", (item) => {
    if (!item.id || !item.seed_data) return [];
    const result: string[] = [];
    if (item.seed_data.fruit) result.push(item.seed_data.fruit);
    if (item.seed_data.byproducts) result.push(...item.seed_data.byproducts);
    return result;
  });
  grownFrom(item_id: string) {
    return this.#grownFromIndex.lookup(item_id);
  }

  #brewedFromIndex = new ReverseIndex(this, "item", (x) => {
    function normalize(
      results: undefined | string[] | Record<string, number>,
    ): string[] {
      if (!results) return [];
      if (Array.isArray(results)) return results;
      return Object.keys(results);
    }
    return x.id ? normalize(x.brewable?.results) : [];
  });
  brewedFrom(item_id: string) {
    return this.#brewedFromIndex.lookup(item_id);
  }

  #transformedFromIndex = new ReverseIndex(this, "item", (x) =>
    normalizeUseAction(x.use_action).flatMap((a) =>
      "target" in a ? [a.target] : [],
    ),
  );
  transformedFrom(item_id: string) {
    return this.#transformedFromIndex.lookup(item_id);
  }

  #bashFromFurnitureIndex = new ReverseIndex(this, "furniture", (f) => {
    return f.bash?.items
      ? this.flattenItemGroup({
          subtype: "collection",
          entries:
            typeof f.bash.items === "string"
              ? [{ group: f.bash.items }]
              : f.bash.items,
        }).map((x) => x.id)
      : [];
  });
  bashFromFurniture(item_id: string) {
    return this.#bashFromFurnitureIndex.lookup(item_id).sort(byName);
  }

  #bashFromTerrainIndex = new ReverseIndex(this, "terrain", (f) => {
    return f.bash?.items
      ? this.flattenItemGroup({
          subtype: "collection",
          entries:
            typeof f.bash.items === "string"
              ? [{ group: f.bash.items }]
              : f.bash.items,
        }).map((x) => x.id)
      : [];
  });
  bashFromTerrain(item_id: string) {
    return this.#bashFromTerrainIndex.lookup(item_id).sort(byName);
  }

  #bashFromVehiclePartIndex = new ReverseIndex(this, "vehicle_part", (vp) => {
    if (!vp.id) return [];
    const breaksIntoGroup: ItemGroupData | null =
      typeof vp.breaks_into === "string"
        ? this.convertTopLevelItemGroup(this.byId("item_group", vp.breaks_into))
        : Array.isArray(vp.breaks_into)
          ? { subtype: "collection", entries: vp.breaks_into }
          : vp.breaks_into
            ? vp.breaks_into
            : null;
    const breaksIntoGroupFlattened =
      breaksIntoGroup && this.flattenItemGroup(breaksIntoGroup);
    return breaksIntoGroupFlattened?.map((x) => x.id) ?? [];
  });
  bashFromVehiclePart(item_id: string) {
    return this.#bashFromVehiclePartIndex.lookup(item_id).sort(byName);
  }

  #deconstructFromFurnitureIndex = new ReverseIndex(this, "furniture", (f) => {
    const deconstruct = f.deconstruct?.items
      ? this.flattenItemGroup({
          subtype: "collection",
          entries:
            typeof f.deconstruct.items === "string"
              ? [{ group: f.deconstruct.items }]
              : f.deconstruct.items,
        })
      : [];

    return deconstruct.map((x) => x.id);
  });
  #deconstructFromTerrainIndex = new ReverseIndex(this, "terrain", (f) => {
    const deconstruct = f.deconstruct?.items
      ? this.flattenItemGroup({
          subtype: "collection",
          entries:
            typeof f.deconstruct.items === "string"
              ? [{ group: f.deconstruct.items }]
              : f.deconstruct.items,
        })
      : [];

    return deconstruct.map((x) => x.id);
  });
  deconstructFrom(item_id: string) {
    return [
      ...this.#deconstructFromFurnitureIndex.lookup(item_id).sort(byName),
      ...this.#deconstructFromTerrainIndex.lookup(item_id).sort(byName),
    ];
  }

  #disarmTrapIndex = new ReverseIndex(this, "trap", (trap) => {
    const droppedItems = trap.drops
      ?.map((drop) => (typeof drop === "string" ? drop : drop.item))
      .filter((drop): drop is string => typeof drop === "string");
    return [...new Set(droppedItems ?? [])];
  });
  disarmTrap(item_id: string): Trap[] {
    return this.#disarmTrapIndex.lookup(item_id).sort(byName);
  }

  #constructTrapIndex = new ReverseIndex(this, "item", (item) =>
    trapIdsFromUseAction(item.use_action),
  );
  constructsTrap(trap_id: string): Item[] {
    return this.#constructTrapIndex.lookup(trap_id).sort(byName);
  }
}

class ReverseIndex<T extends keyof SupportedTypesWithMapped> {
  constructor(
    private data: CBNData,
    private objType: T,
    private fn: (x: SupportedTypesWithMapped[T]) => string[],
  ) {}

  // noinspection JSUnusedLocalSymbols
  #_index: Map<string, SupportedTypesWithMapped[T][]> | null = null;
  // noinspection JSUnusedLocalSymbols
  get #index() {
    if (!this.#_index) {
      const p = perf.mark(`ReverseIndex.build[${this.objType}]`);
      this.#_index = new Map();
      for (const item of this.data.byType(this.objType)) {
        if (!("id" in item || "result" in item)) continue;
        for (const id of this.fn(item)) {
          if (!this.#index.has(id)) this.#index.set(id, []);
          this.#index.get(id)!.push(item);
        }
      }
      p.finish();
    }
    return this.#_index;
  }

  lookup(id: string) {
    return this.#index.get(id) ?? [];
  }
}

function flattenChoices<T>(
  data: CBNData,
  choices: T[],
  get: (x: Requirement) => T[][],
  onlyRecoverable: boolean = false,
): { id: string; count: number }[] {
  const flatChoices: { id: string; count: number }[] = [];
  for (const choice of choices) {
    if (Array.isArray(choice)) {
      const [id, count, ...rest] = choice;
      const isList = rest.includes("LIST");
      const noRecover = rest.includes("NO_RECOVER");
      if (noRecover && onlyRecoverable) continue;
      if (isList) {
        const otherRequirement = data.byId("requirement", id);
        if (otherRequirement.type !== "requirement") {
          console.warn(
            `Expected a requirement, got ${otherRequirement.type} (id=${otherRequirement.id})`,
          );
        }
        const otherRequirementTools = get(otherRequirement) ?? [];
        if (otherRequirementTools.length) {
          const otherRequirementChoices = otherRequirementTools[0]; // only take the first
          flatChoices.push(
            ...flattenChoices(
              data,
              otherRequirementChoices,
              get,
              onlyRecoverable,
            ).map((x) => ({ ...x, count: x.count * count })),
          );
        }
      } else {
        flatChoices.push({ id, count });
      }
    } else if (typeof choice === "string") {
      flatChoices.push({ id: choice, count: 1 });
    } else {
      throw new Error("unexpected choice type");
    }
  }
  return flatChoices;
}

function expandSubstitutes(
  data: CBNData,
  r: { id: string; count: number },
): { id: string; count: number }[] {
  const replacements = data.replacementTools(r.id);
  return [r, ...replacements.map((o) => ({ id: o, count: r.count }))];
}

export function normalize<T>(xs: (T | T[])[] | undefined): T[][] {
  return xs?.map((x: T | T[]) => (Array.isArray(x) ? (x as T[]) : [x])) ?? [];
}

export const countsByCharges = (item: any): boolean => {
  return item.type === "AMMO" || item.type === "COMESTIBLE" || item.stackable;
};

export function normalizeDamageInstance(
  damageInstance: DamageInstance | number | null | undefined,
): DamageUnit[] {
  if (typeof damageInstance === "number") {
    return [{ damage_type: "bash", amount: damageInstance }];
  }
  if (!damageInstance || typeof damageInstance !== "object") {
    return [];
  }
  if (Array.isArray(damageInstance)) return damageInstance;
  else if ("values" in damageInstance && Array.isArray(damageInstance.values))
    return damageInstance.values;
  else if ("damage_type" in damageInstance) return [damageInstance];
  else return [];
}

function isDamageInstanceLike(value: unknown): value is DamageInstance {
  if (Array.isArray(value)) return true;
  if (!value || typeof value !== "object") return false;
  const typed = value as Record<string, unknown>;
  return "values" in typed || "damage_type" in typed;
}

function applyRelativeDamageInstance(
  baseDamage: DamageInstance,
  relativeDamage: DamageInstance,
): DamageUnit[] {
  const baseUnits = normalizeDamageInstance(cloneDamageInstance(baseDamage));
  const relativeUnits = normalizeDamageInstance(relativeDamage);

  for (const relUnit of relativeUnits) {
    if (typeof relUnit.damage_type !== "string") continue;
    let modified = baseUnits.find(
      (du) => du.damage_type === relUnit.damage_type,
    );
    if (!modified) {
      baseUnits.push({ ...relUnit });
      continue;
    }
    if (modified.amount != null || relUnit.amount != null) {
      modified.amount = (modified.amount ?? 0) + (relUnit.amount ?? 0);
    }
    if (
      modified.armor_penetration != null ||
      relUnit.armor_penetration != null
    ) {
      modified.armor_penetration =
        (modified.armor_penetration ?? 0) + (relUnit.armor_penetration ?? 0);
    }
    if (modified.armor_multiplier != null || relUnit.armor_multiplier != null) {
      modified.armor_multiplier =
        (modified.armor_multiplier ?? 0) + (relUnit.armor_multiplier ?? 0);
    }
    if (
      modified.damage_multiplier != null ||
      relUnit.damage_multiplier != null
    ) {
      modified.damage_multiplier =
        (modified.damage_multiplier ?? 0) + (relUnit.damage_multiplier ?? 0);
    }
    if (
      modified.constant_armor_multiplier != null ||
      relUnit.constant_armor_multiplier != null
    ) {
      modified.constant_armor_multiplier =
        (modified.constant_armor_multiplier ?? 0) +
        (relUnit.constant_armor_multiplier ?? 0);
    }
    if (
      modified.constant_damage_multiplier != null ||
      relUnit.constant_damage_multiplier != null
    ) {
      modified.constant_damage_multiplier =
        (modified.constant_damage_multiplier ?? 0) +
        (relUnit.constant_damage_multiplier ?? 0);
    }
  }

  return baseUnits;
}

function applyProportionalDamageInstance(
  baseDamage: DamageInstance,
  proportionalDamage: DamageInstance,
): DamageUnit[] {
  const baseUnits = normalizeDamageInstance(cloneDamageInstance(baseDamage));
  const proportionalUnits = normalizeDamageInstance(proportionalDamage);

  for (const propUnit of proportionalUnits) {
    if (typeof propUnit.damage_type !== "string") continue;
    const modified = baseUnits.find(
      (du) => du.damage_type === propUnit.damage_type,
    );
    if (!modified) continue;
    if (modified.amount != null || propUnit.amount != null) {
      modified.amount = (modified.amount ?? 0) * (propUnit.amount ?? 1);
    }
    if (
      modified.armor_penetration != null ||
      propUnit.armor_penetration != null
    ) {
      modified.armor_penetration =
        (modified.armor_penetration ?? 0) * (propUnit.armor_penetration ?? 1);
    }
    if (
      modified.armor_multiplier != null ||
      propUnit.armor_multiplier != null
    ) {
      modified.armor_multiplier =
        (modified.armor_multiplier ?? 0) * (propUnit.armor_multiplier ?? 1);
    }
    if (
      modified.damage_multiplier != null ||
      propUnit.damage_multiplier != null
    ) {
      modified.damage_multiplier =
        (modified.damage_multiplier ?? 0) * (propUnit.damage_multiplier ?? 1);
    }
    if (
      modified.constant_armor_multiplier != null ||
      propUnit.constant_armor_multiplier != null
    ) {
      modified.constant_armor_multiplier =
        (modified.constant_armor_multiplier ?? 0) *
        (propUnit.constant_armor_multiplier ?? 1);
    }
    if (
      modified.constant_damage_multiplier != null ||
      propUnit.constant_damage_multiplier != null
    ) {
      modified.constant_damage_multiplier =
        (modified.constant_damage_multiplier ?? 0) *
        (propUnit.constant_damage_multiplier ?? 1);
    }
  }

  return baseUnits;
}

export function cloneDamageInstance(di: DamageInstance): DamageInstance {
  if (Array.isArray(di)) {
    return di.map((u) => ({ ...u }));
  } else if ("values" in di) {
    return { ...di, values: di.values.map((u) => ({ ...u })) };
  } else {
    return { ...di };
  }
}

export function cloneQualities(q: any[]): any[] {
  return q.map((x) => (Array.isArray(x) ? [...x] : { ...x }));
}

const vpartVariants = [
  "cover_left",
  "cover_right",
  "hatch_wheel_left",
  "hatch_wheel_right",
  "wheel_left",
  "wheel_right",
  "cross_unconnected",
  "cross",
  "horizontal_front_edge",
  "horizontal_front",
  "horizontal_rear_edge",
  "horizontal_rear",
  "horizontal_2_front",
  "horizontal_2_rear",
  "ne_edge",
  "nw_edge",
  "se_edge",
  "sw_edge",
  "vertical_right",
  "vertical_left",
  "vertical_2_right",
  "vertical_2_left",
  "vertical_T_right",
  "vertical_T_left",
  "front_right",
  "front_left",
  "rear_right",
  "rear_left",
  // these have to be last to avoid false positives
  "cover",
  "vertical",
  "horizontal",
  "vertical_2",
  "horizontal_2",
  "ne",
  "nw",
  "se",
  "sw",
  "front",
  "rear",
  "left",
  "right",
];

export const getVehiclePartIdAndVariant = (
  data: CBNData,
  compositePartId: string,
): [string, string] => {
  if (data.byIdMaybe("vehicle_part", compositePartId))
    return [compositePartId, ""];
  const m = /^(.+)#(.+?)$/.exec(compositePartId);
  if (m) return [m[1], m[2]];

  // TODO: only check this for releases older than https://github.com/CleverRaven/Cataclysm-DDA/pull/65871
  for (const variant of vpartVariants) {
    if (compositePartId.endsWith("_" + variant)) {
      return [
        compositePartId.slice(0, compositePartId.length - variant.length - 1),
        variant,
      ];
    }
  }
  return [compositePartId, ""];
};

export type NormalizedVehicleMountedPart = {
  x: number;
  y: number;
  parts: VehicleMountedPartDefinition[];
};

export const normalizeVehicleMountedParts = (
  vehicle: Vehicle,
): NormalizedVehicleMountedPart[] => {
  const ret: NormalizedVehicleMountedPart[] = [];

  if (vehicle.parts) {
    ret.push(
      ...vehicle.parts.map((part) => ({
        x: part.x,
        y: part.y,
        parts:
          (part.part
            ? [{ part: part.part, fuel: part.fuel }]
            : part.parts?.map((p) =>
                typeof p === "string" ? { part: p } : p,
              )) ?? [],
      })),
    );
  }

  if (!vehicle.blueprint || !vehicle.palette) return ret;

  const origin = vehicle.blueprint_origin ?? { x: 0, y: 0 };
  const rows = vehicle.blueprint.map((row) =>
    Array.isArray(row) ? row.join("") : row,
  );

  for (const [rowIndex, row] of rows.entries()) {
    for (const [colIndex, symbol] of [...row].entries()) {
      const paletteEntries = vehicle.palette[symbol];
      if (!paletteEntries) continue;

      const parts = paletteEntries.flatMap((entry) => {
        if (typeof entry === "string") return [{ part: entry }];
        if (!Array.isArray(entry)) return [entry];

        // Cataclysm-BN's blueprint palette loader uses only the first element as
        // the vehicle part id and ignores any extra legacy metadata in the array.
        const [part] = entry;
        return typeof part === "string" ? [{ part }] : [];
      });
      if (!parts.length) continue;

      ret.push({
        // Match Cataclysm-BN's vehicle blueprint loader in `veh_type.cpp`,
        // which uses column -> x and row -> y after subtracting the origin.
        x: colIndex - origin.x,
        y: rowIndex - origin.y,
        parts,
      });
    }
  }

  return ret;
};

const _itemGroupFromVehicleCache = new WeakMap<Vehicle, ItemGroupData>();
export function itemGroupFromVehicle(vehicle: Vehicle): ItemGroupData {
  const cached = _itemGroupFromVehicleCache.get(vehicle);
  if (cached) return cached;
  const ret: ItemGroupData = {
    subtype: "collection",
    entries: (vehicle.items ?? []).map((it) => {
      if (it.items) {
        return {
          collection: (typeof it.items === "string"
            ? [it.items]
            : it.items
          ).map((it_id) => ({ item: it_id })),
          prob: it.chance,
        };
      } else if (it.item_groups) {
        return {
          collection: (typeof it.item_groups === "string"
            ? [it.item_groups]
            : it.item_groups
          ).map((ig_id) => ({ group: ig_id })),
          prob: it.chance,
        };
      } else {
        return { distribution: [] };
      }
    }),
  };

  _itemGroupFromVehicleCache.set(vehicle, ret);
  return ret;
}

export function normalizeUseAction(action: Item["use_action"]): UseFunction[] {
  if (typeof action === "string")
    return [{ type: "__item_action__", id: action }];
  else if (Array.isArray(action)) {
    return action.map((s) => {
      if (typeof s === "string") return { type: "__item_action__", id: s };
      else if (Array.isArray(s)) {
        return { type: "__item_action__", id: s[0] };
      } else {
        return s;
      }
    });
  } else {
    return action ? [action] : [];
  }
}

function trapIdsFromUseAction(action: Item["use_action"]): string[] {
  const trapIds = new Set<string>();
  for (const useAction of normalizeUseAction(action)) {
    if (useAction.type !== "place_trap") continue;
    trapIds.add(useAction.trap);
    if (useAction.outer_layer_trap) trapIds.add(useAction.outer_layer_trap);
    if (useAction.bury?.trap) trapIds.add(useAction.bury.trap);
  }
  return [...trapIds];
}

type ParsedModsJSON = {
  mods: ModInfo[];
  raw: Record<string, ModData>;
  byId: Map<string, ModData>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeTranslation(value: Translation): Translation {
  if (typeof value === "string") return cleanText(value);
  if ("str" in value) {
    return {
      ...value,
      str: cleanText(value.str),
      ...(typeof value.str_pl === "string"
        ? { str_pl: cleanText(value.str_pl) }
        : {}),
    };
  }
  return {
    str_sp: cleanText(value.str_sp),
  };
}

function parseModsJSON(rawMods: unknown): ParsedModsJSON {
  if (!isRecord(rawMods)) {
    throw new Error("Invalid all_mods.json: expected top-level object map");
  }

  const mods: ModInfo[] = [];
  const raw: Record<string, ModData> = {};
  const byId = new Map<string, ModData>();

  for (const [modId, rawEntry] of Object.entries(rawMods)) {
    if (!isRecord(rawEntry)) {
      throw new Error(`Invalid all_mods.json entry for "${modId}"`);
    }
    const rawInfo = rawEntry.info;
    const rawData = rawEntry.data;
    if (!isRecord(rawInfo)) {
      throw new Error(`Invalid all_mods.json info for "${modId}"`);
    }
    if (!Array.isArray(rawData)) {
      throw new Error(`Invalid all_mods.json data array for "${modId}"`);
    }
    if (rawInfo.type !== "MOD_INFO") {
      throw new Error(`Invalid MOD_INFO type for "${modId}"`);
    }
    if (typeof rawInfo.id !== "string" || rawInfo.id !== modId) {
      throw new Error(`Invalid MOD_INFO id for "${modId}"`);
    }

    const parsedInfo = rawInfo as ModInfo;
    const modData: ModData = {
      info: {
        ...parsedInfo,
        name: sanitizeTranslation(parsedInfo.name),
        description: sanitizeTranslation(parsedInfo.description),
        category: sanitizeTranslation(parsedInfo.category),
      },
      data: rawData,
    };
    raw[modId] = modData;
    byId.set(modId, modData);
    if (!modData.info.core) {
      mods.push(modData.info);
    }
  }

  return { mods, raw, byId };
}

function filterActiveMods(
  requestedActiveMods: string[],
  modsById: Map<string, ModData>,
): string[] {
  const filtered: string[] = [];
  const seen = new Set<string>();
  for (const modId of requestedActiveMods) {
    if (modId === "bn" || seen.has(modId)) continue;
    const modData = modsById.get(modId);
    if (!modData || modData.info.core) continue;
    seen.add(modId);
    filtered.push(modId);
  }
  return filtered;
}

function mergeDataWithActiveMods(
  coreData: any[],
  modsById: Map<string, ModData>,
  activeMods: string[],
): any[] {
  const mergedData = [...coreData];
  for (const modId of activeMods) {
    mergedData.push(...modsById.get(modId)!.data);
  }
  return mergedData;
}

const loadProgressStore = writable<[number, number | undefined] | null>(null);
export const loadProgress = { subscribe: loadProgressStore.subscribe };
/**
 * Monotonic generation token used to invalidate stale async work.
 *
 * Incremented on every `loadData()` start and on `_reset()`, so any older
 * in-flight load exits before mutating the singleton store.
 */
let _generationToken = 0;
const prewarmedDerivedCaches = new WeakSet<CBNData>();

export async function prewarmDerivedCaches(targetData: CBNData): Promise<void> {
  if (isTesting || prewarmedDerivedCaches.has(targetData)) return;
  const startToken = _generationToken;
  try {
    if (startToken !== _generationToken) return;
    await lootByOMSAppearance(targetData);
    if (startToken !== _generationToken) return;
    await yieldUntilIdle();
    if (startToken !== _generationToken) return;
    await furnitureByOMSAppearance(targetData);
    if (startToken !== _generationToken) return;
    await yieldUntilIdle();
    if (startToken !== _generationToken) return;
    await terrainByOMSAppearance(targetData);
    if (startToken !== _generationToken) return;
    prewarmedDerivedCaches.add(targetData);
  } catch (error) {
    // Keep prewarm best-effort: failures should not prevent future retries.
    console.warn("Failed to prewarm derived caches", error);
  }
}

const { subscribe, set } = writable<CBNData | null>(null);

type BuildData = {
  build_number: string;
  release: unknown;
  data: any[];
  mods: unknown | undefined;
};

export const data = {
  subscribe,
  /**
   * Fetches all game data assets via `loadRawDataset()` and publishes a new
   * `CBNData` instance to the store. Owns locale fallback policy, mod catalog
   * parsing, generation-token cancellation, and store lifecycle.
   *
   * Concurrent calls are safe: each call takes a generation token and any
   * stale in-flight call exits before mutating the store.
   *
   * @param version      Build version slug (e.g. "nightly", "stable")
   * @param locale       Requested locale code, or null for English
   * @param activeMods   Ordered mod ids to activate
   * @returns true if load was finished
   */
  async loadData(
    version: string,
    locale: string,
    activeMods: string[] = [],
  ): Promise<boolean> {
    const generationToken = ++_generationToken;
    const isCancelled = () => generationToken !== _generationToken;

    try {
      const raw = await loadRawDataset(version, locale, (received, total) => {
        if (!isCancelled()) {
          loadProgressStore.set(received > 0 ? [received, total] : null);
        }
      });

      if (isCancelled()) return false;

      let effectiveLocale = locale;
      if (locale !== DEFAULT_LOCALE && !raw.localeJSON) {
        console.warn(
          `Failed to load locale ${locale}, falling back to English`,
        );
        effectiveLocale = DEFAULT_LOCALE;
      }

      let filteredActiveMods: string[] = [];
      //TODO: use `zod` maybe
      if (
        !(
          isRecord(raw.dataJSON) &&
          "data" in raw.dataJSON &&
          "build_number" in raw.dataJSON
        )
      ) {
        throw new Error("Invalid all.json: expected top-level object map");
      }
      const coreJSON = raw.dataJSON as BuildData;
      let mergedData = coreJSON.data;
      let rawModsJSON: Record<string, ModData> = {};

      if (raw.modsJSON) {
        const parsedMods = parseModsJSON(raw.modsJSON);
        rawModsJSON = parsedMods.raw;
        filteredActiveMods = filterActiveMods(activeMods, parsedMods.byId);
        mergedData = mergeDataWithActiveMods(
          coreJSON.data,
          parsedMods.byId,
          filteredActiveMods,
        );
      }

      const instance = new CBNData(
        mergedData,
        coreJSON.build_number,
        version,
        effectiveLocale,
        raw.localeJSON,
        raw.pinyinJSON,
        filteredActiveMods,
        rawModsJSON,
      );

      if (isCancelled()) return false;
      set(instance);
      return true;
    } finally {
      if (generationToken === _generationToken) {
        loadProgressStore.set(null);
      }
    }
  },
  /**
   * `_reset`: resetting singleton store state between test app mounts.
   * Side effects: clearing _currentData, generation token, and calling set(null).
   * @internal
   */
  _reset(): void {
    _generationToken++;
    loadProgressStore.set(null);
    resetI18n();
    set(null);
  },
};

export function omsName(data: CBNData, oms: OvermapSpecial): string {
  if (oms.subtype === "mutable") return oms.id;
  const ground_level_omts = (oms.overmaps ?? []).filter(
    (p) => p.point[2] === 0,
  );
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;
  const grid = new Map<string, (typeof ground_level_omts)[0]>();
  for (const omt of ground_level_omts) {
    const [x, y] = omt.point;
    if (!omt.overmap) continue;
    if (
      !data.byIdMaybe(
        "overmap_terrain",
        omt.overmap.replace(DIRECTION_SUFFIX_REGEX, ""),
      )
    )
      continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    grid.set(`${x}|${y}`, omt);
  }
  const centerX = minX + Math.floor((maxX - minX) / 2);
  const centerY = minY + Math.floor((maxY - minY) / 2);
  const centerOmt = grid.get(`${centerX}|${centerY}`);
  if (centerOmt?.overmap) {
    const omt = data.byId(
      "overmap_terrain",
      centerOmt.overmap.replace(DIRECTION_SUFFIX_REGEX, ""),
    );
    if (omt) {
      return gameSingularName(omt);
    }
  }
  return oms.id;
}

export function resolveSelectionWithDependencies(
  selectedIds: string[],
  modsById: Map<string, ModInfo>,
): string[] {
  const ordered: string[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function visit(modId: string): void {
    if (visited.has(modId) || stack.has(modId)) return;
    const mod = modsById.get(modId);
    if (!mod) return;

    stack.add(modId);
    for (const depId of mod.dependencies) {
      visit(depId);
    }
    stack.delete(modId);

    visited.add(modId);
    ordered.push(modId);
  }

  for (const modId of selectedIds) {
    visit(modId);
  }

  return ordered;
}
