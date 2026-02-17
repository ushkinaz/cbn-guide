<script lang="ts">
import { t } from "@transifex/native";
import type { BionicSlot, ItemBasicInfo } from "../../types";
import ItemLink from "../ItemLink.svelte";

export let item: ItemBasicInfo & BionicSlot;
</script>

<section>
  <h2>{t("Bionic", { _comment: "Section heading" })}</h2>
  <dl>
    <dt>{t("Installs as")}</dt>
    <dd>
      <ItemLink type="bionic" id={item.bionic_id ?? item.id} showIcon={false} />
    </dd>
    <dt>{t("Difficulty")}</dt>
    <dd>{item.difficulty ?? 0}</dd>
    <dt>{t("Is upgrade")}</dt>
    <dd>{item.is_upgrade ? t("Yes") : t("No")}</dd>
    {#if item.installation_data}
      <dt>{t("Installation data")}</dt>
      <dd>
        <ItemLink type="item" id={item.installation_data} showIcon={false} />
      </dd>
    {/if}
  </dl>
</section>
