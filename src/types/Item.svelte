<script lang="ts">
import { t } from "@transifex/native";
import LimitedList from "../LimitedList.svelte";
import { getContext } from "svelte";

import {
  asKilograms,
  asLiters,
  CBNData,
  i18n,
  normalizeUseAction,
  parseVolume,
  singular,
  singularName,
} from "../data";
import type {
  Item,
  RequirementData,
  SupportedTypeMapped,
  UseFunction,
} from "../types";
import AsciiPicture from "./AsciiPicture.svelte";
import AmmoInfo from "./item/AmmoInfo.svelte";
import ArmorInfo from "./item/ArmorInfo.svelte";
import Bash from "./item/Bash.svelte";
import BionicInfo from "./item/BionicInfo.svelte";
import BookInfo from "./item/BookInfo.svelte";
import BrewedFrom from "./item/BrewedFrom.svelte";
import ComestibleInfo from "./item/ComestibleInfo.svelte";
import ComponentOf from "./item/ComponentOf.svelte";
import ContainerInfo from "./item/Container.svelte";
import ConstructionByproduct from "./item/ConstructionByproduct.svelte";
import Deconstruct from "./item/Deconstruct.svelte";
import Disassembly from "./item/Disassembly.svelte";
import DroppedBy from "./item/DroppedBy.svelte";
import Foraged from "./item/Foraged.svelte";
import GrownFrom from "./item/GrownFrom.svelte";
import HarvestedFrom from "./item/HarvestedFrom.svelte";
import ItemLink from "./ItemLink.svelte";
import MilledFrom from "./item/MilledFrom.svelte";
import MagazineInfo from "./item/MagazineInfo.svelte";
import MeleeInfo from "./item/MeleeInfo.svelte";
import Recipes from "./item/Recipes.svelte";
import RequirementDataTools from "./item/RequirementDataTools.svelte";
import Salvaged from "./item/Salvaged.svelte";
import SpawnedIn from "./item/SpawnedIn.svelte";
import SpawnedInVehicle from "./item/SpawnedInVehicle.svelte";
import ToolInfo from "./item/ToolInfo.svelte";
import TransformedFrom from "./item/TransformedFrom.svelte";
import WheelInfo from "./item/WheelInfo.svelte";
import UsageDescription from "./UsageDescription.svelte";
import InterpolatedTranslation from "../InterpolatedTranslation.svelte";
import SmokedFrom from "./item/SmokedFrom.svelte";
import GunInfo from "./item/GunInfo.svelte";

export let item: Item;
let data: CBNData = getContext("data");

const _context = "Item Basic Info";

let qualities = (item.qualities ?? []).map(([id, level]) => ({
  quality: data.byId("tool_quality", id),
  level,
}));

function isStrings<T>(array: string[] | T[]): array is string[] {
  return typeof array[0] === "string";
}
const materials =
  item.material == null
    ? []
    : typeof item.material === "string"
      ? [{ type: item.material, portion: 1 }]
      : isStrings(item.material)
        ? item.material.map((s) => ({ type: s, portion: 1 }))
        : item.material.map((s) => ({ type: s.type, portion: s.portion ?? 1 }));
const totalMaterialPortion = materials.reduce((m, o) => m + o.portion, 0);
const primaryMaterial = materials.reduce(
  (m, o) => (!m || o.portion > m.portion ? o : m),
  null as { type: string; portion: number } | null,
);
let flags = [item.flags ?? []]
  .flat()
  .map((id) => data.byIdMaybe("json_flag", id) ?? { id });
let faults = (item.faults ?? []).map((f) => data.byId("fault", f));

const uncraftRecipe = data.uncraftRecipe(item.id);
const uncraft = uncraftRecipe
  ? (() => {
      const { components, qualities, tools } =
        data.normalizeRequirementsForDisassembly(uncraftRecipe);
      const defaultComponents = components.map((c) => c[0]);
      return { components: defaultComponents, qualities, tools };
    })()
  : undefined;

const vparts = data
  .byType("vehicle_part")
  .filter((vp) => vp.id && vp.item === item.id);

