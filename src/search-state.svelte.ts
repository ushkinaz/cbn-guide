import type { CBNData } from "./data";
import type {
  SearchResult,
  SearchResultsMap,
  SearchTarget,
} from "./search-engine";
import { buildSearchIndex, cjkRegex, performSearch } from "./search-engine";
import { debounce } from "./utils/debounce";
import { isTesting } from "./utils/env";

const searchDebounceMs = isTesting ? 0 : 150;

/**
 * Creates a reactive search state that manages search data, query, and debounced result computation.
 *
 * The returned object exposes the current query, latest search results, and the first result
 * (if any), and provides methods to update data and query, synchronize both at once, flush
 * pending debounced work, and reset state.
 *
 * @returns An object with:
 *  - `query`: getter for the current search query string
 *  - `results`: getter for the current SearchResultsMap or `null`
 *  - `firstResult`: getter for the first search result item or `null`
 *  - `setQuery(query)`: set the search query
 *  - `sync(query, data)`: set both query and data, then synchronize results
 *  - `flush()`: immediately run any pending debounced search
 *  - `reset()`: clear data, query, index, and published results
 */
export function createSearchState() {
  const state = $state({
    data: null as CBNData | null,
    query: "",
    results: null as SearchResultsMap | null,
  });

  let lastData: CBNData | null = null;
  let lastIndex: SearchTarget[] = [];

  function updateResults(
    query: string,
    index: SearchTarget[],
    data: CBNData,
  ): void {
    const shouldSearch = query.length >= 2 || cjkRegex.test(query);
    state.results = shouldSearch ? performSearch(query, index, data) : null;
  }

  const performDebouncedSearch = debounce(updateResults, searchDebounceMs);

  function syncState(): void {
    if (!state.data) {
      performDebouncedSearch.cancel();
      state.results = null;
      return;
    }

    if (state.data !== lastData) {
      lastIndex = buildSearchIndex(state.data);
      lastData = state.data;
    }

    if (!state.query) {
      performDebouncedSearch.cancel();
      state.results = null;
      return;
    }

    performDebouncedSearch(state.query, lastIndex, state.data);
  }
  function setQuery(query: string): void {
    state.query = query;
    syncState();
  }

  function sync(query: string, data: CBNData | null): void {
    state.query = query;
    state.data = data;
    syncState();
  }

  function flush(): void {
    performDebouncedSearch.flush();
  }

  function reset(): void {
    performDebouncedSearch.cancel();
    lastData = null;
    lastIndex = [];
    state.data = null;
    state.query = "";
    state.results = null;
  }
  function firstResult(): SearchResult["item"] | null {
    if (!state.results || state.results.size === 0) {
      return null;
    }

    const firstGroup = state.results.values().next().value as
      | SearchResult[]
      | undefined;
    return firstGroup?.[0]?.item ?? null;
  }

  return {
    get query(): string {
      return state.query;
    },
    get results(): SearchResultsMap | null {
      return state.results;
    },
    get firstResult(): SearchResult["item"] | null {
      return firstResult();
    },
    setQuery,
    sync,
    flush,
    reset,
  };
}

export const searchState = createSearchState();

/**
 * Test helper: reset the global search state to its initial, empty condition.
 *
 * Clears stored data and query, cancels any pending debounced searches, and resets results to `null`.
 * @internal test-only
 */
export function _resetSearchState(): void {
  searchState.reset();
}
