import * as Sentry from "@sentry/browser";
import { getCurrentVersionSlug, getUrlConfig } from "./routing";

/**
 * Metric attributes type for Sentry metrics.
 */
export type MetricAttributes = Record<string, string | number | boolean>;

/**
 * Get common attributes that should be attached to every metric.
 */
function getCommonAttributes(): MetricAttributes {
  const { locale, tileset } = getUrlConfig();
  return {
    version: getCurrentVersionSlug(),
    locale: locale || "en",
    tileset: tileset || "default",
    url_path: location.pathname,
  };
}

/**
 * Sentry metrics wrapper to centralize tag management and provide a clean API.
 * Follows Sentry Svelte Metrics documentation:
 * https://docs.sentry.io/platforms/javascript/guides/svelte/metrics/
 */
export const metrics = {
  /**
   * Track discrete events (e.g., button clicks, search occurrences).
   */
  count(name: string, value: number = 1, attributes: MetricAttributes = {}) {
    console.log(`[count] ${name}: ${value}`, attributes);
    Sentry.metrics.count(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },

  /**
   * Track current values or state (e.g., resource usage, resolved version).
   */
  gauge(name: string, value: number, attributes: MetricAttributes = {}) {
    console.log(`[gauge] ${name}: ${value}`, attributes);
    Sentry.metrics.gauge(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },

  /**
   * Track distributions for statistical analysis (e.g., durations, latency).
   */
  distribution(name: string, value: number, attributes: MetricAttributes = {}) {
    console.log(`[distribution] ${name}: ${value}`, attributes);
    Sentry.metrics.distribution(name, value, {
      attributes: { ...getCommonAttributes(), ...attributes },
    });
  },
};
