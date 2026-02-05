<script lang="ts">
import { CBNData, singular, singularName } from "../data";
import { getContext } from "svelte";
import type { UseFunction } from "../types";
import ItemLink from "./ItemLink.svelte";
import { t } from "@transifex/native";

const data = getContext<CBNData>("data");

export let usage: UseFunction;

let action =
  usage.type === "__item_action__"
    ? data.byId("item_action", usage.id)
    : data.byId("item_action", usage.type);
let description =
  ("menu_text" in usage ? usage.menu_text : null) ??
  ("name" in usage && usage.name ? singular(usage.name) : null) ??
  singularName(action);
</script>

<ItemLink
  type="item_action"
  id={action.id}
  overrideText={description}
  showIcon={false} />
{#if usage.type === "transform" || usage.type === "delayed_transform"}
  {" "}(⟹
  <ItemLink type="item" id={usage.target} showIcon={false} />
  )
{:else if usage.type === "consume_drug" && (usage.vitamins?.length || Object.keys(usage.tools_needed ?? {}).length)}
  {" "}(
  {#if Object.keys(usage.tools_needed ?? {}).length}with
    {#each Object.entries(usage.tools_needed ?? {}) as [tool], i}
      {#if i !== 0},
      {/if}
      <ItemLink type="item" id={tool} showIcon={false} />
    {/each}
    {#if usage.vitamins?.length}:
    {/if}
  {/if}
  {#each usage.vitamins ?? [] as [id, lo, hi], i}{@const v = data.byId(
      "vitamin",
      id,
    )}
    {#if i !== 0},
    {/if}
    <ItemLink type={v.type} id={v.id} showIcon={false} />
    ({lo}{hi && hi !== lo ? `–${hi}` : ""}{v.vit_type === "counter"
      ? " U"
      : "%"})
  {/each})
{:else if usage.type === "gps_device"}
  {" "}({t("Range {radius}", {
    radius: usage.radius,
  })}
  {#if usage.additional_charges_per_tile},
    {t("cost: {cost} charges/tile", {
      cost: usage.additional_charges_per_tile,
    })}{/if})
{:else if usage.type === "train_skill"}
  {" "}(
  <ItemLink type="skill" id={usage.training_skill} showIcon={false} />
  {" "}{t("({min}-{max})", {
    min: usage.training_skill_min_level,
    max: usage.training_skill_max_level,
  })}:
  {t("{chance}% to {xp} XP/hr", {
    chance: usage.training_skill_xp_chance,
    xp: Math.round(
      usage.training_skill_xp * (60 / usage.training_skill_interval),
    ),
  })}
  {#if usage.training_skill_fatigue}, {t("fatigue {fatigue}", {
      fatigue: usage.training_skill_fatigue,
    })}{/if})
{:else if usage.type === "prospect_pick"}
  {" "}({t("Range {radius}", {
    radius: usage.radius,
  })})
{/if}
