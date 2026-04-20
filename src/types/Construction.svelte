<script lang="ts">
import { t } from "@transifex/native";
import JSONView from "../JSONView.svelte";

import RequirementsAndList from "./item/RequirementsAndList.svelte";
import { getContext, untrack } from "svelte";
import { CBNData } from "../data";
import type { Construction, RequirementData } from "../types";
import {
  getConstructionPrerequisites,
  getConstructionResults,
  isNullConstructionResult,
} from "./construction";
import ThingLink from "./ThingLink.svelte";
import RequirementDataTools from "./item/RequirementDataTools.svelte";
import { gameSingular, gameSingularName } from "../i18n/game-locale";
import RequirementsOrList from "./item/RequirementsOrList.svelte";

const data = getContext<CBNData>("data");
const _context = "Construction";

interface Props {
  construction: Construction;
  includeTitle?: boolean;
  includeRequires?: boolean;
}

let {
  construction: sourceConstruction,
  includeTitle = false,
  includeRequires = true,
}: Props = $props();
const construction = untrack(() => sourceConstruction);

const using =
  typeof construction.using === "string"
    ? [[construction.using, 1] as [string, number]]
    : (construction.using ?? []);

const requirements = using
  .map(
    ([id, count]) =>
      [data.byId("requirement", id) as RequirementData, count] as const,
  )
  .concat([[construction, 1]]);

const components = requirements.flatMap(([req, count]) => {
  return data
    .flattenRequirement(req.components ?? [], (x) => x.components)
    .map((x) => x.map((x) => ({ ...x, count: x.count * count })));
});

const byproducts = data.flattenItemGroup(
  data.normalizeItemGroup(construction.byproducts, "collection"),
);
const prerequisites = getConstructionPrerequisites(construction);
const results = getConstructionResults(construction);

const preFlags: { flag: string; force_terrain?: boolean }[] = [];
if (construction.pre_flags)
  for (const flag of [construction.pre_flags].flat()) {
    if (typeof flag === "string") {
      preFlags.push({ flag });
    } else preFlags.push(flag);
  }

function sortComponentChoices(
  componentChoices: { id: string; count: number }[],
): { id: string; count: number }[] {
  return [...componentChoices].sort(
    (a, b) =>
      gameSingularName(data.byId("item", a.id)).localeCompare(
        gameSingularName(data.byId("item", b.id)),
      ) || a.id.localeCompare(b.id),
  );
}
</script>

<section>
  {#if includeTitle}
    <h2>
      {gameSingularName(data.byId("construction_group", construction.group))}
    </h2>
  {/if}
  <dl>
    <dt>{t("Required Skills")}</dt>
    <dd>
      {#if construction.required_skills?.length}
        <RequirementsAndList
          items={construction.required_skills}
          horizontal={true}>
          {#snippet children({ item: [id, level] })}
            <ThingLink type="skill" {id} showIcon={false} /> ({level})
          {/snippet}
        </RequirementsAndList>
      {:else}
        {t("none")}
      {/if}
    </dd>
    <dt>{t("Time", { _context })}</dt>
    <dd>
      {typeof construction.time === "number"
        ? `${construction.time} m`
        : (construction.time ?? "0 m")}
    </dd>
    {#if includeRequires && prerequisites.length}
      <dt>{t("Requires", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each prerequisites as prerequisite}
            <li>
              <ThingLink
                type={prerequisite.type}
                id={prerequisite.id}
                showIcon={false} />
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if preFlags.length}
      <dt>{t("Requires Flags", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each preFlags as { flag }}
            <li><ThingLink type="json_flag" id={flag} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    <RequirementDataTools requirement={construction} />
    {#if components.length}
      <dt>{t("Components", { _context: "Requirement" })}</dt>
      <dd>
        <RequirementsAndList items={components}>
          {#snippet children({ item: componentChoices })}
            {@const sortedChoices = sortComponentChoices(componentChoices)}
            <RequirementsOrList
              items={sortedChoices}
              hideLabelWhenSingle={true}>
              {#snippet children({ item: component })}
                <ThingLink
                  id={component.id}
                  count={component.count}
                  type="item"
                  showIcon={false} />
              {/snippet}
            </RequirementsOrList>
          {/snippet}
        </RequirementsAndList>
      </dd>
    {/if}
    {#if byproducts.length}
      <dt>{t("Byproducts", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each byproducts as { id, count }}
            <li>
              <ThingLink type="item" {id} {count} showIcon={false} />
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if !includeTitle && results.length}
      <dt>{t("Creates", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each results as result}
            <li>
              {#if isNullConstructionResult(result)}
                <em
                  >{t("nothing", {
                    _context,
                    _comment:
                      'The furniture/terrain "created" by a deconstruction is...',
                  })}</em>
              {:else}
                <ThingLink type={result.type} id={result.id} showIcon={false} />
              {/if}
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
  </dl>
  {#if construction.pre_note}
    <p style="color: var(--cata-color-gray)">
      {gameSingular(construction.pre_note)}
    </p>
  {/if}
  <JSONView obj={construction} buildNumber={data.buildVersion()} />
</section>
