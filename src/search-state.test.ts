import { expect, test } from "vitest";
import { CBNData } from "./data";
import { createSearchState } from "./search-state.svelte";

test("search state flushes debounced results and tracks first result", () => {
  const searchState = createSearchState();
  const data = new CBNData([
    { type: "BOOK", id: "opal", name: "opal", symbol: "*" },
    { type: "MONSTER", id: "opossum", name: "opossum", symbol: "d" },
  ]);

  searchState.sync("op", data);
  searchState.flush();

  expect(searchState.results?.get("item")?.[0]?.item.id).toBe("opal");
  expect(searchState.firstResult?.id).toBe("opal");

  searchState.setQuery("opo");
  searchState.flush();

  expect(searchState.results?.get("monster")?.[0]?.item.id).toBe("opossum");
  expect(searchState.firstResult?.id).toBe("opossum");
});

test("search state reset clears reactive state", () => {
  const searchState = createSearchState();
  const data = new CBNData([
    { type: "MONSTER", id: "zombie", name: "zombie", symbol: "Z" },
  ]);

  searchState.sync("zombie", data);
  searchState.flush();
  searchState.reset();

  expect(searchState.query).toBe("");
  expect(searchState.results).toBeNull();
  expect(searchState.firstResult).toBeNull();
});
