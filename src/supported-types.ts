import type { SupportedTypesWithMapped } from "./types";

// `satisfies` ensures every key is a valid keyof SupportedTypesWithMapped.
// Add/remove here; TS errors if a key doesn't exist in the type.
const SUPPORTED_TYPE_KEYS = {
  AMMO: null,
  ARMOR: null,
  BATTERY: null,
  BIONIC_ITEM: null,
  BOOK: null,
  COMESTIBLE: null,
  CONTAINER: null,
  ENGINE: null,
  GENERIC: null,
  GUN: null,
  GUNMOD: null,
  MAGAZINE: null,
  MONSTER: null,
  PET_ARMOR: null,
  TOOL: null,
  TOOLMOD: null,
  TOOL_ARMOR: null,
  WHEEL: null,
  city_building: null,
  construction: null,
  damage_type: null,
  fault: null,
  // "flag": null,
  item: null,
  item_group: null,
  json_flag: null,
  mapgen: null,
  material: null,
  monster: null,
  monstergroup: null,
  mutation: null,
  overmap_special: null,
  recipe: null,
  requirement: null,
  skill: null,
  // spell: null,
  technique: null,
  terrain: null,
  trap: null,
  uncraft: null,
  vehicle: null,
  vehicle_part: null,
} satisfies Partial<Record<keyof SupportedTypesWithMapped, null>>;

const supportedTypes = new Set(Object.keys(SUPPORTED_TYPE_KEYS));

export function isSupportedType(
  type: string,
): type is keyof SupportedTypesWithMapped {
  return supportedTypes.has(type);
}
