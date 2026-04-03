import * as Sentry from "@sentry/browser";
import { navigation } from "./navigation.svelte";
import { isProd, RUNNING_MODE } from "./utils/env";

/**
 * Metric attributes type for Sentry metrics.
 */
export type MetricAttributes = Record<string, string | number | boolean>;

/**
 * Get common attributes that should be attached to every metric.
 */
function getCommonAttributes(): MetricAttributes {
  const attrs: MetricAttributes = {
    version: navigation.buildResolvedVersion,
    locale: navigation.locale,
    tileset: navigation.tileset,
    url_path: navigation.url.pathname,
    display_mode: RUNNING_MODE,
  };

  // Add route context if available
  if (
    navigation.target.kind === "catalog" ||
    navigation.target.kind === "item"
  ) {
    attrs.item_type = navigation.target.type;
  }
  if (navigation.target.kind === "item") {
    attrs.item_id = navigation.target.id;
  }
  if (navigation.target.kind === "search") {
    attrs.search = navigation.target.query;
  }

  return attrs;
}

/**
 * Sentry metrics wrapper to centralize tag management and provide a clean API.
 * Follows Sentry Svelte Metrics documentation:
 * https://docs.sentry.io/platforms/javascript/guides/svelte/metrics/
 */
export const metrics = {
  /**
   * Track discrete events (e.g., button clicks, search occurrences).
   * This sends a delta to Sentry without local accumulation.
   */
  count(name: string, value: number = 1, attributes: MetricAttributes = {}) {
    if (!isProd) return;
    Sentry.metrics.count(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },

  /**
   * Track current values or state (e.g., resource usage, resolved version).
   */
  gauge(name: string, value: number, attributes: MetricAttributes = {}) {
    if (!isProd) return;
    Sentry.metrics.gauge(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },

  /**
   * Track distributions for statistical analysis (e.g., durations, latency).
   */
  distribution(name: string, value: number, attributes: MetricAttributes = {}) {
    if (!isProd) return;
    Sentry.metrics.distribution(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },
};
