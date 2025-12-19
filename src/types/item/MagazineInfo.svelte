<script lang="ts">
import LimitedList from "../../LimitedList.svelte";
import { getContext } from "svelte";
import { byName, CddaData } from "../../data";
import type { ItemBasicInfo, MagazineSlot } from "../../types";
import ThingLink from "../ThingLink.svelte";
import ItemSymbol from "./ItemSymbol.svelte";
import { t } from "@transifex/native";
import CompatibleItems from "./CompatibleItems.svelte";

export let item: ItemBasicInfo & MagazineSlot;
const data = getContext<CddaData>("data");

let ammo_types = [item.ammo_type].flat();

const compatibleGuns = data
  .byType("item")
  .filter(
    (gun) =>
      gun.id &&
      gun.type === "GUN" &&
      gun.ammo &&
      gun.magazines?.some(([, magList]) => magList.includes(item.id)),
  )
  .map((gun) => data.byId("item", gun.id))
  .sort(byName);
</script>

<section>
  <h1>{t("Magazine", { _context: "Item Magazine Info" })}</h1>
  <dl>
    {#if ammo_types.length}
      <dt>{t("Ammo Type")}</dt>
      <dd>
        <ul class="comma-separated inline" style="display: inline; padding: 0;">
          {#each ammo_types as at}
            <li><ThingLink type="ammunition_type" id={at} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if item.capacity}
      <dt>{t("Capacity")}</dt>
      <dd>{item.capacity}</dd>
    {/if}
    {#if item.reliability}
      <dt>{t("Reliability")}</dt>
      <dd>{item.reliability}</dd>
    {/if}
    {#if item.reload_time}
      <dt>{t("Reload Time")}</dt>
      <dd>{item.reload_time}</dd>
    {/if}
    {#if item.linkage}
      <dt>{t("Linkage")}</dt>
      <dd><ThingLink type="item" id={item.linkage} /></dd>
    {/if}
  </dl>
</section>

<div class="side-by-side">
  {#if compatibleGuns.length}
    <section>
      <h1>{t("Weapons", { _context: "Item Magazine Info" })}</h1>
      <LimitedList items={compatibleGuns} let:item>
        <ItemSymbol {item} />
        <ThingLink type="item" id={item.id} />
      </LimitedList>
    </section>
  {/if}

  {#each ammo_types as at}
    <CompatibleItems ammo_type={at} type="AMMO" />
  {/each}
</div>