const usage: UseFunction[] = normalizeUseAction(item.use_action).map((s) => {
  if (s.type === "repair_item") {
    return { type: (s as any).item_action_type };
  }
  return s;
});

const ascii_picture =
  item.ascii_picture && data.byIdMaybe("ascii_art", item.ascii_picture);

const byName = (a: any, b: any) =>
  singularName(a).localeCompare(singularName(b));
// TODO: eventually vehicle_parts will probably switch to using materials for fuel_options
const fuelForVPs = data
  .byType("vehicle_part")
  .filter(
    (vp) =>
      vp.id && (vp.fuel_options?.includes(item.id) || vp.fuel_type === item.id),
  );
const fuelForBionics = primaryMaterial?.type
  ? data
      .byType("bionic")
      .filter((b) => b.id && b.fuel_options?.includes(primaryMaterial?.type))
  : [];
const fuelForItems = (fuelForVPs.sort(byName) as SupportedTypeMapped[]).concat(
  fuelForBionics.sort(byName),
);

const usedToRepair = data.byType("fault").filter((f) => {
  const mendingMethods = (f.mending_methods ?? []).map((mm) => {
    const requirements: [RequirementData, number][] =
      typeof mm.requirements === "string"
        ? [[data.byId("requirement", mm.requirements), 1]]
        : Array.isArray(mm.requirements)
          ? mm.requirements.map(
              ([id, num]) =>
                [data.byId("requirement", id), num] as [
                  RequirementData,
                  number,
                ],
            )
          : [[mm.requirements, 1]];
    const requirement = data.normalizeRequirementUsing(requirements);
    const components = data.flattenRequirement(
      requirement.components,
      (r) => r.components,
    );
    return { mending_method: mm, components, requirement };
  });
  return mendingMethods.some((mm) =>
    mm.components.some((c) => c.some((i) => i.id === item.id)),
  );
});

const grantedByMutation = data
  .byType("mutation")
  .filter((m) => m.id && m.integrated_armor?.some((x) => x === item.id));

function normalizeStackVolume(item: Item): (string | number) | undefined {
  if (item.type === "AMMO" && item.ammo_type !== "components") {
    const { count } = item;
    return `${parseVolume(item.volume ?? "1 ml") / (count ?? 1)} ml`;
  }
  if (item.type === "COMESTIBLE") {
    const { charges } = item;
    return `${parseVolume(item.volume ?? "1 ml") / (charges ?? 1)} ml`;
  }
  return item.volume;
}
</script>

<h1 class="capitalize">
  <ItemLink type="item" id={item.id} link={false} />
