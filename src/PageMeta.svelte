<script lang="ts">
import { t } from "@transifex/native";
import { isSupportedType } from "./supported-types";
import { gameSingular, gameSingularName } from "./i18n/gettext";
import { RUNNING_MODE } from "./utils/env";
import { UI_GUIDE_NAME } from "./constants";
import { buildURL } from "./routing.svelte";
import { data } from "./data";
import type {
  ArmorSlot,
  DamageInstance,
  DamageUnit,
  Furniture,
  ItemBasicInfo,
  SupportedTypeMapped,
  SupportedTypes,
  SupportedTypesWithMapped,
  Trap,
  VehiclePart,
} from "./types";
import { asArray } from "./utils/collections";
import { cleanText, formatDisplayValue, formatNumeric } from "./utils/format";
import { type BuildInfo, buildsState, STABLE_VERSION } from "./builds.svelte";
import { navigation } from "./navigation.svelte";
import { translateType } from "./i18n/transifex-static";
import { onMount } from "svelte";

const PAGE_DESCRIPTION_CONTEXT = "Page description";
const SEARCH_RESULTS_CONTEXT = "Search Results";

let builds: BuildInfo[] | null = $derived(buildsState.current?.builds ?? null);

let canonicalUrl = $derived(
  new URL(
    buildURL(STABLE_VERSION, navigation.target, {
      localeParam: navigation.locale,
      modsParam: navigation.mods,
    }),
    location.origin,
  ).toString(),
);

function formatTitle(pageTitle: string | null = null): string {
  if (RUNNING_MODE === "pwa") {
    return pageTitle ?? "";
  }
  return pageTitle ? `${pageTitle} | ${UI_GUIDE_NAME}` : UI_GUIDE_NAME;
}

const defaultMetaDescription = t(
  "{guide} data reference for Cataclysm: Bright Nights.",
  { guide: UI_GUIDE_NAME },
);

let title = $derived.by((): string => {
  const target = navigation.target;
  try {
    if (
      $data &&
      target.kind === "item" &&
      isSupportedType(target.type) &&
      $data.byIdMaybe(target.type, target.id)
    ) {
      const it = $data.byId(target.type, target.id);
      return formatTitle(gameSingularName(it));
    } else if (target.kind === "catalog") {
      return formatTitle(
        translateType(target.type as keyof SupportedTypesWithMapped),
      );
    } else if (target.kind === "search") {
      return formatTitle(
        `${t("Search:", { _context: SEARCH_RESULTS_CONTEXT })} ${target.query}`,
      );
    }
    return formatTitle();
  } catch (error: unknown) {
    console.warn("Failed to build page title", error);
    return formatTitle();
  }
});

let description = $derived.by((): string => {
  const target = navigation.target;
  try {
    if (
      target.kind === "item" &&
      $data &&
      isSupportedType(target.type) &&
      $data.byIdMaybe(target.type, target.id)
    ) {
      const it = $data.byId(target.type, target.id);
      return buildMetaDescription(it);
    } else if (target.kind === "catalog") {
      return t("{type} catalog in {guide}.", {
        type: translateType(target.type as keyof SupportedTypesWithMapped),
        guide: UI_GUIDE_NAME,
        _context: PAGE_DESCRIPTION_CONTEXT,
      });
    } else if (target.kind === "search") {
      return t("Search {guide} for {query}.", {
        guide: UI_GUIDE_NAME,
        query: target.query,
        _context: PAGE_DESCRIPTION_CONTEXT,
      });
    }
    return defaultMetaDescription;
  } catch (error: unknown) {
    console.warn("Failed to build page description", error);
    return defaultMetaDescription;
  }
});

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

const formatFlags = (flags?: string | string[]): string | null => {
  const values = asArray(flags).filter(Boolean);
  if (values.length === 0) return null;
  return values.slice(0, 3).join(":");
};

