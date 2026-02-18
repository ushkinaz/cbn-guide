<script lang="ts">
import { t } from "@transifex/native";
import { getContext } from "svelte";
import { byName, CBNData } from "../../data";
import type { GunSlot, Item } from "../../types";
import ItemLink from "../ItemLink.svelte";
import LimitedList from "../../LimitedList.svelte"; // Assuming we want symbols in lists
import CompatibleItems from "./CompatibleItems.svelte";

export let item: Item;

const data = getContext<CBNData>("data");

function getGunProperties(i: Item): GunSlot {
  if (i.gun_data) {
    const base = i.gun_data;
    const overlay = i as unknown as Partial<GunSlot>;
    return {
      ...base,
      ...overlay,
    } as GunSlot;
  }
  return i as GunSlot;
}

const gunProps = getGunProperties(item);

let ammo_types: string[] = Array.isArray(gunProps.ammo)
  ? gunProps.ammo
  : [gunProps.ammo ?? []].flat();

let magazinesByAmmo = new Map<string, string[]>();
if ("magazines" in gunProps && gunProps.magazines) {
  for (const [ammoType, mags] of gunProps.magazines) {
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

{#each ammoData as { id: ammoTypeId, magazines }}
  <div class="side-by-side">
    <section>
      <h2>{t("Ammunition")}</h2>
      <dl>
        {#if "clip_size" in gunProps && gunProps.clip_size}
          <dt>{t("Capacity")}</dt>
          <dd>{gunProps.clip_size}</dd>
        {/if}

        <dt>{t("Ammo Type")}</dt>
        <dd>
          <ItemLink type="ammunition_type" id={ammoTypeId} showIcon={false} />
        </dd>

        <dt>{t("Magazine")}</dt>
        <dd>
          {#if magazines.length}
            <LimitedList items={magazines} let:item limit={7} grace={2}>
              <ItemLink type="item" id={item.id} />
            </LimitedList>
          {:else}
            {t("None")}
          {/if}
        </dd>
      </dl>
    </section>
    <CompatibleItems ammo_type={ammoTypeId} type="AMMO" />
  </div>
{/each}
