<script lang="ts">
import { t } from "@transifex/native";

import type { DamageUnit, GunSlot, ItemBasicInfo } from "../../types";
import ItemLink from "../ItemLink.svelte";
import { CBNData, singularName } from "../../data";
import { getContext } from "svelte";
import GunAmmoInfo from "./GunAmmoInfo.svelte";

export let item: GunSlot & ItemBasicInfo;

const data = getContext<CBNData>("data");

// TODO: handle multiple ranged_damage type
function extractRangedDamage(): DamageUnit {
  const defaultDamage: DamageUnit = {
    amount: 0,
    damage_type: "bullet",
    armor_penetration: 0,
  };

  if (Array.isArray(item.ranged_damage)) {
    return item.ranged_damage[0];
  }

  if (
    item.ranged_damage &&
    typeof item.ranged_damage === "object" &&
    "values" in item.ranged_damage
  ) {
    return item.ranged_damage.values[0];
  }

  return (item.ranged_damage as DamageUnit) ?? defaultDamage;
}

const ranged_damage = extractRangedDamage();
</script>

<section>
  <h1>{t("Ranged", { _comment: "Section heading" })}</h1>
  <dl>
    <dt>{t("Skill")}</dt>
    <dd><ItemLink type="skill" id={item.skill} showIcon={false} /></dd>
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
    <dd>{item.range ?? 0}</dd>
    <dt title="Added to ammo dispersion">
      {t("Base Dispersion")}
    </dt>
    <dd>{item.dispersion ?? 0}</dd>
    <dt>{t("Sight Dispersion")}</dt>
    <dd>
      {(item.flags ?? []).includes("DISABLE_SIGHTS")
        ? 90
        : (item.sight_dispersion ?? 30)}
    </dd>
    <dt>{t("Base Recoil")}</dt>
    <dd>{item.recoil ?? 0}</dd>
    <dt title="Modifies base loudness as provided by the currently loaded ammo">
      {t("Loudness Modifier")}
    </dt>
    <dd>{(item.loudness ?? 0).toFixed(0)}</dd>
    <dt>{t("Reload Time")}</dt>
    <dd>{item.reload ?? 100} moves</dd>
    <dt title="Volume of the noise made when reloading this weapon">
      {t("Reload Noise Volume")}
    </dt>
    <dd>{item.reload_noise_volume ?? 0}</dd>
    {#if item.valid_mod_locations?.length}
      <dt>{t("Mod Slots")}</dt>
      <dd>
        {item.valid_mod_locations
          .map(([loc, num]) => `${loc} (${num})`)
          .join(", ")}
      </dd>
    {/if}
    <dt>{t("Durability")}</dt>
    <dd>{item.durability ?? 0}</dd>
  </dl>
</section>

<GunAmmoInfo {item} />
