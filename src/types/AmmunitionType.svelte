<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import { byName, CddaData, singularName } from "../data";
import LimitedList from "../LimitedList.svelte";
import type { AmmunitionType, Item } from "../types";
import ItemSymbol from "./item/ItemSymbol.svelte";
import ThingLink from "./ThingLink.svelte";

export let item: AmmunitionType;

const _context = "Ammunition Type";

const data = getContext<CddaData>("data");

const compatibleAmmo = data
  .byType("item")
  .filter(
    (ammo) =>
      ammo.id &&
      ammo.type === "AMMO" &&
      //TODO reuse useAmmoType
      ammo.ammo_type === item.id,
  )
  .sort(byName);

const usesAmmoType = (w: Item, t: AmmunitionType): boolean => {
  if (w.type === "MAGAZINE" && w.ammo_type) {
    const types = Array.isArray(w.ammo_type) ? w.ammo_type : [w.ammo_type];
    return types.includes(t.id);
  }
  if ("ammo" in w && w.ammo) {
    if (Array.isArray(w.ammo)) {
      return w.ammo.includes(t.id);
    } else {
      return w.ammo === t.id;
    }
  }

  return false;
};

const usedBy = data.byType("item").filter((w) => w.id && usesAmmoType(w, item));

function composeSort<T>(
  fa: (a: T, b: T) => number,
  fb: (a: T, b: T) => number,
) {
  return (a: T, b: T) => {
    const r = fa(a, b);
    if (r !== 0) return r;
    return fb(a, b);
  };
}
function byType(a: Item, b: Item) {
  return a.type.localeCompare(b.type);
}
usedBy.sort(composeSort(byType, byName));
</script>

<h1>{t("Ammunition Type")}: {singularName(item)}</h1>
<section>
  <h1>{t("Compatible Variants", { _context })}</h1>
  <ul>
    {#each compatibleAmmo as ammo}
      <li>
        <ItemSymbol item={ammo} />
        <ThingLink type="item" id={ammo.id} />
        {#if ammo.id === item.default}({t("default", { _context })}){/if}
      </li>
    {/each}
  </ul>
</section>

<section>
  <h1>{t("Used By", { _context })}</h1>
  {#if usedBy.length > 0}
    <LimitedList items={usedBy} let:item>
      <ItemSymbol {item} />
      <ThingLink type="item" id={item.id} />
    </LimitedList>
  {:else}
    <p>
      <em style="color: var(--cata-color-gray)"
        >{t("No items use this ammo.", { _context })}</em>
    </p>
  {/if}
</section>
