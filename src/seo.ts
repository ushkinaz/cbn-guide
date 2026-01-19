import { singular, singularName } from "./data";
import type {
  DamageInstance,
  DamageUnit,
  Furniture,
  ItemBasicInfo,
  SupportedTypeMapped,
  SupportedTypes,
  VehiclePart,
} from "./types";

const MAX_DESCRIPTION_LENGTH = 160;
const TRIM_DESCRIPTION_LENGTH = 155;
const COLOR_TAG_REGEX = /<\/?color[^>]*>/gi;
const WHITESPACE_REGEX = /\s+/g;

const TOOL_LIKE_TYPES = new Set([
  "GENERIC",
  "TOOL",
  "TOOLMOD",
  "BATTERY",
  "BOOK",
  "COMESTIBLE",
  "CONTAINER",
  "ENGINE",
  "MAGAZINE",
  "WHEEL",
  "BIONIC_ITEM",
]);

const ARMOR_TYPES = new Set(["ARMOR", "PET_ARMOR", "TOOL_ARMOR"]);

const WEAPON_TYPES = new Set(["GUN", "GUNMOD"]);

const cleanText = (value: string): string =>
  value
    .replace(COLOR_TAG_REGEX, "")
    .replace(/\r?\n/g, " ")
    .replace(WHITESPACE_REGEX, " ")
    .trim();

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) return value.toString();
  return value
    .toFixed(2)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
};

const formatValue = (value: number | string): string =>
  typeof value === "number" ? formatNumber(value) : cleanText(value);

const formatStat = (label: string, value: number | string): string =>
  `${label} ${formatValue(value)}`;

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
  return values.slice(0, 3).join("/");
};

const formatMaterial = (
  material?: ItemBasicInfo["material"],
): string | null => {
  if (!material) return null;
  if (typeof material === "string") return cleanText(material);
  if (Array.isArray(material) && material.length > 0) {
    if (typeof material[0] === "string") {
      return (material as string[]).slice(0, 2).map(cleanText).join("/");
    }
    return (material as { type: string; portion?: number }[])
      .map((entry) => entry.type)
      .filter(Boolean)
      .slice(0, 2)
      .map(cleanText)
      .join("/");
  }
  return null;
};

const formatQualities = (qualities?: [string, number][]): string | null => {
  if (!qualities || qualities.length === 0) return null;
  return qualities
    .slice(0, 2)
    .map(([id, level]) => `${cleanText(id)} ${formatNumber(level)}`)
    .join(", ");
};

const mergeQualities = (item: ItemBasicInfo): string | null => {
  const combined = [
    ...(item.qualities ?? []),
    ...(item.charged_qualities ?? []),
  ];
  return formatQualities(combined);
};

const primaryDamageUnit = (damage?: DamageInstance): DamageUnit | null => {
  if (!damage) return null;
  if (Array.isArray(damage)) return damage[0] ?? null;
  if ("values" in damage) return damage.values[0] ?? null;
  return damage;
};

const typeLabelForItem = (item: SupportedTypeMapped): string => {
  if (item.type === "MONSTER") return "MONSTER";
  if (item.type === "AMMO") return "AMMO";
  if (WEAPON_TYPES.has(item.type)) return "WEAPON";
  if (ARMOR_TYPES.has(item.type)) return "ARMOR";
  if (item.type === "furniture") return "FURNITURE";
  if (item.type === "vehicle_part") return "VEHICLE_PART";
  return item.type?.toUpperCase?.() ?? "ITEM";
};

const statsForMonster = (item: SupportedTypes["MONSTER"]): string[] => {
  const stats: string[] = [];
  if (item.hp != null) stats.push(formatStat("HP", item.hp));
  if (item.speed != null) stats.push(formatStat("Speed", item.speed));
  if (item.diff != null) stats.push(formatStat("Diff", item.diff));
  return stats;
};

