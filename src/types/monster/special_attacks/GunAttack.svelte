<script lang="ts">
import type { GunAttack } from "../../../types";
import ItemLink from "../../ItemLink.svelte";

export let attack: GunAttack & { cooldown?: number };
</script>

<ItemLink
  type="item"
  id={attack.gun_type}
  showIcon={false} />{#if attack.cooldown !== undefined}{" "}(cooldown: {attack.cooldown}){/if}
