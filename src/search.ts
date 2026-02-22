import fuzzysort from "fuzzysort";
import { type CBNData, i18n, mapType, singularName } from "./data";
import type { SupportedTypeMapped, SupportedTypesWithMapped } from "./types";
import { metrics } from "./metrics";
import { writable, type Readable } from "svelte/store";
import { debounce } from "./utils/debounce";
import { isTesting } from "./utils/env";
import { nowTimeStamp } from "./utils/perf";

export const SEARCHABLE_TYPES = new Set<keyof SupportedTypesWithMapped>([
  "item",
  "monster",
  "furniture",
  "vehicle_part",
  "tool_quality",
  "martial_art",
  "mutation",
  "mutation_category",
  "vehicle",
  "terrain",
  "skill",
  "overmap_special",
]);

export type SearchTarget = {
  id: string;
  name: string;
  type: keyof SupportedTypesWithMapped;
};

export type SearchResult = {
  item: SupportedTypeMapped & {
    id: string;
    type: keyof SupportedTypesWithMapped;
  } & { __filename?: string };
};

const OVERMAP_DIRECTION_SUFFIX = /_(north|south|east|west)$/;

export function searchableName(data: CBNData, item: SupportedTypeMapped) {
  if (item.type === "overmap_special" || item.type === "city_building") {
    const flat = data._flatten(item);
    if (flat.subtype === "mutable") return flat.id;
    else
      return (
        flat.overmaps
          ?.filter((omEntry) => omEntry.overmap)
          .map((omEntry) => {
            const normalizedId = omEntry.overmap!.replace(
              OVERMAP_DIRECTION_SUFFIX,
              "",
            );
            const om = data.byIdMaybe("overmap_terrain", normalizedId);
            return om ? singularName(om) : normalizedId;
          })
          .join("\0") ?? flat.id
      );
  }

  let name = data.resolveOne(item, "name");
  let type = item.type;
  let id = (item as any).id;

  if (item.type === "vehicle_part" && !name && (item as any).item) {
    const underlying = data.byId("item", (item as any).item);
    name = underlying.name;
    type = underlying.type;
    id = underlying.id;
  }

  if (i18n.getLocale().startsWith("zh_")) {
    const pseudoObj = { id, type, name };
    return singularName(pseudoObj) + " " + singularName(pseudoObj, "pinyin");
  }
  return singularName({ id, type, name });
}

export function buildSearchIndex(data: CBNData): SearchTarget[] {
  const start = nowTimeStamp();
  const raw = data?.all() ?? [];
  const targets: SearchTarget[] = [];
  for (const x of raw) {
    if (!("id" in x) || typeof x.id !== "string") continue;
    const mappedType = mapType(x.type);
    if (!SEARCHABLE_TYPES.has(mappedType)) continue;

    if (x.type === "mutation" && /Fake\d$/.test(x.id as string)) continue;

    if (
      x.type === "MONSTER" &&
      !data.isMonsterVisible((x as { id: string }).id)
    )
      continue;

    targets.push({
      id: (x as any).id,
      name: searchableName(data, x),
      type: mappedType,
    });
  }
  metrics.distribution(
    "search.index.calc_duration_ms",
    nowTimeStamp() - start,
    {
      unit: "millisecond",
    },
  );
  return targets;
}

export function performSearch(
  text: string,
  targets: SearchTarget[],
  data: CBNData,
): Map<string, SearchResult[]> {
  const results = fuzzysort.go(text, targets, {
    keys: ["id", "name"],
    threshold: -10000,
  });

  if (results.length === 0) {
    metrics.count("search.query.empty", 1);
  }
  const byType = new Map<string, SearchResult[]>();
  const seen = new Set<string>();

  for (const { obj: item } of results) {
    const mappedType = item.type;
    if (!SEARCHABLE_TYPES.has(mappedType)) continue;

    let list = byType.get(mappedType);
    if (!list) {
      list = [];
      byType.set(mappedType, list);
    }

    const key = mappedType + ":" + item.id;
    if (seen.has(key)) continue;
    seen.add(key);

    const obj = data.byId(mappedType, item.id) as SearchResult["item"];
    list.push({ item: obj });
  }
  return byType;
}

const _searchResults = writable<Map<string, SearchResult[]> | null>(null);
export const searchResults: Readable<Map<string, SearchResult[]> | null> = {
  subscribe: _searchResults.subscribe,
};

let lastData: CBNData | null = null;
let lastIndex: SearchTarget[] = [];

const cjkRegex =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u3131-\ud79d]/;

const searchDebounceMs = isTesting ? 0 : 150;

const performDebouncedSearch = debounce(
  (query: string, index: SearchTarget[], data: CBNData) => {
    const shouldSearch = query.length >= 2 || cjkRegex.test(query);
    const results = shouldSearch ? performSearch(query, index, data) : null;
    _searchResults.set(results);
  },
  searchDebounceMs,
);

/**
 * Synchronize search results based on query and data.
 * Rebuilds the search index if data has changed.
 * Debounces search execution to avoid expensive operations on every keystroke.
 *
 * @param query - Search query string
 * @param data - Game data to search within
 */
export function syncSearch(query: string, data: CBNData) {
  // If data changed, rebuild index immediately
  if (data !== lastData) {
    lastIndex = buildSearchIndex(data);
    lastData = data;
  }

  // If query is empty, clear results immediately
  if (!query) {
    performDebouncedSearch.cancel();
    _searchResults.set(null);
    return;
  }

  // For non-empty queries, debounce the search
  performDebouncedSearch(query, lastIndex, data);
}

/**
 * Flush any pending debounced search, executing it immediately.
 * Useful when the user wants results right away (e.g., pressing Enter to navigate).
 */
export function flushSearch() {
  performDebouncedSearch.flush();
}
