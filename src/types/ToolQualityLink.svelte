<script lang="ts">
import ThingLink from "./ThingLink.svelte";

interface Props {
  id: string;
  level?: number;
  count?: number;
}

let { id, level = 1, count }: Props = $props();
</script>

<ThingLink type="tool_quality" {id} showIcon={false} {count} {level} />
