<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";

import { byName, CBNData, singular, singularName } from "../data";

import type { Mutation } from "../types";
import MutationColor from "./MutationColor.svelte";
import MutationList from "./MutationList.svelte";
import ItemLink from "./ItemLink.svelte";

export let item: Mutation;

let data = getContext<CBNData>("data");
const _context = "Mutation";
const asStringArray = (value: string | string[] | undefined): string[] =>
  typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
const categories = asStringArray(item.category);
const thresholdRequirements = asStringArray(item.threshreq);
const leadsTo = asStringArray(item.leads_to);
const changesTo = asStringArray(item.changes_to);
const cancels = asStringArray(item.cancels);
const changesToMutations = changesTo
  .map((id) => data.byIdMaybe("mutation", id))
  .filter(Boolean) as Mutation[];
const cancelsMutations = cancels
  .map((id) => data.byIdMaybe("mutation", id))
  .filter(Boolean) as Mutation[];

const postThresholdMutations = data
  .byType("mutation")
  .filter((m) => asStringArray(m.threshreq).includes(item.id))
  .sort(byName);

const requiredBy = data
  .byType("mutation")
  .filter(
    (m) =>
      asStringArray(m.prereqs).includes(item.id) ||
      asStringArray(m.prereqs2).includes(item.id),
  )
  .sort(byName);

const canceledByMutations = data
  .byType("mutation")
  .filter((m) => asStringArray(m.cancels).includes(item.id))
  .sort(byName);

const canceledByBionics = data
  .byType("bionic")
  .filter((b) => (b.canceled_mutations ?? []).includes(item.id))
  .sort(byName);

const conflictsWithBionics = data
  .byType("bionic")
  .filter((b) => (b.mutation_conflicts ?? []).includes(item.id))
  .sort(byName);
</script>

<h1>
  {item.threshold ? t("Threshold Mutation") : t("Mutation")}: {singularName(
    item,
  )}
</h1>
<section>
  <dl>
    <dt>{t("Points", { _context })}</dt>
    <dd><MutationColor mutation={item}>{item.points}</MutationColor></dd>
    {#if categories.length}
      <dt>{t("Category", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each categories as category_id}
            <li>
              <ItemLink
                type="mutation_category"
                id={category_id}
                showIcon={false} />
            </li>
          {/each}
        </ul>
      </dd>
    {:else if item.threshold}
      <dt>{t("Category", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each data
            .byType("mutation_category")
            .filter((mc) => mc.threshold_mut === item.id) as category}
            <li>
              <ItemLink
                type="mutation_category"
                id={category.id}
                showIcon={false} />
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    <dt>{t("Purifiable", { _context })}</dt>
    <dd>{(item.purifiable ?? true) ? t("Yes") : t("No")}</dd>
    <dt>{t("Visibility", { _context })}</dt>
    <dd>{item.visibility ?? 0}</dd>
    <dt>{t("Ugliness", { _context })}</dt>
    <dd>{item.ugliness ?? 0}</dd>
    {#if item.encumbrance_always?.length}
      <dt>{t("Encumbrance", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.encumbrance_always as [part, encumbrance]}
            <li>
              <ItemLink type="body_part" id={part} showIcon={false} /> ({encumbrance})
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if item.encumbrance_covered?.length}
      <dt>{t("Encumbrance (covered)", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.encumbrance_covered as [part, encumbrance]}
            <li>
              <ItemLink type="body_part" id={part} showIcon={false} /> ({encumbrance})
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if item.restricts_gear?.length}
      <dt
        title={t(
          "Gear worn on this body part must be large enough to accommodate abnormally large mutated anatomy.",
        )}>
        {t("Restricts Gear", { _context })}
      </dt>
      <dd>
        <ul class="comma-separated">
          {#each item.restricts_gear as part}
            <li><ItemLink type="body_part" id={part} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if item.craft_skill_bonus?.length}
      <dt>{t("Crafting Skill Modifier", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.craft_skill_bonus as [skill, bonus]}
            <li>
              <ItemLink type="skill" id={skill} showIcon={false} /> ({bonus > 0
                ? "+" + bonus
                : bonus})
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    <dt title={t("You can't have two mutations that share a type.")}>
      {t("{n, plural, =1 {Type} other {Types}}", {
        n: item.types?.length ?? 0,
        _context,
      })}
    </dt>
    <dd>
      {#if item.types}
        <ul class="comma-separated">
          {#each item.types as type_id}
            <li>
              <ItemLink type="mutation_type" id={type_id} showIcon={false} />
            </li>
          {/each}
        </ul>
      {:else}
        <em>{t("none")}</em>
      {/if}
    </dd>
    <dt>{t("Prerequisites", { _context })}</dt>
    <dd>
      {#if item.prereqs}
        <ul>
          <li>
            <ul class="comma-separated or">
              {#each item.prereqs as prereq_id}
                <li>
                  <ItemLink type="mutation" id={prereq_id} showIcon={false} />
                </li>
              {/each}
            </ul>
          </li>
          {#if item.prereqs2}
            <li>
              <ul class="comma-separated or">
                {#each item.prereqs2 as prereq_id}
                  <li>
                    <ItemLink type="mutation" id={prereq_id} showIcon={false} />
                  </li>
                {/each}
              </ul>
            </li>
          {/if}
        </ul>
      {:else}
        <em>{t("none")}</em>
      {/if}
    </dd>
    {#if thresholdRequirements.length}
      <dt>{t("Threshold Requirement", { _context })}</dt>
      <dd>
        <ul class="comma-separated or">
          {#each thresholdRequirements as prereq_id}
            <li>
              <ItemLink type="mutation" id={prereq_id} showIcon={false} />
            </li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if leadsTo.length}
      <dt>{t("Leads To", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each leadsTo as id}
            <li><ItemLink {id} type="mutation" showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if changesTo.length}
      <dt>{t("Changes To", { _context })}</dt>
      <dd>
        <MutationList mutations={changesToMutations} />
      </dd>
    {/if}
    {#if cancels.length}
      <dt>{t("Cancels", { _context })}</dt>
      <dd>
        <MutationList mutations={cancelsMutations} />
      </dd>
    {/if}
    {#if canceledByMutations.length}
      <dt>{t("Canceled By", { _context })}</dt>
      <dd>
        <MutationList mutations={canceledByMutations} />
      </dd>
    {/if}
    {#if conflictsWithBionics.length}
      <dt>{t("Incompatible With", { _context })}</dt>
      <dd>
        <ul>
          {#each conflictsWithBionics as { id }}
            <li><ItemLink {id} type="bionic" showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if canceledByBionics.length}
      <dt>{t("Canceled By Bionics", { _context })}</dt>
      <dd>
        <ul>
          {#each canceledByBionics as { id }}
            <li><ItemLink {id} type="bionic" showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    {#if item.integrated_armor}
      <dt>{t("Integrated Armor", { _context })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each item.integrated_armor as id}
            <li><ItemLink {id} type="item" showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
  </dl>
  <p style="color: var(--cata-color-gray)">{singular(item.description)}</p>
</section>

{#if item.threshold && postThresholdMutations.length}
  <section>
    <h1>{t("Post-Threshold Mutations", { _context })}</h1>
    <MutationList mutations={postThresholdMutations} />
  </section>
{/if}

{#if requiredBy.length}
  <section>
    <h1>{t("Required By", { _context })}</h1>
    <ul>
      {#each requiredBy as m}
        <li><ItemLink id={m.id} type="mutation" showIcon={false} /></li>
      {/each}
    </ul>
  </section>
{/if}
