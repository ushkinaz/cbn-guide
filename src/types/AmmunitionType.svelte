<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import { byName, CddaData, singularName } from "../data";
import LimitedList from "../LimitedList.svelte";
import type { AmmunitionType, Item } from "../types";
import ItemSymbol from "./item/ItemSymbol.svelte";
import ThingLink from "./ThingLink.svelte";
import CompatibleItems from "./item/CompatibleItems.svelte";

export let item: AmmunitionType;

const _context = "Ammunition Type";
</script>

<h1>{t("Ammunition Type")}: {singularName(item)}</h1>

<CompatibleItems ammo_type={item.id} type="AMMO" />

<div class="side-by-side">
  <CompatibleItems ammo_type={item.id} type="GUN" />
  <CompatibleItems ammo_type={item.id} type="MAGAZINE" />
</div>
