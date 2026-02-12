/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, test, vi } from "vitest";
import ModSelector from "./ModSelector.svelte";
import type { ModInfo } from "./types";

const testMods: ModInfo[] = [
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
];

afterEach(() => {
  cleanup();
});

describe("ModSelector", () => {
  test("checks currently selected mods when opened", () => {
    const { getByLabelText, getByText } = render(ModSelector, {
      open: true,
      mods: testMods,
      selectedModIds: ["aftershock"],
      loading: false,
      errorMessage: null,
    });

    expect(getByText("content")).toBeTruthy();
    expect(getByText("total conversion")).toBeTruthy();
    expect((getByLabelText("Aftershock") as HTMLInputElement).checked).toBe(
      true,
    );
    expect((getByLabelText("Magiclysm") as HTMLInputElement).checked).toBe(
      false,
    );
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

    expect((getByLabelText("Aftershock") as HTMLInputElement).checked).toBe(
      true,
    );

    await fireEvent.click(getByText("Reset"));
    await waitFor(() => expect(getByText("Selected: 0")).toBeTruthy());
    await waitFor(() =>
      expect((getByLabelText("Aftershock") as HTMLInputElement).checked).toBe(
        false,
      ),
    );

    await fireEvent.click(getByText("Apply and Reload"));
    expect(applied).toEqual([]);
  });
});
