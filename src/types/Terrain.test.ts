/**
 * @vitest-environment happy-dom
 */
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import WithData from "../WithData.svelte";
import { CBNData } from "../data";
import Terrain from "./Terrain.svelte";

describe("Terrain", () => {
  it("shows deconstruction methods and required tools for advanced terrain removal", () => {
    const data = new CBNData([
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
  });
});
