import * as Sentry from "@sentry/browser";
import { getCurrentVersionSlug, getUrlConfig, parseRoute } from "./routing";

/**
 * Metric attributes type for Sentry metrics.
 */
export type MetricAttributes = Record<string, string | number | boolean>;

/**
 * Get common attributes that should be attached to every metric.
 */
function getCommonAttributes(): MetricAttributes {
  const { locale, tileset } = getUrlConfig();
  const route = parseRoute();

  const attrs: MetricAttributes = {
    version: getCurrentVersionSlug(),
    locale: locale || "en",
    tileset: tileset || "default",
    url_path: location.pathname,
  };

  // Add route context if available
  if (route.item) {
    if (route.item.type) attrs.item_type = route.item.type;
    if (route.item.id) attrs.item_id = route.item.id;
  }
  if (route.search) {
    attrs.search = route.search;
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
    Sentry.metrics.count(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },

  /**
   * Track current values or state (e.g., resource usage, resolved version).
   */
  gauge(name: string, value: number, attributes: MetricAttributes = {}) {
    Sentry.metrics.gauge(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },

  /**
   * Track distributions for statistical analysis (e.g., durations, latency).
   */
  distribution(name: string, value: number, attributes: MetricAttributes = {}) {
    Sentry.metrics.distribution(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },
};
