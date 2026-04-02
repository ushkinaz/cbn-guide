/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Hoist mock factories so they are available before imports are evaluated.
const { sentryCount, sentryGauge, sentryDistribution } = vi.hoisted(() => ({
  sentryCount: vi.fn(),
  sentryGauge: vi.fn(),
  sentryDistribution: vi.fn(),
}));

vi.mock("@sentry/browser", () => ({
  metrics: {
    count: sentryCount,
    gauge: sentryGauge,
    distribution: sentryDistribution,
  },
  setTag: vi.fn(),
  setContext: vi.fn(),
  captureException: vi.fn(),
}));

// Override isProd to true so we can test attribute enrichment.
vi.mock("./utils/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("./utils/env")>();
  return {
    ...original,
    isProd: true,
    RUNNING_MODE: "browser",
  };
});

import { metrics } from "./metrics";
import { _reset as resetRouting } from "./routing.svelte";
import { _resetVersionState } from "./builds.svelte";
import { _resetPreferences } from "./preferences.svelte";
import { setWindowLocation } from "./routing.test-helpers";

function resetAll() {
  resetRouting();
  _resetVersionState();
  _resetPreferences();
  sentryCount.mockReset();
  sentryGauge.mockReset();
  sentryDistribution.mockReset();
}

describe("metrics", () => {
  beforeEach(() => {
    setWindowLocation("stable/");
    resetAll();
  });

  afterEach(() => {
    resetAll();
    vi.clearAllMocks();
  });

  describe("API surface", () => {
    test("count, gauge, and distribution are callable without throwing", () => {
      expect(() => metrics.count("test.event")).not.toThrow();
      expect(() => metrics.gauge("test.gauge", 42)).not.toThrow();
      expect(() => metrics.distribution("test.dist", 100)).not.toThrow();
    });

    test("count defaults to a value of 1 when no value is passed", () => {
      metrics.count("test.event");
      expect(sentryCount).toHaveBeenCalledOnce();
      const [, value] = sentryCount.mock.calls[0];
      expect(value).toBe(1);
    });

    test("count forwards the provided value", () => {
      metrics.count("test.event", 5);
      expect(sentryCount).toHaveBeenCalledOnce();
      const [, value] = sentryCount.mock.calls[0];
      expect(value).toBe(5);
    });

    test("gauge forwards the metric name and value", () => {
      metrics.gauge("test.gauge", 99);
      expect(sentryGauge).toHaveBeenCalledOnce();
      const [name, value] = sentryGauge.mock.calls[0];
      expect(name).toBe("test.gauge");
      expect(value).toBe(99);
    });

    test("distribution forwards the metric name and value", () => {
      metrics.distribution("test.dist", 250);
      expect(sentryDistribution).toHaveBeenCalledOnce();
      const [name, value] = sentryDistribution.mock.calls[0];
      expect(name).toBe("test.dist");
      expect(value).toBe(250);
    });
  });

  describe("common attributes", () => {
    test("attaches locale, tileset, and display_mode to every count call", () => {
      setWindowLocation("stable/");
      resetRouting();

      metrics.count("test.event");

      expect(sentryCount).toHaveBeenCalledOnce();
      const [, , options] = sentryCount.mock.calls[0];
      expect(options.attributes).toMatchObject({
        locale: "en",
        display_mode: "browser",
      });
    });

    test("merges caller-supplied attributes with common attributes", () => {
      metrics.count("test.event", 1, { custom: "value" });

      const [, , options] = sentryCount.mock.calls[0];
      expect(options.attributes.custom).toBe("value");
      // Common attributes are still present alongside caller attrs.
      expect(options.attributes).toHaveProperty("locale");
      expect(options.attributes).toHaveProperty("display_mode");
    });

    test("caller attributes override common attributes with the same key", () => {
      metrics.count("test.event", 1, { locale: "override" });

      const [, , options] = sentryCount.mock.calls[0];
      expect(options.attributes.locale).toBe("override");
    });

    test("does not include item_type for home route", () => {
      setWindowLocation("stable/");
      resetRouting();

      metrics.count("test.event");

      const [, , options] = sentryCount.mock.calls[0];
      expect(options.attributes).not.toHaveProperty("item_type");
      expect(options.attributes).not.toHaveProperty("item_id");
      expect(options.attributes).not.toHaveProperty("search");
    });

    test("includes item_type and item_id for item routes", () => {
      setWindowLocation("stable/item/rock");
      resetRouting();

      metrics.count("test.event");

      const [, , options] = sentryCount.mock.calls[0];
      expect(options.attributes.item_type).toBe("item");
      expect(options.attributes.item_id).toBe("rock");
    });

    test("includes item_type but not item_id for catalog routes", () => {
      setWindowLocation("stable/monster");
      resetRouting();

      metrics.count("test.event");

      const [, , options] = sentryCount.mock.calls[0];
      expect(options.attributes.item_type).toBe("monster");
      expect(options.attributes).not.toHaveProperty("item_id");
    });

    test("includes search query for search routes", () => {
      setWindowLocation("stable/search/zombie");
      resetRouting();

      metrics.count("test.event");

      const [, , options] = sentryCount.mock.calls[0];
      expect(options.attributes.search).toBe("zombie");
      expect(options.attributes).not.toHaveProperty("item_type");
      expect(options.attributes).not.toHaveProperty("item_id");
    });

    test("includes url_path in every metric call", () => {
      setWindowLocation("stable/item/rock");
      resetRouting();

      metrics.gauge("test.gauge", 1);

      const [, , options] = sentryGauge.mock.calls[0];
      expect(options.attributes.url_path).toBeTruthy();
    });
  });

  describe("gauge and distribution share the same attribute enrichment", () => {
    test("gauge includes common attributes", () => {
      metrics.gauge("test.gauge", 10);

      const [, , options] = sentryGauge.mock.calls[0];
      expect(options.attributes).toHaveProperty("locale");
      expect(options.attributes).toHaveProperty("display_mode");
    });

    test("distribution includes common attributes", () => {
      metrics.distribution("test.dist", 500, { unit: "millisecond" });

      const [, , options] = sentryDistribution.mock.calls[0];
      expect(options.attributes).toHaveProperty("locale");
      expect(options.attributes.unit).toBe("millisecond");
    });
  });
});