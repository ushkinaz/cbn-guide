/**
 * Internationalization (i18n) utility for the Cataclysm: Bright Nights guide.
 *
 * ARCHITECTURE:
 * The application uses two distinct translation systems:
 *
 * 1. **Transifex (`@transifex/native`)**:
 *    Used for static UI strings within the web application (e.g., button labels, headers).
 *    Strings are extracted at build time and served via Transifex Native.
 *    Use the `t()` function imported from `@transifex/native` for these.
 *
 * 2. **Gettext (`gettext.js`)**:
 *    Used for dynamic game content (items, monsters, etc.) loaded from external JSON data.
 *    These strings are translated at runtime using pre-compiled gettext dictionaries from the game.
 *    Functions in this module prefixed with `game` (e.g., `gameSingular`) use this system.
 */
import type { SupportedTypesWithMapped, Translation } from "../types";
import { t } from "@transifex/native";
import makeI18n, { type Gettext } from "gettext.js";
import { stripColorTags } from "./format";

/**
 * Translates a game entity type code into a human-readable display name.
 * This is needed because Transifex doesn't support translation of dynamically
 * generated strings, so we map these known keys to static calls.
 *
 * @param type The internal type key (e.g., "AMMO", "GENERIC").
 * @returns The translated display name.
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
    case "addiction_type":
      return t("Addiction Types");
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
    case "damage_info_order":
      return t("Damage Info Orders");
    case "damage_type":
      return t("Damage Types");
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
    case "harvest_drop_type":
      return t("Harvest Drop Types");
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
    case "sub_body_part":
      return t("Sub Body Parts");
    case "technique":
      return t("Techniques");
    case "terrain":
      return t("Terrain");
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
    //Adding a new type will trigger an error - this is intentional
  }
}

/**
 * Translates a season name into its localized version.
 */
export function translateSeason(season: string) {
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

export let i18n: Gettext = makeI18n();

/**
 * Resets the Gettext i18n singleton and sets the new locale.
 * Called when changing language versions.
 */
export function resetI18n(locale: string = "en"): void {
  i18n = makeI18n();
  i18n.setLocale(locale);
}

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

/**
 * Core translation function for game data strings.
 * Uses the Gettext to resolve translations, including variants
 * for number-based plurals.
 *
 * @param t The raw translation object or string from the game data.
 * @param needsPlural Whether this string needs a plural form.
 * @param n Cardinality for plural selection.
 * @param domain Optional text domain (e.g., for mods).
 */
export function gameTranslate(
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

/** Translates a game string into its singular form. */
export const gameSingular = (name: Translation): string =>
  gameTranslate(name, false, 1);

/** Translates a game string into its plural form (defaulting to n=2). */
export const gamePlural = (name: Translation, n: number = 2): string =>
  gameTranslate(name, true, n);

/** Translates a game object's name property into its singular form. */
export const gameSingularName = (obj: any, domain?: string): string =>
  gamePluralName(obj, 1, domain);

/** Translates a game object's name property into its plural form. */
export const gamePluralName = (
  obj: any,
  n: number = 2,
  domain?: string,
): string => {
  const name: Translation = obj?.name?.male ?? obj?.name;
  if (name == null) return obj?.id ?? obj?.abstract;
  const txed = Array.isArray(name)
    ? gameTranslate(name[0], needsPlural.includes(obj.type), n, domain)
    : gameTranslate(name, needsPlural.includes(obj.type), n, domain);
  if (txed.length === 0) return obj?.id ?? obj?.abstract;
  return txed;
};

export const byName = (a: any, b: any) =>
  gameSingularName(a).localeCompare(gameSingularName(b));
