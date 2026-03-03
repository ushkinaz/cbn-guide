<script lang="ts">
import type { GunAttack } from "../../../types";
import ItemLink from "../../ItemLink.svelte";

interface Props {
  attack: GunAttack & { cooldown?: number };
}

let { attack }: Props = $props();
</script>

<ItemLink
  type="item"
  id={attack.gun_type}
  showIcon={false} />{#if attack.cooldown !== undefined}{" "}(cooldown: {attack.cooldown}){/if}
