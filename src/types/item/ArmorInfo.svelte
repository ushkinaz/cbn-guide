<script lang="ts">
import { getContext } from "svelte";
import { CBNData, singular } from "../../data";
import { formatFixed2 } from "../../utils/format";
import type {
  ArmorPortionData,
  ArmorSlot,
  CoveredPart,
  ItemBasicInfo,
} from "../../types";

export let item: ItemBasicInfo & ArmorSlot;
let data = getContext<CBNData>("data");

function isStrings<T>(array: string[] | T[]): array is string[] {
  return typeof array[0] === "string";
}

const normalizedMaterial =
  item.material == null
    ? []
    : typeof item.material === "string"
      ? [{ type: item.material, portion: 1 }]
      : isStrings(item.material)
        ? item.material.map((s) => ({ type: s, portion: 1 }))
        : item.material;

let materials = normalizedMaterial.map((m) => ({
  material: data.byId("material", m.type),
  portion: m.portion,
}));
const totalMaterialPortion = materials.reduce(
  (m, o) => m + (o.portion ?? 1),
  0,
);

/**
 * Contains all armor parts from all sources
 */
const armor: ArmorPortionData[] = [
  ...(item.armor_portion_data ?? []),
  ...(Array.isArray(item.covers) ? [item] : []),
];

/**
 * Needed for correct mapping.
 * All body parts not present in the mapping are used as is.
 * Key is in fact an alias for value parts.
 */
const bodyPartsMapping: Map<CoveredPart, Coverage> = new Map([
  [
    "arm_either",
    { alias: "arm_either", either: false, parts: ["arm_l", "arm_r"] },
  ],
  ["arms", { alias: "arms", either: false, parts: ["arm_l", "arm_r"] }],
  [
    "foot_either",
    { alias: "foot_either", either: true, parts: ["foot_l", "foot_r"] },
  ],
  ["feet", { alias: "feet", either: true, parts: ["foot_l", "foot_r"] }],
  [
    "hand_either",
    { alias: "hand_either", either: true, parts: ["hand_l", "hand_r"] },
  ],
  ["hands", { alias: "hands", either: false, parts: ["hand_l", "hand_r"] }],
  [
    "leg_either",
    { alias: "leg_either", either: true, parts: ["leg_l", "leg_r"] },
  ],
  ["legs", { alias: "legs", either: false, parts: ["leg_l", "leg_r"] }],
]);

const { expandedCoverage, allParts } = calculateMergedCoverage();

function covers(bodyPart: CoveredPart): boolean {
  return allParts.has(bodyPart);
}

let covers_anything =
  (item.covers ?? []).length || (item.armor_portion_data ?? []).length;

type Coverage = {
  /**
   * 'legs', 'leg_either' etc
   */
  alias?: string;
  /**
   * cover either left or right but not both
   */
  either: boolean;
  parts: CoveredPart[];
};

function calculateMergedCoverage(): {
  expandedCoverage: Coverage[];
  allParts: Set<CoveredPart>;
} {
  const coversExpanded: Coverage[] = [];
  let coversMerged = new Set<CoveredPart>();

  for (const armorPortion of armor) {
    for (const coveredPart of armorPortion.covers ?? []) {
      const { expandedCoverage: parts, allParts: mergedParts } =
        expandCoverage(coveredPart);
      coversExpanded.push(parts);
      coversMerged = new Set([...coversMerged, ...mergedParts]);
    }
  }

  // At this point coversExpanded might have duplicates with different "either"
  // we need to deduplicate
  const dedupedCoversExpanded: Coverage[] = [];
  for (const cover of coversExpanded) {
    // No way there are two armor parts covering same part "either" and "and".
    // Therefore, no need to dedupe such entries

    if (cover.parts.length > 1) {
      dedupedCoversExpanded.push(cover);
    } else {
      let found = false;
      for (const innerCover of coversExpanded) {
        //At this point cover.parts.length == 1
        if (innerCover.parts.includes(cover.parts[0])) {
          found = true;
          break;
        }
      }
      if (!found) {
        dedupedCoversExpanded.push(cover);
      }
    }
  }
  return { expandedCoverage: dedupedCoversExpanded, allParts: coversMerged };
}

/**
 *
 * @param bp_id
 * @returns {expandedCoverage} an actual low-level parts
 * @returns {allParts} an array of all possible names of covered parts. ['arms', 'arm_l', 'arm_r']
 *
 */
function expandCoverage(bp_id: CoveredPart): {
  expandedCoverage: Coverage;
  allParts: Set<CoveredPart>;
} {
  let compositeCoverage = bodyPartsMapping.get(bp_id);
  if (compositeCoverage) {
    return {
      expandedCoverage: compositeCoverage,
      allParts: new Set([bp_id, ...compositeCoverage.parts]),
    };
  } else {
    return {
      expandedCoverage: {
        either: false,
        parts: [bp_id],
      },
      allParts: new Set([bp_id]),
    };
  }
}

function coverageLabel(apd: ArmorPortionData): Set<string> {
  const covered = new Set();
  const labels = new Set<string>();

  for (const bp_id of apd.covers ?? []) {
    if (covered.has(bp_id)) continue;
    const { expandedCoverage: coveredComposite } = expandCoverage(bp_id);
    let composite = coveredComposite.parts.length > 1;

    for (const coversPart of coveredComposite.parts) {
      const bp = data.byId("body_part", coversPart);
      labels.add(safeName(coversPart, composite));
      if (composite) {
        covered.add(bp.opposite_part);
      }
      covered.add(bp_id);
    }
  }
  return labels;
}

