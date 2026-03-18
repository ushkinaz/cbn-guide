/**
 * @vitest-environment happy-dom
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { CBNData } from "./data";
import SearchResults from "./SearchResults.svelte";
import { searchState } from "./search-state.svelte";
import { performSearch, buildSearchIndex } from "./search-engine";

let data: CBNData = new CBNData([
  { type: "MONSTER", id: "zombie", name: "zombie", symbol: "Z" },
  { type: "MONSTER", id: "zombie_child", name: "zombie child", symbol: "z" },
  { type: "BOOK", id: "ZSG", name: "Zombie Survival Guide", symbol: "?" },
  { type: "AMMO", id: "battery", name: "battery", symbol: "=" },
]);

afterEach(() => {
  searchState.reset();
  cleanup();
});

test("search results shows results", () => {
  searchState.sync("zombie", data);
  searchState.flush();
  const { container } = render(SearchResults, { data, search: "zombie" });
  expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
  expect(container.textContent).toMatch(/zombie/);
  expect(container.textContent).toMatch(/zombie child/);
  expect(container.textContent).toMatch(/Zombie Survival Guide/);
  expect(container.textContent).not.toMatch(/battery/);
});

test("search with <2 letters shows ...", () => {
  // Don't call syncSearch - single letter searches shouldn't trigger
  const { container } = render(SearchResults, { data, search: "z" });
  expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
  expect(container.textContent).toMatch(/\.\.\./);
});

test("search with no results shows 'no results'", () => {
  searchState.sync("zaoeusthhhahchsigdiypcgiybx", data);
  searchState.flush();
  const { container } = render(SearchResults, {
    data,
    search: "zaoeusthhhahchsigdiypcgiybx",
  });
  expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
  expect(container.textContent).toMatch(/No results/);
});

test("search result icon updates when the top match changes", async () => {
  const searchData = new CBNData([
    { type: "BOOK", id: "opal", name: "opal", symbol: "*" },
    { type: "MONSTER", id: "opossum", name: "opossum", symbol: "d" },
  ]);

  searchState.sync("op", searchData);
  searchState.flush();

  const view = render(SearchResults, { data: searchData, search: "op" });

  expect(
    view.container.querySelector("li .item-link__text")?.textContent?.trim(),
  ).toBe("opal");
  expect(
    view.container.querySelector("li .tile-icon")?.textContent?.trim(),
  ).toBe("*");

  searchState.sync("opo", searchData);
  searchState.flush();
  await view.rerender({ data: searchData, search: "opo" });

  expect(
    view.container.querySelector("li .item-link__text")?.textContent?.trim(),
  ).toBe("opossum");
  expect(
    view.container.querySelector("li .tile-icon")?.textContent?.trim(),
  ).toBe("d");
});

test("search result mutation color metadata updates with the top match", async () => {
  const searchData = new CBNData([
    { type: "mutation", id: "growth", name: "growth", points: 2 },
    { type: "mutation", id: "shrink", name: "shrink", points: -2 },
  ]);

  searchState.sync("gr", searchData);
  searchState.flush();

  const view = render(SearchResults, { data: searchData, search: "gr" });

  expect(
    view.container.querySelector("li .item-link__text")?.textContent?.trim(),
  ).toBe("growth");
  expect(
    view.container.querySelector("li .item-link > span[style]")?.textContent,
  ).toBe("2");

  searchState.sync("sh", searchData);
  searchState.flush();
  await view.rerender({ data: searchData, search: "sh" });

  expect(
    view.container.querySelector("li .item-link__text")?.textContent?.trim(),
  ).toBe("shrink");
  expect(
    view.container.querySelector("li .item-link > span[style]")?.textContent,
  ).toBe("-2");
});

test("performSearch returns all results and dedups", () => {
  const manyItems = [];
  for (let i = 0; i < 300; i++) {
    manyItems.push({
      type: "MONSTER",
      id: `zombie_${i}`,
      name: `zombie ${i}`,
      symbol: "z",
    });
  }
  // Add duplicate
  manyItems.push({
    type: "MONSTER",
    id: "zombie_0",
    name: "zombie 0 duplicate",
    symbol: "z",
  });

  const testData = new CBNData(manyItems);
  const targets = buildSearchIndex(testData);

  const results = performSearch("zombie", targets, testData);
  const monsters = results.get("monster");

  expect(monsters).toBeDefined();
  expect(monsters?.length).toBe(300); // Should return all 300 unique monsters

  // Check dedup: zombie_0 should appear once
  const z0 = monsters?.filter((m) => m.item.id === "zombie_0");
  expect(z0?.length).toBe(1);
});
