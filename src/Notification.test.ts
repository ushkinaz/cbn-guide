/**
 * @jest-environment jsdom
 */
import {
  render,
  fireEvent,
  cleanup,
  waitForElementToBeRemoved,
} from "@testing-library/svelte";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Notification from "./Notification.svelte";
import { notifications, notify, dismiss } from "./Notification.svelte";
import { get } from "svelte/store";
import { tick } from "svelte";
import { vi } from "vitest";

vi.mock("svelte/transition", () => ({
  fly: () => ({ duration: 0 }),
}));

describe("Notification component", () => {
  beforeEach(() => {
    // Clear notifications before each test
    const current = get(notifications);
    (current as any[]).forEach((n) => dismiss(n.id));
  });

  afterEach(() => {
    cleanup();
  });

  describe("Logic", () => {
    it("should add a notification", () => {
      notify("Test message", "info");
      const list = get(notifications) as any[];
      expect(list.length).toBe(1);
      expect(list[0].message).toBe("Test message");
      expect(list[0].type).toBe("info");
      expect(list[0].id).toBeDefined();
    });

    it("should dismiss a notification", () => {
      notify("Test message", "info");
      let list = get(notifications) as any[];
      const id = list[0].id;

      dismiss(id);
      list = get(notifications) as any[];
      expect(list.length).toBe(0);
    });
  });

  describe("UI", () => {
    it("renders notifications from the store", async () => {
      notify("Error message", "error");
      notify("Info message", "info");

      const { getByText } = render(Notification);
      await tick();

      expect(getByText("Error message")).toBeTruthy();
      expect(getByText("Info message")).toBeTruthy();
    });

    it("dismisses a notification when clicking close button", async () => {
      notify("Dismiss me", "info");
      const { getByLabelText, queryByText } = render(Notification);
      await tick();

      expect(queryByText("Dismiss me")).toBeTruthy();

      const closeBtn = getByLabelText("Dismiss notification");
      await fireEvent.click(closeBtn);

      await waitForElementToBeRemoved(() => queryByText("Dismiss me"));

      expect(queryByText("Dismiss me")).toBeNull();
    });
  });
});
