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
import { t } from "./i18n";
import { CBNData, data, mapType } from "./data";
import { getVersionedBasePath } from "./routing";
import type { SupportedTypeMapped } from "./types";

const categories = [
  {
    label: "Items",
    href: "item",
    icon: itemsIcon,
  },
  {
    label: "Monsters",
    href: "monster",
    icon: monstersIcon,
  },
  {
    label: "Furniture",
    href: "furniture",
    icon: furnitureIcon,
  },
  {
    label: "Terrain",
    href: "terrain",
    icon: terrainIcon,
  },
  {
    label: "Vehicles",
    href: "vehicle",
    icon: vehicleIcon,
  },
  {
    label: "Vehicle Parts",
    href: "vehicle_part",
    icon: vehiclePartsIcon,
  },
  {
    label: "Qualities",
    href: "tool_quality",
    icon: qualitiesIcon,
  },
  {
    label: "Mutations",
    href: "mutation",
    icon: mutationsIcon,
  },
  {
    label: "Martial Arts",
    href: "martial_art",
    icon: martialArtsIcon,
  },
  {
    label: "Flags",
    href: "json_flag",
    icon: flagsIcon,
  },
  {
    label: "Achievements",
    href: "achievement",
    icon: achievementsIcon,
  },
];

const randomizableItemTypes = new Set([
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

async function getRandomPage() {
  const d = await new Promise<CBNData>((resolve) => {
    const unsubscribe = data.subscribe((v) => {
      if (v) {
        resolve(v);
        setTimeout(() => unsubscribe());
      }
    });
  });
  const items = d
    .all()
    .filter(
      (x) => "id" in x && randomizableItemTypes.has(mapType(x.type)),
    ) as (SupportedTypeMapped & { id: string })[];
  return items[(Math.random() * items.length) | 0];
}

let randomPage: string | null = null;

function newRandomPage() {
  getRandomPage().then((r) => {
    randomPage = `${getVersionedBasePath()}${mapType(r.type)}/${r.id}${
      location.search
    }`;
  });
}

newRandomPage();
</script>

<div class="category-grid">
  {#each categories as cat}
    <a
      href="{getVersionedBasePath()}{cat.href}{location.search}"
      class="category-card">
      <div class="icon-wrapper">
        <img
          src={cat.icon}
          alt={t(cat.label)}
          class="category-icon"
          loading="eager"
          decoding="async" />
      </div>
      <span class="label">{t(cat.label)}</span>
    </a>
  {/each}
  <a
    href={randomPage}
    class="category-card random"
    on:click={() => setTimeout(newRandomPage)}>
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
  grid-template-columns: repeat(
    auto-fill,
    minmax(150px, 1fr)
  ); /* Slightly wider min to help fit text */
  gap: 1rem;
  margin-top: 2rem;
  padding: 0 1rem;
}

.category-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(
    255,
    255,
    255,
    0.05
  ); /* Matches global section background */
  border-radius: 4px;
  padding: 1rem;
  text-decoration: none;
  color: inherit;
  transition:
    transform 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;
  aspect-ratio: 1;
}

.category-card:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Fixed container for the scaled icon to prevent layout issues */
.icon-wrapper {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  pointer-events: none;
  flex-shrink: 0; /* Prevent shrinking */
  z-index: 1;
}

.category-icon {
  width: 88px;
  height: 88px;
  object-fit: contain;
}

.category-card:hover .category-icon,
.category-card:focus-visible .category-icon {
  transform: scale(1.03);
}

.label {
  z-index: 5;
  /* Fixed height container for 2 lines of text ensures alignment */
  height: 1rem;
  width: 100%;
  display: flex;
  align-items: flex-start; /* Align text to top of box */
  justify-content: center;

  text-align: center;
  line-height: 1.2;

  /* Section Header Styling */
  color: var(--cata-color-white);
  text-transform: uppercase;
  font-size: 1rem;
  font-weight: bold;
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  margin: 0;
  overflow: hidden;
}
</style>
