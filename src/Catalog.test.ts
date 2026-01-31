// @vitest-environment jsdom
import { render } from "@testing-library/svelte";
import { describe, it, expect, vi } from "vitest";
import Catalog from "./Catalog.svelte";
import { CBNData } from "./data";

// Mock transifex/native
vi.mock("@transifex/native", () => ({
  t: (str: string, params: any) => {
    let res = str;
    if (params) {
      for (const k in params) {
        res = res.replace(`{${k}}`, params[k]);
      }
    }
    return res;
  },
  tx: {
    init: () => {},
    setCurrentLocale: () => {},
  },
}));

// Mock i18n
vi.mock("./i18n", () => ({
  t: (str: string) => str,
}));

describe("Catalog Optimization", () => {
  it("filters mutations correctly and hides empty groups", () => {
    // We create data where 'Fake1' is filtered out.
    // 'Cat1' has only 'Fake1'.
    // 'Cat2' has 'Valid1'.
    const data = new CBNData([
      {
        type: "mutation",
        id: "Fake1",
        name: "Fake Mutation",
        category: ["Cat1"],
      },
      {
        type: "mutation",
        id: "Valid1",
        name: "Valid Mutation",
        category: ["Cat2"],
      },
      // We do NOT define mutation_category objects for Cat1/Cat2 so they fall back to generic list view
    ]);

    const { getByText, queryByText } = render(Catalog, {
      type: "mutation",
      data,
    });

    // Valid mutation should be present
    expect(getByText("Valid Mutation")).toBeTruthy();

    // Fake mutation should be filtered out
    expect(queryByText("Fake Mutation")).toBeNull();

    // Category 2 header should be present
    expect(getByText("Cat2")).toBeTruthy();

    // Category 1 header:
    // With optimization (filtering before grouping), it SHOULD NOT show up because it only contains filtered items.
    expect(queryByText("Cat1")).toBeNull();
  });
});
