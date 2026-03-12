# Development Guide

## Getting started

This project is a Svelte 5 application that uses Vite 6 for building and Vitest for testing. It requires a local copy of the game data to function correctly during development.

### Prerequisites

- **Node.js**: version 20 or higher, 24 recommended
- **pnpm**: version 10.x
- **Python**: version 3.x (Required for Unifont generation).

### Recommended Tools

- **[jq](https://jqlang.github.io/jq/)**: Highly recommended for querying, filtering, and inspecting the large game data files (e.g., `_test/all.json`).

### Initial Setup

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```
2.  **Fetch game data**:
    ```bash
    pnpm fetch:fixtures
    ```
    This script downloads the necessary JSON fixtures from the builds repository. It's not required for the app, but usefull for testing.
3.  **Start development server**:
    ```bash
    pnpm dev
    ```
    The application will be available at [http://localhost:3000](http://localhost:3000).

---

## Svelte Reactivity & Architecture

**Core Architecture**: This project uses **route-driven remounting** — main content components (`Thing`, `Catalog`, `SearchResults`) are wrapped in `{#key}` blocks and destroyed/recreated on every navigation.

**Implication**: Most components don't need `$:` reactive statements for prop changes. They start fresh on each route change.

### When Reactivity IS Needed

Use `$:` reactive statements in these specific cases:

1. **Long-lived components** (app shell, header, footer) that react to route/store changes
2. **Store subscriptions** that update without remount: `$tileData` (user can change tileset without reload)
3. **Local state derivation** within a component: `$: visible = items.slice(0, expanded ? items.length : limit)`

### When Reactivity is UNNECESSARY

Skip `$:` for prop-change reactivity in:

- **`Thing.svelte` and descendants** — remounted via `{#key item}`
- **`Catalog.svelte` and descendants** — remounted via `{#key item}`
- **`SearchResults.svelte` and descendants** — remounted via `{#key search}`

### Anti-Patterns to Avoid

❌ **Never** `$: setContext(...)` — doesn't propagate to existing children  
❌ **Avoid** `$:` for side effects — use `onMount` or event handlers  
❌ **Don't** add prop-watching `$:` inside keyed blocks — the component already remounts

### State Management

**Global Data**: `data` store from `src/data.ts`

- Write-once per page load (throws if set twice)
- Replaced wholesale on version change
- Access via `$data` subscription or props, never `$: setContext('data', data)`

**URL as Source of Truth**: Version and search params drive app state. Details: [docs/routing.md](docs/routing.md)

**For comprehensive details**: See [docs/reactivity.md](docs/reactivity.md)

## Architecture Decision Records

Significant architectural decisions are documented in `docs/adr/`, see [[docs/adr/README.md]] using the Lightweight Architecture Decision Records format. When making important design choices, create a new ADR to document the context, decision, and consequences.

## Testing

This project uses `vitest` for testing. The tests cover a range of functionality from data parsing and validation to UI component rendering.

### Running Tests

- **Static checks (required before commit)**: `pnpm lint` and `pnpm check`
  - Runs formatting checks (`pnpm lint:format`) and type validation (`pnpm check:types`).
- **Changed-related tests**: `pnpm test:changed`
  - Runs tests related to changed files.
- **Fast local suite**: `pnpm test:fast`
  - Runs all tests except expensive render-regression suites.
- **Full regression suite**: `pnpm test:full` (or `pnpm test`)
  - Runs static checks and the full Vitest suite, including render-regression tests.
- **Type Checking**: `pnpm check:types`
  - Runs `svelte-check` and `tsc` to ensure type safety.

Suggested command matrix:

- Tiny/localized change: `pnpm lint && pnpm test:changed`
- Normal feature/bugfix: `pnpm lint && pnpm check && pnpm test:fast`
- Cross-cutting/data-model/routing change: `pnpm test:full`

### Project Scripts

The project uses a semantic naming convention (`scope:action`) for NPM scripts:

#### Code Quality

- `pnpm lint`: Check code formatting.
- `pnpm check`: Run type checking.
- `pnpm lint:format`: Check code formatting.
- `pnpm check:types`: Run type checking.
- `pnpm lint:fix`: Auto-fix formatting issues.

#### Testing

- `pnpm test`: Alias for `pnpm test:full`.
- `pnpm test:full`: Full regression suite (includes expensive render-regression tests).
- `pnpm test:fast`: Excludes `src/all.*.test.ts` and `src/__mod_tests__/**`.
- `pnpm test:changed`: Runs tests related to changed files.
- `pnpm gen:mod-tests`: Generates isolated Vitest files per mod to prevent Out-Of-Memory (OOM) errors during render tests.

#### Data & Assets

- `pnpm fetch:fixtures`: Download test data fixtures (default version).
- `pnpm fetch:fixtures:nightly`: Download nightly test data fixtures.
- `pnpm fetch:builds`: Download build metadata for versions.
- `pnpm fetch:icons`: Download item icons.
- `pnpm gen:css`: Generate `game-palette.css` from game data.
- `pnpm gen:sitemap`: Generate `sitemap.xml`.
- `pnpm gen:unifont`: Generate a subset of Unifont for the specific game data.
- `pnpm gen:unifont:verify`: CI check to ensure font subset covers current data.

#### Deployment

- `pnpm i18n:push`: Upload source strings to Transifex.
  - Transifex extraction only picks direct `t("...")` keys.
  - `t(variableOrExpression)` is not extracted (for example: `t(cat.label)` or `t(gamePlural(type))`).
  - Dynamic keys can still translate at runtime only if that key was extracted elsewhere before.

#### CI / Local Testing

- `scripts/gh-local.sh`: Runs the GitHub Actions CI pipeline locally using [act](https://github.com/nektos/act).
  - **Purpose**: Simulates the CI environment locally. This helps test workflows before pushing to GitHub, which is especially useful for debugging complex CI issues (like Out-Of-Memory errors).
  - **Prerequisites**: Requires [Docker](https://www.docker.com/) installed and running, and the [`act` CLI](https://nektosact.com/) installed (e.g., `brew install act` on macOS).

### Transifex API Workflow (Download -> AI Translate -> Update)

1. Download current translations for a resource: `TRANSIFEX_API_TOKEN='1/...' pnpm i18n:download --out='./tmp/transifex-download`
2. Translate downloaded JSON files with your AI workflow.
3. Update existing translations in Transifex: `TRANSIFEX_API_TOKEN='1/...' pnpm i18n:upload --dir='./tmp/transifex-download`

Useful options:

- Download only selected locales: `--locales='de,ru_RU,uk_UA'`
- Include locales with zero translated strings: `--include-empty=true`
- Dry run update without PATCH: `--dry-run=true`
- Update a single file/locale: `--file='./tmp/transifex-download/de.json' --locale='de'`

### Test Files Overview

#### Integration & Rendering Tests

- **`src/all.X.test.ts`** (`all.1.test.ts`, `all.2.test.ts`, etc.)
  - These are comprehensive integration tests that attempt to render _every_ item of supported types in the game data.
  - They are split into chunks (using `src/testRender.ts`) to parallelize the workload and prevent timeouts.
  - They check for runtime errors during component mounting and look for common data binding issues (like `undefined`, `NaN`, `[object Object]` in the output).

- **`src/__mod_tests__/mod.*.test.ts` (Generated)**
  - Dynamically generated test files created by `pnpm gen:mod-tests`, representing one file per mod found in `_test/all_mods.json`.
  - **Why generation is needed:** Game data rendering tests require substantial memory.
  - **How it works:** By creating individual files (e.g., `mod.aftershock.test.ts`), Vitest is forced to run each mod in an isolated worker process. This strictly caps memory usage as data instances are garbage collected when the isolated worker terminates. These files are gitignored and automatically regenerated whenever `pnpm test:full` runs.

#### Core Data Logic

- **`src/data.test.ts`**
  - Unit tests for the `CBNData` class in `src/data.ts`.

- **`src/schema.test.ts`**
  - If upstream BN changes the schema for JSON data, this test will fail.

#### Feature Tests

- **`src/search.test.ts`**
  - Verifies search functionality, including partial matches, filtering logic, and "No results" states.

#### Type-Specific Logic (`src/types/item/`)

- **`src/types/item/spawnLocations.test.ts`**
  - Extensive tests for loot spawning logic.
  - Verifies that mapgen definitions, item groups, palettes, and nested mapgens are correctly parsed to calculate drop probabilities (`prob`) and expected values (`expected`).
- **`src/types/item/SpawnedIn.test.ts`**
  - Tests the visual representation of spawn locations in the `SpawnedIn.svelte` component.

- **`src/types/item/utils.test.ts`**
  - Helper unit tests for utility functions like `multimap`.

## Benchmarks

The project includes benchmarking scripts to track performance across different environments.

- **`pnpm bench:node`**: Runs performance benchmarks in the Node.js environment.
- **`pnpm bench:browser`**: Runs benchmarks in a headless browser environment.
- **`pnpm bench:browser:batch`**: Runs benchmarks in the browser across multiple versions or data sets.
- **`pnpm bench:report`**: Aggregates benchmark results and generates a summary report.

### Test Helpers

- **`src/testRender.ts`**
  - Contains the logical core for `all.X.test.ts`.
