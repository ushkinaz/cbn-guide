/**
 * @vitest-environment happy-dom
 */
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import WithData from "../WithData.svelte";
import { CBNData } from "../data";
import Furniture from "./Furniture.svelte";

describe("Furniture", () => {
  it("shows furniture constructions from post_furniture", () => {
    const data = new CBNData([
      {
        type: "construction_group",
        id: "build_sign",
        name: "Build Sign",
      },
      {
        type: "construction_group",
        id: "dig_pit",
        name: "Dig Pit",
      },
      {
        type: "construction",
        id: "constr_sign",
        group: "build_sign",
        category: "OTHER",
        time: "20 m",
        required_skills: [["fabrication", 0]],
        post_furniture: "f_sign",
      },
      {
        type: "construction",
        id: "constr_pit",
        group: "dig_pit",
        category: "OTHER",
        time: "30 m",
        required_skills: [["fabrication", 0]],
        post_terrain: "t_pit",
      },
      {
        type: "furniture",
        id: "f_sign",
        name: "sign",
        description: "Read it. Warnings ahead.",
        move_cost_mod: 0,
        required_str: 0,
      },
      {
        type: "terrain",
        id: "t_pit",
        name: "pit",
        description: "A test pit.",
      },
    ]);

    const { getByText, queryByText } = render(WithData, {
      Component: Furniture,
      data,
      item: data.byId("furniture", "f_sign"),
    });

    expect(getByText("Construction")).toBeTruthy();
    expect(getByText("Build Sign")).toBeTruthy();
    expect(queryByText("Dig Pit")).toBeNull();
  });

  it("shows deconstruction methods and required tools for advanced furniture removal", () => {
    const data = new CBNData([
      {
        type: "construction_group",
        id: "advanced_object_deconstruction",
        name: "Advanced Object Deconstruction",
      },
      {
        type: "requirement",
        id: "object_deconstruction_advanced",
        qualities: [
          { id: "HAMMER", level: 2 },
          { id: "CHISEL", level: 2 },
          { id: "PRY", level: 3 },
          { id: "SCREW", level: 1 },
        ],
      },
      {
        type: "tool_quality",
        id: "HAMMER",
        name: "hammering",
      },
      {
        type: "tool_quality",
        id: "CHISEL",
        name: "chiseling",
      },
      {
        type: "tool_quality",
        id: "PRY",
        name: "prying",
      },
      {
        type: "tool_quality",
        id: "SCREW",
        name: "screw driving",
      },
      {
        type: "construction",
        id: "constr_remove_object_fireplace",
        group: "advanced_object_deconstruction",
        category: "OTHER",
        time: "90 m",
        required_skills: [["fabrication", 2]],
        using: "object_deconstruction_advanced",
        pre_furniture: "f_fireplace",
        pre_special: "check_deconstruct",
      },
      {
        type: "furniture",
        id: "f_fireplace",
        name: "fireplace",
        description: "A warm test fixture.",
        move_cost_mod: 0,
        required_str: 0,
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Furniture,
      data,
      item: data.byId("furniture", "f_fireplace"),
    });

    expect(getByText("Deconstruction")).toBeTruthy();
    expect(getByText("Tools Required")).toBeTruthy();
    expect(getByText("hammering")).toBeTruthy();
    expect(getByText("chiseling")).toBeTruthy();
    expect(getByText("prying")).toBeTruthy();
    expect(getByText("screw driving")).toBeTruthy();
  });
});
