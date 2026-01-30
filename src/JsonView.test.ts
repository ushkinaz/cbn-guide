/**
 * @vitest-environment jsdom
 */
import { render, fireEvent, screen } from "@testing-library/svelte";
import { expect, test } from "vitest";
import JsonView from "./JsonView.svelte";

test("JsonView renders and toggles correctly", async () => {
  const obj = {
    id: "test_id",
    type: "test_type",
    some_prop: "value",
    __filename: "data/test.json",
  };
  const buildNumber = "12345";

  const { container } = render(JsonView, { obj, buildNumber });

  const button = screen.getByRole("button", { name: /raw json/i });
  expect(button).toBeTruthy();

  // Check initial state
  expect(button.getAttribute("aria-expanded")).toBe("false");

  // Check aria-controls has a dynamic ID
  const ariaControls = button.getAttribute("aria-controls");
  expect(ariaControls).toMatch(/^json-content-test_type-test_id-[a-z0-9]+$/);

  // Icon should be hidden
  const icon = container.querySelector(".icon");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");

  // Content should not be visible initially
  expect(screen.queryByText(/"some_prop": "value"/)).toBeNull();

  // Click to toggle
  await fireEvent.click(button);

  // Check expanded state
  expect(button.getAttribute("aria-expanded")).toBe("true");

  // Content should be visible
  // The content might be inside a pre tag, so we check for partial text
  const content = await screen.findByText(/"some_prop": "value"/);
  expect(content).toBeTruthy();

  // Content container should have the matching ID
  const contentDiv = container.querySelector(`[id="${ariaControls}"]`);
  expect(contentDiv).toBeTruthy();
});
