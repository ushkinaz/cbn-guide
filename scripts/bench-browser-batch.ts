import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: tsx scripts/bench-browser-batch.ts [options]

Runs browser benchmarks for all URLs listed in bench-results/browser-urls.txt

Optional:
  --runs <n>            Number of runs per URL (default: 10)
  --no-throttle         Disable CPU/network throttling
  --urls <file>         Custom URLs file (default: bench-results/browser-urls.txt)
  --help, -h            Show this help message

URLs File Format:
  - One URL per line
  - Empty lines are ignored
  - Lines starting with # are comments
  - URLs should be full paths (e.g., http://localhost:3000/stable/item/pretzels)

Example bench-results/browser-urls.txt:
  # Core pages
  http://localhost:3000/stable/item/pretzels
  http://localhost:3000/stable/recipe/soup_dumplings

  # Heavy pages
  http://localhost:3000/stable/item/katana

Examples:
  pnpm bench:browser:batch
  pnpm bench:browser:batch --runs 10
  pnpm bench:browser:batch --no-throttle
  pnpm bench:browser:batch --urls my-urls.txt
`);
    process.exit(0);
  }

  const runsArg = args.indexOf("--runs");
  const urlsFileArg = args.indexOf("--urls");

  return {
    runs: runsArg !== -1 ? parseInt(args[runsArg + 1], 10) : 10,
    noThrottle: args.includes("--no-throttle"),
    urlsFile:
      urlsFileArg !== -1
        ? path.resolve(args[urlsFileArg + 1])
        : path.resolve("bench-results/browser-urls.txt"),
  };
}

function readUrls(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: URLs file not found at ${filePath}`);
    console.error(`\nCreate a file with one URL per line, e.g.:`);
    console.error(`  http://localhost:3000/stable/item/pretzels`);
    console.error(`  http://localhost:3000/stable/recipe/soup_dumplings`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")); // Skip empty lines and comments
}

async function main() {
  const { runs, noThrottle, urlsFile } = parseArgs();

  console.log(`\nBrowser Benchmark Batch Runner`);
  console.log(`  URLs file: ${urlsFile}`);
  console.log(`  Runs per URL: ${runs}`);
  if (noThrottle) {
    console.log(`  Throttling: DISABLED`);
  }
  console.log();

  const urls = readUrls(urlsFile);

  if (urls.length === 0) {
    console.error(`Error: No URLs found in ${urlsFile}`);
    process.exit(1);
  }

  console.log(`Found ${urls.length} URL(s) to benchmark:\n`);
  urls.forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });
  console.log();

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(
      `\n${"=".repeat(80)}\n[${i + 1}/${urls.length}] Benchmarking: ${url}\n${"=".repeat(80)}\n`,
    );

    try {
      const cmd = [
        "pnpm",
        "bench:browser",
        "--url",
        url,
        "--runs",
        runs.toString(),
        noThrottle ? "--no-throttle" : "",
      ]
        .filter(Boolean)
        .join(" ");

      execSync(cmd, {
        stdio: "inherit",
        cwd: process.cwd(),
      });

      successCount++;
    } catch (error) {
      console.error(`\n✗ Failed to benchmark ${url}`);
      failCount++;
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Batch Complete!`);
  console.log(`  ✓ Success: ${successCount}/${urls.length}`);
  if (failCount > 0) {
    console.log(`  ✗ Failed: ${failCount}/${urls.length}`);
  }
  console.log(`${"=".repeat(80)}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
