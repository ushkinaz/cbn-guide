<script lang="ts">
import { type CBNData, loadProgress, mapType, omsName } from "./data";
import { getVersionedBasePath } from "./routing";
import ItemLink from "./types/ItemLink.svelte";
import type { OvermapSpecial } from "./types";
import { setContext } from "svelte";
import { t } from "./i18n";
import LimitedList from "./LimitedList.svelte";
import LimitedTableList from "./LimitedTableList.svelte";
import OvermapAppearance from "./types/item/OvermapAppearance.svelte";
import {
  getOMSByAppearance,
  overmapAppearance,
} from "./types/item/spawnLocations";
import { type SearchResult, searchResults } from "./search";

export let data: CBNData;
$: setContext("data", data);

export let search: string;

$: matchingObjectsList = $searchResults ? [...$searchResults.entries()] : null;

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
</script>

{#if matchingObjectsList}
  {#each matchingObjectsList as [type, results]}
    {#if type === "overmap_special"}
      {@const grouped = groupByAppearance(results)}
      <h1>location</h1>
      <LimitedTableList items={grouped} limit={50}>
        <tr slot="item" let:item={result}>
          <td style="text-align: center; padding-left: 2.5em;">
            <OvermapAppearance overmapSpecial={result[0]} />
          </td>
          <td style="vertical-align: middle; padding-left: 5px;">
            <a
              href="{getVersionedBasePath()}overmap_special/{result[0]
                .id}{location.search}">{omsName(data, result[0])}</a
            >{#if result.length > 1}{" "}({result.length} variants){/if}
          </td>
        </tr>
      </LimitedTableList>
    {:else}
      <h1>{type.replace(/_/g, " ")}</h1>
      <LimitedList items={results} let:item={result} limit={50}>
        {@const item = data._flatten(result.item)}
        <ItemLink type={mapType(result.item.type)} id={result.item.id} />
        {#if /obsolet/.test(result.item.__filename ?? "")}
          <em style="color: var(--cata-color-gray)"
            >({t("obsolete", { _context: "Search Results" })})</em>
        {/if}
      </LimitedList>
    {/if}
  {:else}
    <em
      >{t("No results for {query}.", {
        query: search,
        _context: "Search Results",
      })}</em>
  {/each}
{:else if data || !$loadProgress}
  <pre>...</pre>
{:else}
  <pre>{($loadProgress[0] / 1024 / 1024).toFixed(1)}/{(
      $loadProgress[1] /
      1024 /
      1024
    ).toFixed(1)} MB</pre>
{/if}
