import makeI18n, { type Gettext } from "gettext.js";

import type { Translation } from "../types";

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
  return typeof t === "string" ? t : "str_sp" in t ? t.str_sp : t.str;
}

function getMsgIdPlural(t: Translation): string {
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
  return (
    i18n.dcnpgettext(domain, undefined, sg, pl, n) ||
    (n === 1 ? sg : (pl ?? sg))
  );
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
