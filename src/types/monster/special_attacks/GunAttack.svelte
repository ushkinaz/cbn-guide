<script lang="ts">
import type { GunAttack } from "../../../types";
import ThingLink from "../../ThingLink.svelte";

interface Props {
  attack: GunAttack & { cooldown?: number };
}

let { attack }: Props = $props();
</script>

<ThingLink
  type="item"
  id={attack.gun_type}
  showIcon={false} />{#if attack.cooldown !== undefined}{" "}(cooldown: {attack.cooldown}){/if}
