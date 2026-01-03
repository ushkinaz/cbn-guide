# Build scripts

This folder contains build-only scripts for data processing and asset management.

For detailed documentation, parameters, and usage instructions for each script, please refer to the header comments within the respective files.

## Available Scripts

### Data & Assets

- **`fetch-fixtures.ts`** (`yarn fetch:fixtures`): Fetches game data (`all.json`) for local development and testing. Use `yarn fetch:fixtures:latest` to pull the nightly version.
- **`fetch-builds.ts`** (`yarn fetch:builds`): Fetches the latest `builds.json` containing version metadata.
- **`fetch-icons.ts`** (`yarn fetch:icons`): Extracts and renders icons for game entities from tilesets.
- **`gen-css.ts`** (`yarn gen:css`): Generates CSS variables and palette classes from game color definitions.
- **`gen-sitemap.ts`** (`yarn gen:sitemap`): Generates a static `sitemap.xml` for SEO.
- **`gen-unifont.sh`** (`yarn gen:unifont`): Optimizes Unifont by subsetting it to only required characters (defined in `unifont-chars.txt`).

### Performance & Benchmarking

- **`bench-node.ts`** (`yarn bench:node`): High-precision microbenchmarks for the `src/data.ts` module in Node.js. Supports regression detection and baseline comparisons.
- **`bench-browser.ts`** (`yarn bench:browser`): Automates browser-based performance measurement using Puppeteer. Captures User Timing marks and calculates statistics over multiple reloads.
- **`bench-report.ts`** (`yarn bench:report`): Generates an interactive HTML dashboard with Chart.js to visualize historical benchmark trends (both node and browser) stored in `bench-results/*.jsonl`.
- **`bench-utils.ts`**: Shared utilities and types for the benchmarking suite.
