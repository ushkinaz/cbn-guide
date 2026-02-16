import { data, singular, singularName } from "./data";
import type {
  ArmorSlot,
  DamageInstance,
  DamageUnit,
  Furniture,
  ItemBasicInfo,
  SupportedTypeMapped,
  SupportedTypes,
  VehiclePart,
} from "./types";
import { get } from "svelte/store";
import { cleanText, formatDisplayValue, formatNumeric } from "./utils/format";

const MAX_DESCRIPTION_LENGTH = 160;
const TRIM_DESCRIPTION_LENGTH = 155;

const formatStat = (label: string, value: number | string): string =>
  `${label} ${formatDisplayValue(value)}`;

/**
 * Formats a list of stats into a human-readable string using "&" for the last item.
 */
const formatStatList = (stats: string[]): string => {
  if (stats.length === 0) return "";
  if (stats.length === 1) return stats[0];
  if (stats.length === 2) return `${stats[0]} & ${stats[1]}`;
  return `${stats.slice(0, -1).join(", ")} & ${stats[stats.length - 1]}`;
};

const toArray = (value?: string | string[] | null): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const formatFlags = (flags?: string | string[]): string | null => {
  const values = toArray(flags).filter(Boolean);
  if (values.length === 0) return null;
  return values.slice(0, 3).join(":");
};

const formatQualities = (qualities?: [string, number][]): string | null => {
  if (!qualities || qualities.length === 0) return null;

  const cbnData = get(data);
  const formatted = qualities
    .slice(0, 5)
    .map(([id, level]) => {
      const quality = cbnData?.byIdMaybe("tool_quality", id);
      const resolvedName = quality ? singularName(quality) : undefined;
      const safeName = resolvedName ?? id;
      if (!safeName) return null;
      return `${cleanText(safeName)} ${formatNumeric(level)}`;
    })
    .filter(Boolean);

  return formatted.length > 0 ? formatted.join(", ") : null;
};

const primaryDamageUnit = (damage?: DamageInstance): DamageUnit | null => {
  if (!damage) return null;
  if (Array.isArray(damage)) return damage[0] ?? null;
  if ("values" in damage) return damage.values[0] ?? null;
  return damage;
};

/**
 * Converts a string to Title Case (e.g., "vehicle_part" -> "Vehicle Part").
 */
const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const typeLabelForItem = (item: SupportedTypeMapped): string => {
  if (item.type === "GENERIC") return toTitleCase(item.category ?? "Generic");
  return toTitleCase(item.type ?? "Item");
};

const statsForMonster = (item: SupportedTypes["MONSTER"]): string[] => {
  const stats: string[] = [];
  const species = toArray(item.species as string | string[] | null);
  if (species.length > 0) stats.push(toTitleCase(species.join(" ")));
  if (item.hp != null) stats.push(formatStat("HP", item.hp));
  if (item.speed != null) stats.push(formatStat("Speed", item.speed));
  return stats;
};

const statsForAmmo = (item: SupportedTypes["AMMO"]): string[] => {
  const stats: string[] = [];
  const ammo_type = get(data)?.byIdMaybe("ammunition_type", item.ammo_type);
  if (ammo_type?.name) stats.push(singular(ammo_type.name));

  if (item.range) stats.push(formatStat("rng", item.range));
  if (item.dispersion) stats.push(formatStat("disp", item.dispersion));
  const damageUnit = primaryDamageUnit(item.damage);
  if (damageUnit?.amount != null)
    stats.push(formatStat("dmg", damageUnit.amount));
  if (damageUnit?.armor_penetration != null) {
    stats.push(formatStat("ap", damageUnit.armor_penetration));
  }
  return stats;
};

const statsForMagazine = (item: SupportedTypes["MAGAZINE"]): string[] => {
  const stats: string[] = [];
  const ammo_type = get(data)?.byIdMaybe(
    "ammunition_type",
    toArray(item.ammo_type)[0],
  );
  if (ammo_type?.name) stats.push(singular(ammo_type.name));
  if (item.capacity) stats.push(formatStat("cap", item.capacity));
  return stats;
};

const statsForGun = (item: SupportedTypes["GUN"]): string[] => {
  const stats: string[] = [];
  if (item.skill != null) stats.push(item.skill);
  if (item.ammo != null && typeof item.ammo == "string") {
    const ammo_type = get(data)?.byIdMaybe("ammunition_type", item.ammo);
    if (ammo_type?.name)
      stats.push(formatStat("ammo", singular(ammo_type.name)));
  }
  const damageUnit = primaryDamageUnit(item.ranged_damage);
  if (damageUnit?.amount != null)
    stats.push(formatStat("dmg", damageUnit.amount));
  if (item.dispersion != null) stats.push(formatStat("disp", item.dispersion));
  if (item.clip_size != null) stats.push(formatStat("clip", item.clip_size));
  return stats;
};

