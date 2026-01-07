<script lang="ts">
import { t } from "@transifex/native";
import type { ComestibleSlot } from "../../types";
import ItemLink from "../ItemLink.svelte";
import { CBNData, parseDuration } from "../../data";
import { getContext } from "svelte";

export let item: ComestibleSlot;

const _context = "Item Comestible Info";

const data = getContext<CBNData>("data");
</script>

<section>
  <h1>{t("Comestible", { _context })}</h1>
  <dl>
    <dt>{t("Calories", { _context })}</dt>
    <dd>{item.calories ?? 0} kcal</dd>
    <dt>{t("Quench", { _context })}</dt>
    <dd>{item.quench ?? 0}</dd>
    <dt>{t("Enjoyability", { _context })}</dt>
    <dd>{item.fun ?? 0}</dd>
    <dt>{t("Portions", { _context })}</dt>
    <dd>{item.charges ?? 1}</dd>
    <dt>{t("Spoils In", { _context })}</dt>
    <dd>{item.spoils_in ?? "never"}</dd>
    <dt>{t("Health", { _context })}</dt>
    <dd>{item.healthy ?? 0}</dd>
    {#if item.smoking_result}
      <dt>{t("Smoking Result", { _context })}</dt>
      <dd>
        <ItemLink type="item" id={item.smoking_result} showIcon={false} />
      </dd>
    {/if}
    {#if item.parasites ?? 0 !== 0}
      <dt>{t("Parasites", { _context })}</dt>
      <dd>{(100 / (item.parasites ?? 0)).toPrecision(2)}%</dd>
    {/if}
    {#if item.vitamins?.length}
      <dt>{t("Vitamins (%RDA)", { _context })}</dt>
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
                {rda?.toFixed(2)}%{" "}
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
