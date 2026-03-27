/**
 * @vitest-environment happy-dom
 */
import { render } from "@testing-library/svelte";

import WithData from "../../WithData.svelte";
import { CBNData } from "../../data";
import DisarmTrap from "./DisarmTrap.svelte";
import { describe, expect, it } from "vitest";

describe("the disarm trap section", () => {
  it("shows traps that can drop an item when disarmed", () => {
    const data = new CBNData([
      {
        type: "GENERIC",
        id: "fake_item",
        name: "fake item",
      },
      {
        type: "trap",
        id: "tr_fake_string_drop",
        name: "string drop trap",
        drops: ["fake_item"],
      },
      {
        type: "trap",
        id: "tr_fake_object_drop",
        name: "object drop trap",
        drops: [{ item: "fake_item", quantity: 2 }],
      },
    ]);

    const { getByText } = render(WithData, {
      Component: DisarmTrap,
      data,
      item_id: "fake_item",
    });

    expect(getByText("Disarmed From")).toBeTruthy();
    expect(getByText("string drop trap")).toBeTruthy();
    expect(getByText("object drop trap")).toBeTruthy();
  });
});
