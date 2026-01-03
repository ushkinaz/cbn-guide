import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import {
  getGitSha,
  createHistogramStats,
  saveResults,
  loadBaseline,
  detectRegressions,
  type MetricResult,
  type BenchmarkResult,
  type AggregatedStats,
} from "./bench-utils.js";

interface PerformanceEntry {
  name: string;
  count: number;
  total_time_ms: string | number;
  avg_time_ms: string | number;
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: tsx scripts/bench-browser.ts --url <url> [options]

Required:
  --url <url>           URL to profile (e.g., http://localhost:3000/stable/item/fire_axe)

Optional:
  --output <dir>        Output directory (default: bench-results/)
  --runs <n>            Number of measurements to capture (default: 10)
  --baseline <path>     Compare against baseline stats file
  --threshold <n>       Regression threshold percentage (default: 10)
  --no-throttle         Disable CPU/network throttling for faster local testing
  --help, -h            Show this help message

Output:
  <output>/browser-<slug>.jsonl       Append-only history (one result per line)
  <output>/browser-<slug>-stats.json  Aggregated statistics (overwritten)

Examples:
  yarn bench:browser --url http://localhost:3000/v0.9.1/item/pretzels
  yarn bench:browser --url http://localhost:3000/stable/item/fire_axe --runs 20
`);
    process.exit(0);
  }

  const urlArg = args.indexOf("--url");
  const outputArg = args.indexOf("--output");
  const runsArg = args.indexOf("--runs");
  const baselineArg = args.indexOf("--baseline");
  const thresholdArg = args.indexOf("--threshold");

  if (urlArg === -1) {
    console.error(
      "Error: --url is required. Use --help for usage information.",
    );
    process.exit(1);
  }

  const url = args[urlArg + 1];

  return {
    url,
    outputDir:
      outputArg !== -1
        ? path.resolve(args[outputArg + 1])
        : path.resolve("bench-results"),
    runs: runsArg !== -1 ? parseInt(args[runsArg + 1], 10) : 10,
    baseline: baselineArg !== -1 ? path.resolve(args[baselineArg + 1]) : null,
    threshold: thresholdArg !== -1 ? parseFloat(args[thresholdArg + 1]) : 10,
    noThrottle: args.includes("--no-throttle"),
  };
}

function generateSlugFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // Take the last two segments (e.g., ['item', 'pretzels'])
    const relevantParts = pathParts.slice(-2);

    if (relevantParts.length === 0) {
      return "index";
    }

    return relevantParts.join("-");
  } catch (error) {
    console.error("Invalid URL:", url);
    process.exit(1);
  }
}

async function captureSingleMeasurement(
  url: string,
  runNumber: number,
  noThrottle: boolean = false,
): Promise<PerformanceEntry[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    if (!noThrottle) {
      const client = await page.createCDPSession();
      await client.send("Emulation.setCPUThrottlingRate", { rate: 3 });
    }

    console.log(`  [${runNumber}] Navigating to ${url}...`);

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    console.log(`  [${runNumber}] Waiting for page content to load...`);

    await page.waitForFunction(
      () => {
        const text = document.body.innerText || "";
        const isLoaded =
          !text.includes("Loading") &&
          (text.toLowerCase().includes("general") ||
            text.toLowerCase().includes("raw json"));
        const hasMarks = performance.getEntriesByType("measure").length > 0;
        return isLoaded && hasMarks;
      },
      { timeout: 120000 },
    );

    console.log(`  [${runNumber}] Page loaded, collecting metrics...`);

    const performanceData = await page.evaluate(() => {
      const measures = performance.getEntriesByType("measure");
      return [...new Set(measures.map((m) => m.name))]
        .map((name) => {
          const entries = measures.filter((m) => m.name === name);
          const totalTime = entries.reduce((a, b) => a + b.duration, 0);
          return {
            name: name,
            count: entries.length,
            total_time_ms: totalTime,
            avg_time_ms: totalTime / entries.length,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    });

    console.log(
      `  [${runNumber}] ✓ Captured ${performanceData.length} metrics`,
    );

    return performanceData;
  } finally {
    await browser.close();
  }
}

async function main() {
  const {
    url,
    outputDir,
    runs,
    baseline: baselinePath,
    threshold,
    noThrottle,
  } = parseArgs();
  const slug = generateSlugFromUrl(url);
  const scenario = `browser-${slug}`;

  console.log(`\nBrowser Performance Benchmark Configuration:`);
  console.log(`  URL: ${url}`);
  console.log(`  Scenario: ${scenario}`);
  console.log(`  Output: ${outputDir}/${scenario}`);
  console.log(`  Runs: ${runs}`);
  if (baselinePath) {
    console.log(`  Baseline: ${baselinePath}`);
    console.log(`  Threshold: ${threshold}%`);
  }
  if (noThrottle) {
    console.log(`  Throttling: DISABLED`);
  } else {
    console.log(`  CPU Throttling: 3x (Mid Tier Mobile)`);
  }
  console.log();

  const gitSha = getGitSha();
  const allMetrics = new Map<string, number[]>();

  for (let i = 1; i <= runs; i++) {
    console.log(`Run ${i}/${runs}:`);
    try {
      const performanceData = await captureSingleMeasurement(
        url,
        i,
        noThrottle,
      );

      performanceData.forEach((p) => {
        if (!allMetrics.has(p.name)) {
          allMetrics.set(p.name, []);
        }
        // Store as microseconds (μs)
        const durationUs =
          typeof p.avg_time_ms === "string"
            ? parseFloat(p.avg_time_ms) * 1000
            : p.avg_time_ms * 1000;
        allMetrics.get(p.name)!.push(durationUs);
      });
      console.log();
    } catch (error) {
      console.error(`  [${i}] ✗ Failed:`, error);
      console.log();
    }
  }

  if (allMetrics.size === 0) {
    console.error("Error: No measurements were successfully captured.");
    process.exit(1);
  }

  console.log(`Successfully captured ${runs} runs.\n`);

  // Create histogram statistics for each metric
  const metrics: MetricResult = {};
  for (const [name, values] of allMetrics.entries()) {
    metrics[name] = createHistogramStats(values);
  }

  // Create benchmark result
  const result: BenchmarkResult = {
    scenario,
    timestamp: Date.now(),
    date: new Date().toISOString().split("T")[0],
    "git-sha1": gitSha,
    metrics,
    metadata: {
      url,
      throttling: noThrottle ? "None" : "3x CPU",
    },
  };

  const aggregated: AggregatedStats = {
    scenario,
    updated: new Date().toISOString(),
    totalRuns: runs,
    metrics,
  };

  saveResults(outputDir, scenario, result, aggregated);

  console.log(`\nPerformance Statistics (in microseconds):`);
  const tableData = Object.entries(metrics)
    .sort((a, b) => b[1].mean - a[1].mean)
    .slice(0, 10)
    .map(([name, stats]) => ({
      Metric: name.length > 40 ? name.substring(0, 37) + "..." : name,
      "Mean (ms)": stats.mean.toFixed(2),
      "Stddev (ms)": stats.stddev.toFixed(2),
      "P95 (ms)": stats.p95.toFixed(2),
      "P99 (ms)": stats.p99.toFixed(2),
      Samples: stats.count,
    }));
  console.table(tableData);

  // Baseline comparison
  if (baselinePath) {
    const baseline = loadBaseline(baselinePath);
    if (baseline) {
      const regressions = detectRegressions(metrics, baseline, threshold);

      if (regressions.length > 0) {
        console.error(`\n❌ Performance regressions detected:\n`);
        regressions.forEach((r) => {
          console.error(
            `  ${r.metric}: ${r.change.toFixed(1)}% slower (${r.current.toFixed(2)}μs vs ${r.baseline.toFixed(2)}μs)`,
          );
        });
        process.exit(1);
      } else {
        console.log(`\n✅ No regressions detected (threshold: ${threshold}%)`);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
