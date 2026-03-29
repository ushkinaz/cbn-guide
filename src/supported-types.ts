import type { SupportedTypesWithMapped } from "./types";

const supportedTypes = new Set<string>([
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
  "MONSTER",
  "PET_ARMOR",
  "TOOL",
  "TOOLMOD",
  "TOOL_ARMOR",
  "WHEEL",
  "city_building",
  "construction",
  "damage_type",
  "fault",
  "flag",
  "item",
  "item_group",
  "json_flag",
  "mapgen",
  "material",
  "monster",
  "monstergroup",
  "mutation",
  "overmap_special",
  "profession",
  "recipe",
  "requirement",
  "skill",
  "spell",
  "technique",
  "terrain",
  "trap",
  "uncraft",
  "vehicle",
  "vehicle_part",
]);

/**
 * Type guard for entity types that the guide can render directly.
 */
export function isSupportedType(
  type: string,
): type is keyof SupportedTypesWithMapped {
  return supportedTypes.has(type);
}
