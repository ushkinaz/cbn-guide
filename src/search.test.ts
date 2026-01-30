/**
 * @jest-environment jsdom
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/svelte";

import { CBNData } from "./data";
import { syncSearch, flushSearch } from "./search";

import SearchResults from "./SearchResults.svelte";

let data: CBNData = new CBNData([
  { type: "MONSTER", id: "zombie", name: "zombie", symbol: "Z" },
  { type: "MONSTER", id: "zombie_child", name: "zombie child", symbol: "z" },
  { type: "BOOK", id: "ZSG", name: "Zombie Survival Guide", symbol: "?" },
  { type: "AMMO", id: "battery", name: "battery", symbol: "=" },
]);

afterEach(() => {
  syncSearch("", data); // Clear search results
  cleanup();
});

test("search results shows results", () => {
  syncSearch("zombie", data);
  flushSearch(); // Ensure search completes synchronously
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
  syncSearch("zaoeusthhhahchsigdiypcgiybx", data);
  flushSearch();
  const { container } = render(SearchResults, {
    data,
    search: "zaoeusthhhahchsigdiypcgiybx",
  });
  expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
  expect(container.textContent).toMatch(/No results/);
});
