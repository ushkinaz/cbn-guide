/**
 * @vitest-environment happy-dom
 */
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import WithData from "../WithData.svelte";
import { makeTestCBNData } from "../data.test-helpers";
import Terrain from "./Terrain.svelte";

describe("Terrain", () => {
  it("shows pry details from the real terrain pry data", () => {
    const data = makeTestCBNData([
      {
        type: "tool_quality",
        id: "PRY",
        name: "prying",
      },
      {
        type: "terrain",
        id: "t_door_locked",
        name: "locked door",
        description: "A test door that resists your intentions.",
        pry: {
          pry_quality: 1,
          noise: 12,
          difficulty: 11,
          alarm: true,
          breakable: true,
          new_ter_type: "t_door_o",
          pry_items: [{ item: "manhole_cover" }],
          break_items: [{ item: "2x4" }, { item: "nail", charges: [0, 2] }],
        },
      },
      {
        type: "terrain",
        id: "t_door_o",
        name: "open door",
        description: "The door is now open.",
      },
      {
        type: "item",
        id: "manhole_cover",
        name: "manhole cover",
      },
      {
        type: "item",
        id: "2x4",
        name: "2x4",
      },
      {
        type: "item",
        id: "nail",
        name: "nail",
        stackable: true,
      },
    ]);

    const { getByText, queryByText } = render(WithData, {
      Component: Terrain,
      data,
      item: data.byId("terrain", "t_door_locked"),
    });

    expect(getByText("Requires")).toBeTruthy();
    expect(getByText("prying")).toBeTruthy();
    expect(getByText("Difficulty")).toBeTruthy();
    expect(getByText("11")).toBeTruthy();
    expect(getByText("Alarm")).toBeTruthy();
    expect(getByText("Breakable")).toBeTruthy();
    expect(getByText("open door")).toBeTruthy();
    expect(getByText("Pry Items")).toBeTruthy();
    expect(getByText("manhole cover")).toBeTruthy();
    expect(getByText("Debris")).toBeTruthy();
    expect(getByText("2x4")).toBeTruthy();
    expect(getByText("nail")).toBeTruthy();
    expect(getByText((content) => content.includes("0–2"))).toBeTruthy();
    expect(queryByText("Duration")).toBeNull();
  });

  it("shows the terrain deconstruction result target", () => {
    const data = makeTestCBNData([
      {
        type: "terrain",
        id: "t_test_wall",
        name: "test wall",
        description: "A wall awaiting negation.",
        deconstruct: {
          items: [{ item: "2x4", count: [2, 2] }],
          ter_set: "t_test_rubble",
        },
      },
      {
        type: "terrain",
        id: "t_test_rubble",
        name: "test rubble",
        description: "What remains.",
      },
      {
        type: "item",
        id: "2x4",
        name: "2x4",
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Terrain,
      data,
      item: data.byId("terrain", "t_test_wall"),
    });

    expect(getByText("Deconstruct")).toBeTruthy();
    expect(getByText("Becomes")).toBeTruthy();
    expect(getByText("test rubble")).toBeTruthy();
  });

  it("shows deconstruction methods and required tools for advanced terrain removal", () => {
    const data = makeTestCBNData([
      {
        type: "construction_group",
        id: "advanced_object_deconstruction",
        name: "Advanced Object Deconstruction",
      },
      {
        type: "tool_quality",
        id: "SCREW",
        name: "screw driving",
      },
      {
        type: "construction",
        id: "constr_remove_t_console",
        group: "advanced_object_deconstruction",
        category: "OTHER",
        time: "20 m",
        required_skills: [["electronics", 0]],
        qualities: [{ id: "SCREW", level: 1 }],
        pre_terrain: "t_console",
        pre_special: "check_deconstruct",
      },
      {
        type: "terrain",
        id: "t_console",
        name: "console",
        description: "A test console.",
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Terrain,
      data,
      item: data.byId("terrain", "t_console"),
    });

    expect(getByText("Deconstruction")).toBeTruthy();
    expect(getByText("Tools Required")).toBeTruthy();
    expect(getByText("screw driving")).toBeTruthy();

    const { queryByText } = render(WithData, {
      Component: Terrain,
      data,
      item: data.byId("terrain", "t_console"),
    });

    expect(queryByText("Requires")).toBeNull();
  });
});
