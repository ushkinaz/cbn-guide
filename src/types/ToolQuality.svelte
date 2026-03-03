<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";
import { byName, CBNData, i18n, singularName } from "../data";
import LimitedList from "../LimitedList.svelte";
import type { Construction, Item, ToolQuality, VehiclePart } from "../types";
import ItemLink from "./ItemLink.svelte";

interface Props {
  item: ToolQuality;
}

let { item }: Props = $props();

let data = getContext<CBNData>("data");
const _context = "Tool Quality";

let toolsWithQualityByLevelList = $derived.by(() => {
  const toolsWithQualityByLevel = new Map<number, Item[]>();
  for (const it of data.byType("item")) {
    if (!it.id) continue;
    const q = (it.qualities ?? []).find(([id, _level]) => id === item.id);
    if (q) {
      const [, level] = q;
      if (!toolsWithQualityByLevel.has(level))
        toolsWithQualityByLevel.set(level, []);
      toolsWithQualityByLevel.get(level)!.push(it);
    } else {
      if (it.type === "GUN" && !it.flags?.includes("PRIMITIVE_RANGED_WEAPON")) {
        if (it.skill.toUpperCase() === item.id) {
          if (!toolsWithQualityByLevel.has(1))
            toolsWithQualityByLevel.set(1, []);
          toolsWithQualityByLevel.get(1)!.push(it);
        }
      }
    }
  }
  const toolsWithQualityByLevelListValue = [
    ...toolsWithQualityByLevel.entries(),
  ].sort((a, b) => a[0] - b[0]);
  toolsWithQualityByLevelListValue.forEach(([, tools]) => {
    tools.sort(byName);
  });
  return toolsWithQualityByLevelListValue;
});

let vpartsWithQualityByLevelList = $derived.by(() => {
  const vpartsWithQualityByLevel = new Map<number, VehiclePart[]>();
  for (const it of data.byType("vehicle_part")) {
    if (!it.id) continue;
    const q = (it.qualities ?? []).find(([id, _level]) => id === item.id);
    if (q) {
      const [, level] = q;
      if (!vpartsWithQualityByLevel.has(level))
        vpartsWithQualityByLevel.set(level, []);
      vpartsWithQualityByLevel.get(level)!.push(it);
    }
  }
  const vpartsWithQualityByLevelListValue = [
    ...vpartsWithQualityByLevel.entries(),
  ].sort((a, b) => a[0] - b[0]);
  vpartsWithQualityByLevelListValue.forEach(([, vparts]) => {
    vparts.sort(byName);
  });
  return vpartsWithQualityByLevelListValue;
});

let recipesUsingQualityList = $derived.by(() => {
  const recipesUsingQualitySet = new Map<number, Set<string>>();
  for (const it of data.byType("recipe")) {
    if (!it.result || !data.byIdMaybe("item", it.result)) continue;
    const { qualities } = data.normalizeRequirements(it);
    for (const qs of qualities) {
      for (const { id, level = 1 } of qs) {
        if (id === item.id) {
          if (!recipesUsingQualitySet.has(level))
            recipesUsingQualitySet.set(level, new Set());
          recipesUsingQualitySet.get(level)!.add(it.result);
        }
      }
    }
  }
  const recipesUsingQuality = new Map<number, string[]>();
  for (const [level, set] of recipesUsingQualitySet)
    recipesUsingQuality.set(
      level,
      [...set].sort((a, b) =>
        singularName(data.byId("item", a)).localeCompare(
          singularName(data.byId("item", b)),
        ),
      ),
    );
  return [...recipesUsingQuality.entries()].sort((a, b) => a[0] - b[0]);
});

