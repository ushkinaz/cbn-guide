import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createHistogram } from "perf_hooks";

export interface HistogramStats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export interface MetricResult {
  [metricName: string]: HistogramStats;
}

export interface BenchmarkResult {
  scenario: string;
  timestamp: number;
  date: string;
  "git-sha1": string;
  metrics: MetricResult;
  metadata?: Record<string, any>;
}

export interface AggregatedStats {
  scenario: string;
  updated: string;
  totalRuns: number;
  metrics: MetricResult;
}

export interface RegressionResult {
  metric: string;
  change: number;
  current: number;
  baseline: number;
}

export function getGitSha(): string {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch (e) {
    return "unknown";
  }
}

export function createHistogramStats(values: number[]): HistogramStats {
  const histogram = createHistogram();
  // Histogram requires values >= 1, so we ensure minimum of 1
  // We assume values are in microseconds (μs)
  values.forEach((v) => histogram.record(Math.max(1, Math.round(v))));

  return {
    mean: histogram.mean,
    stddev: histogram.stddev,
    min: histogram.min,
    max: histogram.max,
    p50: histogram.percentile(50),
    p95: histogram.percentile(95),
    p99: histogram.percentile(99),
    count: histogram.count,
  };
}

export function saveResults(
  outputDir: string,
  scenario: string,
  result: BenchmarkResult,
  aggregated: AggregatedStats,
) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Append to JSONL file
  const jsonlPath = path.join(outputDir, `${scenario}.jsonl`);
  fs.appendFileSync(jsonlPath, JSON.stringify(result) + "\n");
  console.log(`✓ Appended result to ${jsonlPath}`);

  // Save/update aggregated stats
  const statsPath = path.join(outputDir, `${scenario}-stats.json`);
  fs.writeFileSync(statsPath, JSON.stringify(aggregated, null, 2));
  console.log(`✓ Updated stats at ${statsPath}`);
}

export function loadBaseline(baselinePath: string): AggregatedStats | null {
  try {
    if (!fs.existsSync(baselinePath)) {
      console.warn(`⚠️  Baseline not found at ${baselinePath}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
  } catch (error) {
    console.error(`Error loading baseline: ${error}`);
    return null;
  }
}

export function detectRegressions(
  current: MetricResult,
  baseline: AggregatedStats,
  threshold: number,
): RegressionResult[] {
  const regressions: RegressionResult[] = [];

  for (const [metricName, currentStats] of Object.entries(current)) {
    const baselineStats = baseline.metrics[metricName];
    if (!baselineStats) continue;

    const change =
      ((currentStats.mean - baselineStats.mean) / baselineStats.mean) * 100;

    if (change > threshold) {
      regressions.push({
        metric: metricName,
        change: Number(change.toFixed(2)),
        current: currentStats.mean,
        baseline: baselineStats.mean,
      });
    }
  }

  return regressions;
}
