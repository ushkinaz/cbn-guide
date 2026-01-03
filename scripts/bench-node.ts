import fs from "fs";
import path from "path";
import { performance } from "perf_hooks";
import { CBNData } from "../src/data.js";
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

// ============================================================================
// Scenario registry
// ============================================================================

type ScenarioFunction = (cbnData: CBNData) => void | Promise<void>;
const scenarioRegistry = new Map<string, ScenarioFunction>();

/**
 * Register a benchmark scenario
 * @param name - Scenario identifier
 * @param fn - Benchmark function that receives a CBNData instance
 */
function registerScenario(name: string, fn: ScenarioFunction) {
  scenarioRegistry.set(name, fn);
}

// ============================================================================
// Scenario definitions
// ============================================================================

registerScenario("constructor", () => {
  const data = loadTestData();
  new CBNData(data);
});

registerScenario("lazy-indexes", (cbnData) => {
  // Trigger lazy index builds (first call only)
  cbnData.replacementTools("voltmeter_bionic");
  cbnData.getItemComponents();
  cbnData.getConstructionComponents();
});

registerScenario("item-lookup", (cbnData) => {
  // Perform various lookups using actual items from test data
  cbnData.byId("item", "architect_cube");
  cbnData.byId("item", "chaos_dagger");
  cbnData.byId("item", "22_lr");
  cbnData.byId("furniture", "f_gridautoclave");
  cbnData.byId("terrain", "t_tree_blackjack");
  cbnData.byId("vehicle_part", "box");
});

registerScenario("type", (cbnData) => {
  // Perform various lookups using actual items from test data
  cbnData.byType("mapgen").length;
  cbnData.byType("item").length;
  cbnData.byType("overmap_special").length;
});

registerScenario("bash-from-terrain", (cbnData) => {
  // Perform various lookups using actual items from test data
  cbnData.bashFromTerrain("t_dock_deep_pile").length;
  cbnData.bashFromTerrain("t_pavement_y_bg_dp").length;
});

// ============================================================================
// Helper functions
// ============================================================================

function collectPerformanceData(): Map<string, number[]> {
  const measures = performance.getEntriesByType("measure");
  const metricsMap = new Map<string, number[]>();

  measures.forEach((m) => {
    const durationUs = m.duration * 1000; // Convert ms to microseconds
    if (!metricsMap.has(m.name)) {
      metricsMap.set(m.name, []);
    }
    metricsMap.get(m.name)!.push(durationUs);
  });

  //We don't need them anymore, clear just in case
  clearPerformanceMarks();

  return metricsMap;
}

function clearPerformanceMarks() {
  performance.clearMarks();
  performance.clearMeasures();
}