const statsForAmmo = (item: SupportedTypes["AMMO"]): string[] => {
  const stats: string[] = [];
  const damageUnit = primaryDamageUnit(item.damage);
  if (damageUnit?.amount != null)
    stats.push(formatStat("Dmg", damageUnit.amount));
  if (damageUnit?.armor_penetration != null) {
    stats.push(formatStat("AP", damageUnit.armor_penetration));
  }
  if (item.ammo_type) stats.push(formatStat("Type", item.ammo_type));
  return stats;
};

const statsForWeapon = (item: SupportedTypes["GUN"]): string[] => {
  const stats: string[] = [];
  const damageUnit = primaryDamageUnit(item.ranged_damage);
  if (damageUnit?.amount != null)
    stats.push(formatStat("Dmg", damageUnit.amount));
  if (item.dispersion != null) stats.push(formatStat("Disp", item.dispersion));
  if (item.clip_size != null) stats.push(formatStat("Clip", item.clip_size));
  return stats;
};

const statsForArmor = (
  item: ItemBasicInfo & SupportedTypes["ARMOR"],
): string[] => {
  const stats: string[] = [];
  const armorItem = item as any; // Armor stats may be on base or portion data
  if (armorItem.armor_bash != null)
    stats.push(formatStat("Bash", armorItem.armor_bash));
  if (armorItem.armor_cut != null)
    stats.push(formatStat("Cut", armorItem.armor_cut));
  if (item.encumbrance != null) stats.push(formatStat("Enc", item.encumbrance));
  if (item.coverage != null) stats.push(formatStat("Cov", item.coverage));
  return stats;
};

const statsForFurniture = (item: Furniture): string[] => {
  const stats: string[] = [];
  const durability = item.bash?.str_max;
  if (durability != null) stats.push(formatStat("Dur", durability));
  const flags = formatFlags(item.flags);
  if (flags) stats.push(`Flags ${flags}`);
  return stats;
};

const statsForVehiclePart = (item: VehiclePart): string[] => {
  const stats: string[] = [];
  const durability =
    item.durability ??
    (typeof (item as { bash?: { str_max?: number } }).bash?.str_max === "number"
      ? (item as { bash?: { str_max?: number } }).bash?.str_max
      : undefined);
  if (durability != null) stats.push(formatStat("Dur", durability));
  const flags = formatFlags(item.flags);
  if (flags) stats.push(`Flags ${flags}`);
  return stats;
};

const statsForToolLike = (item: ItemBasicInfo): string[] => {
  const stats: string[] = [];
  const qualities = mergeQualities(item);
  if (qualities) stats.push(`Qual ${qualities}`);
  const flags = formatFlags(item.flags);
  if (flags) stats.push(`Flags ${flags}`);
  return stats;
};

const descriptionForItem = (item: SupportedTypeMapped): string => {
  const desc =
    "description" in item && item.description ? singular(item.description) : "";
  if (!desc) return "";
  return cleanText(desc);
};