const formatQualities = (qualities?: [string, number][]): string | null => {
  if (!qualities || qualities.length === 0) return null;

  const formatted = qualities
    .slice(0, 5)
    .map(([id, level]) => {
      const quality = $data?.byIdMaybe("tool_quality", id);
      const resolvedName = quality ? gameSingularName(quality) : undefined;
      const safeName = resolvedName ?? id;
      if (!safeName) return null;
      return `${cleanText(safeName)} ${formatNumeric(level)}`;
    })
    .filter(Boolean);

  return formatted.length > 0 ? formatted.join(", ") : null;
};

const primaryDamageUnit = (
  damage?: DamageInstance | number,
): DamageUnit | null => {
  if (damage == null) return null;
  if (typeof damage === "number") {
    return {
      damage_type: "bullet",
      amount: damage,
      armor_penetration: 0,
    };
  }
  if (Array.isArray(damage)) return damage[0] ?? null;
  if (
    typeof damage === "object" &&
    "values" in damage &&
    Array.isArray(damage.values)
  )
    return damage.values[0] ?? null;
  if (typeof damage === "object") return damage as DamageUnit;
  return null;
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
  const species = asArray(item.species as string | string[] | null);
  if (species.length > 0) stats.push(toTitleCase(species.join(" ")));
  if (item.hp != null) stats.push(formatStat("HP", item.hp));
  if (item.speed != null) stats.push(formatStat("Speed", item.speed));
  return stats;
};

const statsForAmmo = (item: SupportedTypes["AMMO"]): string[] => {
  const stats: string[] = [];
  const ammo_type = $data?.byIdMaybe("ammunition_type", item.ammo_type);
  if (ammo_type?.name) stats.push(gameSingular(ammo_type.name));

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
  const ammo_type = $data?.byIdMaybe(
    "ammunition_type",
    asArray(item.ammo_type)[0],
  );
  if (ammo_type?.name) stats.push(gameSingular(ammo_type.name));
  if (item.capacity) stats.push(formatStat("cap", item.capacity));
  return stats;
};

const statsForGun = (item: SupportedTypes["GUN"]): string[] => {
  const stats: string[] = [];
  if (item.skill != null) stats.push(item.skill);
  if (item.ammo != null && typeof item.ammo == "string") {
    const ammo_type = $data?.byIdMaybe("ammunition_type", item.ammo);
    if (ammo_type?.name)
      stats.push(formatStat("ammo", gameSingular(ammo_type.name)));
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
    "description" in item && item.description
      ? gameSingular(item.description)
      : "";
  if (!desc) return "";
  return cleanText(desc);
};

const statsForTrap = (item: Trap): string[] => {
  const stats: string[] = [];
  if (item.visibility != null) stats.push(formatStat("vis", item.visibility));
  if (item.avoidance != null) stats.push(formatStat("avoid", item.avoidance));
  if (item.difficulty != null) stats.push(formatStat("diff", item.difficulty));
  return stats;
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
  trap: statsForTrap,
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
 * Synchronized with a document title and optimized for SEO.
 */
export function buildMetaDescription(item: SupportedTypeMapped): string {
  const typeLabel = gameSingular(typeLabelForItem(item));
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
}

onMount(() => {
  const defaultTitle = document.getElementById("default-title");
  defaultTitle?.remove();

  const defaultDescription = document.getElementById("default-description");
  defaultDescription?.remove();
});
</script>

<svelte:head>
  <title>{title}</title>
  <meta content={title} property="og:title" />
  <meta content={description} name="description" property="og:description" />
  {#if builds}
    <link rel="canonical" href={canonicalUrl} />
    {@const currentBuild = builds.find(
      (b) => b.build_number === navigation.buildResolvedVersion,
    )}
    {#if currentBuild}
      {#each [...(currentBuild.langs ?? [])].sort( (a, b) => a.localeCompare(b), ) as lang}
        <link
          rel="alternate"
          hreflang={lang.replace("_", "-")}
          href={new URL(
            buildURL(navigation.buildRequestedVersion, navigation.target, {
              localeParam: lang,
              modsParam: navigation.mods,
            }),
            location.origin,
          ).toString()} />
      {/each}
    {/if}
  {/if}
</svelte:head>