let constructionsUsingQualityByLevelList = $derived.by(() => {
  const constructionsUsingQualityByLevel = new Map<number, Construction[]>();
  for (const construction of data.byType("construction")) {
    const { qualities } = data.normalizeRequirements(construction);
    for (const qs of qualities) {
      for (const { id, level = 1 } of qs) {
        if (id === item.id) {
          if (!constructionsUsingQualityByLevel.has(level))
            constructionsUsingQualityByLevel.set(level, []);
          constructionsUsingQualityByLevel.get(level)!.push(construction);
        }
      }
    }
  }
  const constructionsUsingQualityByLevelListValue = [
    ...constructionsUsingQualityByLevel.entries(),
  ].sort((a, b) => a[0] - b[0]);
  constructionsUsingQualityByLevelListValue.forEach(([, constructions]) => {
    constructions.sort((a, b) =>
      singularName(data.byId("construction_group", a.group)).localeCompare(
        singularName(data.byId("construction_group", b.group)),
      ),
    );
  });
  return constructionsUsingQualityByLevelListValue;
});
</script>

<h1>{t("Quality", { _comment: "Tool Quality" })}: {singularName(item)}</h1>
{#if item.usages}
  <section>
    <h2>{t("Usages", { _context })}</h2>
    <dl>
      {#each item.usages as [level, usages]}
        <dt style="font-variant: tabular-nums">
          {t("Level {level}", { level, _context })}
        </dt>
        <dd>
          <ul class="comma-separated">
            <!-- prettier-ignore -->
            {#each usages as usage}<li><ItemLink type="item_action" id={usage}  showIcon={false} /></li>{/each}
          </ul>
        </dd>
      {/each}
    </dl>
  </section>
{/if}
{#if toolsWithQualityByLevelList.length}
  <section>
    <h2>{t("Tools", { _context })}</h2>
    <dl>
      {#each toolsWithQualityByLevelList as [level, tools]}
        <dt style="font-variant: tabular-nums">
          {t("Level {level}", { level, _context })}
        </dt>
        <dd>
          <LimitedList items={tools} limit={20}>
            {#snippet children({ item })}
              <ItemLink type="item" id={item.id} />
            {/snippet}
          </LimitedList>
        </dd>
      {/each}
    </dl>
  </section>
{/if}
{#if vpartsWithQualityByLevelList.length}
  <section>
    <h2>{t("Vehicle Parts")}</h2>
    <dl>
      {#each vpartsWithQualityByLevelList as [level, vparts]}
        <dt style="font-variant: tabular-nums">
          {t("Level {level}", { level, _context })}
        </dt>
        <dd>
          <LimitedList items={vparts.sort(byName)} limit={20}>
            {#snippet children({ item })}
              <ItemLink type="vehicle_part" id={item.id} />
            {/snippet}
          </LimitedList>
        </dd>
      {/each}
    </dl>
  </section>
{/if}
{#if recipesUsingQualityList.length}
  <section>
    <h2>{t("Recipes")}</h2>
    <dl>
      {#each recipesUsingQualityList as [level, recipes]}
        <dt style="font-variant: tabular-nums">
          {t("Level {level}", { level, _context })}
        </dt>
        <dd>
          <LimitedList items={recipes} limit={20}>
            {#snippet children({ item })}
              <ItemLink type="item" id={item} />
            {/snippet}
          </LimitedList>
        </dd>
      {/each}
    </dl>
  </section>
{/if}
{#if constructionsUsingQualityByLevelList.length}
  <section>
    <h2>{t("Constructions")}</h2>
    <dl>
      {#each constructionsUsingQualityByLevelList as [level, constructions]}
        <dt style="font-variant: tabular-nums">
          {t("Level {level}", { level, _context })}
        </dt>
        <dd>
          <LimitedList items={constructions}>
            {#snippet children({ item: f })}
              <ItemLink
                id={f.group}
                type="construction_group"
                showIcon={false} />
              {#if f.pre_terrain}
                on {#each [f.pre_terrain].flat() as preTerrain, i}
                  {@const itemType = preTerrain.startsWith("f_")
                    ? "furniture"
                    : "terrain"}
                  {#if i !== 0}{i18n.__(" OR ")}{/if}
                  <ItemLink type={itemType} id={preTerrain} />
                {/each}
              {/if}
            {/snippet}
          </LimitedList>
        </dd>
      {/each}
    </dl>
  </section>
{/if}
