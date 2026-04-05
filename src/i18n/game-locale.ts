/**
 * Runtime gettext helpers for Cataclysm: Bright Nights game data.
 *
 * ARCHITECTURE:
 * This module is the shared, Node-safe translation layer for strings that come
 * from external game JSON. It is used by application code, tests, and Node
 * scripts that reuse the shared data layer.
 *
 * Static UI labels extracted by Transifex live separately in
 * `src/i18n/transifex-static.ts` so browser-only imports do not leak into Node
 * entrypoints such as `scripts/gen-sitemap.ts`.
 */
import type { Translation } from "../types";
import makeI18n, { type Gettext } from "gettext.js";
import { stripColorTags } from "../utils/format";

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
 * Reset the shared gettext singleton and set the active locale.
 *
 * This is called when the app or a shared Node consumer switches language.
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
 * Translate a game-data string via gettext, including plural and mod domains.
 *
 * @param t The raw translation object or string from the game data.
 * @param needsPlural Whether this string needs a plural form.
 * @param n Cardinality for plural selection.
 * @param domain Optional text domain (for example, for mods).
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

/** Translate a game string into its singular form. */
export const gameSingular = (name: Translation): string =>
  gameTranslate(name, false, 1);

/** Translate a game string into its plural form, defaulting to `n = 2`. */
export const gamePlural = (name: Translation, n: number = 2): string =>
  gameTranslate(name, true, n);

/** Translate a game object's `name` property into its singular form. */
export const gameSingularName = (obj: any, domain?: string): string =>
  gamePluralName(obj, 1, domain);

/** Translate a game object's `name` property into its plural form. */
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
