<script lang="ts">
import { type CBNData, loadProgress, mapType } from "./data";
import ItemLink from "./types/ItemLink.svelte";
import type { OvermapSpecial, SupportedTypesWithMapped } from "./types";
import { setContext, untrack } from "svelte";
import { t } from "@transifex/native";
import LimitedList from "./LimitedList.svelte";
import {
  getOMSByAppearance,
  overmapAppearance,
} from "./types/item/spawnLocations";
import { searchState } from "./search-state.svelte";
import type { SearchResult, SearchResultsMap } from "./search-engine";
import Loading from "./Loading.svelte";
import { translateType } from "./utils/i18n";

interface Props {
  data: CBNData;
  search: string;
  results?: SearchResultsMap | null;
}

let { data, search, results: sourceResults }: Props = $props();

function groupByAppearance(results: SearchResult[]): OvermapSpecial[][] {
  const seenAppearances = new Set<string>();
  const ret: OvermapSpecial[][] = [];
  for (const r of results) {
    const oms = r.item as OvermapSpecial;
    const appearance = overmapAppearance(data, oms);
    if (!appearance) ret.push([oms]);
    else if (!seenAppearances.has(appearance)) {
      ret.push(
        getOMSByAppearance(data)
          .get(appearance)!
          .map((id) => data.byId("overmap_special", id)),
      );
      seenAppearances.add(appearance);
    }
  }
  return ret;
}
const contextData = untrack(() => data);
setContext("data", contextData);
let results = $derived(
  sourceResults === undefined ? searchState.results : sourceResults,
);
let matchingObjectsList = $derived(results ? [...results.entries()] : null);

function asType(type: string): keyof SupportedTypesWithMapped {
  return type as keyof SupportedTypesWithMapped;
}
</script>

{#if matchingObjectsList}
  {#each matchingObjectsList as [type, results] (type)}
    <section>
      {#if type === "overmap_special"}
        {@const grouped = groupByAppearance(results)}
        <h2>{t("Locations", { _context: "Search Results" })}</h2>
        <LimitedList items={grouped} limit={25}>
          {#snippet children({ item: result })}
            <ItemLink type="overmap_special" id={result[0].id} />
          {/snippet}
        </LimitedList>
      {:else}
        <h2>{translateType(asType(type))}</h2>
        <LimitedList items={results} limit={25}>
          {#snippet children({ item: result })}
            <ItemLink type={mapType(result.item.type)} id={result.item.id} />
          {/snippet}
        </LimitedList>
      {/if}
    </section>
  {:else}
    <div role="status" aria-live="polite">
      {t('No results for "{query}".', {
        query: search,
        _context: "Search Results",
      })}
    </div>
  {/each}
{:else if data || !$loadProgress}
  <div class="searching-state" style="font-size: 20px">
    <ItemLink
      type="monster"
      id="mon_dog_thing"
      overrideText={t("looking...", {
        _context: "Search Results",
      })}
      link={false} />
  </div>
{:else}
  <Loading text="..." />
{/if}

<style>
.searching-state {
  animation: pulse 1.5s infinite;
  color: var(--cata-color-gray);
  font-style: italic;
  padding-left: 100px;
}

@keyframes pulse {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}
</style>
