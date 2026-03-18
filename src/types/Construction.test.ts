/**
 * @vitest-environment happy-dom
 */
import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import WithData from "../WithData.svelte";
import { CBNData } from "../data";
import Construction from "./Construction.svelte";

describe("Construction", () => {
  it("renders furniture prerequisites and null furniture results", () => {
    const data = new CBNData([
      {
        type: "construction_group",
        id: "advanced_object_deconstruction",
        name: "Advanced Object Deconstruction",
      },
      {
        type: "construction",
        id: "constr_remove_object_fireplace",
        group: "advanced_object_deconstruction",
        category: "OTHER",
        time: "90 m",
        required_skills: [["fabrication", 2]],
        pre_furniture: "f_fireplace",
        post_furniture: "f_null",
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
      Component: Construction,
      data,
      construction: data.byId("construction", "constr_remove_object_fireplace"),
    });

    expect(getByText("Requires")).toBeTruthy();
    expect(getByText("fireplace")).toBeTruthy();
    expect(getByText("Creates")).toBeTruthy();
    expect(getByText("nothing")).toBeTruthy();
  });

  it("renders terrain prerequisites and furniture results without prefix inference", () => {
    const data = new CBNData([
      {
        type: "construction_group",
        id: "build_beaded_door",
        name: "Build Beaded Door",
      },
      {
        type: "construction",
        id: "constr_beaded_door",
        group: "build_beaded_door",
        category: "OTHER",
        time: "30 m",
        required_skills: [["fabrication", 1]],
        pre_terrain: "t_door_frame",
        post_furniture: "f_beaded_door",
      },
      {
        type: "terrain",
        id: "t_door_frame",
        name: "door frame",
        description: "A test door frame.",
      },
      {
        type: "furniture",
        id: "f_beaded_door",
        name: "beaded door",
        description: "A test beaded door.",
        move_cost_mod: 0,
        required_str: 0,
      },
    ]);

    const { getByText } = render(WithData, {
      Component: Construction,
      data,
      construction: data.byId("construction", "constr_beaded_door"),
    });

    expect(getByText("door frame")).toBeTruthy();
    expect(getByText("beaded door")).toBeTruthy();
  });
});