const statsForArmor = (item: ItemBasicInfo & ArmorSlot): string[] => {
  const stats: string[] = [];
  if (item.encumbrance != null) stats.push(formatStat("enc", item.encumbrance));
  if (item.coverage != null) stats.push(formatStat("cov", item.coverage));
  if (item.covers != null)
    stats.push(formatStat("covers", item.covers.join(",")));
  return stats;
};

const statsForFurniture = (item: Furniture): string[] => {
  const stats: string[] = [];
  if (item.coverage != null) stats.push(formatStat("cov", item.coverage));
  const flags = formatFlags(item.flags);
  if (flags) stats.push(`flags ${flags}`);
  return stats;
};

const statsForVehiclePart = (item: VehiclePart): string[] => {
  const stats: string[] = [];

  if (item.durability != null) stats.push(formatStat("dur", item.durability));
  const flags = formatFlags(item.flags);
  if (flags) stats.push(`flags ${flags}`);
  return stats;
};

const statsForBook = (item: SupportedTypes["BOOK"]): string[] => {
  const stats: string[] = [];
  if (item.skill != null) stats.push(item.skill);
  if (item.max_level != null) stats.push(formatStat("m.level", item.max_level));
  if (item.intelligence != null)
    stats.push(formatStat("int", item.intelligence));
  return stats;
};

const statsForContainer = (item: SupportedTypes["CONTAINER"]): string[] => {
  const stats: string[] = [];
  if (item.contains != null) stats.push(item.contains.toString());
  if (item.watertight != null && item.watertight) stats.push("watertight");
  return stats;
};

const statsForGeneric = (item: ItemBasicInfo): string[] => {
  const stats: string[] = [];
  const qualities = formatQualities(item.qualities);
  if (qualities) stats.push(`qual ${qualities}`);
  const flags = formatFlags(item.flags);
  if (flags) stats.push(`flags ${flags}`);
  return stats;
};

const descriptionForItem = (item: SupportedTypeMapped): string => {
  const desc =
    "description" in item && item.description ? singular(item.description) : "";
  if (!desc) return "";
  return cleanText(desc);
};

const statsRenderers: Partial<{
  [K in keyof SupportedTypes]: (item: SupportedTypes[K]) => string[];
}> = {
  AMMO: statsForAmmo,
  ARMOR: statsForArmor,
  BATTERY: statsForGeneric,
  BIONIC_ITEM: statsForGeneric,
  BOOK: statsForBook,
  COMESTIBLE: statsForGeneric,
  CONTAINER: statsForContainer,
  ENGINE: statsForGeneric,
  GENERIC: statsForGeneric,
  GUN: statsForGun,
  GUNMOD: statsForGeneric,
  MAGAZINE: statsForMagazine,
  MONSTER: statsForMonster,
  TOOL: statsForGeneric,
  TOOLMOD: statsForGeneric,
  TOOL_ARMOR: statsForArmor,
  WHEEL: statsForGeneric,
  furniture: statsForFurniture,
  vehicle_part: statsForVehiclePart,
};

const buildKeyStats = (item: SupportedTypeMapped): string[] => {
  const type = item.type as keyof SupportedTypes;
  const renderer = statsRenderers[type];
  if (renderer) {
    return (renderer as (item: any) => string[])(item);
  }

  return statsForGeneric(item as ItemBasicInfo);
};

/**
 * Generates a concise meta-description for a game entity.
 * Synchronized with a document. Title and optimized for SEO.
 */
export const buildMetaDescription = (item: SupportedTypeMapped): string => {
  const typeLabel = singular(typeLabelForItem(item));
  const keyStats = buildKeyStats(item);
  const statsText = formatStatList(keyStats);

  const base = statsText.length
    ? `${typeLabel}: ${statsText}.`
    : `${typeLabel}.`;

  const itemDescription = descriptionForItem(item);
  let description = base;

  if (itemDescription) {
    const combined = `${base} ${itemDescription}`;
    if (combined.length > TRIM_DESCRIPTION_LENGTH) {
      const remaining = TRIM_DESCRIPTION_LENGTH - base.length - 1;
      if (remaining > 10) {
        description = `${base} ${itemDescription.slice(0, remaining).trimEnd()}`;
        description = description.replace(/[ ,;:]+$/g, "");
      }
    } else {
      description = combined;
    }
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    description = description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
    description = description.replace(/[ ,;:]+$/g, "");
  }

  return description;
};
