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

type SearchResultsSubscriber = (value: SearchResultsMap | null) => void;

export type SearchState = ReturnType<typeof createSearchState>;

/**
 * Creates a reactive search state that manages search data, query, debounced result computation, and subscriptions.
 *
 * The returned object exposes the current query, latest search results, and the first result (if any), and provides methods to update data and query, synchronize both at once, flush pending debounced work, reset state, and subscribe to result changes.
 *
 * @returns An object with:
 *  - `query`: getter for the current search query string
 *  - `results`: getter for the current SearchResultsMap or `null`
 *  - `firstResult`: getter for the first search result item or `null`
 *  - `setData(data)`: set the searchable data (or `null`)
 *  - `setQuery(query)`: set the search query
 *  - `sync(query, data)`: set both query and data, then synchronize results
 *  - `flush()`: immediately run any pending debounced search
 *  - `reset()`: clear data, query, index, and published results
 *  - `subscribeResults(run)`: subscribe to results updates; returns an unsubscribe function
 */
export function createSearchState() {
  const state = $state({
    data: null as CBNData | null,
    query: "",
    results: null as SearchResultsMap | null,
  });

  let lastData: CBNData | null = null;
  let lastIndex: SearchTarget[] = [];
  const subscribers = new Set<SearchResultsSubscriber>();

  function publish(results: SearchResultsMap | null): void {
    state.results = results;
    for (const subscriber of subscribers) {
      subscriber(results);
    }
  }

  function updateResults(
    query: string,
    index: SearchTarget[],
    data: CBNData,
  ): void {
    const shouldSearch = query.length >= 2 || cjkRegex.test(query);
    publish(shouldSearch ? performSearch(query, index, data) : null);
  }

  const performDebouncedSearch = debounce(updateResults, searchDebounceMs);

  function syncState(): void {
    if (!state.data) {
      performDebouncedSearch.cancel();
      publish(null);
      return;
    }

    if (state.data !== lastData) {
      lastIndex = buildSearchIndex(state.data);
      lastData = state.data;
    }

    if (!state.query) {
      performDebouncedSearch.cancel();
      publish(null);
      return;
    }

    performDebouncedSearch(state.query, lastIndex, state.data);
  }

  function setData(data: CBNData | null): void {
    state.data = data;
    syncState();
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
    publish(null);
  }

  function subscribeResults(run: SearchResultsSubscriber): () => void {
    run(state.results);
    subscribers.add(run);
    return () => {
      subscribers.delete(run);
    };
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
    setData,
    setQuery,
    sync,
    flush,
    reset,
    subscribeResults,
  };
}

export const searchState = createSearchState();

/**
 * Reset the global search state to its initial, empty condition.
 *
 * Clears stored data and query, cancels any pending debounced searches, and publishes `null` results to subscribers.
 */
export function resetSearchState(): void {
  searchState.reset();
}
