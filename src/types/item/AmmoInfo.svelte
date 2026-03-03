<script lang="ts">
import { t } from "@transifex/native";
import { CBNData, singularName } from "../../data";
import type { AmmoSlot, DamageUnit } from "../../types";
import ItemLink from "../ItemLink.svelte";
import { getContext } from "svelte";
import CompatibleItems from "./CompatibleItems.svelte";

interface Props {
  item: AmmoSlot;
}

let { item }: Props = $props();

const data = getContext<CBNData>("data");

const DEFAULT_DAMAGE: DamageUnit = {
  amount: 0,
  damage_type: "bullet",
  armor_penetration: 0,
};

function normalizeDamageUnits(damage: AmmoSlot["damage"]): DamageUnit[] {
  if (Array.isArray(damage)) return damage;
  if (typeof damage === "number") {
    return [{ ...DEFAULT_DAMAGE, amount: damage }];
  }
  if (damage && typeof damage === "object") {
    if ("values" in damage && Array.isArray(damage.values)) {
      return damage.values;
    }
    return [damage as DamageUnit];
  }
  return [];
}

// TODO: handle multiple damage type
let damage = $derived(normalizeDamageUnits(item.damage)[0] ?? DEFAULT_DAMAGE);

function computeLoudness(item: AmmoSlot): number {
  // https://github.com/cataclysmbnteam/Cataclysm-BN/blob/1d32ac54067ac6dd004189d95aa5039f9ab1fc54/src/item_factory.cpp#L290
  if ((item.loudness ?? -1) >= 0) return item.loudness ?? 0;
  const damages = normalizeDamageUnits(item.damage);
  let aggregateLoudness = 0;
  for (const du of damages) {
    aggregateLoudness += (du.amount ?? 0) * 2 + (du.armor_penetration ?? 0);
  }
  return aggregateLoudness;
}
</script>

{#if item.damage || item.show_stats}
  <section>
    <h2>{t("Ammunition")}</h2>
    <dl>
      <dt>{t("Ammunition Type")}</dt>
      <dd>
        <ItemLink type="ammunition_type" id={item.ammo_type} showIcon={false} />
      </dd>
      <dt>{t("Damage")}</dt>
      <dd>
        {damage.amount ?? 0} ({singularName(
          data.byIdMaybe("damage_type", damage.damage_type) ?? {
            id: damage.damage_type,
          },
        )})
      </dd>
      <dt>{t("Armor Penetration")}</dt>
      <dd>{damage.armor_penetration ?? 0}</dd>
      <dt>{t("Range")}</dt>
      <dd>{item.range ?? 0}</dd>
      <dt>{t("Dispersion")}</dt>
      <dd>{item.dispersion ?? 0}</dd>
      <dt>{t("Recoil")}</dt>
      <dd>{item.recoil ?? 0}</dd>
      <dt title="Base loudness of ammo (possibly modified by gun/gunmods)">
        {t("Loudness")}
      </dt>
      <dd>{computeLoudness(item).toFixed(0)}</dd>
      {#if item.casing}
        <dt>{t("Casing")}</dt>
        <dd><ItemLink id={item.casing} type="item" showIcon={false} /></dd>
      {/if}
      {#if item.effects?.length}
        <dt>{t("Effects")}</dt>
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
