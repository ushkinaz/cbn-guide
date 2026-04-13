<script lang="ts">
import { t } from "@transifex/native";

import { getContext, untrack } from "svelte";

import { CBNData } from "../data";
import type { Achievement } from "../types";
import ThingLink from "./ThingLink.svelte";
import {
  gamePlural,
  gameSingular,
  gameSingularName,
} from "../i18n/game-locale";

interface Props {
  item: Achievement;
}

let { item: sourceItem }: Props = $props();
const item = untrack(() => sourceItem);
const data = getContext<CBNData>("data");
const _context = "Achievement";

const unlocks = data
  .byType("achievement")
  .filter(
    (x) => x.id !== item.id && [x.hidden_by ?? []].flat().includes(item.id),
  );

//Some achievements are hidden by themselves
const hiddenBy = item.hidden_by
  ? [item.hidden_by].flat().filter((x) => x !== item.id)
  : [];
</script>

<h1>
  Achievement: {gameSingularName(item)}
</h1>

<section>
  {#if item.description}
    <p style="color: var(--cata-color-gray)">
      {gameSingular(item.description)}
    </p>
  {/if}
  <dl>
    {#if hiddenBy && hiddenBy.length > 0}
      <dt>{t("Hidden By", { _context })}</dt>
      <dd>
        <ul class="comma-separated and">
          {#each hiddenBy as id}
            {id}
            <li><ThingLink type={item.type} {id} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if unlocks.length}
      <dt>{t("Unlocks", { _context })}</dt>
      <dd>
        <ul class="comma-separated and">
          {#each unlocks as a}
            <li><ThingLink type={item.type} id={a.id} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if item.time_constraint}
      <dt>{t("Time Constraint", { _context })}</dt>
      <dd>
        Time since <strong>{item.time_constraint.since}</strong> is
        <strong
          >{item.time_constraint.is}
          {item.time_constraint.target ?? ""}</strong>
      </dd>
    {/if}
    <dt>{t("Requirements", { _context })}</dt>
    <dd>
      <ul class="no-bullets">
        {#each item.requirements as req}
          <li>
            {#if req.description}
              <strong>{req.description}</strong>
            {:else}
              {@const stat = data.byId("event_statistic", req.event_statistic)}
              <strong
                >{stat.description
                  ? gamePlural(stat.description)
                  : stat.id}</strong>
              is <strong>{req.is} {req.target ?? ""}</strong>
            {/if}
          </li>
        {/each}
      </ul>
    </dd>
  </dl>
</section>
