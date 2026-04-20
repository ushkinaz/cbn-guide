<script lang="ts">
import { t } from "@transifex/native";
import ThingLink from "./ThingLink.svelte";

interface Props {
  id: string;
  level?: number;
  count?: number;
}

let { id, level = 1, count }: Props = $props();
</script>

<ThingLink type="tool_quality" {id} showIcon={false} {count} /><span
  class="level">{t("lvl")}{level}</span>

<style>
.level {
  font-variant-caps: all-small-caps;
  padding-left: 0.5em;
}
</style>
