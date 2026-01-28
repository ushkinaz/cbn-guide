/**
 * @jest-environment jsdom
 */
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, fireEvent, waitFor } from "@testing-library/svelte";
import JsonView from "./JsonView.svelte";

afterEach(cleanup);

test("JsonView renders and copy button works", async () => {
  const obj = { type: "TEST", id: "test_obj", value: 123, __filename: "test.json" };
  const { container, getByText, getByLabelText } = render(JsonView, { obj, buildNumber: "123" });

  // Check if "Raw JSON" button exists
  expect(getByText("Raw JSON")).toBeDefined();

  // Check if "Copy" button exists
  const copyButton = getByLabelText("Copy JSON to clipboard");
  expect(copyButton).toBeDefined();

  // Mock clipboard API
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockImplementation(() => Promise.resolve()),
    },
  });

  // Click copy button
  await fireEvent.click(copyButton);

  // Check if clipboard was called with correct JSON
  const expectedJson = JSON.stringify(
    obj,
    (key, value) => (key === "__filename" ? undefined : value),
    2
  );
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedJson);

  // Verify "Copied!" text appears
  await waitFor(() => expect(getByText("Copied!")).toBeDefined());
});
