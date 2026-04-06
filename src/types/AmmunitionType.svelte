<script lang="ts">
import { t } from "@transifex/native";
import type { AmmunitionType } from "../types";
import CompatibleItems from "./item/CompatibleItems.svelte";

import { gameSingularName } from "../i18n/game-locale";

interface Props {
  item: AmmunitionType;
}

let { item }: Props = $props();

const _context = "Ammunition Type";
</script>

<h1>{t("Ammunition Type")}: {gameSingularName(item)}</h1>

<CompatibleItems ammo_type={item.id} type="AMMO" />

<div class="side-by-side">
  <CompatibleItems ammo_type={item.id} type="GUN" />
  <CompatibleItems ammo_type={item.id} type="MAGAZINE" />
</div>
