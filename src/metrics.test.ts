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
    metrics.resetCounters();
  });

  describe("incr()", () => {
    it("should increment counter from 0 to 1", () => {
      metrics.incr("test.counter");
      expect(metrics.getCounter("test.counter")).toBe(1);
    });

    it("should accumulate multiple increments", () => {
      metrics.incr("test.counter");
      metrics.incr("test.counter");
      metrics.incr("test.counter");
      expect(metrics.getCounter("test.counter")).toBe(3);
    });

    it("should increment by custom delta", () => {
      metrics.incr("test.counter", 5);
      metrics.incr("test.counter", 3);
      expect(metrics.getCounter("test.counter")).toBe(8);
    });

    it("should handle negative deltas", () => {
      metrics.incr("test.counter", 10);
      metrics.incr("test.counter", -3);
      expect(metrics.getCounter("test.counter")).toBe(7);
    });

    it("should report accumulated value to Sentry as gauge", () => {
      metrics.incr("test.counter");
      metrics.incr("test.counter");

      expect(Sentry.metrics.gauge).toHaveBeenCalledTimes(2);
      expect(Sentry.metrics.gauge).toHaveBeenLastCalledWith(
        "test.counter",
        2,
        expect.objectContaining({
          attributes: expect.objectContaining({
            version: "stable",
            locale: "en",
            tileset: "default",
          }),
        }),
      );
    });

    it("should maintain separate counters for different names", () => {
      metrics.incr("counter.a");
      metrics.incr("counter.b");
      metrics.incr("counter.a");

      expect(metrics.getCounter("counter.a")).toBe(2);
      expect(metrics.getCounter("counter.b")).toBe(1);
    });

    it("should maintain separate counters for different attributes", () => {
      metrics.incr("test.counter", 1, { type: "foo" });
      metrics.incr("test.counter", 1, { type: "bar" });
      metrics.incr("test.counter", 1, { type: "foo" });

      expect(metrics.getCounter("test.counter", { type: "foo" })).toBe(2);
      expect(metrics.getCounter("test.counter", { type: "bar" })).toBe(1);
    });

    it("should generate stable keys regardless of attribute order", () => {
      metrics.incr("test.counter", 1, { a: "1", b: "2" });
      metrics.incr("test.counter", 1, { b: "2", a: "1" });

      expect(metrics.getCounter("test.counter", { a: "1", b: "2" })).toBe(2);
      expect(metrics.getCounter("test.counter", { b: "2", a: "1" })).toBe(2);
    });

    it("should NOT create separate counters for different common attributes", async () => {
      // This is the critical test: counters should accumulate regardless of
      // version/locale/tileset changes. Only user-provided attributes matter.

      // Simulate: user increments counter, then switches version
      metrics.incr("feature.used");

      // Simulate version change by mocking getCurrentVersionSlug
      const mockRouting = await import("./routing");
      vi.spyOn(mockRouting, "getCurrentVersionSlug").mockReturnValue("nightly");

      metrics.incr("feature.used");

      // Should be 2, not 1 (version change shouldn't split the counter)
      expect(metrics.getCounter("feature.used")).toBe(2);
    });
  });

  describe("getCounter()", () => {
    it("should return 0 for non-existent counter", () => {
      expect(metrics.getCounter("nonexistent")).toBe(0);
    });

    it("should return current value after increments", () => {
      metrics.incr("test.counter", 5);
      expect(metrics.getCounter("test.counter")).toBe(5);
      metrics.incr("test.counter", 3);
      expect(metrics.getCounter("test.counter")).toBe(8);
    });
  });

  describe("resetCounters()", () => {
    it("should reset specific counter", () => {
      metrics.incr("counter.a", 5);
      metrics.incr("counter.b", 3);

      metrics.resetCounters("counter.a");

      expect(metrics.getCounter("counter.a")).toBe(0);
      expect(metrics.getCounter("counter.b")).toBe(3);
    });

    it("should reset specific counter with attributes", () => {
      metrics.incr("test.counter", 1, { type: "foo" });
      metrics.incr("test.counter", 1, { type: "bar" });

      metrics.resetCounters("test.counter", { type: "foo" });

      expect(metrics.getCounter("test.counter", { type: "foo" })).toBe(0);
      expect(metrics.getCounter("test.counter", { type: "bar" })).toBe(1);
    });

    it("should reset all counters when called without arguments", () => {
      metrics.incr("counter.a", 5);
      metrics.incr("counter.b", 3);

      metrics.resetCounters();

      expect(metrics.getCounter("counter.a")).toBe(0);
      expect(metrics.getCounter("counter.b")).toBe(0);
    });
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
