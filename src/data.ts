/**
 * Core data layer for Cataclysm: Bright Nights game data.
 *
 * ARCHITECTURE:
 * - **Singleton pattern**: CBNData instantiated ONCE per page load, never mutates
 * - **Full page reload**: Version/language/tileset/mod changes trigger location.href reload (see routing.md, ADR-002)
 * - **Incremental Mod Resolution**: Mods are resolved via top-to-bottom unfurling during flattening (see ADR-003)
 * - **Immutable after construction**: All data frozen after initial load (~30MB, 30K+ objects)
 * - **Caching**: Maps/WeakMaps never need invalidation - data lifetime = page lifetime
 *
 * This design is intentional - changing versions or mods requires loading completely different JSON.
 */
import { writable } from "svelte/store";
import makeI18n, { type Gettext } from "gettext.js";
import * as perf from "./utils/perf";
import { isTesting } from "./utils/env";

import type {
  Bionic,
  ComestibleSlot,
  DamageInstance,
  DamageUnit,
  InlineItemGroup,
  Item,
  ItemBasicInfo,
  ItemGroup,
  ItemGroupData,
  ItemGroupEntry,
  Mapgen,
  MapgenValue,
  ModData,
  ModInfo,
  Monster,
  MonsterGroup,
  OvermapSpecial,
  PaletteData,
  QualityRequirement,
  Recipe,
  Requirement,
  RequirementData,
  SupportedTypeMapped,
  SupportedTypesWithMapped,
  Translation,
  UseFunction,
  Vehicle,
} from "./types";
import type { Loot } from "./types/item/spawnLocations";
import { getDataJsonUrl } from "./constants";
import { cleanText, formatKg, formatL, stripColorTags } from "./utils/format";

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

export let i18n: Gettext = makeI18n();

const needsPlural = [
  "AMMO",
  "ARMOR",
  "BATTERY",
  "BIONIC_ITEM",
  "BOOK",
  "COMESTIBLE",
  "CONTAINER",
  "ENGINE",
  "GENERIC",
  "GUN",
  "GUNMOD",
  "MAGAZINE",
  "PET_ARMOR",
  "TOOL",
  "TOOLMOD",
  "TOOL_ARMOR",
  "WHEEL",
  "MONSTER",
  "vehicle_part",
  "json_flag",
];

function getMsgId(t: Translation) {
  if (t == null) return "";
  return typeof t === "string" ? t : "str_sp" in t ? t.str_sp : t.str;
}

function getMsgIdPlural(t: Translation): string {
  if (t == null) return "";
  return typeof t === "string"
    ? t + "s"
    : "str_sp" in t
      ? t.str_sp
      : "str_pl" in t && t.str_pl
        ? t.str_pl
        : t.str + "s";
}

export function translate(
  t: Translation,
  needsPlural: boolean,
  n: number,
  domain?: string,
): string {
  const sg = getMsgId(t);
  const pl = needsPlural ? getMsgIdPlural(t) : "";
  const raw =
    i18n.dcnpgettext(domain, undefined, sg, pl, n) ||
    (n === 1 ? sg : (pl ?? sg));
  return stripColorTags(raw);
}

export const singular = (name: Translation): string =>
  translate(name, false, 1);

export const plural = (name: Translation, n: number = 2): string =>
  translate(name, true, n);

export const singularName = (obj: any, domain?: string): string =>
  pluralName(obj, 1, domain);

export const pluralName = (
  obj: any,
  n: number = 2,
  domain?: string,
): string => {
  const name: Translation = obj?.name?.male ?? obj?.name;
  if (name == null) return obj?.id ?? obj?.abstract;
  const txed = Array.isArray(name)
    ? translate(name[0], needsPlural.includes(obj.type), n, domain)
    : translate(name, needsPlural.includes(obj.type), n, domain);
  if (txed.length === 0) return obj?.id ?? obj?.abstract;
  return txed;
};

export const byName = (a: any, b: any) =>
  singularName(a).localeCompare(singularName(b));

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

/**
 * Central data store for the application.
 * Handles loading, indexing, and accessing game data.
 * Implements lazy flattening of objects (resolving inheritance).
 */
