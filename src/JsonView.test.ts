/**
 * @vitest-environment jsdom
 */
import { expect, test, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import JsonView from "./JsonView.svelte";

test("JsonView has accessible toggle button and copy functionality", async () => {
  const obj = { id: "test", type: "item" };
  const writeText = vi.fn();

  // Mock clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText,
    },
  });

  const { getByText, getByRole, queryByText } = render(JsonView, {
    obj,
    buildNumber: "123",
  });

  const button = getByRole("button", { name: /Raw JSON/ });

  // Verify aria-expanded is false initially
  expect(button.getAttribute("aria-expanded")).toBe("false");

  // Copy button should not be visible yet
  expect(queryByText("Copy")).toBeNull();

  // Click to expand
  await fireEvent.click(button);

  // Verify aria-expanded is true
  expect(button.getAttribute("aria-expanded")).toBe("true");

  // Content should be visible
  expect(getByText(/"id": "test"/)).toBeTruthy();

  // Copy button should be visible
  const copyButton = getByText("Copy");
  expect(copyButton).toBeTruthy();

  // Click copy
  await fireEvent.click(copyButton);

  // Verify clipboard write
  expect(writeText).toHaveBeenCalledWith(JSON.stringify(obj, null, 2));

  // Verify feedback
  expect(getByText("Copied!")).toBeTruthy();
});
