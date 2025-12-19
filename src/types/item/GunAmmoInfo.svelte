<script lang="ts">
import { t } from "@transifex/native";
import { getContext } from "svelte";
import { byName, CddaData } from "../../data";
import type { GunSlot, ItemBasicInfo } from "../../types";
import ThingLink from "../ThingLink.svelte";
import ItemSymbol from "./ItemSymbol.svelte";
import LimitedList from "../../LimitedList.svelte"; // Assuming we want symbols in lists
import CompatibleItems from "./CompatibleItems.svelte";

export let item: GunSlot & ItemBasicInfo;

const data = getContext<CddaData>("data");

let ammo_types: string[] = Array.isArray(item.ammo)
  ? item.ammo
  : [item.ammo ?? []].flat();

let magazinesByAmmo = new Map<string, string[]>();
if ("magazines" in item && item.magazines) {
  for (const [ammoType, mags] of item.magazines) {
    if (mags) magazinesByAmmo.set(ammoType, mags);
  }
}

const ammoData = ammo_types.map((ammo_type) => {
  const magazines = (magazinesByAmmo.get(ammo_type) ?? [])
    .map((id) => data.byId("item", id))
    .sort(byName);
  return {
    id: ammo_type,
    magazines,
  };
});
</script>

<div class="side-by-side">
  {#each ammoData as { id: ammoTypeId, magazines }}
    <section>
      <h1>{t("Ammunition")}</h1>
      <dl>
        {#if "clip_size" in item && item.clip_size}
          <dt>{t("Capacity")}</dt>
          <dd>{item.clip_size}</dd>
        {/if}

        <dt>{t("Ammo Type")}</dt>
        <dd><ThingLink type="ammunition_type" id={ammoTypeId} /></dd>

        <dt>{t("Magazine")}</dt>
        <dd>
          {#if magazines.length}
            <LimitedList items={magazines} let:item limit={7} grace={2}>
              <ItemSymbol {item} />
              <ThingLink type="item" id={item.id} />
            </LimitedList>
          {:else}
            {t("None")}
          {/if}
        </dd>
      </dl>
    </section>
    <CompatibleItems ammo_type={ammoTypeId} type="AMMO" />
  {/each}
</div>
