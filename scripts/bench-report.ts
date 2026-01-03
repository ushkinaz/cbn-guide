import fs from "fs";
import path from "path";
import { type BenchmarkResult } from "./bench-utils.js";

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: tsx scripts/bench-report.ts [options]

Optional:
  --input <dir>         Input directory with .jsonl files (default: bench-results/)
  --output <file>       Output HTML file (default: bench-results/report.html)
  --help, -h            Show this help message

Examples:
  yarn bench:report
  yarn bench:report --input bench-results/ --output my-report.html
`);
    process.exit(0);
  }

  const inputArg = args.indexOf("--input");
  const outputArg = args.indexOf("--output");

  return {
    inputDir:
      inputArg !== -1
        ? path.resolve(args[inputArg + 1])
        : path.resolve("bench-results"),
    outputFile:
      outputArg !== -1
        ? path.resolve(args[outputArg + 1])
        : path.resolve("bench-results/report.html"),
  };
}

function loadJsonlFile(filePath: string): BenchmarkResult[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  return lines
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as BenchmarkResult);
}

function generateHtml(data: Map<string, BenchmarkResult[]>): string {
  // Prepare data for charts
  const chartData: any = {};

  for (const [scenario, results] of data.entries()) {
    if (results.length === 0) continue;

    // Get all metric names from the latest result
    const metricNames = Object.keys(results[results.length - 1].metrics);

    chartData[scenario] = {};

    for (const metricName of metricNames) {
      const dates = results.map((r) => r.date);
      const means = results.map((r) => r.metrics[metricName]?.mean || 0);
      const p95s = results.map((r) => r.metrics[metricName]?.p95 || 0);
      const p99s = results.map((r) => r.metrics[metricName]?.p99 || 0);

      chartData[scenario][metricName] = {
        dates,
        means,
        p95s,
        p99s,
      };
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benchmark Performance Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: #1a1a1a;
    }
    .meta {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .scenario {
      margin-bottom: 40px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 30px;
    }
    .scenario:last-child {
      border-bottom: none;
    }
    h2 {
      font-size: 22px;
      margin-bottom: 20px;
      color: #2c3e50;
    }
    .metric-chart {
      margin-bottom: 30px;
      background: #fafafa;
      padding: 20px;
      border-radius: 6px;
    }
    .metric-chart h3 {
      font-size: 16px;
      margin-bottom: 15px;
      color: #555;
    }
    canvas {
      max-height: 300px;
    }
    .no-data {
      text-align: center;
      padding: 40px;
      color: #999;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Benchmark Performance Report</h1>
    <div class="meta">
      Generated: ${new Date().toISOString()}<br>
      Total scenarios: ${data.size}
    </div>

${Array.from(data.entries())
  .map(
    ([scenario, results]) => `
    <div class="scenario">
      <h2>${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario</h2>
      ${
        results.length === 0
          ? `<div class="no-data">No data available for this scenario.</div>`
          : Object.keys(results[results.length - 1].metrics)
              .map(
                (metricName) => `
      <div class="metric-chart">
        <h3>${metricName}</h3>
        <canvas id="chart-${scenario}-${metricName.replace(/[^a-zA-Z0-9]/g, "_")}"></canvas>
      </div>`,
              )
              .join("")
      }
    </div>`,
  )
  .join("")}
  </div>

  <script>
    const chartData = ${JSON.stringify(chartData)};

    // Configure Chart.js defaults
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    Chart.defaults.plugins.legend.display = true;
    Chart.defaults.plugins.legend.position = 'top';

    // Create charts
    for (const [scenario, metrics] of Object.entries(chartData)) {
      for (const [metricName, data] of Object.entries(metrics)) {
        const chartId = \`chart-\${scenario}-\${metricName.replace(/[^a-zA-Z0-9]/g, "_")}\`;
        const ctx = document.getElementById(chartId);
        if (!ctx) continue;

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.dates,
            datasets: [
              {
                label: 'Mean (μs)',
                data: data.means,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.1,
                fill: true
              },
              {
                label: 'P95 (μs)',
                data: data.p95s,
                borderColor: 'rgb(255, 159, 64)',
                backgroundColor: 'rgba(255, 159, 64, 0.1)',
                tension: 0.1,
                fill: false
              },
              {
                label: 'P99 (μs)',
                data: data.p99s,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                tension: 0.1,
                fill: false,
                borderDash: [5, 5]
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
              mode: 'index',
              intersect: false,
            },
            plugins: {
              title: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' μs';
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Duration (μs)'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Date'
                }
              }
            }
          }
        });
      }
    }
  </script>
</body>
</html>`;
}

async function main() {
  const { inputDir, outputFile } = parseArgs();

  console.log(`\nGenerating benchmark report...`);
  console.log(`  Input: ${inputDir}`);
  console.log(`  Output: ${outputFile}\n`);

  // Find all .jsonl files
  const jsonlFiles = fs
    .readdirSync(inputDir)
    .filter((f) => f.endsWith(".jsonl"));

  if (jsonlFiles.length === 0) {
    console.error(
      `No .jsonl files found in ${inputDir}. Run benchmarks first.`,
    );
    process.exit(1);
  }

  // Load data for each scenario
  const data = new Map<string, BenchmarkResult[]>();

  for (const file of jsonlFiles) {
    const scenario = file.replace(".jsonl", "");
    const filePath = path.join(inputDir, file);
    const results = loadJsonlFile(filePath);

    console.log(`  Loaded ${results.length} results from ${file}`);
    data.set(scenario, results);
  }

  // Generate HTML
  const html = generateHtml(data);

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, html);

  console.log(`\n✓ Report generated: ${outputFile}`);
  console.log(`  Open in browser to view charts`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
