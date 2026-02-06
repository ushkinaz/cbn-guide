# Build scripts

This folder contains build-only scripts for data processing and asset management.

For detailed documentation, parameters, and usage instructions for each script, please refer to the header comments within the respective files.

## Available Scripts

### Data & Assets

- **`fetch-fixtures.ts`** (`pnpm fetch:fixtures`): Fetches game data (`all.json`) for local development and testing. Use `pnpm fetch:fixtures:latest` to pull the nightly version.
- **`fetch-builds.ts`** (`pnpm fetch:builds`): Fetches the latest `builds.json` containing version metadata.
- **`fetch-icons.ts`** (`pnpm fetch:icons`): Extracts and renders icons for game entities from tilesets.
- **`transifex-download.ts`** (`pnpm i18n:download:api`): Downloads resource translations per locale using `resource_translations_async_downloads` API and saves locale JSON files.
- **`transifex-update.ts`** (`pnpm i18n:update:api`): Updates existing resource translations using bulk `PATCH /resource_translations` from local JSON files (for AI-assisted translation workflow).
- **`gen-css.ts`** (`pnpm gen:css`): Generates CSS variables and palette classes from game color definitions.
- **`gen-sitemap.ts`** (`pnpm gen:sitemap`): Generates a static `sitemap.xml` for SEO.
- **`gen-ogimage.py`** (`pnpm gen:ogimage`): Generates a custom OpenGraph (OG) image with game data, icons, and system fonts.
- **`gen-unifont.sh`** (`pnpm gen:unifont`): Optimizes Unifont by subsetting it to only required characters (defined in `unifont-chars.txt`).

### Performance & Benchmarking

- **`bench-node.ts`** (`pnpm bench:node`): High-precision microbenchmarks for the `src/data.ts` module in Node.js. Supports regression detection and baseline comparisons.
- **`bench-browser.ts`** (`pnpm bench:browser`): Automates browser-based performance measurement using Puppeteer. Captures User Timing marks and calculates statistics over multiple reloads.
- **`bench-report.ts`** (`pnpm bench:report`): Generates an interactive HTML dashboard with Chart.js to visualize historical benchmark trends (both node and browser) stored in `bench-results/*.jsonl`.
- **`bench-utils.ts`**: Shared utilities and types for the benchmarking suite.
