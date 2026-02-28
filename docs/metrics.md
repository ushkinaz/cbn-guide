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

## Naming Convention

We use a **Controlled Vocabulary** for metric names to ensure discoverability and consistency.
Treat it as the canonical baseline and extend sparingly when semantics require it.

👉 **See [docs/metrics_naming.md](./metrics_naming.md) for the full naming specification.**

Key format: `<domain>.<subject>.<action>[.unit]`

- `ui.button.click` (not `clicked_button`)
- `search.query.duration_ms` (not `searchTime`)
- `app.version.change` (not `version_switch`)

## API

```typescript
import { metrics } from "./metrics";

// Events: discrete occurrences (Sentry aggregates sum)
metrics.count("app.version.change", 1, { from: "stable", to: "nightly" });

// Gauges: current state snapshot (Sentry averages/max/last)
metrics.gauge("data.version", buildNumber);

// Distributions: statistical analysis (mean, p95, etc.)
metrics.distribution("ui.item.render_duration_ms", durationMs);
```

**Auto-included attributes (for Sentry grouping):**

- `version`, `locale`, `tileset`, `url_path` - Always included
- `item_type`, `item_id` - Included when viewing an item
- `search` - Included when on search page

## Good vs Bad Metrics

### ✅ Good: Product improvement signals

```typescript
// Answer: "Do users switch versions?"
metrics.count("app.version.change", 1, { from, to });

// Answer: "What % of searches find nothing?"
if (results.length === 0) {
  metrics.count("search.query.empty");
}

// Answer: "Which data version are users on?"
metrics.gauge("data.version", buildNumber);
```

### ❌ Bad: Micro-measurements, noise, obvious metrics

```typescript
// ❌ Performance micro-optimization (use local benchmarks instead)
metrics.distribution("ui.item.render_duration_ms", duration);

// ❌ High-cardinality attributes (explosion of metric permutations)
metrics.count("search", 1, { query: text }); // Creates generic metric, but query tag explodes!

// ❌ Obvious/useless data
metrics.count("page.load"); // We already have analytics for this
metrics.gauge("locale", locale); // Auto-included in all metrics

// ❌ Logging, not metrics
metrics.count("debug.log"); // Use console.log or Sentry.captureMessage
```

## Common Pitfalls

**1. High-cardinality user attributes**

```typescript
// ✅ GOOD: Low-cardinality aggregation
metrics.count("search.query.empty", 1);
```

**2. Confusing text counts with numeric metrics**

Metrics must be numbers.

```typescript
// ❌ BAD
metrics.gauge("current_page", "home"); // Error: value must be number

// ✅ GOOD
metrics.count("nav.route.change", 1, { view: "home" });
```

**3. Measuring what you can derive**

```typescript
// ❌ BAD: Redundant metrics
metrics.count("search.total");
metrics.count("search.success");
metrics.count("search.failure");
// Problem: three calls per search

// ✅ GOOD: Measure the result
const result = performSearch();
metrics.count("search.result", 1, { success: result.ok });
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
metrics.distribution("app.init.duration_ms", performance.now() - t1);
```

## Developer Opt-Out

To avoid skewing metrics during development: `localStorage.setItem('cbn-guide:metrics-disabled', 'true'); location.reload();`

## Testing

```typescript
import { beforeEach, expect, it, vi } from "vitest";
import { metrics } from "./metrics";
import * as Sentry from "@sentry/browser";

vi.mock("@sentry/browser", () => ({
  metrics: {
    count: vi.fn(),
    gauge: vi.fn(),
    distribution: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it("tracks feature usage", () => {
  metrics.count("feature.calculator.use", 1);
  expect(Sentry.metrics.count).toHaveBeenCalledWith(
    "feature.calculator.use",
    1,
    expect.any(Object),
  );
});
```

See `src/metrics.test.ts` for full test suite.

## Current Usage

- `src/routing.ts`: Version switches, routing init time, build number
- `src/search.ts`: Search no-results rate

## When to Add a Metric

Ask yourself:

1. **Does this answer a product question?** ("Which features do users actually use?")
2. **Can I act on this data?** (If not, don't collect it)
3. **Is it worth the cost?** (Money + bandwidth + maintenance)
4. **Can I derive it from existing metrics?** (If yes, don't duplicate)

**If unsure, skip the metric.** It's easier to add metrics later than to remove noisy ones from production.
