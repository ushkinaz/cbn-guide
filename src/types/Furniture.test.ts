/**
 * @vitest-environment happy-dom
 */
import { render, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import WithData from "../WithData.svelte";
import { makeTestCBNData } from "../data.test-helpers";
import Furniture from "./Furniture.svelte";

describe("Furniture", () => {
  it("shows pry details from the real furniture pry data", () => {
    const data = makeTestCBNData([
      {
        type: "tool_quality",
        id: "PRY",
        name: "prying",
      },
      {
        type: "furniture",
        id: "f_coffin_c",
        name: "closed coffin",
        description: "A sealed test coffin.",
        move_cost_mod: 0,
        required_str: 0,
        pry: {
          pry_quality: 1,
          noise: 12,
          difficulty: 7,
          new_furn_type: "f_coffin_o",
        },
      },
      {
        type: "furniture",
        id: "f_coffin_o",
        name: "open coffin",
        description: "The lid has yielded.",
        move_cost_mod: 0,
        required_str: 0,
      },
    ]);

    const { getByText, queryByText } = render(WithData, {
      Component: Furniture,
      data,
      item: data.byId("furniture", "f_coffin_c"),
    });

    const requiresDefinition = getByText("Requires").nextElementSibling;
    const difficultyDefinition = getByText("Difficulty").nextElementSibling;
    const becomesDefinition = getByText("Becomes").nextElementSibling;

    expect(requiresDefinition).toBeTruthy();
    expect(
      within(requiresDefinition as HTMLElement).getByText("prying"),
    ).toBeTruthy();
    expect(difficultyDefinition).toBeTruthy();
    expect(
      within(difficultyDefinition as HTMLElement).getByText("7"),
    ).toBeTruthy();
    expect(becomesDefinition).toBeTruthy();
    expect(
      within(becomesDefinition as HTMLElement).getByText("open coffin"),
    ).toBeTruthy();
    expect(queryByText("Duration")).toBeNull();
  });

  it("shows furniture constructions from post_furniture", () => {
    const data = makeTestCBNData([
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
    const data = makeTestCBNData([
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

    const hiddenRequires = render(WithData, {
      Component: Furniture,
      data,
      item: data.byId("furniture", "f_fireplace"),
    });

    const hiddenQueries = within(hiddenRequires.container);

    expect(hiddenQueries.queryByText("Requires")).toBeNull();
  });
});
