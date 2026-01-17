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

This project follows specific patterns for Svelte reactivity and state management to ensure performance and predictability.

### Reactive Statements

The reactive label `$:` should be reserved primarily for **derived state** (computed values) required for rendering.

**Recommended Usage:**

- **derived state**:
  ```svelte
  $: filteredItems = items.filter(i => i.name.includes(search)); $: count =
  filteredItems.length;
  ```
- **logging/debugging** (during dev only):
  ```svelte
  $: console.log('Items changed:', items);
  ```

**Non-Standard / Discouraged Usage:**

- **Side Effects**: Avoid using `$:` to trigger significant side effects (e.g., API calls, complex DOM manipulation, global store updates).
  - _Why_: It makes data flow hard to trace. Use `onMount`, event handlers, or methods called from the user interaction point instead.
- **Context Updates (`setContext`)**: **Never** call `setContext` inside a reactive statement.
  - _Why_: `setContext` is synchronous and must be called during component initialization. Calls inside `$:` happen after mount and **do not** propagate to existing children (who read context only once at valid init time).
  - _Alternative_: Pass a `Store` via context, or use Props, or import the Global Store directly.
- **Opaque Expressions**: Avoid comma-operator hacks to force updates.
  - _Bad_: `$: (item, search, (currentHref = location.href));`
  - _Why_: This is unreadable and relies on side-effects of property access or global state polling. Use explicit assignments or event listeners.

### State Management

1.  **Global Data (`src/data.ts`)**:
    The application relies on a central `data` store (`CBNData` instance).
    - **Effectively Immutable**: The `CBNData` instance itself is effectively immutable. It is replaced wholesale when a new game version is loaded. It does not mutate internally.
    - Components should subscribe to `$data` or accept it as a prop.
    - **Do not** attempt to re-provide `$data` via context in every component (`$: setContext('data', data)`). This is an anti-pattern. Since `data` is a global export, prefer verifying if `import { data } from '...'` suffices, or pass it explicitly.

2.  **Versioning & Routing**:
    - URL state (version, search) is the source of truth.
    - The app reacts to URL changes to update the `data` store.
    - Components should react to `$data` changes gracefully.
    - Details in [[docs/routing.md]]

### Legacy Code Note

You may encounter non-standard patterns (e.g., in `App.svelte` or `SearchResults.svelte`).

- **`App.svelte`**: Contains reactive store updates `$: tileData.setURL(...)`. This should eventually be refactored to a derived store pattern.
- **`SearchResults.svelte`**: Contains `$: setContext("data", data)`. This is technically incorrect (does not update children reactively) but may appear working if the component is continually destroyed/recreated (keyed).

When refactoring, prioritize moving logic out of `$:` side-effects and into clearer `Event -> Action -> Store Update` flows.

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
