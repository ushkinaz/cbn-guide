import type { SupportedTypesWithMapped } from "../types";
import { t } from "@transifex/native";

/**
 * Static Transifex-backed labels that must remain isolated from Node-safe
 * shared modules.
 *
 * Transifex extraction only recognizes literal `t("...")` calls, so known UI
 * labels that are selected dynamically are mapped here through explicit helper
 * functions. This module is intentionally browser-facing; shared code and Node
 * scripts should depend on `src/i18n/game-locale.ts` instead.
 */

/**
 * Translate a game entity type code into its display label.
 *
 * @param type The internal type key (for example, "AMMO" or "GENERIC").
 * @returns The translated display label.
 */
export function translateType(type: keyof SupportedTypesWithMapped): string {
  switch (type) {
    case "AMMO":
      return t("Ammunition");
    case "ARMOR":
      return t("Armor");
    case "BATTERY":
      return t("Batteries");
    case "BIONIC_ITEM":
      return t("Bionic Items");
    case "BOOK":
      return t("Books");
    case "COMESTIBLE":
      return t("Comestibles");
    case "CONTAINER":
      return t("Containers");
    case "ENGINE":
      return t("Engines");
    case "GENERIC":
      return t("Generic Items");
    case "GUN":
      return t("Guns");
    case "GUNMOD":
      return t("Gun Mods");
    case "MAGAZINE":
      return t("Magazines");
    case "MONSTER_WHITELIST":
      return t("Monsters Whitelists");
    case "MONSTER_BLACKLIST":
      return t("Monsters Blacklists");
    case "PET_ARMOR":
      return t("Pet Armor");
    case "TOOL":
      return t("Tools");
    case "TOOLMOD":
      return t("Tool Mods");
    case "TOOL_ARMOR":
      return t("Tool Armor");
    case "WHEEL":
      return t("Wheels");
    case "ITEM_CATEGORY":
      return t("Item Categories");
    case "MONSTER":
      return t("Monsters");
    case "SPELL":
      return t("Spells");
    case "achievement":
      return t("Achievements");
    case "ammunition_type":
      return t("Ammunition Types");
    case "ascii_art":
      return t("ASCII Art");
    case "bionic":
      return t("Bionics");
    case "body_part":
      return t("Body Parts");
    case "city_building":
      return t("City Buildings");
    case "construction":
      return t("Constructions");
    case "construction_group":
      return t("Construction Groups");
    case "effect_type":
      return t("Effect Types");
    case "event_statistic":
      return t("Event Statistics");
    case "fault":
      return t("Faults");
    case "furniture":
      return t("Furniture");
    case "harvest":
      return t("Harvests");
    case "item_action":
      return t("Item Actions");
    case "item_group":
      return t("Item Groups");
    case "json_flag":
      return t("Flags");
    case "mapgen":
      return t("Mapgens");
    case "martial_art":
      return t("Martial Arts");
    case "material":
      return t("Materials");
    case "monstergroup":
      return t("Monster Groups");
    case "mutation":
      return t("Mutations");
    case "mutation_category":
      return t("Mutation Categories");
    case "mutation_type":
      return t("Mutation Types");
    case "overmap_special":
      return t("Overmap Specials");
    case "overmap_terrain":
      return t("Overmap Terrain");
    case "palette":
      return t("Palettes");
    case "recipe":
      return t("Recipes");
    case "requirement":
      return t("Requirements");
    case "rotatable_symbol":
      return t("Rotatable Symbols");
    case "skill":
      return t("Skills");
    case "technique":
      return t("Techniques");
    case "terrain":
      return t("Terrain");
    case "trap":
      return t("Traps");
    case "tool_quality":
      return t("Qualities");
    case "uncraft":
      return t("Uncraft Recipes");
    case "vehicle":
      return t("Vehicles");
    case "vehicle_part":
      return t("Vehicle Parts");
    case "vitamin":
      return t("Vitamins");
    case "weapon_category":
      return t("Weapon Categories");
    case "monster_attack":
      return t("Monster Attacks");
    case "item":
      return t("Items");
    case "monster":
      return t("Monsters");
    // Adding a new type will trigger an error. This is intentional.
  }
}

/**
 * Translate a season label that must be expressed as a literal Transifex key.
 */
export function translateSeason(season: string): string {
  switch (season) {
    case "Spring":
      return t("Spring");
    case "Summer":
      return t("Summer");
    case "Autumn":
      return t("Autumn");
    case "Winter":
      return t("Winter");
    case "any season":
      return t("any season");
    default:
      return season;
  }
}
