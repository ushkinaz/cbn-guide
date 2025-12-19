<script lang="ts">
import { t } from "@transifex/native";
import { byName, CddaData, singularName } from "../../data";
import type {
  AmmoSlot,
  DamageUnit,
  GunSlot,
  ItemBasicInfo,
  MagazineSlot,
  SupportedTypesWithMapped,
} from "../../types";
import ThingLink from "../ThingLink.svelte";
import { getContext } from "svelte";
import LimitedList from "../../LimitedList.svelte";
import ItemSymbol from "./ItemSymbol.svelte";

export let item: AmmoSlot;
const _context = "Item Ammo Info";

const data = getContext<CddaData>("data");

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

// Find specific magazines that use this ammo's ammo_type
let compatibleMagazines: (ItemBasicInfo & MagazineSlot)[] = [];
if (item.ammo_type) {
  compatibleMagazines = data
    .byType("item")
    .filter(
      (i) =>
        i.id &&
        i.type === "MAGAZINE" &&
        i.ammo_type &&
        (Array.isArray(i.ammo_type)
          ? i.ammo_type.includes(item.ammo_type)
          : i.ammo_type === item.ammo_type),
    )
    .sort(byName) as SupportedTypesWithMapped["MAGAZINE"][];
}

// Find guns that use this ammo's ammo_type
let compatibleGuns: (ItemBasicInfo & GunSlot)[] = [];
if (item.ammo_type) {
  compatibleGuns = data
    .byType("item")
    .filter(
      (i) =>
        i.id &&
        i.type === "GUN" &&
        i.ammo &&
        (Array.isArray(i.ammo)
          ? i.ammo.includes(item.ammo_type)
          : i.ammo === item.ammo_type),
    )
    .sort(byName) as SupportedTypesWithMapped["GUN"][];
}
</script>

{#if item.damage || item.show_stats}
  <section>
    <h1>{t("Ammunition", { _context })}</h1>
    <dl>
      <dt>{t("Ammunition Type", { _context })}</dt>
      <dd><ThingLink type="ammunition_type" id={item.ammo_type} /></dd>
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
        <dd><ThingLink id={item.casing} type="item" /></dd>
      {/if}
      {#if item.effects?.length}
        <dt>{t("Effects", { _context })}</dt>
        <dd>{item.effects.join(", ")}</dd>
      {/if}
    </dl>
  </section>
{/if}

<div class="side-by-side">
  {#if compatibleGuns.length}
    <section>
      <h1>{t("Weapons", { _context })}</h1>
      <LimitedList items={compatibleGuns} let:item>
        <ItemSymbol {item} />
        <ThingLink type="item" id={item.id} />
      </LimitedList>
    </section>
  {/if}

  {#if compatibleMagazines.length}
    <section>
      <h1>{t("Magazines", { _context })}</h1>
      <LimitedList items={compatibleMagazines} let:item>
        <ItemSymbol {item} />
        <ThingLink type="item" id={item.id} />
      </LimitedList>
    </section>
  {/if}
</div>
