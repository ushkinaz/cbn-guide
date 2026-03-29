import * as Sentry from "@sentry/browser";
import { getRoute } from "./routing";
import { isProd, RUNNING_MODE } from "./utils/env";

/**
 * Metric attributes type for Sentry metrics.
 */
export type MetricAttributes = Record<string, string | number | boolean>;

/**
 * Get common attributes that should be attached to every metric.
 */
function getCommonAttributes(): MetricAttributes {
  const route = getRoute();

  const attrs: MetricAttributes = {
    version: route.version,
    locale: route.locale || "en",
    tileset: route.tileset || "default",
    url_path: location.pathname,
    display_mode: RUNNING_MODE,
  };

  // Add route context if available
  if (route.target.kind === "catalog" || route.target.kind === "item") {
    attrs.item_type = route.target.type;
  }
  if (route.target.kind === "item") {
    attrs.item_id = route.target.id;
  }
  if (route.target.kind === "search") {
    attrs.search = route.target.query;
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
