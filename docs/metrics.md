# Metrics

> **TL;DR:** Metrics cost money, bandwidth, and user frustration. Use them for high-level product decisions, not micro-optimization. When in doubt, don't add a metric.

## Philosophy

Metrics should answer **product questions**, not measure every function call:

- "Do users actually use search?" → ✅ Useful metric
- "How long does Array.sort() take?" → ❌ Use benchmarks/profiling instead

**Every metric has costs:**

- **Money**: We use the free tier, which is limited
- **Bandwidth**: In an SPA, metrics can be sent on every interaction/click
- **User experience**: Network overhead, especially on slow connections
- **Maintenance**: More metrics = more noise in dashboards

## API

```typescript
import { metrics } from "./metrics";

// Counters: accumulate locally, report total to Sentry
metrics.incr("feature.usage"); // +1
metrics.incr("errors", 1, { type: "network" }); // +1 with tag

// Events: one-time occurrences (Sentry aggregates)
metrics.count("version.switch", 1, { from: "stable", to: "nightly" });

// Gauges: current state snapshot
metrics.gauge("data.resolved_version", buildNumber);

// Distributions: statistical analysis (mean, p95, etc.)
metrics.distribution("search.time", durationMs, { unit: "millisecond" });
```

**Auto-included attributes (for Sentry grouping):**

- `version`, `locale`, `tileset`, `url_path` - Always included
- `item_type`, `item_id` - Included when viewing an item
- `search` - Included when on search page

**Important:**

- These tags appear in Sentry for grouping/filtering, but do NOT split counters
- Counter keys use only user-provided attributes
- Each unique **user attribute** combination creates a separate counter

## Good vs Bad Metrics

### ✅ Good: Product improvement signals

```typescript
// Answer: "Do users switch versions?"
metrics.incr("version.switch", 1, { from, to });

// Answer: "What % of searches find nothing?"
if (results.length === 0) {
  metrics.count("search.no_results");
}

// Answer: "Which data version are users on?"
metrics.gauge("data.version", buildNumber);
```

### ❌ Bad: Micro-measurements, noise, obvious metrics

```typescript
// ❌ Performance micro-optimization (use local benchmarks instead)
metrics.distribution("array.sort.time", duration);
metrics.distribution("lodash.debounce.time", duration);

// ❌ High-cardinality attributes (explosion of metric permutations)
metrics.incr("search", 1, { query: text }); // Creates metric per unique query!

// ❌ Obvious/useless data
metrics.incr("page.load"); // We already have analytics for this
metrics.gauge("locale", locale); // Auto-included in all metrics

// ❌ Logging, not metrics
metrics.incr("debug.log"); // Use console.log or Sentry.captureMessage
```

## Common Pitfalls

**1. High-cardinality user attributes**

Counter keys use **only user-provided attributes**. Common attributes (version, locale, tileset) are added to Sentry as tags for grouping, but don't split counters.

```typescript
// ✅ GOOD: Counter accumulates correctly
metrics.incr("search.clicked"); // version=stable → counter = 1
// User switches version
metrics.incr("search.clicked"); // version=nightly → counter = 2

// Sentry receives:
// - Total value: 2
// - Tags: {version: "nightly", locale: "en", tileset: "default"}
// - You can group by version in Sentry if needed

// ❌ BAD: High-cardinality USER attributes
metrics.incr("search", 1, { query: "fire axe" });
metrics.incr("search", 1, { query: "knife" });
// Creates separate counters: "search|query=fire axe" and "search|query=knife"
// Result: Thousands of separate counters, explosion of metric permutations

// ✅ GOOD: Low-cardinality aggregation
metrics.distribution("search.query_length", query.length);
// Single metric, distribution of values
```

**2. Confusing counters with events**

```typescript
// ❌ BAD: Using incr() for one-time events
onClick(() => metrics.incr("button.click"));
// Problem: Counter accumulates forever, unclear what total means

// ✅ GOOD: Use count() for discrete events
onClick(() => metrics.count("button.click"));
```

**3. Measuring what you can derive**

```typescript
// ❌ BAD: Redundant metrics
metrics.incr("search.total");
metrics.incr("search.success");
metrics.incr("search.failure");
// Problem: search.total = success + failure (waste of bandwidth)

// ✅ GOOD: Measure the interesting signal
if (results.length === 0) {
  metrics.count("search.no_results", 1, { query_length: query.length });
}
```

**4. Over-instrumenting performance**

```typescript
// ❌ BAD: Measure everything that moves
const t1 = performance.now();
doSomething();
metrics.distribution("something.time", performance.now() - t1);
// Problem: Metrics are for product questions, not profiling

// ✅ GOOD: Measure user-visible performance only
const t1 = performance.now();
await loadInitialData();
metrics.distribution("app.load_time", performance.now() - t1);
```

## Testing

```typescript
import { metrics } from "./metrics";

beforeEach(() => metrics.resetCounters());

test("tracks feature usage", () => {
  useFeature();
  expect(metrics.getCounter("feature.usage")).toBe(1);
});
```

See `src/metrics.test.ts` for full test suite.

## Current Usage

- `src/routing.ts`: Version switches, routing init time, build number
- `src/search.ts`: Search performance, no-results rate, query length

## When to Add a Metric

Ask yourself:

1. **Does this answer a product question?** ("Which features do users actually use?")
2. **Can I act on this data?** (If not, don't collect it)
3. **Is it worth the cost?** (Money + bandwidth + maintenance)
4. **Can I derive it from existing metrics?** (If yes, don't duplicate)

**If unsure, skip the metric.** It's easier to add metrics later than to remove noisy ones from production.