const secondaryInfoForItem = (item: SupportedTypeMapped): string => {
  const parts: string[] = [];

  if (item.type === "MONSTER") {
    const monster = item as SupportedTypes["MONSTER"];
    if (monster.size) parts.push(formatStat("Size", monster.size));
    if (monster.weight) parts.push(formatStat("Wt", monster.weight));
    const material = formatMaterial(monster.material);
    if (material) parts.push(formatStat("Mat", material));
    const flags = formatFlags(monster.flags);
    if (flags) parts.push(`Flags ${flags}`);
    return parts.join(", ");
  }

  if (item.type === "AMMO") {
    const ammo = item as SupportedTypes["AMMO"];
    if (ammo.ammo_type) parts.push(formatStat("Type", ammo.ammo_type));
    if (ammo.effects?.length) {
      parts.push(
        `Effects ${ammo.effects.slice(0, 3).map(cleanText).join("/")}`,
      );
    }
    return parts.join(", ");
  }

  if (WEAPON_TYPES.has(item.type)) {
    const weapon = item as SupportedTypes["GUN"];
    if (weapon.range != null) parts.push(formatStat("Range", weapon.range));
    if (weapon.recoil != null) parts.push(formatStat("Recoil", weapon.recoil));
    return parts.join(", ");
  }

  if (ARMOR_TYPES.has(item.type)) {
    const armor = item as ItemBasicInfo & SupportedTypes["ARMOR"];
    const flags = formatFlags(armor.flags);
    if (flags) parts.push(`Flags ${flags}`);
    if (armor.environmental_protection != null) {
      parts.push(formatStat("EP", armor.environmental_protection));
    }
    return parts.join(", ");
  }

  if (item.type === "furniture") {
    const furniture = item as Furniture;
    if (furniture.required_str != null) {
      parts.push(formatStat("ReqStr", furniture.required_str));
    }
    if (furniture.move_cost_mod != null) {
      parts.push(formatStat("Move", furniture.move_cost_mod));
    }
    return parts.join(", ");
  }

  if (item.type === "vehicle_part") {
    const part = item as VehiclePart;
    if (part.item) parts.push(formatStat("Item", part.item));
    if (part.power != null) parts.push(formatStat("Power", part.power));
    return parts.join(", ");
  }

  if (TOOL_LIKE_TYPES.has(item.type)) {
    const tool = item as ItemBasicInfo;
    if (tool.weight != null) parts.push(formatStat("Wt", tool.weight));
    if (tool.volume != null) parts.push(formatStat("Vol", tool.volume));
    return parts.join(", ");
  }

  return "";
};

const buildKeyStats = (item: SupportedTypeMapped): string[] => {
  if (item.type === "MONSTER")
    return statsForMonster(item as SupportedTypes["MONSTER"]);
  if (item.type === "AMMO") return statsForAmmo(item as SupportedTypes["AMMO"]);
  if (WEAPON_TYPES.has(item.type))
    return statsForWeapon(item as SupportedTypes["GUN"]);
  if (ARMOR_TYPES.has(item.type))
    return statsForArmor(item as ItemBasicInfo & SupportedTypes["ARMOR"]);
  if (item.type === "furniture") return statsForFurniture(item as Furniture);
  if (item.type === "vehicle_part")
    return statsForVehiclePart(item as VehiclePart);
  if (TOOL_LIKE_TYPES.has(item.type))
    return statsForToolLike(item as ItemBasicInfo);
  return statsForToolLike(item as ItemBasicInfo);
};

export const buildMetaDescription = (item: SupportedTypeMapped): string => {
  const name = cleanText(singularName(item));
  const rawId =
    "id" in item ? (Array.isArray(item.id) ? item.id.join("/") : item.id) : "";
  const fallbackId =
    "abstract" in item && typeof item.abstract === "string"
      ? item.abstract
      : "";
  const id = cleanText(rawId || fallbackId || "unknown");
  const typeLabel = typeLabelForItem(item);
  const keyStats = buildKeyStats(item);
  const statsText = formatStatList(keyStats);

  const base = statsText.length
    ? `${name} (${id}) stats. ${typeLabel} with ${statsText}.`
    : `${name} (${id}) stats. ${typeLabel}.`;

  const secondary = secondaryInfoForItem(item);
  const itemDescription = descriptionForItem(item);
  let description = secondary ? `${base} ${secondary}` : base;
  if (itemDescription) {
    description = description
      ? `${description} ${itemDescription}`
      : itemDescription;
  }

  if (description.length > TRIM_DESCRIPTION_LENGTH) {
    if (secondary || itemDescription) {
      const remaining = TRIM_DESCRIPTION_LENGTH - base.length - 1;
      if (remaining > 0) {
        const tail = [secondary, itemDescription].filter(Boolean).join(" ");
        description = `${base} ${tail.slice(0, remaining).trimEnd()}`;
      } else {
        description = base;
      }
      description = description.replace(/[ ,;:]+$/g, "");
    }
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    description = description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd();
  }

  return description;
};
