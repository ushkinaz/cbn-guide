<script lang="ts">
import { t } from "../i18n";
import { singularName } from "../data";
import type { AmmunitionType } from "../types";
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
