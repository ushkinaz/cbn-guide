/**
 * @jest-environment jsdom
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render, act } from "@testing-library/svelte";

import { CBNData } from "./data";
import { syncSearch } from "./search";

import SearchResults from "./SearchResults.svelte";

let data: CBNData = new CBNData([
  { type: "MONSTER", id: "zombie", name: "zombie", symbol: "Z" },
  { type: "MONSTER", id: "zombie_child", name: "zombie child", symbol: "z" },
  { type: "BOOK", id: "ZSG", name: "Zombie Survival Guide", symbol: "?" },
  { type: "AMMO", id: "battery", name: "battery", symbol: "=" },
]);

afterEach(cleanup);

test("search results shows results", async () => {
  const { container } = render(SearchResults, { data, search: "zombie" });
  await act(() => syncSearch("zombie", data));
  expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
  expect(container.textContent).toMatch(/zombie/);
  expect(container.textContent).toMatch(/zombie child/);
  expect(container.textContent).toMatch(/Zombie Survival Guide/);
  expect(container.textContent).not.toMatch(/battery/);
});

test("search with <2 letters shows ...", async () => {
  const { container } = render(SearchResults, { data, search: "z" });
  await act(() => syncSearch("z", data));
  expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
  expect(container.textContent).toMatch(/\.\.\./);
});

test("search with no results shows 'no results'", async () => {
  const { container } = render(SearchResults, {
    data,
    search: "zaoeusthhhahchsigdiypcgiybx",
  });
  await act(() => syncSearch("zaoeusthhhahchsigdiypcgiybx", data));
  expect(container.textContent).not.toMatch(/undefined|NaN|object Object/);
  expect(container.textContent).toMatch(/No results/);
});
