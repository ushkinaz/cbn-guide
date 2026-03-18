<script lang="ts">
import { t } from "@transifex/native";
import JsonView from "../JsonView.svelte";

import { getContext, untrack } from "svelte";
import { CBNData } from "../data";
import type { Construction, RequirementData } from "../types";
import {
  getConstructionPrerequisites,
  getConstructionResults,
  isNullConstructionResult,
} from "./construction";
import ItemLink from "./ItemLink.svelte";
import RequirementDataTools from "./item/RequirementDataTools.svelte";
import { i18n, gameSingular, gameSingularName } from "../utils/i18n";

const data = getContext<CBNData>("data");
const _context = "Construction";

interface Props {
  construction: Construction;
  includeTitle?: boolean;
}

let { construction: sourceConstruction, includeTitle = false }: Props =
  $props();
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
      {#each construction.required_skills ?? [] as [id, level], i}
        <ItemLink type="skill" {id} showIcon={false} /> ({level}){#if i + 2 === construction.required_skills?.length}{" and "}{:else if i + 1 !== construction.required_skills?.length}{", "}{/if}
      {/each}
    </dd>
    <dt>{t("Time", { _context })}</dt>
    <dd>
      {typeof construction.time === "number"
        ? `${construction.time} m`
        : (construction.time ?? "0 m")}
    </dd>
    {#if prerequisites.length}
      <dt>{t("Requires", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each prerequisites as prerequisite}
            <li>
              <ItemLink type={prerequisite.type} id={prerequisite.id} />
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
            <li><ItemLink type="json_flag" id={flag} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    <RequirementDataTools requirement={construction} />
    {#if components.length}
      <dt>{t("Components", { _context: "Requirement" })}</dt>
      <dd>
        <ul class="no-bullets">
          {#each components as componentChoices}
            <li>
              {#each componentChoices.map( (c) => ({ ...c, item: data.byId("item", c.id) }), ) as { id, count }, i}
                {#if i !== 0}{i18n.__(" OR ")}{/if}
                <ItemLink {id} {count} type="item" showIcon={false} />
              {/each}
            </li>{/each}
        </ul>
      </dd>
    {/if}
    {#if byproducts.length}
      <dt>{t("Byproducts", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each byproducts as { id, count }}
            <li>
              <ItemLink type="item" {id} {count} />
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
                <ItemLink type={result.type} id={result.id} />
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
  <JsonView obj={construction} buildNumber={data.build_number} />
</section>