function safeName(bodyPartId: string, composite: boolean): string {
  const bp = data.byId("body_part", bodyPartId);
  if (composite) {
    return singular(bp.heading_multiple ?? bp.heading);
  } else {
    return singular(bp.heading);
  }
}
function safeMaxEncumbrance(apd: ArmorPortionData | ArmorSlot): number | null {
  return "max_encumbrance" in apd
    ? ((apd as ArmorSlot).max_encumbrance ?? null)
    : null;
}
</script>

<section>
  <h1>Armor</h1>
  <dl>
    <dt>Covers</dt>
    <dd>
      {#if covers("head")}The <strong>head</strong>.{/if}
      {#if covers("eyes")}The <strong>eyes</strong>.{/if}
      {#if covers("mouth")}The <strong>mouth</strong>.{/if}
      {#if covers("torso")}The <strong>torso</strong>.{/if}

      {#each expandedCoverage as coverage}
        {#if coverage.either}
          Either <strong>{safeName(coverage.parts[0], true)}</strong>.
        {:else if coverage.alias}
          The <strong>{safeName(coverage.parts[0], true)}</strong>.
        {:else}
          The <strong>{safeName(coverage.parts[0], false)}</strong>.
        {/if}
        {" "}
      {/each}

      {#if !covers_anything}Nothing.{/if}
    </dd>
    <dt>Layer</dt>
    <dd>
      {#if (item.flags ?? []).includes("PERSONAL")}Personal aura
      {:else if (item.flags ?? []).includes("SKINTIGHT")}Close to skin
      {:else if (item.flags ?? []).includes("BELTED")}Strapped
      {:else if (item.flags ?? []).includes("OUTER")}Outer
      {:else if (item.flags ?? []).includes("WAIST")}Waist
      {:else if (item.flags ?? []).includes("AURA")}Outer aura
      {:else}Normal
      {/if}
    </dd>
    <dt>Warmth</dt>
    <dd>{item.warmth ?? 0}</dd>
    <dt>Encumbrance</dt>
    <dd>
      {#if armor}
        <dl>
          {#each armor as apd}
            <dt>
              <ul class="comma-separated">
                {#each coverageLabel(apd) as label}
                  <li>{label}</li>
                {/each}
              </ul>
            </dt>
            <dd>
              {apd.encumbrance ??
                0}{#if safeMaxEncumbrance(apd)}{" "}({safeMaxEncumbrance(apd)} when
                full){/if}
            </dd>
          {/each}
        </dl>
      {:else}
        {item.encumbrance ??
          0}{#if item.max_encumbrance}{" "}({item.max_encumbrance} when full){/if}
      {/if}
    </dd>
    <dt
      title="This determines how likely it is that an attack hits the item instead of the player.">
      Coverage
    </dt>
    <dd>
      {#if armor}
        <dl>
          {#each armor as apd}
            <dt>
              <ul class="comma-separated">
                {#each coverageLabel(apd) as label}
                  <li>{label}</li>
                {/each}
              </ul>
            </dt>
            <dd>{apd.coverage ?? 0}%</dd>
          {/each}
        </dl>
      {:else}
        {item.coverage ?? 0}%
      {/if}
    </dd>
    {#if materials.length || item.environmental_protection}
      <dt>Protection</dt>
      <dd>
        <dl>
          {#if materials.length}
            <dt>Bash</dt>
            <dd>
              {formatFixed2(
                (materials.reduce(
                  (m, o) =>
                    m + (o.material.bash_resist ?? 0) * (o.portion ?? 1),
                  0,
                ) *
                  (item.material_thickness ?? 0)) /
                  totalMaterialPortion,
              )}
            </dd>
            <dt>Cut</dt>
            <dd>
              {formatFixed2(
                (materials.reduce(
                  (m, o) => m + (o.material.cut_resist ?? 0) * (o.portion ?? 1),
                  0,
                ) *
                  (item.material_thickness ?? 0)) /
                  totalMaterialPortion,
              )}
            </dd>
            <dt>Ballistic</dt>
            <dd>
              {formatFixed2(
                (materials.reduce(
                  (m, o) =>
                    m + (o.material.bullet_resist ?? 0) * (o.portion ?? 1),
                  0,
                ) *
                  (item.material_thickness ?? 0)) /
                  totalMaterialPortion,
              )}
            </dd>
            <dt>Acid</dt>
            <dd>
              {formatFixed2(
                (() => {
                  let resist =
                    materials.reduce(
                      (m, o) =>
                        m + (o.material.acid_resist ?? 0) * (o.portion ?? 1),
                      0,
                    ) / totalMaterialPortion;
                  const env = item.environmental_protection ?? 0;
                  if (env < 10) resist *= env / 10;
                  return resist;
                })(),
              )}
            </dd>
            <dt>Fire</dt>
            <dd>
              {formatFixed2(
                (() => {
                  let resist =
                    materials.reduce(
                      (m, o) =>
                        m + (o.material.fire_resist ?? 0) * (o.portion ?? 1),
                      0,
                    ) / totalMaterialPortion;
                  const env = item.environmental_protection ?? 0;
                  if (env < 10) resist *= env / 10;
                  return resist;
                })(),
              )}
            </dd>
          {/if}
          <dt title="Environmental">Environ.</dt>
          <dd>{item.environmental_protection ?? 0}</dd>
        </dl>
      </dd>
    {/if}
  </dl>
</section>
