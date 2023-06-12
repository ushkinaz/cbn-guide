<script lang="ts">
import { t } from "@transifex/native";
import type { ContainerSlot } from "../../types";
import ThingLink from "../ThingLink.svelte";

export let item: ContainerSlot;

const _context = "Container Info";
</script>

<section>
  <h1>{t("Container", { _context })}</h1>
  <dl>
    <dt>{t("Contains", { _context })}</dt>
    <dd>{item.contains ?? 0}</dd>
    <dt>{t("Seals", { _context })}</dt>
    <dd>{item.seals ?? "false"}</dd>
    <dt>{t("Watertight", { _context })}</dt>
    <dd>{item.watertight ?? "false"}</dd>
    <dt>{t("Preserves", { _context })}</dt>
    <dd>{item.preserves ?? "false"}</dd>
    {#if item.unseals_into}
      <dt>{t("Unseals Into", { _context })}</dt>
      <dd><ThingLink id={item.unseals_into} type="item" /></dd>
    {/if}
  </dl>
</section>
