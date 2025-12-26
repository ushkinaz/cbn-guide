# Development Guide

## Testing

This project uses `vitest` for testing. The tests cover a range of functionality from data parsing and validation to UI component rendering.

### Running Tests

- **Run all tests**: `yarn test`
  - This runs linting (`yarn lint`), validation (`yarn validate`), and then `vitest run src`.
- **Run tests with latest data**: `yarn test:latest`
  - Updates test data fixtures to the latest version of game data before running tests.
- **Watch mode**: `yarn test:watch`
  - Runs tests in watch mode for development.
- **Type Checking**: `yarn validate`
  - Runs `svelte-check` and `tsc` to ensure type safety.

### Test Files Overview

#### Integration & Rendering Tests

- **`src/all.X.test.ts`** (`all.1.test.ts`, `all.2.test.ts`, etc.)
  - These are comprehensive integration tests that attempt to render _every_ item of supported types in the game data.
  - They are split into chunks (using `src/testRender.ts`) to parallelize the workload and prevent timeouts.
  - They check for runtime errors during component mounting and look for common data binding issues (like `undefined`, `NaN`, `[object Object]` in the output).

#### Core Data Logic

- **`src/data.test.ts`**
  - Unit tests for the `CddaData` class in `src/data.ts`.

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

### Test Helpers

- **`src/testRender.ts`**
  - Contains the logical core for `all.X.test.ts`.
