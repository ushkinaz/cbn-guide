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
 * Counter storage: Map<counterKey, accumulated_value>
 *
 * Key format: "name|attr1=val1|attr2=val2" (sorted by attribute name)
 *
 * IMPORTANT: Counter keys use ONLY user-provided attributes, NOT common attributes.
 * This ensures counters accumulate correctly regardless of version/locale/route changes.
 * Common attributes (version, locale, tileset, url_path, etc.) are added when sending to Sentry as tags.
 */
const counters = new Map<string, number>();

/**
 * Generate a stable key for counter storage from name + user-provided attributes.
 * Common attributes (version, locale, tileset) are deliberately excluded.
 *
 * @param name - Counter name
 * @param userAttributes - Only the attributes explicitly passed by the user
 */
function getCounterKey(name: string, userAttributes: MetricAttributes): string {
  const sortedAttrs = Object.entries(userAttributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  return sortedAttrs ? `${name}|${sortedAttrs}` : name;
}

/**
 * Sentry metrics wrapper to centralize tag management and provide a clean API.
 * Follows Sentry Svelte Metrics documentation:
 * https://docs.sentry.io/platforms/javascript/guides/svelte/metrics/
 */
export const metrics = {
  /**
   * Increment a counter by delta (default: 1).
   * Counters accumulate locally and report the total to Sentry as a gauge.
   * Use this for true incremental counting (e.g., "total searches performed").
   *
   * @param name - Counter name
   * @param delta - Amount to increment by (default: 1)
   * @param attributes - Additional attributes/tags
   */
  incr(name: string, delta: number = 1, attributes: MetricAttributes = {}) {
    // Counter key uses ONLY user attributes (not common attributes)
    const key = getCounterKey(name, attributes);

    const current = counters.get(key) ?? 0;
    const newValue = current + delta;
    counters.set(key, newValue);

    // When sending to Sentry, merge user attributes with common attributes
    const allAttrs = { ...getCommonAttributes(), ...attributes };

    // Report accumulated value to Sentry as a gauge
    // (Sentry.metrics.count doesn't provide true incremental semantics)
    Sentry.metrics.gauge(name, newValue, {
      attributes: allAttrs,
    });
  },

  /**
   * Track discrete events (e.g., button clicks, search occurrences).
   * This sends a delta to Sentry without local accumulation.
   * Use incr() if you need true counter semantics.
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

  /**
   * Get current counter value for a given name + attributes.
   * Useful for testing and debugging.
   * Note: Only user-provided attributes are used in the key lookup.
   */
  getCounter(name: string, attributes: MetricAttributes = {}): number {
    const key = getCounterKey(name, attributes);
    return counters.get(key) ?? 0;
  },

  /**
   * Reset a specific counter or all counters.
   * Useful for testing.
   * Note: Only user-provided attributes are used in the key lookup.
   */
  resetCounters(name?: string, attributes?: MetricAttributes) {
    if (name !== undefined) {
      const key = getCounterKey(name, attributes ?? {});
      counters.delete(key);
    } else {
      counters.clear();
    }
  },
};
