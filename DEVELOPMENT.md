# Development Guide

## Getting started

This project is a Svelte 4 application that uses Vite 5 for building and Vitest for testing. It requires a local copy of the game data to function correctly during development.

### Prerequisites

- **Node.js**: version 18 or higher, 22 recommended
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

- **Run all tests**: `pnpm test`
  - Runs formatting checks (`pnpm verify:format`), type validation (`pnpm verify:types`), and unit tests.
  - Takes long time to run.
- **Run tests with latest nightly data**: `pnpm test:nightly`
  - Fetches latest fixtures (`pnpm fetch:fixtures:nightly`) and runs tests.
- **Watch mode**: `pnpm test:watch`
  - Fetches fixtures, runs type checks, and starts Vitest in watch mode.
- **Type Checking**: `pnpm verify:types`
  - Runs `svelte-check` and `tsc` to ensure type safety.

### Project Scripts

The project uses a semantic naming convention (`scope:action`) for NPM scripts:

#### Code Quality

- `pnpm verify`: Run all static checks (formatting & types).
- `pnpm verify:format`: Check code formatting.
- `pnpm verify:types`: Run type checking.
- `pnpm fix:format`: Auto-fix formatting issues.

#### Data & Assets

- `pnpm fetch:fixtures`: Download test data fixtures (default version).
- `pnpm fetch:fixtures:nightly`: Download nightly test data fixtures.
- `pnpm fetch:builds`: Download build metadata for versions.
- `pnpm fetch:icons`: Download item icons.
- `pnpm gen:css`: Generate `colors.css` from game data.
- `pnpm gen:sitemap`: Generate `sitemap.xml`.
- `pnpm gen:unifont`: Generate a subset of Unifont for the specific game data.
- `pnpm gen:unifont:verify`: CI check to ensure font subset covers current data.

#### Deployment

- `pnpm i18n:push`: Upload source strings to Transifex.

### Test Files Overview

#### Integration & Rendering Tests

- **`src/all.X.test.ts`** (`all.1.test.ts`, `all.2.test.ts`, etc.)
  - These are comprehensive integration tests that attempt to render _every_ item of supported types in the game data.
  - They are split into chunks (using `src/testRender.ts`) to parallelize the workload and prevent timeouts.
  - They check for runtime errors during component mounting and look for common data binding issues (like `undefined`, `NaN`, `[object Object]` in the output).

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
