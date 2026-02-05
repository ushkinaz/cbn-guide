<script lang="ts">
import { t } from "@transifex/native";
import { CBNData, singularName } from "../../data";
import type { AmmoSlot, DamageUnit } from "../../types";
import ItemLink from "../ItemLink.svelte";
import { getContext } from "svelte";
import CompatibleItems from "./CompatibleItems.svelte";

export let item: AmmoSlot;
const _context = "Item Ammo Info";

const data = getContext<CBNData>("data");

// TODO: handle multiple damage type
const damage = Array.isArray(item.damage)
  ? item.damage[0]
  : item.damage && "values" in item.damage
    ? item.damage.values[0]
    : ((item.damage as DamageUnit) ?? {
        amount: 0,
        damage_type: "bullet",
        armor_penetration: 0,
      });

function computeLoudness(item: AmmoSlot): number {
  // https://github.com/cataclysmbnteam/Cataclysm-BN/blob/1d32ac54067ac6dd004189d95aa5039f9ab1fc54/src/item_factory.cpp#L290
  if ((item.loudness ?? -1) >= 0) return item.loudness ?? 0;
  let damages: DamageUnit[] = [];
  let aggregateLoudness = 0;
  if (Array.isArray(item.damage)) {
    damages = item.damage;
  } else if (typeof item.damage === "object") {
    damages = [item.damage as DamageUnit];
  }
  for (const du of damages) {
    aggregateLoudness += (du.amount ?? 0) * 2 + (du.armor_penetration ?? 0);
  }
  return aggregateLoudness;
}
</script>

{#if item.damage || item.show_stats}
  <section>
    <h1>{t("Ammunition", { _context })}</h1>
    <dl>
      <dt>{t("Ammunition Type", { _context })}</dt>
      <dd>
        <ItemLink type="ammunition_type" id={item.ammo_type} showIcon={false} />
      </dd>
      <dt>{t("Damage", { _context })}</dt>
      <dd>
        {damage.amount ?? 0} ({singularName(
          data.byIdMaybe("damage_type", damage.damage_type) ?? {
            id: damage.damage_type,
          },
        )})
      </dd>
      <dt>{t("Armor Penetration", { _context })}</dt>
      <dd>{damage.armor_penetration ?? 0}</dd>
      <dt>{t("Range", { _context })}</dt>
      <dd>{item.range ?? 0}</dd>
      <dt>{t("Dispersion", { _context })}</dt>
      <dd>{item.dispersion ?? 0}</dd>
      <dt>{t("Recoil", { _context })}</dt>
      <dd>{item.recoil ?? 0}</dd>
      <dt title="Base loudness of ammo (possibly modified by gun/gunmods)">
        {t("Loudness", { _context })}
      </dt>
      <dd>{computeLoudness(item).toFixed(0)}</dd>
      <dt>{t("Critical Multiplier", { _context })}</dt>
      <dd>{item.critical_multiplier ?? 2}</dd>
      {#if item.casing}
        <dt>{t("Casing", { _context })}</dt>
        <dd><ItemLink id={item.casing} type="item" showIcon={false} /></dd>
      {/if}
      {#if item.effects?.length}
        <dt>{t("Effects", { _context })}</dt>
        <dd>{item.effects.join(", ")}</dd>
      {/if}
    </dl>
  </section>
{/if}

<div class="side-by-side">
  {#if item.ammo_type}
    <CompatibleItems ammo_type={item.ammo_type} type="GUN" />
    <CompatibleItems ammo_type={item.ammo_type} type="MAGAZINE" />
  {/if}
</div>
