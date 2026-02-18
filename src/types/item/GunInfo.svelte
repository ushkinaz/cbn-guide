<script lang="ts">
import { t } from "@transifex/native";

import type { DamageUnit, GunSlot, Item } from "../../types";
import ItemLink from "../ItemLink.svelte";
import { CBNData, singularName } from "../../data";
import { getContext } from "svelte";
import GunAmmoInfo from "./GunAmmoInfo.svelte";

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

// TODO: handle multiple ranged_damage type
function extractRangedDamage(): DamageUnit {
  const defaultDamage: DamageUnit = {
    amount: 0,
    damage_type: "bullet",
    armor_penetration: 0,
  };

  if (Array.isArray(gunProps.ranged_damage)) {
    return gunProps.ranged_damage[0];
  }

  if (
    gunProps.ranged_damage &&
    typeof gunProps.ranged_damage === "object" &&
    "values" in gunProps.ranged_damage
  ) {
    return gunProps.ranged_damage.values[0];
  }

  return (gunProps.ranged_damage as DamageUnit) ?? defaultDamage;
}

const ranged_damage = extractRangedDamage();
</script>

<section>
  <h2>{t("Ranged", { _comment: "Section heading" })}</h2>
  <dl>
    <dt>{t("Skill")}</dt>
    <dd><ItemLink type="skill" id={gunProps.skill} showIcon={false} /></dd>
    {#if item.min_strength}
      <dt>{t("Min Strength")}</dt>
      <dd>{item.min_strength}</dd>
    {/if}
    <dt>{t("Base Damage")}</dt>
    <dd>
      {ranged_damage.amount ?? 0} ({singularName(
        data.byIdMaybe(
          "damage_type",
          ranged_damage.damage_type ?? "bullet",
        ) ?? {
          id: ranged_damage.damage_type ?? "bullet",
        },
      )})
    </dd>
    <dt>{t("Armor Penetration")}</dt>
    <dd>{ranged_damage.armor_penetration ?? 0}</dd>
    <dt title="Added to ammo range">{t("Range Bonus")}</dt>
    <dd>{gunProps.range ?? 0}</dd>
    <dt title="Added to ammo dispersion">
      {t("Base Dispersion")}
    </dt>
    <dd>{gunProps.dispersion ?? 0}</dd>
    <dt>{t("Sight Dispersion")}</dt>
    <dd>
      {(item.flags ?? []).includes("DISABLE_SIGHTS")
        ? 90
        : (gunProps.sight_dispersion ?? 30)}
    </dd>
    <dt>{t("Base Recoil")}</dt>
    <dd>{gunProps.recoil ?? 0}</dd>
    <dt title="Modifies base loudness as provided by the currently loaded ammo">
      {t("Loudness Modifier")}
    </dt>
    <dd>{(gunProps.loudness ?? 0).toFixed(0)}</dd>
    <dt>{t("Reload Time")}</dt>
    <dd>{gunProps.reload ?? 100} moves</dd>
    <dt title="Volume of the noise made when reloading this weapon">
      {t("Reload Noise Volume")}
    </dt>
    <dd>{gunProps.reload_noise_volume ?? 0}</dd>
    {#if gunProps.valid_mod_locations?.length}
      <dt>{t("Mod Slots")}</dt>
      <dd>
        {gunProps.valid_mod_locations
          .map(([loc, num]) => `${loc} (${num})`)
          .join(", ")}
      </dd>
    {/if}
    <dt>{t("Durability")}</dt>
    <dd>{gunProps.durability ?? 0}</dd>
  </dl>
</section>

<GunAmmoInfo {item} />
