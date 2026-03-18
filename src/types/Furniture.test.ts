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
});
