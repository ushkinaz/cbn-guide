import * as Sentry from "@sentry/browser";
import { isProd, RUNNING_MODE } from "./utils/env";
import type { RouteTarget } from "./routing.svelte";

/**
 * Metric attributes type for Sentry metrics.
 */
export type MetricAttributes = Record<string, string | number | boolean>;

let version: string;
let locale: string;
let tileset: string;
let displayMode: string;
let target: RouteTarget = { kind: "home" };

export function initializeMetrics(
  versionAttr: string,
  localeAttr: string,
  tilesetAttr: string,
) {
  version = versionAttr;
  locale = localeAttr;
  tileset = tilesetAttr;
  displayMode = RUNNING_MODE;
}

export function updateTarget(newTarget: RouteTarget) {
  target = newTarget;
  return newTarget;
}

/**
 * Get common attributes that should be attached to every metric.
 */
function getCommonAttributes(): MetricAttributes {
  const attrs: MetricAttributes = {
    version: version,
    locale: locale,
    tileset: tileset,
    display_mode: displayMode,
  };

  // Add route context if available
  if (target.kind === "catalog" || target.kind === "item") {
    attrs.item_type = target.type;
  }
  if (target.kind === "item") {
    attrs.item_id = target.id;
  }
  if (target.kind === "search") {
    attrs.search = target.query;
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
