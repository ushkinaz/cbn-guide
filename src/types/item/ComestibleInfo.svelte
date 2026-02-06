<script lang="ts">
import { getContext } from "svelte";

import { CBNData, parseDuration } from "../../data";
import { t } from "@transifex/native";
import { formatFixed2 } from "../../utils/format";
import type { ComestibleSlot } from "../../types";
import ItemLink from "../ItemLink.svelte";

export let item: ComestibleSlot;

const data = getContext<CBNData>("data");
</script>

<section>
  <h1>{t("Comestible")}</h1>
  <dl>
    <dt>{t("Calories")}</dt>
    <dd>{item.calories ?? 0} kcal</dd>
    <dt>{t("Quench")}</dt>
    <dd>{item.quench ?? 0}</dd>
    <dt>{t("Enjoyability")}</dt>
    <dd>{item.fun ?? 0}</dd>
    <dt>{t("Portions")}</dt>
    <dd>{item.charges ?? 1}</dd>
    <dt>{t("Spoils In")}</dt>
    <dd>{item.spoils_in ?? "never"}</dd>
    <dt>{t("Health")}</dt>
    <dd>{item.healthy ?? 0}</dd>
    {#if item.smoking_result}
      <dt>{t("Smoking Result")}</dt>
      <dd>
        <ItemLink type="item" id={item.smoking_result} showIcon={false} />
      </dd>
    {/if}
    {#if item.parasites ?? 0 !== 0}
      <dt>{t("Parasites")}</dt>
      <dd>{(100 / (item.parasites ?? 0)).toPrecision(2)}%</dd>
    {/if}
    {#if item.vitamins?.length}
      <dt>{t("Vitamins (%RDA)")}</dt>
      <dd>
        <dl style="font-variant: tabular-nums">
          {#each item.vitamins as [vitamin, rdapct]}
            {@const v = data.byId("vitamin", vitamin)}
            {@const unitsPerDay = (24 * 60 * 60) / parseDuration(v.rate)}
            {@const mass = (rdapct / 100) * unitsPerDay}
            {@const rda = (mass / unitsPerDay) * 100}
            <dt>
              <ItemLink id={vitamin} type="vitamin" showIcon={false} />
            </dt>
            <dd>
              {#if v.vit_type === "counter" || v.vit_type === "drug"}
                {rda} U
              {:else}
                {formatFixed2(rda)}%{" "}
                {#if mass}
                  {#if mass >= 0.001}
                    ({(mass * 1000).toFixed(1)} mg)
                  {:else}
                    ({(mass * 1000 * 1000).toFixed(0)} μg)
                  {/if}
                {/if}
              {/if}
            </dd>
          {/each}
        </dl>
      </dd>
    {/if}
  </dl>
</section>