export class CBNData {
  _raw: any[];
  _byType: Map<string, any[]> = new Map();
  _byTypeById: Map<string, Map<string, any>> = new Map();
  _abstractsByType: Map<string, Map<string, any>> = new Map();
  _overrides: Map<any, any> = new Map();
  _toolReplacements: Map<string, string[]> = new Map();
  _craftingPseudoItems: Map<string, string> = new Map();
  _migrations: Map<string, string> = new Map();
  _flattenCache: Map<any, any> = new Map();
  _nestedMapgensById: Map<string, Mapgen[]> = new Map();
  /** Memoized direct touching mods keyed by mapped type + provenance key. */
  _directModsByTypeByIdCache: Map<
    keyof SupportedTypesWithMapped,
    Map<string, ModInfo[]>
  > = new Map();
  /**
   * Memoized contributing mods for concrete objects keyed by mapped type + id.
   * Unlike `_directModsByTypeByIdCache`, this includes all mods in the resolved
   * `copy-from` chain (parents first, then current object).
   */
  _contributingModsByTypeByIdCache: Map<
    keyof SupportedTypesWithMapped,
    Map<string, ModInfo[]>
  > = new Map();
  /**
   * Precomputed visibility for monsters after applying MONSTER_BLACKLIST /
   * MONSTER_WHITELIST policy objects from the merged dataset.
   *
   * @internal
   */
  _monsterVisibilityById: Map<string, boolean> = new Map();

  release: any;
  /** Concrete build number from the game data (e.g., "v0.9.1") */
  build_number: string | undefined;
  /** Original version slug used for fetching (e.g., "stable", "nightly") */
  fetching_version: string | undefined;
  /** Effective locale actually loaded (e.g. "uk" if "uk_UA" fell back) */
  effective_locale: string;
  /** Locale originally requested by the user */
  requested_locale: string;
  /** Ordered non-core mod metadata. null means metadata wasn't fetched yet. */
  mods: ModInfo[] | null;
  /** Ordered active non-core mod ids. null means metadata wasn't fetched yet. */
  active_mods: string[] | null;
  /** Full all_mods.json payload keyed by mod id. null means metadata wasn't fetched yet. */
  raw_mods_json: Record<string, ModData> | null;

