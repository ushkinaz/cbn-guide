/**
 * @vitest-environment happy-dom
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, test, vi } from "vitest";
import ModSelector from "./ModSelector.svelte";
import type { ModInfo } from "./types";

const testMods: ModInfo[] = [
  {
    type: "MOD_INFO",
    id: "no_npc_food",
    name: "No NPC Food",
    description: "Disables NPC food consumption",
    category: "rebalance",
    dependencies: ["bn"],
  },
  {
    type: "MOD_INFO",
    id: "cbm_slots",
    name: "CBM Slots",
    description: "Adds CBM slot rules",
    category: "rebalance",
    dependencies: ["bn"],
  },
  {
    type: "MOD_INFO",
    id: "aftershock",
    name: "Aftershock",
    description: "Adds futuristic content",
    category: "content",
    dependencies: ["bn"],
  },
  {
    type: "MOD_INFO",
    id: "magiclysm",
    name: "Magiclysm",
    description: "Adds spells and magic",
    category: "total_conversion",
    dependencies: ["bn"],
  },
  {
    type: "MOD_INFO",
    id: "arcana",
    name: "Arcana",
    description: "Adds arcane tech",
    category: "content",
    dependencies: ["aftershock"],
  },
];

afterEach(() => {
  cleanup();
});

function isChecked(input: HTMLInputElement): boolean {
  return (
    input.matches(":checked") ||
    input.checked === true ||
    (input as unknown as { checked: number }).checked === -1
  );
}

describe("ModSelector", () => {
  test("checks currently selected mods when opened", () => {
    const { getAllByText, getByLabelText, getByText } = render(ModSelector, {
      open: true,
      mods: testMods,
      selectedModIds: ["aftershock"],
      loading: false,
      errorMessage: null,
    });

    expect(getByText("content")).toBeTruthy();
    expect(getByText("total conversion")).toBeTruthy();
    expect(isChecked(getByLabelText("Aftershock") as HTMLInputElement)).toBe(
      true,
    );
    expect(isChecked(getByLabelText("Magiclysm") as HTMLInputElement)).toBe(
      false,
    );
    expect(getByText("requires: aftershock")).toBeTruthy();
  });

  test("closes on Escape and applies ordered mod ids", async () => {
    const { component, getByLabelText, getByText } = render(ModSelector, {
      open: true,
      mods: testMods,
      selectedModIds: ["aftershock"],
      loading: false,
      errorMessage: null,
    });

    const onClose = vi.fn();
    let applied: string[] | null = null;
    component.$on("close", onClose);
    component.$on("apply", (event) => {
      applied = event.detail;
    });

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.click(getByLabelText("Magiclysm"));
    await fireEvent.click(getByText("Apply and Reload"));
    expect(applied).toEqual(["aftershock", "magiclysm"]);
  });

  test("reset clears all selected mods", async () => {
    const { component, getByLabelText, getByText } = render(ModSelector, {
      open: true,
      mods: testMods,
      selectedModIds: ["aftershock"],
      loading: false,
      errorMessage: null,
    });

    let applied: string[] | null = null;
    component.$on("apply", (event) => {
      applied = event.detail;
    });

    expect(isChecked(getByLabelText("Aftershock") as HTMLInputElement)).toBe(
      true,
    );

    await fireEvent.click(getByText("Reset"));
    await waitFor(() => expect(getByText("selected: 0")).toBeTruthy());
    await waitFor(() =>
      expect(isChecked(getByLabelText("Aftershock") as HTMLInputElement)).toBe(
        false,
      ),
    );

    await fireEvent.click(getByText("Apply and Reload"));
    expect(applied).toEqual([]);
  });

  test("selecting mod auto-selects dependencies", async () => {
    const { component, getByLabelText, getByText } = render(ModSelector, {
      open: true,
      mods: testMods,
      selectedModIds: [],
      loading: false,
      errorMessage: null,
    });

    let applied: string[] | null = null;
    component.$on("apply", (event) => {
      applied = event.detail;
    });

    await fireEvent.click(getByLabelText("Arcana"));
    await waitFor(() =>
      expect(isChecked(getByLabelText("Aftershock") as HTMLInputElement)).toBe(
        true,
      ),
    );
    expect(isChecked(getByLabelText("Arcana") as HTMLInputElement)).toBe(true);
    await waitFor(() => expect(getByText("selected: 2")).toBeTruthy());

    await fireEvent.click(getByText("Apply and Reload"));
    expect(applied).toEqual(["aftershock", "arcana"]);
  });

  test("default selects game default mods that are available", async () => {
    const { component, getByText } = render(ModSelector, {
      open: true,
      mods: testMods,
      selectedModIds: ["aftershock"],
      loading: false,
      errorMessage: null,
    });

    let applied: string[] | null = null;
    component.$on("apply", (event) => {
      applied = event.detail;
    });

    await fireEvent.click(getByText("Default"));
    await waitFor(() => expect(getByText("selected: 2")).toBeTruthy());
    await fireEvent.click(getByText("Apply and Reload"));
    expect(applied).toEqual(["no_npc_food", "cbm_slots"]);
  });

  test("default restores full defaults after manual uncheck", async () => {
    const { component, getByLabelText, getByText } = render(ModSelector, {
      open: true,
      mods: testMods,
      selectedModIds: [],
      loading: false,
      errorMessage: null,
    });

    let applied: string[] | null = null;
    component.$on("apply", (event) => {
      applied = event.detail;
    });

    await fireEvent.click(getByText("Default"));
    await waitFor(() => expect(getByText("selected: 2")).toBeTruthy());

    await fireEvent.click(getByLabelText("No NPC Food"));
    await waitFor(() => expect(getByText("selected: 1")).toBeTruthy());

    await fireEvent.click(getByText("Default"));
    await waitFor(() => expect(getByText("selected: 2")).toBeTruthy());

    await fireEvent.click(getByText("Apply and Reload"));
    expect(applied).toEqual(["no_npc_food", "cbm_slots"]);
  });
});
