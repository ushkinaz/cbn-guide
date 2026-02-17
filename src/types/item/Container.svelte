<script lang="ts">
import { t } from "@transifex/native";
import type { ContainerSlot } from "../../types";
import ItemLink from "../ItemLink.svelte";

export let item: ContainerSlot;
</script>

<section>
  <h2>{t("Container")}</h2>
  <dl>
    <dt>{t("Contains")}</dt>
    <dd>{item.contains ?? 0}</dd>
    <dt>{t("Seals")}</dt>
    <dd>{item.seals ?? "false"}</dd>
    <dt>{t("Watertight")}</dt>
    <dd>{item.watertight ?? "false"}</dd>
    <dt>{t("Preserves")}</dt>
    <dd>{item.preserves ?? "false"}</dd>
    {#if item.unseals_into}
      <dt>{t("Unseals Into")}</dt>
      <dd><ItemLink id={item.unseals_into} type="item" showIcon={false} /></dd>
    {/if}
  </dl>
</section>