</h1>
<section>
  <h1>{t("General", { _context })}</h1>
  <div class="side-by-side no-margin">
    <div>
      <dl>
        {#if materials.length}
          <dt>{t("Material")}</dt>
          <dd>
            <ul class="comma-separated">
              {#each materials as m}
                <!-- prettier-ignore -->
                <li>
                  <ItemLink
                    type="material"
                    id={m.type}  showIcon={false} />{#if materials.length > 1}{" "}({(
                      (m.portion / totalMaterialPortion) *
                      100
                    ).toFixed(0)}%){/if}</li>{/each}
            </ul>
          </dd>
        {/if}
        <dt>{t("Volume")}</dt>
        <dd>{asLiters(normalizeStackVolume(item) ?? "1 ml")}</dd>
        <dt>{t("Weight")}</dt>
        <dd>{asKilograms(item.weight ?? 0)}</dd>

        {#if item.weapon_category?.length}
          <dt>
            {t("Category", {
              _context,
              _comment: "Weapon category for martial arts",
            })}
          </dt>
          <dd>
            <ul class="comma-separated">
              {#each item.weapon_category as category_id}
                <li>
                  <ItemLink
                    type="weapon_category"
                    id={category_id}
                    showIcon={false} />
                </li>
              {/each}
            </ul>
          </dd>
        {/if}

        {#if flags.length}
          <dt>{t("Flags")}</dt>
          <dd>
            <ul>
              {#each flags as f}
                <li>
                  {#if "info" in f && f.info}
                    <ItemLink type="json_flag" id={f.id} showIcon={false} />
                    <span style="color: var(--cata-color-gray)"
                      >({singular(f.info)})</span>
                  {:else}
                    <ItemLink type="json_flag" id={f.id} showIcon={false} />
                  {/if}
                </li>
              {/each}
            </ul>
          </dd>
        {/if}

        {#if faults.length}
          <dt>{t("Possible Faults", { _context })}</dt>
          <dd>
            <ul class="comma-separated">
              {#each faults as fault}
                <li>
                  <ItemLink type="fault" id={fault.id} showIcon={false} />
                </li>
              {/each}
            </ul>
          </dd>
        {/if}

        {#if qualities.length}
          <dt>{t("Qualities", { _context })}</dt>
          <dd>
            <ul class="no-bullets">
              {#each qualities as { quality, level }}
                <li>
                  <InterpolatedTranslation
                    str={i18n
                      .gettext(
                        "Has level <color_cyan>%1$d %2$s</color> quality",
                        "{level}",
                        "{quality}",
                      )
                      .replace(/\$[ds]|<\/?color[^>]*>/g, "")}
                    slot0="level"
                    slot1="quality">
                    <strong slot="0">{level}</strong>
                    <ItemLink
                      slot="1"
                      type="tool_quality"
                      id={quality.id}
                      showIcon={false} />
                  </InterpolatedTranslation>
                </li>
              {/each}
            </ul>
          </dd>
        {/if}

        {#if vparts.length}
          <dt>{t("Vehicle Parts", { _context })}</dt>
          <dd>
            <ul class="comma-separated">
              {#each vparts as vpart}
                <li>
                  <ItemLink
                    type="vehicle_part"
                    id={vpart.id}
                    showIcon={false} />
                </li>
              {/each}
            </ul>
          </dd>
        {/if}

        {#if uncraft && uncraftRecipe}
          <dt>{t("Disassembles Into", { _context })}</dt>
          <dd>
            <ul class="comma-separated">
              {#each uncraft.components as [id, count]}
                <li><ItemLink {id} {count} type="item" showIcon={false} /></li>
              {/each}
            </ul>
            {#if uncraft.qualities?.length || uncraft.tools?.length}
              <dl>
                <RequirementDataTools
                  requirement={uncraftRecipe}
                  direction="uncraft" />
              </dl>
            {/if}
          </dd>
        {/if}

        {#if usage.length}
          <dt>{t("Usage", { _context })}</dt>
          <dd>
            <ul class="comma-separated">
              <!-- prettier-ignore -->
              {#each usage as u}<li><UsageDescription usage={u} /></li>{/each}
            </ul>
          </dd>
        {/if}

        {#if item.brewable}
          {@const results = Array.isArray(item.brewable.results)
            ? Object.fromEntries(item.brewable.results.map((r) => [r, 1]))
            : item.brewable.results}
          <dt>{t("Ferments Into", { _context })}</dt>
          <dd>
            <ul class="comma-separated">
              {#each Object.entries(results) as [result_id, count]}
                <li>
                  <ItemLink
                    type="item"
                    id={result_id}
                    {count}
                    showIcon={false} />
                </li>
              {/each}
            </ul>
            ({item.brewable.time ?? "1 turn"})
          </dd>
        {/if}

        {#if item.milling?.into}
          <dt>{t("Mills Into", { _context })}</dt>
          <dd>
            <ItemLink type="item" id={item.milling.into} showIcon={false} />
            (×{item.milling.conversion_rate ?? 0})
          </dd>
        {/if}

        {#if grantedByMutation.length}
          <dt>{t("From Mutation", { _context })}</dt>
          <dd>
            <ul class="comma-separated">
              {#each grantedByMutation as { id }}
                <li><ItemLink type="mutation" {id} showIcon={false} /></li>
              {/each}
            </ul>
          </dd>
        {/if}

        {#if item.nanofab_template_group}
          {@const items = data.flattenTopLevelItemGroup(
            data.byId("item_group", item.nanofab_template_group),
          )}
          <dt>{t("Possible Recipes", { _context })}</dt>
          <dd>
            <ul>
              {#each items as { id, prob }}
                <li>
                  <ItemLink type="item" {id} />
                  ({(prob * 100).toFixed(1)}%)
                </li>
              {/each}
            </ul>
          </dd>
        {/if}
      </dl>
      {#if item.description}
        <p
          style="color: var(--cata-color-gray); margin-bottom: 0; white-space: pre-wrap;">
          {singular(item.description)}
        </p>
      {/if}
    </div>
    <div>
      {#if ascii_picture}
        <AsciiPicture picture={ascii_picture} />
      {/if}
    </div>
  </div>
</section>
{#if item.type === "BOOK"}
  <BookInfo {item} />
{/if}
{#if item.type === "ARMOR" || item.type === "TOOL_ARMOR"}
  <ArmorInfo {item} />
{/if}
{#if item.type === "BIONIC_ITEM"}
  <BionicInfo {item} />
{/if}
{#if item.type === "TOOL" || item.type === "TOOL_ARMOR"}
  <ToolInfo {item} />
{/if}
{#if item.type === "CONTAINER"}
  <ContainerInfo {item} />
{/if}
{#if item.type === "ENGINE" && item.displacement}
  <section>
    <h1>{t("Engine", { _context })}</h1>
    <dl>
      <dt>{t("Displacement", { _context })}</dt>
      <dd>{item.displacement} cc</dd>
    </dl>
  </section>
{/if}
{#if item.type === "COMESTIBLE"}
  <ComestibleInfo {item} />
{/if}
{#if item.type === "WHEEL"}
  <WheelInfo {item} />
{/if}
{#if item.type === "MAGAZINE"}
  <MagazineInfo {item} />
{/if}
{#if item.seed_data}
  <section>
    <h1>{t("Grows Into", { _context: "Seed Data" })}</h1>
    <dl>
      <dt>{t("Harvest Results", { _context: "Seed Data" })}</dt>
      <dd>
        <ul class="comma-separated">
          {#each [item.seed_data.fruit]
            .concat(item.seed_data.byproducts ?? [])
            .concat((item.seed_data.seeds ?? true) ? [item.id] : [])
            .filter((x) => x !== "null") as id}
            <li><ItemLink type="item" {id} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
      <dt>{t("Growing Time", { _context: "Seed Data" })}</dt>
      <dd>{item.seed_data.grow}</dd>
    </dl>
  </section>
{/if}
{#if item.bashing || item.cutting || item.melee_damage || item.type === "GUN" || item.type === "AMMO"}
  {#if item.type === "GUN"}
    <GunInfo {item} />
  {:else if item.type === "AMMO"}
    <AmmoInfo {item} />
  {/if}
  <MeleeInfo {item} />
{/if}
{#if fuelForItems.length}
  <section>
    <h1>{t("Fuel For", { _context })}</h1>
    <LimitedList items={fuelForItems} let:item>
      <ItemLink type={item.type} id={item.id} />
    </LimitedList>
  </section>
{/if}
{#if usedToRepair.length}
  <section>
    <h1>{t("Used to Repair", { _context })}</h1>
    <LimitedList items={usedToRepair} let:item>
      <ItemLink type="fault" id={item.id} showIcon={false} />
    </LimitedList>
  </section>
{/if}
<ComponentOf item_id={item.id} />

<div class="hide-header-if-no-sections">
  <h2>{t("Obtaining", { _context })}</h2>
  <Foraged item_id={item.id} />
  <GrownFrom item_id={item.id} />
  <BrewedFrom item_id={item.id} />
  <HarvestedFrom item_id={item.id} />
  <MilledFrom item_id={item.id} />
  <SmokedFrom item_id={item.id} />
  <TransformedFrom item_id={item.id} />
  <Disassembly item_id={item.id} />
  <Salvaged item_id={item.id} />
  <Recipes item_id={item.id} />
  <ConstructionByproduct item_id={item.id} />
  <Deconstruct item_id={item.id} />
  <Bash item_id={item.id} />
  <DroppedBy item_id={item.id} />
  <SpawnedIn item_id={item.id} />
  <SpawnedInVehicle item_id={item.id} />
</div>

<style>
.hide-header-if-no-sections > h2:last-child {
  display: none;
}
</style>
