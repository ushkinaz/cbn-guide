<script lang="ts">
//https://game-icons.net/1x1/skoll/achievement.html
import achievementsIcon from "./assets/category-icons/achievements.svg";
//https://game-icons.net/1x1/delapouite/price-tag.html
import flagsIcon from "./assets/category-icons/flags.svg";
//https://game-icons.net/1x1/delapouite/sofa.html
import furnitureIcon from "./assets/category-icons/furniture.svg";
//https://game-icons.net/1x1/john-colburn/pistol-gun.html
import itemsIcon from "./assets/category-icons/items.svg";
//https://game-icons.net/1x1/john-colburn/pistol-gun.html
import martialArtsIcon from "./assets/category-icons/martial-arts.svg";
//https://game-icons.net/1x1/delapouite/shambling-zombie.html
import monstersIcon from "./assets/category-icons/monsters.svg";
//https://game-icons.net/1x1/lorc/dna1.html
import mutationsIcon from "./assets/category-icons/mutations.svg";
//https://game-icons.net/1x1/delapouite/stake-hammer.html
import qualitiesIcon from "./assets/category-icons/qualities.svg";
//https://game-icons.net/1x1/delapouite/rolling-dices.html
// https://game-icons.net/1x1/delapouite/dice-six-faces-six.html
import randomIcon from "./assets/category-icons/random.svg";
//https://game-icons.net/1x1/delapouite/high-grass.html
import terrainIcon from "./assets/category-icons/terrain.svg";
//https://game-icons.net/1x1/delapouite/car-wheel.html
import vehiclePartsIcon from "./assets/category-icons/vehicle-parts.svg";
//https://game-icons.net/1x1/skoll/apc.html
import vehicleIcon from "./assets/category-icons/vehicle.svg";
import { t } from "@transifex/native";
import { CBNData, data, mapType } from "./data";
import {
  getCurrentVersionSlug,
  getVersionedBasePath,
  navigateTo,
} from "./routing";
import type { SupportedTypesWithMapped } from "./types";

const categories = [
  {
    label: t("Items"),
    href: "item",
    icon: itemsIcon,
  },
  {
    label: t("Monsters"),
    href: "monster",
    icon: monstersIcon,
  },
  {
    label: t("Furniture"),
    href: "furniture",
    icon: furnitureIcon,
  },
  {
    label: t("Terrain"),
    href: "terrain",
    icon: terrainIcon,
  },
  {
    label: t("Vehicles"),
    href: "vehicle",
    icon: vehicleIcon,
  },
  {
    label: t("Vehicle Parts"),
    href: "vehicle_part",
    icon: vehiclePartsIcon,
  },
  {
    label: t("Qualities"),
    href: "tool_quality",
    icon: qualitiesIcon,
  },
  {
    label: t("Mutations"),
    href: "mutation",
    icon: mutationsIcon,
  },
  {
    label: t("Martial Arts"),
    href: "martial_art",
    icon: martialArtsIcon,
  },
  {
    label: t("Flags"),
    href: "json_flag",
    icon: flagsIcon,
  },
  {
    label: t("Achievements"),
    href: "achievement",
    icon: achievementsIcon,
  },
];

const randomizableItemTypes = new Set<keyof SupportedTypesWithMapped>([
  "item",
  "monster",
  "furniture",
  // "terrain",
  "vehicle_part",
  "tool_quality",
  "mutation",
  // "martial_art",
  // "json_flag",
  "achievement",
]);
const RANDOM_PICK_MAX_RETRIES = 30;
const RANDOM_PICK_FALLBACK = { type: "item", id: "guidebook" } as const;

/**
 * Selects a random game entity for the "Random Page" card.
 * Filters for types that are meaningful to browse randomly (items, monsters, etc).
 */
async function getRandomPage() {
  const d = await new Promise<CBNData>((resolve) => {
    const unsubscribe = data.subscribe((v) => {
      if (v) {
        resolve(v);
        // Unsubscribe after getting the first value to prevent memory leaks
        setTimeout(() => unsubscribe());
      }
    });
  });

  const all = d.all();
  if (all.length === 0) return null;

  for (let attempt = 0; attempt < RANDOM_PICK_MAX_RETRIES; attempt += 1) {
    const candidate = all[(Math.random() * all.length) | 0] as
      | { id?: unknown; type?: unknown }
      | undefined;
    if (!candidate) continue;
    if (typeof candidate.id !== "string" || typeof candidate.type !== "string")
      continue;

    const mappedType = mapType(
      candidate.type as keyof SupportedTypesWithMapped,
    ) as keyof SupportedTypesWithMapped;
    if (!randomizableItemTypes.has(mappedType)) continue;

    // Verify candidate resolves in current mod set (e.g. blacklist/disabled monsters).
    if (!d.byIdMaybe(mappedType, candidate.id)) continue;

    return { type: mappedType, id: candidate.id };
  }

  return null;
}

/**
 * Chooses a random destination on demand and navigates to it.
 */
async function openRandomPage(event: MouseEvent) {
  event.preventDefault();
  const r = await getRandomPage();
  const destination = r ?? RANDOM_PICK_FALLBACK;
  navigateTo(
    getCurrentVersionSlug(),
    { type: destination.type, id: destination.id },
    "",
    true,
  );
}
</script>

<div class="category-grid">
  {#each categories as cat}
    <a
      href="{getVersionedBasePath()}{cat.href}{location.search}"
      class="category-card">
      <div class="icon-wrapper">
        <img
          src={cat.icon}
          alt={cat.label}
          class="category-icon"
          loading="eager"
          decoding="async" />
      </div>
      <span class="label">{cat.label}</span>
    </a>
  {/each}
  <a
    href={`${getVersionedBasePath()}${location.search}`}
    class="category-card random"
    on:click={openRandomPage}>
    <div class="icon-wrapper">
      <img
        src={randomIcon}
        alt={t("Random Page")}
        class="category-icon"
        loading="eager"
        decoding="async" />
    </div>
    <span class="label">{t("Random Page")}</span>
  </a>
</div>

<style>
.category-grid {
  display: grid;
  clear: both;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-top: 2rem;
  padding: 0;
}

.category-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;

  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 0.6rem;
  text-decoration: none;
  color: inherit;
  transition:
    transform 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;

  height: auto;
  min-height: 60px;
}

.category-card:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.icon-wrapper {
  background-color: transparent;
  border: none;

  width: 48px;
  height: 48px;

  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.7rem;
  margin-left: 0.4rem;
  flex-shrink: 0;
}

.category-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.8));
}

img.category-icon {
  image-rendering: pixelated; /* Chrome/Edge */
  image-rendering: -moz-crisp-edges; /* Firefox */
  image-rendering: crisp-edges; /* Standard */
}

.category-card:hover .category-icon,
.category-card:focus-visible .category-icon {
  transform: scale(1.05);
}

.label {
  z-index: 5;
  width: 100%;
  display: block;
  text-align: left;
  justify-content: flex-start;

  line-height: 1.2;
  color: var(--cata-color-white);
  text-transform: capitalize;

  font-size: 0.9rem;
  font-weight: bold;
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  margin: 0;

  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

@media (max-width: 600px) {
  .category-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  .category-card {
    padding: 0.75rem 0.5rem;
    flex-direction: row;
    justify-content: flex-start;
    height: auto;
    min-height: 50px;
  }

  .icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .label {
    font-size: 1rem;
  }
}
</style>
