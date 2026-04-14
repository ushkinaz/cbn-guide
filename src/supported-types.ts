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
  ITEM_CATEGORY: null,
  MAGAZINE: null,
  MONSTER: null,
  PET_ARMOR: null,
  SPELL: null,
  TOOL: null,
  TOOLMOD: null,
  TOOL_ARMOR: null,
  WHEEL: null,
  achievement: null,
  ammunition_type: null,
  ascii_art: null,
  bionic: null,
  body_part: null,
  city_building: null,
  construction: null,
  construction_group: null,
  effect_type: null,
  event_statistic: null,
  fault: null,
  furniture: null,
  harvest: null,
  item: null,
  item_action: null,
  item_group: null,
  json_flag: null,
  mapgen: null,
  martial_art: null,
  material: null,
  monster: null,
  monster_attack: null,
  monstergroup: null,
  mutation: null,
  mutation_category: null,
  mutation_type: null,
  overmap_special: null,
  overmap_terrain: null,
  palette: null,
  recipe: null,
  requirement: null,
  rotatable_symbol: null,
  skill: null,
  technique: null,
  terrain: null,
  tool_quality: null,
  trap: null,
  uncraft: null,
  vehicle: null,
  vehicle_part: null,
  vitamin: null,
  weapon_category: null,
  MONSTER_BLACKLIST: null,
  MONSTER_WHITELIST: null,
} satisfies Record<keyof SupportedTypesWithMapped, null>;

const supportedTypes = new Set(Object.keys(SUPPORTED_TYPE_KEYS));

/**
 * Guard whether a string names a content type the app actually knows how to route and render.
 *
 * This exists because route segments and JSON payloads arrive as plain strings, but the rest of
 * the app needs a trustworthy boundary before treating those strings as `SupportedTypesWithMapped`
 * keys. Without this check, malformed URLs or unknown upstream types could leak deeper into the
 * app and force routing, metadata, or rendering code to operate on invalid type names.
 *
 * In practice this is used as the narrow waist between untyped external input and the app's
 * supported content model: if this returns `true`, TypeScript can safely narrow the value to a
 * known supported type.
 *
 * @param type - Raw type name from routing state, game data, or other external input
 * @returns `true` when the type is one of the content kinds explicitly supported by the app
 */
export function isSupportedType(
  type: string,
): type is keyof SupportedTypesWithMapped {
  return supportedTypes.has(type);
}
