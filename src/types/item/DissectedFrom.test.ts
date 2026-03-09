/**
 * @vitest-environment happy-dom
 */
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import DissectedFrom from "./DissectedFrom.svelte";
import WithData from "../../WithData.svelte";
import { CBNData } from "../../data";

describe("DissectedFrom", () => {
  it("displays the monsters that an item is dissected from", async () => {
    const item_id = "test_bionic";
    const data = new CBNData([
      {
        type: "MONSTER",
        id: "test_monster",
        name: { str: "Test Monster" },
        harvest: "test_harvest",
      },
      {
        type: "harvest",
        id: "test_harvest",
        entries: [{ drop: item_id, type: "bionic" }],
      },
      {
        type: "GENERIC",
        id: item_id,
        name: { str: "Test Bionic" },
      },
    ]);

    const { getByText } = render(WithData, {
      Component: DissectedFrom,
      item_id,
      data,
    });

    expect(getByText(/Dissected From/)).toBeTruthy();
    expect(getByText(/Test Monster/)).toBeTruthy();
  });

  it("does not display anything if there are no dissection sources", async () => {
    const item_id = "lonely_item";
    const data = new CBNData([
      {
        type: "GENERIC",
        id: item_id,
        name: { str: "Lonely Item" },
      },
    ]);

    const { queryByText } = render(WithData, {
      Component: DissectedFrom,
      item_id,
      data,
    });

    expect(queryByText(/Dissected From/)).toBeNull();
  });
});
