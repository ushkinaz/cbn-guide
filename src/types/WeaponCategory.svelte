<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import { CBNData } from "../data";
import LimitedList from "../LimitedList.svelte";
import type { WeaponCategory } from "../types";
import ItemLink from "./ItemLink.svelte";
import { byName, gameSingularName } from "../utils/i18n";

interface Props {
  item: WeaponCategory;
}

let { item }: Props = $props();

const data = getContext<CBNData>("data");

function normalizedWeaponCategories(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.filter((value): value is string => typeof value === "string");
  return typeof raw === "string" ? [raw] : [];
}

function usesWeaponCategory(obj: { weapon_category?: unknown }): boolean {
  return normalizedWeaponCategories(obj.weapon_category).some(
    (c) => c === item.id,
  );
}

const itemsInCategory = data
  .byType("item")
  .filter((i) => i.id)
  .filter(usesWeaponCategory);
itemsInCategory.sort(byName);

const martialArts = data
  .byType("martial_art")
  .filter((ma) => ma.id)
  .filter(usesWeaponCategory);
martialArts.sort(byName);
</script>

<h1>{t("Weapon Category")}: {gameSingularName(item)}</h1>
<section>
  <h2>{t("Weapons", { _context: "Martial Art" })}</h2>
  {#if itemsInCategory.length}
    <LimitedList items={itemsInCategory}>
      {#snippet children({ item })}
        <ItemLink type="item" id={item.id} />
      {/snippet}
    </LimitedList>
  {:else}
    <p style="color: var(--cata-color-gray)">
      {t("There are no weapons in this category.")}
    </p>
  {/if}
</section>

<section>
  <h2>{t("Martial Arts")}</h2>
  {#if martialArts.length}
    <LimitedList items={martialArts}>
      {#snippet children({ item })}
        <ItemLink type="martial_art" id={item.id} showIcon={false} />
      {/snippet}
    </LimitedList>
  {:else}
    <p style="color: var(--cata-color-gray)">
      {t("There are no martial arts that use this weapon category.")}
    </p>
  {/if}
</section>
