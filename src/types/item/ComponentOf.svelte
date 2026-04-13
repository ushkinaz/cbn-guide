<script lang="ts">
import { t } from "@transifex/native";
import { getContext, untrack } from "svelte";
import { CBNData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ThingLink from "../ThingLink.svelte";
import { getConstructionPrerequisites } from "../construction";
import { gameSingularName } from "../../i18n/game-locale";

interface Props {
  item_id: string;
}

let { item_id: sourceItemId }: Props = $props();
const item_id = untrack(() => sourceItemId);
const _context = "Item Basic Info";

const data = getContext<CBNData>("data");

const itemComponents = data.getItemComponents();

const recipes: Set<string> =
  itemComponents.byComponent.get(item_id) ?? new Set();
const toolRecipes: Set<string> =
  itemComponents.byTool.get(item_id) ?? new Set();

const constructionComponents = data.getConstructionComponents();
const constructions = [
  ...(constructionComponents.byComponent.get(item_id) ?? new Set()),
]
  .map((id) => data.byId("construction", id))
  .sort((a, b) =>
    gameSingularName(data.byId("construction_group", a.group)).localeCompare(
      gameSingularName(data.byId("construction_group", b.group)),
    ),
  );
const toolConstructions = [
  ...(constructionComponents.byTool.get(item_id) ?? new Set()),
]
  .map((id) => data.byId("construction", id))
  .sort((a, b) =>
    gameSingularName(data.byId("construction_group", a.group)).localeCompare(
      gameSingularName(data.byId("construction_group", b.group)),
    ),
  );

const providedByVparts = data
  .byType("vehicle_part")
  .filter((vp) => vp.id && vp.pseudo_tools?.some((t) => t.id === item_id));
const providedByFurniture = data
  .byType("furniture")
  .filter((f) => f.id && f.crafting_pseudo_item === item_id);
const results = [...recipes].sort((a, b) =>
  gameSingularName(data.byId("item", a)).localeCompare(
    gameSingularName(data.byId("item", b)),
  ),
);
const toolResults = [...toolRecipes].sort((a, b) =>
  gameSingularName(data.byId("item", a)).localeCompare(
    gameSingularName(data.byId("item", b)),
  ),
);
</script>

{#if providedByVparts.length}
  <section>
    <h2>
      {t("Provided By Vehicle Parts", {
        _context,
        _comment: "Section heading",
      })}
    </h2>
    <LimitedList items={providedByVparts}>
      {#snippet children({ item })}
        <ThingLink type={item.type} id={item.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}

{#if providedByFurniture.length}
  <section>
    <h2>
      {t("Provided By Furniture", { _context, _comment: "Section heading" })}
    </h2>
    <LimitedList items={providedByFurniture}>
      {#snippet children({ item })}
        <ThingLink type={item.type} id={item.id} />
      {/snippet}
    </LimitedList>
  </section>
{/if}

{#if results.length || toolResults.length}
  <div class="side-by-side">
    {#if results.length}
      <section>
        <h2>{t("Component Of", { _context, _comment: "Section heading" })}</h2>
        <LimitedList items={results}>
          {#snippet children({ item })}
            <ThingLink type="item" id={item} />
          {/snippet}
        </LimitedList>
      </section>
    {/if}

    {#if toolResults.length}
      <section>
        <h2>
          {t("Tool For Crafting", { _context, _comment: "Section heading" })}
        </h2>
        <LimitedList items={toolResults}>
          {#snippet children({ item })}
            <ThingLink type="item" id={item} />
          {/snippet}
        </LimitedList>
      </section>
    {/if}
  </div>
{/if}

{#if constructions.length || toolConstructions.length}
  <div class="side-by-side">
    {#if constructions.length}
      <section>
        <h2>
          {t("Used In Construction", { _context, _comment: "Section heading" })}
        </h2>
        <LimitedList items={constructions}>
          {#snippet children({ item: f })}
            <ThingLink
              id={f.group}
              type="construction_group"
              showIcon={false} />
            {@const prerequisites = getConstructionPrerequisites(f)}
            {#if prerequisites.length}
              {t("on")}
              {#each prerequisites as prerequisite, i}
                {#if i !== 0},
                {/if}
                <ThingLink type={prerequisite.type} id={prerequisite.id} />
              {/each}
            {/if}
          {/snippet}
        </LimitedList>
      </section>
    {/if}
    {#if toolConstructions.length}
      <section>
        <h2>
          {t("Tool For Construction", {
            _context,
            _comment: "Section heading",
          })}
        </h2>
        <LimitedList items={toolConstructions}>
          {#snippet children({ item: f })}
            <ThingLink
              id={f.group}
              type="construction_group"
              showIcon={false} />
            {@const prerequisites = getConstructionPrerequisites(f)}
            {#if prerequisites.length}
              {t("on")}
              {#each prerequisites as prerequisite, i}
                {#if i !== 0},
                {/if}
                <ThingLink type={prerequisite.type} id={prerequisite.id} />
              {/each}
            {/if}
          {/snippet}
        </LimitedList>
      </section>
    {/if}
  </div>
{/if}