  /**
   * @param raw Raw game data objects
   * @param build_number Concrete build number
   * @param release Release metadata
   * @param fetching_version Original version slug used for fetching
   * @param effective_locale Effective locale actually loaded
   * @param requested_locale Locale originally requested
   */
  constructor(
    raw: any[],
    build_number?: string,
    release?: any,
    fetching_version?: string,
    effective_locale: string = "en",
    requested_locale: string = "en",
    mods: ModInfo[] | null = null,
    active_mods: string[] | null = null,
    raw_mods_json: Record<string, ModData> | null = null,
  ) {
    const p = perf.mark("CBNData.constructor");

    this.release = release;
    this.build_number = build_number;
    this.fetching_version = fetching_version;
    this.effective_locale = effective_locale;
    this.requested_locale = requested_locale;
    this.mods = mods;
    this.active_mods = active_mods;
    this.raw_mods_json = raw_mods_json;
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
      const monsterCategories = new Set(
        Array.isArray(monster.categories)
          ? monster.categories
          : typeof monster.categories === "string"
            ? [monster.categories]
            : [],
      );
      const monsterSpecies = new Set(
        Array.isArray(monster.species)
          ? monster.species
          : typeof monster.species === "string"
            ? [monster.species]
            : [],
      );

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
   *
   * @param type The type of objects to retrieve.
   * @returns An array of flattened objects.
   */
  byType<TypeName extends keyof SupportedTypesWithMapped>(
    type: TypeName,
  ): SupportedTypesWithMapped[TypeName][] {
    const flattened =
      this._byType.get(type)?.map((x) => this._flatten(x)) ?? [];
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
   * Resolves direct touching mods for a mapped type/key by scanning active mods
   * on demand. This intentionally avoids any constructor-time provenance index.
   *
   * ARCHITECTURE: Uses top-down scanning (see docs/adr/003-mod-resolution-path.md and 004-mod-provenance-and-data-origin-tracking.md)
   */
  _directModsForTypeIdByScan(
    mappedType: keyof SupportedTypesWithMapped,
    id: string,
  ): ModInfo[] {
    const activeMods = this.active_mods;
    const rawModsJson = this.raw_mods_json;
    if (!activeMods || !rawModsJson) return [];

    const directMods: ModInfo[] = [];
    for (const modId of activeMods) {
      const modData = rawModsJson[modId];
      if (!modData) continue;

      let touchesId = false;
      for (const rawObj of modData.data) {
        if (typeof rawObj !== "object" || rawObj === null) continue;
        const candidate = rawObj as Record<string, unknown>;
        if (typeof candidate.type !== "string") continue;

        const candidateType = mapType(
          candidate.type as keyof SupportedTypesWithMapped,
        );
        if (candidateType !== mappedType) continue;

        if (this._provenanceKeyForObject(candidateType, candidate) === id) {
          touchesId = true;
          break;
        }
      }

      if (touchesId) directMods.push(modData.info);
    }
    return directMods;
  }

  /**
   * Returns direct touching mods for a mapped type/id pair using memoized
   * on-demand scans (no global preindexing).
   */
  _directModsForTypeId(
    mappedType: keyof SupportedTypesWithMapped,
    id: string,
  ): readonly ModInfo[] {
    if (!this._directModsByTypeByIdCache.has(mappedType)) {
      this._directModsByTypeByIdCache.set(mappedType, new Map());
    }
    const byId = this._directModsByTypeByIdCache.get(mappedType)!;
    const cached = byId.get(id);
    if (cached) return cached;

    const mods = this._directModsForTypeIdByScan(mappedType, id);
    byId.set(id, mods);
    return mods;
  }

  /**
   * Merges parent-chain and current-node mod lists while preserving order and
   * uniqueness by mod id.
   *
   * @param inherited Contributing mods from parent chain.
   * @param current Direct touching mods of the current object node.
   * @returns Ordered, unique merged mod list.
   */
  _mergeUniqueMods(
    inherited: readonly ModInfo[],
    current: readonly ModInfo[],
  ): ModInfo[] {
    if (inherited.length === 0) return [...current];
    if (current.length === 0) return [...inherited];

    const merged: ModInfo[] = [...inherited];
    const seen = new Set(inherited.map((mod) => mod.id));
    for (const mod of current) {
      if (seen.has(mod.id)) continue;
      seen.add(mod.id);
      merged.push(mod);
    }
    return merged;
  }

  /** Clears memoized provenance caches when mod metadata changes. */
  _clearModProvenanceCaches(): void {
    this._directModsByTypeByIdCache.clear();
    this._contributingModsByTypeByIdCache.clear();
  }

  /**
   * Resolves immediate parent provenance id for a mapped type/id.
   * Self-copy chains (same id copied from itself across overrides) are collapsed
   * until a different parent id is found.
   *
   * ARCHITECTURE: ADR-005 (Robust inheritance: Migrations and Self-Copy Handling).
   * Collapses self-referential inheritance chains for clean provenance.
   *
   * @param mappedType Mapped type family to search in.
   * @param id Provenance id (object id or abstract).
   * @returns Parent mapped type/id pair or null when no parent exists.
   */
  _resolveParentTypeIdForModProvenance(
    mappedType: keyof SupportedTypesWithMapped,
    id: string,
  ): { mappedType: keyof SupportedTypesWithMapped; id: string } | null {
    let current = this._objectForProvenanceKey(mappedType, id);
    if (!current) return null;
    const currentMappedType = mappedType;

    const seen = new Set<Record<string, unknown>>();
    while (current) {
      if (seen.has(current)) return null;
      seen.add(current);

      const parent = this._resolveCopyFromParent(current);
      if (!parent) return null;
      const parentMappedType = mapType(
        parent.type as keyof SupportedTypesWithMapped,
      );
      const parentId = this._provenanceKeyForObject(parentMappedType, parent);
      if (!parentId) return null;

      if (parentMappedType !== currentMappedType || parentId !== id) {
        return { mappedType: parentMappedType, id: parentId };
      }

      // Continue traversing through self-copy overrides until parent id changes.
      current = parent;
    }
    return null;
  }

  /**
   * Resolves contributing mods for a mapped type/id by traversing its full
   * `copy-from` parent chain recursively.
   *
   * ARCHITECTURE: Implements top-to-bottom inheritance unfurling (see docs/adr/003-mod-resolution-path.md and 004-mod-provenance-and-data-origin-tracking.md)
   *
   * @param mappedType Mapped type family to search in.
   * @param id Provenance id (object id or abstract).
   * @param stack Cycle-detection set for recursive traversal.
   * @returns Ordered mod list for the full inheritance chain.
   */
  _modsForTypeIdChain(
    mappedType: keyof SupportedTypesWithMapped,
    id: string,
    stack: Set<string> = new Set(),
  ): ModInfo[] {
    const stackId = `${mappedType}::${id}`;
    if (stack.has(stackId)) return [];
    stack.add(stackId);

    const parent = this._resolveParentTypeIdForModProvenance(mappedType, id);
    const inheritedMods = parent
      ? this._modsForTypeIdChain(parent.mappedType, parent.id, stack)
      : [];
    stack.delete(stackId);
    return this._mergeUniqueMods(
      inheritedMods,
      this._directModsForTypeId(mappedType, id),
    );
  }

  /**
   * Returns mods that directly define/override the concrete object with the
   * given type/id key. This method does not include `copy-from` ancestry.
   * The key must match the same identifier used by `byId(...)` for the family
   * (for example: item `id`, recipe `result[_id_suffix]`, monstergroup `name`).
   *
   * @param type Mapped type family to search in.
   * @param id Concrete object key used by `byId(...)`.
   * @returns Direct touching non-core mods in load order.
   */
  getDirectModsForId<TypeName extends keyof SupportedTypesWithMapped>(
    type: TypeName,
    id: string,
  ): readonly ModInfo[] {
    if (typeof id !== "string") return [];
    const mappedType = mapType(type);
    if (!this._byTypeById.get(mappedType)?.has(id)) return [];
    return [...this._directModsForTypeId(mappedType, id)];
  }

  /**
   * Returns all mods that contribute to the resolved object with the given
   * type/id key, including direct touches and all `copy-from` ancestors.
   *
   * @param type Mapped type family to search in.
   * @param id Concrete object key used by `byId(...)`.
   * @returns Contributing non-core mods across the full inheritance chain.
   */
  getContributingModsForId<TypeName extends keyof SupportedTypesWithMapped>(
    type: TypeName,
    id: string,
  ): readonly ModInfo[] {
    if (typeof id !== "string") return [];
    const mappedType = mapType(type);
    const cached = this._contributingModsByTypeByIdCache
      .get(mappedType)
      ?.get(id);
    if (cached) return [...cached];

    if (!this._byTypeById.get(mappedType)?.has(id)) return [];
    const mods = this._modsForTypeIdChain(mappedType, id);
    if (!this._contributingModsByTypeByIdCache.has(mappedType)) {
      this._contributingModsByTypeByIdCache.set(mappedType, new Map());
    }
    this._contributingModsByTypeByIdCache.get(mappedType)!.set(id, mods);
    return [...mods];
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
   * ARCHITECTURE: Leverages top-down unfurling for performance (see docs/adr/003-mod-resolution-path.md and 004-mod-provenance-and-data-origin-tracking.md)
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
      console.error(
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
        if (k === "melee_damage") {
          const di = normalizeDamageInstance(
            cloneDamageInstance(ret.melee_damage),
          );
          for (const du of di) du.amount = (du.amount ?? 0) + ret.relative[k];
          ret.melee_damage = di;
        } else if (k === "weight") {
          ret[k] = (parseMass(ret[k]) ?? 0) + ret.relative[k];
        } else if (k === "volume") {
          ret[k] = (parseVolume(ret[k]) ?? 0) + ret.relative[k];
        } else {
          ret[k] = (ret[k] ?? 0) + ret.relative[k];
        }
      } else if (
        (k === "damage" || k === "ranged_damage" || k === "melee_damage") &&
        ret[k] &&
        isDamageInstanceLike(ret[k]) &&
        isDamageInstanceLike(ret.relative[k])
      ) {
        ret[k] = applyRelativeDamageInstance(ret[k], ret.relative[k]);
      } else if (
        (k === "melee_damage" || (k === "armor" && ret.type === "MONSTER")) &&
        ret[k]
      ) {
        if (k === "melee_damage") ret[k] = cloneDamageInstance(ret[k]);
        else ret[k] = { ...ret[k] };
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
        (k === "damage" || k === "ranged_damage" || k === "melee_damage") &&
        ret[k] &&
        isDamageInstanceLike(ret[k]) &&
        isDamageInstanceLike(ret.proportional[k])
      ) {
        ret[k] = applyProportionalDamageInstance(ret[k], ret.proportional[k]);
      } else if (
        (k === "melee_damage" || (k === "armor" && ret.type === "MONSTER")) &&
        ret[k]
      ) {
        if (k === "melee_damage") ret[k] = cloneDamageInstance(ret[k]);
        else ret[k] = { ...ret[k] };
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

  _cachedMapgenSpawnItems = new Map<Mapgen, string[]>();
  mapgenSpawnItems(mapgen: Mapgen): string[] {
    if (this._cachedMapgenSpawnItems.has(mapgen))
      return this._cachedMapgenSpawnItems.get(mapgen)!;
    if (mapgen.method !== "json") {
      this._cachedMapgenSpawnItems.set(mapgen, []);
      return [];
    }
    const p = perf.mark(`CBNData.mapgenSpawnItems`, true);
    const palette = new Map<string, Set<string>>();
    const add = (c: string, item_id: MapgenValue) => {
      if (typeof item_id === "string") {
        if (!palette.has(c)) palette.set(c, new Set());
        palette.get(c)!.add(item_id);
      } else {
        // TODO: handle distribution, param, switch/cases
      }
    };

    const addGroup = (c: string, v: InlineItemGroup) => {
      // TODO dedupe?
      const group =
        typeof v === "string"
          ? this.convertTopLevelItemGroup(this.byId("item_group", v))
          : Array.isArray(v)
            ? { subtype: "collection" as const, entries: v }
            : v;
      if (group) {
        for (const { id } of this.flattenItemGroup(group)) add(c, id);
      } else {
        if (typeof v === "string") {
          const item = this.byId("item", v);
          if (item) add(c, v);
        }
      }
    };

    const addPalette = (palette: PaletteData) => {
      for (const [c, v] of Object.entries(palette.item ?? {})) {
        const va = Array.isArray(v) ? v : [v];
        for (const s of va) add(c, s.item);
      }
      for (const [c, v] of Object.entries(palette.items ?? {})) {
        const va = Array.isArray(v) ? v : [v];
        for (const s of va) addGroup(c, s.item);
      }
      for (const [c, v] of Object.entries(palette.sealed_item ?? {})) {
        const va = Array.isArray(v) ? v : [v];
        for (const s of va) {
          if (s.item?.item) add(c, s.item.item);
          if (s.items?.item) addGroup(c, s.items.item);
        }
      }
    };

    addPalette(mapgen.object);

    for (const p_id of mapgen.object.palettes ?? [])
      if (typeof p_id === "string") addPalette(this.byId("palette", p_id));
      else {
        // TODO: handle param/distribution/switch
      }

    const ret = new Set<string>();

    const usedChars = new Set<string>();
    for (const row of mapgen.object.rows ?? []) {
      for (const char of row) {
        usedChars.add(char);
      }
    }
    for (const char of usedChars) {
      const v = palette.get(char) ?? new Set();
      for (const x of v) ret.add(x);
    }

    for (const v of mapgen.object.place_item ?? [])
      if (typeof v.item === "string") ret.add(v.item);

    for (const v of mapgen.object.place_items ?? []) {
      const group =
        typeof v.item === "string"
          ? this.convertTopLevelItemGroup(this.byId("item_group", v.item))
          : Array.isArray(v.item)
            ? { subtype: "collection" as const, entries: v.item }
            : v.item;
      if (group) {
        for (const { id } of this.flattenItemGroup(group)) ret.add(id);
      } else {
        if (typeof v === "string") {
          const item = this.byId("item", v);
          if (item) ret.add(v);
        }
      }
    }

    for (const v of mapgen.object.place_loot ?? []) {
      if ("item" in v) ret.add(v.item);
      if ("group" in v)
        for (const { id } of this.flattenTopLevelItemGroup(
          this.byId("item_group", v.group),
        ))
          ret.add(id);
    }

    for (const v of mapgen.object.add ?? [])
      if (typeof v.item === "string") ret.add(v.item);

    const r = [...ret];
    this._cachedMapgenSpawnItems.set(mapgen, r);
    p.finish();
    return r;
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
      (req.qualities ?? []).map((x) => (Array.isArray(x) ? x : [x])),
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

  #compatibleItemsFlagIndex = new ReverseIndex(this, "item", (item) => {
    //TODO: find compatible mags, ammo
    const ret: string[] = [];
    return ret;
  });
  compatibleItems(item: ItemBasicInfo): Item[] {
    const byFlag = item.flags
      ? [item.flags]
          .flat()
          .flatMap((f) => this.#compatibleItemsFlagIndex.lookup(f))
      : [];

    return [...new Set([...byFlag])];
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

  setLocale(localeJson: any, pinyinNameJson: any) {
    if (pinyinNameJson) pinyinNameJson[""] = localeJson[""];
    i18n.loadJSON(localeJson);
    i18n.setLocale(this.effective_locale);
    if (pinyinNameJson) {
      i18n.loadJSON(pinyinNameJson, "pinyin");
    }
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
          console.error(
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

export function normalizeAddictionTypes(
  comestible: ComestibleSlot,
): { addiction: string; potential: number }[] {
  const addictionType = comestible.addiction_type;
  if (typeof addictionType === "string") {
    return [
      {
        addiction: addictionType,
        potential: comestible.addiction_potential ?? 0,
      },
    ];
  } else {
    return [];
  }
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

const _itemGroupFromVehicleCache = new Map<Vehicle, ItemGroupData>();
export function itemGroupFromVehicle(vehicle: Vehicle): ItemGroupData {
  if (_itemGroupFromVehicleCache.has(vehicle))
    return _itemGroupFromVehicleCache.get(vehicle)!;
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

function createHttpStatusError(
  status: number,
  url: string,
  statusText?: string,
): Error & { status: number } {
  const prefix = status === 404 ? "404" : `HTTP ${status}`;
  const suffix = statusText ? ` ${statusText}` : "";
  const error = new Error(`${prefix}${suffix}: ${url}`) as Error & {
    status: number;
  };
  error.status = status;
  return error;
}

const fetchJsonWithProgress = (
  url: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
): Promise<any> => {
  // GoogleBot has a 15MB limit on the size of the response, so we need to
  // serve it double-gzipped JSON.
  if (/latest/.test(url) && /googlebot/i.test(navigator.userAgent))
    return fetchGzippedJsonForGoogleBot(url);
  if (isTesting) {
    progress(100, 100);
    return fetch(url).then((r) => {
      if (!r.ok && r.status === 404) {
        throw createHttpStatusError(404, url, r.statusText);
      }
      return r.json();
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const handleError = (type: string) => {
      const status = xhr.status;
      // If status is 404, we definitely have a missing file.
      // If status is 0, it often means a CORS error, network error,
      // or a request aborted by the browser/extensions.
      if (status === 404) {
        reject(createHttpStatusError(404, url, xhr.statusText));
        return;
      }
      if (status === 0) {
        reject(new Error(`Network/CORS/Abort: ${url}`));
        return;
      }
      reject(
        new Error(
          `${type} ${status} (${xhr.statusText}) while fetching ${url}`,
        ),
      );
    };

    xhr.onload = (e) => {
      if (xhr.status === 404) {
        reject(createHttpStatusError(404, url, xhr.statusText));
      } else if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.response) resolve(xhr.response);
        else reject(new Error(`Empty/invalid JSON response from ${url}`));
      } else {
        handleError("Status");
      }
    };
    xhr.onprogress = (e) => {
      progress(e.loaded, e.lengthComputable ? e.total : 0);
    };
    xhr.onerror = () => handleError("Error");
    xhr.onabort = () => handleError("Aborted");
    xhr.open("GET", url);
    xhr.responseType = "json";
    xhr.send();
  });
};

async function fetchGzippedJsonForGoogleBot(url: string): Promise<any> {
  const gzUrl = url.replace(/latest/, "latest.gz");
  const res = await fetch(gzUrl, { mode: "cors" });
  if (!res.ok)
    throw new Error(`Error ${res.status} (${res.statusText}) fetching ${url}`);
  if (!res.body)
    throw new Error(`No body in response from ${url} (status ${res.status})`);

  // Use DecompressionStream to decompress the gzipped response
  const decompressionStream = new (globalThis as any).DecompressionStream(
    "gzip",
  );
  const decompressedStream: ReadableStream<ArrayBuffer> =
    res.body.pipeThrough(decompressionStream);

  const text = await new Response(decompressedStream).text();
  return JSON.parse(text);
}

const fetchJson = async (
  version: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
) => {
  return fetchJsonWithProgress(getDataJsonUrl(version, "all.json"), progress);
};

const fetchLocaleJson = async (
  version: string,
  locale: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
) => {
  return fetchJsonWithProgress(
    getDataJsonUrl(version, `lang/${locale}.json`),
    progress,
  );
};

type ParsedModsJson = {
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

function parseModsJson(rawMods: unknown): ParsedModsJson {
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

/**
 * Checks if an error corresponds to a 404 Not Found response.
 * Handles both Error objects with messages and raw strings.
 *
 * @param error The error to check
 */
function is404Error(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.trim()
      : typeof error === "string"
        ? error.trim()
        : "";
  if (/^(?:HTTP\s+)?404\b/i.test(message)) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  ) {
    return true;
  }

  return false;
}

const fetchModsJson = async (
  version: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
) => {
  return fetchJsonWithProgress(
    getDataJsonUrl(version, "all_mods.json"),
    progress,
  );
};

/**
 * Loads and parses the mod index with background retries.
 *
 * SILENT FAIL POLICY: If loading fails due to missing `all_mods.json` (404),
 * this function returns null instead of throwing. Other failures (network/parsing)
 * are propagated to avoid masking data corruption or unexpected errors.
 */
async function loadParsedModsJson(
  version: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
): Promise<ParsedModsJson | null> {
  try {
    const modsJson = await retry(() => fetchModsJson(version, progress));
    return parseModsJson(modsJson);
  } catch (e) {
    if (is404Error(e)) {
      return null;
    }
    throw e;
  }
}

function applyLoadedModsMetadata(
  targetData: CBNData,
  parsedMods: ParsedModsJson | null,
): void {
  targetData.mods = parsedMods?.mods ?? [];
  targetData.active_mods = targetData.active_mods ?? [];
  targetData.raw_mods_json = parsedMods?.raw ?? {};
  targetData._clearModProvenanceCaches();
}

/**
 * Retry a promise-generating function with exponential backoff.
 * Max 3 attempts with increasing delays: 2s, 4s, 8s.
 * @throws Error with user-friendly message if all attempts fail
 */
async function retry<T>(promiseGenerator: () => Promise<T>): Promise<T> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await promiseGenerator();
    } catch (e) {
      if (is404Error(e)) {
        // Fast-fail for missing files (including CORS-blocked 404s)
        throw e;
      }
      console.error(`Attempt ${attempt}/${MAX_RETRIES} failed:`, e);

      if (attempt === MAX_RETRIES) {
        // Final attempt failed - show user-friendly error
        throw new Error(
          `Failed to load data after ${MAX_RETRIES} attempts. ` +
            `Please check your internet connection and try refreshing the page.`,
        );
      }

      // Exponential backoff: 2s, 4s, 8s
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`Retrying in ${delayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // TypeScript flow analysis - should never reach here
  throw new Error("Unexpected: retry loop exhausted");
}

const loadProgressStore = writable<[number, number] | null>(null);
export const loadProgress = { subscribe: loadProgressStore.subscribe };
let _hasSetVersion = false;
let _currentData: CBNData | null = null;
let _ensureModsLoadedPromise: Promise<void> | null = null;
const { subscribe, set } = writable<CBNData | null>(null);
export const data = {
  subscribe,
  async setVersion(
    version: string,
    locale: string | null,
    versionSlug?: string,
    availableLangs?: string[],
    activeMods: string[] = [],
  ) {
    if (_hasSetVersion && !isTesting)
      throw new Error("can only set version once");
    _hasSetVersion = true;
    _ensureModsLoadedPromise = null;
    let totals = [0, 0, 0, 0];
    let receiveds = [0, 0, 0, 0];
    const updateProgress = () => {
      const total = totals.reduce((a, b) => a + b, 0);
      const received = receiveds.reduce((a, b) => a + b, 0);
      loadProgressStore.set(received > 0 ? [received, total] : null);
    };
    updateProgress();
    const urlVersion = versionSlug ?? version;
    const dataJson = await retry(() =>
      fetchJson(urlVersion, (receivedBytes, totalBytes) => {
        totals[0] = totalBytes;
        receiveds[0] = receivedBytes;
        updateProgress();
      }),
    );

    let localeJson: any = null;
    let pinyinNameJson: any = null;
    let effective_locale = "en";

    if (locale && locale !== "en") {
      const loadLocale = async (loc: string, index: number) => {
        return retry(() =>
          fetchLocaleJson(version, loc, (receivedBytes, totalBytes) => {
            totals[index] = totalBytes;
            receiveds[index] = receivedBytes;
            updateProgress();
          }),
        );
      };

      // Determine the best available locale using metadata if provided.
      // Strategy:
      // 1. Exact match (e.g. "ru_RU" -> "ru_RU")
      // 2. Base language match (e.g. "ru_RU" -> "ru")
      // 3. Fallback to requested locale (letting it fail later if truly missing)
      let targetLocale: string | null = null;
      if (availableLangs) {
        if (availableLangs.includes(locale)) {
          targetLocale = locale;
        } else {
          const partialLocale = locale.split("_")[0];
          if (availableLangs.includes(partialLocale)) {
            targetLocale = partialLocale;
          }
        }
      } else {
        // Fallback for cases where metadata is missing (e.g. tests)
        targetLocale = locale;
      }

      if (targetLocale) {
        try {
          localeJson = await loadLocale(targetLocale, 1);
          effective_locale = targetLocale;
          if (targetLocale.startsWith("zh_")) {
            try {
              pinyinNameJson = await loadLocale(targetLocale + "_pinyin", 2);
            } catch (e) {
              console.warn(`Failed to load pinyin for ${targetLocale}`, e);
            }
          }
        } catch (e) {
          console.error(
            `Failed to load locale ${targetLocale}, falling back to English:`,
            e,
          );
          effective_locale = "en";
        }
      }
    }

    let mods: ModInfo[] | null = null;
    let filteredActiveMods: string[] | null = null;
    let rawModsJson: Record<string, ModData> | null = null;
    let mergedData = dataJson.data;
    const requestedActiveMods = activeMods.filter((modId) => modId !== "bn");

    if (requestedActiveMods.length > 0) {
      const parsedMods = await loadParsedModsJson(
        urlVersion,
        (receivedBytes, totalBytes) => {
          totals[3] = totalBytes;
          receiveds[3] = receivedBytes;
          updateProgress();
        },
      );
      if (parsedMods) {
        mods = parsedMods.mods;
        rawModsJson = parsedMods.raw;
        filteredActiveMods = filterActiveMods(
          requestedActiveMods,
          parsedMods.byId,
        );
        mergedData = mergeDataWithActiveMods(
          dataJson.data,
          parsedMods.byId,
          filteredActiveMods,
        );
      } else {
        mods = [];
        filteredActiveMods = [];
        rawModsJson = {};
      }
    }

    const instance = new CBNData(
      mergedData,
      dataJson.build_number,
      dataJson.release,
      urlVersion,
      effective_locale,
      locale || "en",
      mods,
      filteredActiveMods,
      rawModsJson,
    );
    try {
      if (localeJson) instance.setLocale(localeJson, pinyinNameJson);
    } catch (e) {
      console.error("Failed to apply locale JSON:", e);
      instance.effective_locale = "en";
    }
    _currentData = instance;
    set(instance);
  },
  async ensureModsLoaded() {
    const startData = _currentData;
    if (!startData || startData.mods !== null) return;

    if (_ensureModsLoadedPromise) {
      await _ensureModsLoadedPromise;
      return;
    }

    _ensureModsLoadedPromise = (async () => {
      const modsVersion = startData.fetching_version ?? startData.build_number;
      if (!modsVersion) {
        if (_currentData !== startData) return;
        applyLoadedModsMetadata(startData, null);
        _currentData = startData;
        set(startData);
        return;
      }

      const parsedMods = await loadParsedModsJson(modsVersion, () => {});
      if (_currentData !== startData) return;
      applyLoadedModsMetadata(startData, parsedMods);

      if (_currentData !== startData) return;
      _currentData = startData;
      set(startData);
    })();

    try {
      await _ensureModsLoadedPromise;
    } finally {
      _ensureModsLoadedPromise = null;
    }
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
      return singularName(omt);
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
