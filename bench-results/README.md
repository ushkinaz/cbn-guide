# Performance Benchmarks

This directory contains performance benchmark results for Node.js and browser environments.

## File Structure

```
bench-results/
├── README.md                           # This file
├── browser-urls.txt                    # URLs for batch browser benchmarks (gitignored)
├── node-<scenario>.jsonl               # Node.js historical data (commit to git)
├── node-<scenario>-stats.json          # Node.js aggregated stats (commit to git)
├── browser-<url-slug>.jsonl            # Browser historical data (commit to git)
├── browser-<url-slug>-stats.json       # Browser aggregated stats (commit to git)
└── report.html                         # Interactive charts (generated, gitignored)
```

## Files

### `node-<scenario>.jsonl` - Node.js Historical Data

**Format:** JSON Lines (one result per line)  
**Purpose:** Track Node.js benchmark performance over time  
**Git:** ✅ Commit this

Measures pure Node.js performance of `src/data.ts` operations.

### `browser-<url-slug>.jsonl` - Browser Historical Data

**Format:** JSON Lines (one result per line)  
**Purpose:** Track end-to-end browser performance over time  
**Git:** ✅ Commit this

Measures full page load and rendering in real browser with Puppeteer.

### `*-stats.json` - Aggregated Stats

**Format:** JSON  
**Purpose:** Latest baseline for regression detection  
**Git:** ✅ Commit this

Official baselines that get compared against in CI/CD.

### `report.html` - Visual Report

**Format:** HTML with Chart.js  
**Purpose:** Interactive charts showing trends  
**Git:** ❌ Gitignored (regenerate with `pnpm bench:report`)

## Usage

### Node.js Benchmarks (Fast, Isolated)

```bash
# Quick check (10 runs)
pnpm bench:node --scenario constructor

# High precision (50 runs)
pnpm bench:node --scenario constructor --runs 50

# All scenarios
pnpm bench:node --scenario constructor --runs 20
pnpm bench:node --scenario lazy-indexes --runs 20
pnpm bench:node --scenario item-lookup --runs 20
```

### Browser Benchmarks (Realistic, End-to-End)

```bash
# Single URL
pnpm bench:browser --url http://localhost:3000/stable/item/pretzels

# Custom runs and output
pnpm bench:browser --url http://localhost:3000/stable/item/pretzels --runs 10

# No CPU throttling (faster local testing)
pnpm bench:browser --url http://localhost:3000/stable/item/pretzels --no-throttle

# Batch mode: benchmark multiple URLs
# Edit bench-results/browser-urls.txt, then run:
pnpm bench:browser:batch

# Batch with options
pnpm bench:browser:batch --runs 10 --no-throttle
```

**Batch Mode URLs File** (`bench-results/browser-urls.txt`):

```txt
# One URL per line, # for comments
http://localhost:3000/stable/item/pretzels
http://localhost:3000/stable/item/katana
http://localhost:3000/stable/recipe/soup_dumplings
```

### Compare Against Baseline

```bash
# Node: Fail if performance regresses > 10%
pnpm bench:node --scenario constructor \
  --baseline bench-results/node-constructor-stats.json \
  --threshold 10

# Browser: Compare against baseline
pnpm bench:browser --url http://localhost:3000/stable/item/pretzels \
  --baseline bench-results/browser-item-pretzels-stats.json \
  --threshold 10
```

**Exit code 1 if regression detected** (fails CI/CD).

### Visualize Trends

```bash
pnpm bench:report
# Opens bench-results/report.html
```

## Scenarios

### Node.js Scenarios

| Scenario       | Measures                      | Typical Mean              |
| -------------- | ----------------------------- | ------------------------- |
| `constructor`  | Full CBNData initialization   | ~13ms                     |
| `lazy-indexes` | First-call lazy index builds  | ~72ms (getItemComponents) |
| `item-lookup`  | byId/byType lookup operations | ~2μs                      |

### Browser Scenarios

- Page-specific URLs (e.g., `/stable/item/pretzels`)
- Measures full stack: data loading, rendering, user timing marks
- Includes real browser overhead and network

## Metrics

All measurements in **microseconds (μs)**:

- **mean**: Average value
- **stddev**: Standard deviation (consistency)
- **min/max**: Range
- **p50**: Median (50th percentile)
- **p95**: 95th percentile (outlier threshold)
- **p99**: 99th percentile (worst-case)

## Workflow

### Development

```bash
# Node: Quick regression check
pnpm bench:node --scenario constructor \
  --baseline bench-results/node-constructor-stats.json \
  --threshold 5

# Browser: Full stack regression check
pnpm bench:browser --url http://localhost:3000/stable/item/pretzels \
  --baseline bench-results/browser-item-pretzels-stats.json \
  --threshold 10
```

### Release

```bash
# Update official baselines
pnpm bench:node --scenario constructor --runs 50
pnpm bench:browser --url http://localhost:3000/stable/item/pretzels --runs 20

git add bench-results/*-stats.json bench-results/*.jsonl
git commit -m "chore: update performance baselines for v2.0"
```

### CI/CD

```yaml
- name: Node.js performance regression test
  run: |
    pnpm bench:node --scenario constructor \
      --baseline bench-results/node-constructor-stats.json \
      --threshold 10

- name: Browser performance regression test
  run: |
    pnpm dev &  # Start dev server
    sleep 5
    pnpm bench:browser --url http://localhost:3000/stable/item/pretzels \
      --baseline bench-results/browser-item-pretzels-stats.json \
      --threshold 15
```

## Querying Historical Data

Use `jq` to analyze `.jsonl` files:

```bash
# Node: Get all mean values for a metric
jq -r '.metrics."CBNData.constructor".mean' bench-results/node-constructor.jsonl

# Browser: Track page load times
jq -r '.metrics."Page Load".mean' bench-results/browser-item-pretzels.jsonl

# Filter by date range
jq 'select(.date >= "2026-01-01")' bench-results/node-constructor.jsonl

# Find regressions (mean > threshold)
jq 'select(.metrics."CBNData.constructor".mean > 15000)' bench-results/node-constructor.jsonl
```

## See Also

- [scripts/bench-node.ts](file://../scripts/bench-node.ts) - Node.js benchmark runner
- [scripts/bench-browser.ts](file://../scripts/bench-browser.ts) - Browser benchmark runner
- [scripts/bench-report.ts](file://../scripts/bench-report.ts) - HTML report generator
- [scripts/bench-utils.ts](file://../scripts/bench-utils.ts) - Shared utilities