function loadTestData(): any[] {
  const testDataPath = path.resolve("_test/all.json");
  if (!fs.existsSync(testDataPath)) {
    console.error(
      `Error: Test data not found at ${testDataPath}. Run 'yarn fetch:fixtures' first.`,
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(testDataPath, "utf-8")).data;
}

/**
 * Run a registered scenario with common setup/teardown
 */
async function runBenchmark(scenario: string): Promise<Map<string, number[]>> {
  const scenarioFn = scenarioRegistry.get(scenario);
  if (!scenarioFn) {
    throw new Error(
      `Unknown scenario: ${scenario}. Available: ${Array.from(scenarioRegistry.keys()).join(", ")}`,
    );
  }

  // Common setup
  const data = loadTestData();
  const cbnData = new CBNData(data);

  clearPerformanceMarks();
  // Run scenario-specific benchmark
  await scenarioFn(cbnData);

  // Common teardown
  return collectPerformanceData();
}

// ============================================================================
// Argument parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: tsx scripts/bench-node.ts [--scenario <scenario>] [options]

Optional:
  --scenario <name>     Benchmark scenario to run:
                        - constructor: Full dataset load and index building
                        - lazy-indexes: First-call lazy index performance
                        - item-lookup: byId/byType lookup performance
                        If omitted, runs all registered scenarios

  --output <path>       Output directory (default: bench-results/)
  --runs <n>            Number of benchmark runs (default: 10)
  --baseline <path>     Compare against baseline stats file
  --threshold <n>       Regression threshold percentage (default: 10)
  --help, -h            Show this help message

Output:
  <output>/node-<scenario>.jsonl       Append-only history (one result per line)
  <output>/node-<scenario>-stats.json  Aggregated statistics (overwritten)

Examples:
  yarn bench:node                              # Run all scenarios
  yarn bench:node --scenario constructor
  yarn bench:node --scenario lazy-indexes --runs 20
`);
    process.exit(0);
  }

  const scenarioArg = args.indexOf("--scenario");
  const outputArg = args.indexOf("--output");
  const runsArg = args.indexOf("--runs");
  const baselineArg = args.indexOf("--baseline");
  const thresholdArg = args.indexOf("--threshold");

  const validScenarios = Array.from(scenarioRegistry.keys());
  let scenarios: string[];

  if (scenarioArg === -1) {
    // No scenario specified - run all scenarios
    scenarios = validScenarios;
  } else {
    const scenario = args[scenarioArg + 1];
    if (!scenario || !validScenarios.includes(scenario)) {
      console.error(
        `Error: Invalid scenario "${scenario}". Valid scenarios: ${validScenarios.join(", ")}`,
      );
      process.exit(1);
    }
    scenarios = [scenario];
  }

  return {
    scenarios,
    outputDir:
      outputArg !== -1
        ? path.resolve(args[outputArg + 1])
        : path.resolve("bench-results"),
    runs: runsArg !== -1 ? parseInt(args[runsArg + 1], 10) : 10,
    baseline: baselineArg !== -1 ? path.resolve(args[baselineArg + 1]) : null,
    threshold: thresholdArg !== -1 ? parseFloat(args[thresholdArg + 1]) : 10,
  };
}

async function main() {
  const {
    scenarios,
    outputDir,
    runs,
    baseline: baselinePath,
    threshold,
  } = parseArgs();

  const gitSha = getGitSha();

  console.log(`\nNode.js Microbenchmark Configuration:`);
  console.log(
    `  Scenarios: ${scenarios.length === scenarioRegistry.size ? "all" : scenarios.join(", ")}`,
  );
  console.log(`  Output: ${outputDir}/`);
  console.log(`  Runs: ${runs}`);
  if (baselinePath) {
    console.log(`  Baseline: ${baselinePath}`);
    console.log(`  Threshold: ${threshold}%`);
  }
  console.log();

  // Run each scenario
  for (const scenario of scenarios) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Running scenario: ${scenario}`);
    console.log(`${"=".repeat(60)}\n`);

    // Collect all metrics across runs
    const allMetrics = new Map<string, number[]>();

    for (let i = 1; i <= runs; i++) {
      console.log(`Run ${i}/${runs}...`);
      try {
        const metricsMap = await runBenchmark(scenario);

        // Aggregate metrics
        for (const [name, values] of metricsMap.entries()) {
          if (!allMetrics.has(name)) {
            allMetrics.set(name, []);
          }
          allMetrics.get(name)!.push(...values);
        }

        console.log(`  ✓ ${metricsMap.size} metrics collected`);
      } catch (error) {
        console.error(`  ✗ Failed:`, error);
      }
    }

    if (allMetrics.size === 0) {
      console.error(
        `Error: No measurements were successfully captured for ${scenario}.`,
      );
      continue; // Skip to next scenario instead of exiting
    }

    console.log(`\nSuccessfully captured ${runs} runs.\n`);

    // Create histogram statistics for each metric
    const metrics: MetricResult = {};
    for (const [name, values] of allMetrics.entries()) {
      metrics[name] = createHistogramStats(values);
    }

    // Unified naming for Node benchmarks
    const unifiedScenario = `node-${scenario}`;

    // Create benchmark result
    const result: BenchmarkResult = {
      scenario: unifiedScenario,
      timestamp: Date.now(),
      date: new Date().toISOString().split("T")[0],
      "git-sha1": gitSha,
      metrics,
    };

    const aggregated: AggregatedStats = {
      scenario: unifiedScenario,
      updated: new Date().toISOString(),
      totalRuns: runs,
      metrics,
    };

    saveResults(outputDir, unifiedScenario, result, aggregated);

    // Display statistics
    console.log(`\nPerformance Statistics (in microseconds):`);
    const tableData = Object.entries(metrics)
      .sort((a, b) => b[1].mean - a[1].mean)
      .map(([name, stats]) => ({
        Metric: name,
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
          // Don't exit immediately when running multiple scenarios
          if (scenarios.length === 1) {
            process.exit(1);
          }
        } else {
          console.log(
            `\n✅ No regressions detected (threshold: ${threshold}%)`,
          );
        }
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`All scenarios completed!`);
  console.log(`${"=".repeat(60)}\n`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
