/**
 * @vitest-environment happy-dom
 */
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import WithData from "../WithData.svelte";
import { makeTestCBNData } from "../data.test-helpers";
import Trap from "./Trap.svelte";

describe("Trap", () => {
  it("renders a basic trap showing names, stats and action", () => {
    const data = makeTestCBNData([
      {
        type: "trap",
        id: "tr_crossbow",
        name: "crossbow trap",
        visibility: 5,
        avoidance: 4,
        difficulty: 0,
        action: "crossbow",
      },
      {
        type: "item",
        id: "crossbow",
        name: "crossbow",
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Trap,
      data,
      item: data.byId("trap", "tr_crossbow"),
    });

    expect(getByText("Visibility")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    expect(getByText("Avoidance")).toBeTruthy();
    expect(getByText("4")).toBeTruthy();
    expect(getByText("Difficulty")).toBeTruthy();
    expect(getByText("0")).toBeTruthy();

    expect(getByText("Action")).toBeTruthy();
    expect(getByText("Crossbow Shot")).toBeTruthy();
  });

  it("shows the Benign property", () => {
    const data = makeTestCBNData([
      {
        type: "trap",
        id: "tr_funnel",
        name: "funnel",
        visibility: -1,
        avoidance: 0,
        difficulty: 0,
        action: "none",
        benign: true,
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Trap,
      data,
      item: data.byId("trap", "tr_funnel"),
    });

    expect(getByText("Always visible")).toBeTruthy();
    expect(getByText("Benign")).toBeTruthy();
  });

  it("shows the drops list correctly", () => {
    const data = makeTestCBNData([
      {
        type: "trap",
        id: "tr_nailboard",
        name: "spiked board",
        visibility: 1,
        avoidance: 6,
        difficulty: 0,
        action: "board",
        drops: ["board_trap"],
      },
      {
        type: "item",
        id: "board_trap",
        name: "board trap",
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Trap,
      data,
      item: data.byId("trap", "tr_nailboard"),
    });

    expect(getByText("Disarm drops")).toBeTruthy();
    expect(getByText("board trap")).toBeTruthy();
  });

  it("shows the Remove on Trigger property and trigger_items", () => {
    const data = makeTestCBNData([
      {
        type: "trap",
        id: "tr_beartrap",
        name: "bear trap",
        visibility: 2,
        avoidance: 3,
        difficulty: 5,
        action: "beartrap",
        remove_on_trigger: true,
        trigger_items: ["beartrap_item"],
      },
      {
        type: "item",
        id: "beartrap_item",
        name: "bear trap item",
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Trap,
      data,
      item: data.byId("trap", "tr_beartrap"),
    });

    expect(getByText("Remove on trigger")).toBeTruthy();
    expect(getByText("Trigger drops")).toBeTruthy();
    expect(getByText("bear trap item")).toBeTruthy();
  });

  it("shows construction sources and trap-specific state", () => {
    const data = makeTestCBNData([
      {
        type: "trap",
        id: "tr_bubblewrap",
        name: "bubble wrap",
        visibility: 0,
        avoidance: 8,
        difficulty: 0,
        action: "bubble",
        always_invisible: true,
        trap_radius: 1,
      },
      {
        type: "GENERIC",
        id: "bubblewrap",
        name: "bubble wrap sheet",
        use_action: {
          type: "place_trap",
          trap: "tr_bubblewrap",
        },
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Trap,
      data,
      item: data.byId("trap", "tr_bubblewrap"),
    });

    expect(getByText("Always Invisible")).toBeTruthy();
    expect(getByText("Trap Radius")).toBeTruthy();
    expect(getByText("Construction")).toBeTruthy();
    expect(getByText("bubble wrap sheet")).toBeTruthy();
  });

  it("preserves quantity when count-by-charges drops specify quantity and charges", () => {
    const data = makeTestCBNData([
      {
        type: "trap",
        id: "tr_charge_drop",
        name: "charge drop trap",
        visibility: 1,
        avoidance: 1,
        difficulty: 1,
        action: "none",
        trigger_items: [{ item: "ration", quantity: 2, charges: 3 }],
      },
      {
        type: "COMESTIBLE",
        id: "ration",
        name: "ration",
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Trap,
      data,
      item: data.byId("trap", "tr_charge_drop"),
    });

    expect(getByText("ration")).toBeTruthy();
    expect(getByText("x6")).toBeTruthy();
  });
});
