<script lang="ts">
import ItemSymbol from "./types/item/ItemSymbol.svelte";
import { t } from "@transifex/native";
import { CddaData, data, mapType } from "./data";
import type { SupportedTypeMapped } from "./types";

const categories = [
  {
    label: "Items",
    href: "item",
    id: "glock_17",
    type: "item",
  },
  {
    label: "Monsters",
    href: "monster",
    id: "mon_zombie",
    type: "monster",
  },
  {
    label: "Furniture",
    href: "furniture",
    id: "f_locker",
    type: "furniture",
  },
  {
    label: "Terrain",
    href: "terrain",
    id: "t_shrub_strawberry",
    type: "terrain",
  },
  {
    label: "Vehicle Parts",
    href: "vehicle_part",
    id: "wheel",
    type: "vehicle_part",
  },
  {
    label: "Qualities",
    href: "tool_quality",
    id: "hammer",
    type: "item",
  },
  {
    label: "Mutations",
    href: "mutation",
    id: "mon_twisted_body",
    type: "monster",
  },
  {
    label: "Martial Arts",
    href: "martial_art",
    id: "tonfa_wood",
    type: "item",
  },
  {
    label: "Flags",
    href: "json_flag",
    id: "textbook_computer",
    type: "item",
  },
  {
    label: "Achievements",
    href: "achievement",
    id: "badge_marshal",
    type: "item",
  },
];

const randomableItemTypes = new Set([
  "item",
  "monster",
  "furniture",
  "terrain",
  "vehicle_part",
  // "tool_quality",
  // "mutation",
  // "martial_art",
  // "json_flag",
  // "achievement",
]);

async function getRandomPage() {
  const d = await new Promise<CddaData>((resolve) => {
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
      (x) => "id" in x && randomableItemTypes.has(mapType(x.type)),
    ) as (SupportedTypeMapped & { id: string })[];
  return items[(Math.random() * items.length) | 0];
}

let randomPage: string | null = null;

function newRandomPage() {
  getRandomPage().then((r) => {
    randomPage = `${import.meta.env.BASE_URL}${mapType(r.type)}/${r.id}${
      location.search
    }`;
  });
}

newRandomPage();
</script>

<div class="category-grid">
  {#each categories as cat}
    <a href="/{cat.href}{location.search}" class="category-card">
      <div class="icon-wrapper">
        <div class="scaler">
          <ItemSymbol item={{ id: cat.id, type: cat.type }} />
        </div>
      </div>
      <span class="label">{t(cat.label)}</span>
    </a>
  {/each}
  <a
    href={randomPage}
    class="category-card random"
    on:click={() => setTimeout(newRandomPage)}>
    <div class="icon-wrapper">
      <div class="scaler">
        <ItemSymbol item={{ id: "plastic_six_dice", type: "item" }} />
      </div>
    </div>
    <span class="label">{t("Random Page")}</span>
  </a>
</div>

<style>
.category-grid {
  display: grid;
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
  box-shadow:
    0px 2px 1px -1px rgba(0, 0, 0, 0.2),
    0px 1px 1px 0px rgba(0, 0, 0, 0.14),
    0px 1px 3px 0px rgba(0, 0, 0, 0.12); /* Matches section shadow */
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

.scaler {
  transform: scale(3);
  image-rendering: pixelated;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Ensure the scaler doesn't capture events */
  pointer-events: none;
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
  color: #ccc; /* standard UI gray, readable on dark */
  text-transform: uppercase;
  font-size: 1rem;
  font-weight: bold;
  margin: 0;
  overflow: hidden;
}
</style>
