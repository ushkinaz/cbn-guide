import { describe, it, expect, beforeEach, vi } from "vitest";
import { metrics } from "./metrics";
import * as Sentry from "@sentry/browser";

// Mock global location
Object.defineProperty(global, "location", {
  value: {
    pathname: "/test",
  },
  writable: true,
});

// Mock Sentry
vi.mock("@sentry/browser", () => ({
  metrics: {
    gauge: vi.fn(),
    count: vi.fn(),
    distribution: vi.fn(),
  },
}));

// Mock routing module
vi.mock("./routing", () => ({
  getCurrentVersionSlug: () => "stable",
  getUrlConfig: () => ({ locale: "en", tileset: "default" }),
  parseRoute: () => ({ version: "stable", item: null, search: "" }),
}));

describe("metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("count()", () => {
    it("should send delta to Sentry without accumulation", () => {
      metrics.count("test.event", 1);
      metrics.count("test.event", 1);

      expect(Sentry.metrics.count).toHaveBeenCalledTimes(2);
      expect(Sentry.metrics.count).toHaveBeenCalledWith(
        "test.event",
        1,
        expect.any(Object),
      );
    });
  });

  describe("gauge()", () => {
    it("should send absolute value to Sentry", () => {
      metrics.gauge("test.gauge", 42);

      expect(Sentry.metrics.gauge).toHaveBeenCalledWith(
        "test.gauge",
        42,
        expect.any(Object),
      );
    });
  });

  describe("distribution()", () => {
    it("should send value to Sentry", () => {
      metrics.distribution("test.histogram", 123.45);

      expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
        "test.histogram",
        123.45,
        expect.any(Object),
      );
    });
  });
});
