<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import { byName, CBNData, singularName } from "../data";
import LimitedList from "../LimitedList.svelte";
import type { WeaponCategory } from "../types";
import ItemLink from "./ItemLink.svelte";

export let item: WeaponCategory;

const data = getContext<CBNData>("data");

const itemsInCategory = data
  .byType("item")
  .filter((i) => i.id)
  .filter((i) => (i.weapon_category ?? []).some((c) => c === item.id));
itemsInCategory.sort(byName);

const martialArts = data
  .byType("martial_art")
  .filter((ma) => ma.id)
  .filter((ma) => ma.weapon_category?.some((c) => c === item.id));
martialArts.sort(byName);
</script>

<h1>{t("Weapon Category")}: {singularName(item)}</h1>
<section>
  <h2>{t("Weapons", { _context: "Martial Art" })}</h2>
  {#if itemsInCategory.length}
    <LimitedList items={itemsInCategory} let:item>
      <ItemLink type="item" id={item.id} />
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
    <LimitedList items={martialArts} let:item>
      <ItemLink type="martial_art" id={item.id} />
    </LimitedList>
  {:else}
    <p style="color: var(--cata-color-gray)">
      {t("There are no martial arts that use this weapon category.")}
    </p>
  {/if}
</section>
