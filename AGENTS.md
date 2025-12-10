# AI Agent Guide for cbn-guide (Hitchhiker's Guide to the Cataclysm - Bright Nights)

This document provides context, conventions, and guidelines for AI agents working on this codebase.

## Project Overview

**Project Name**: hhg-bn (cbn-guide)
**Description**: A web-based guidebook and wiki for "Cataclysm: Dark Days Ahead - Bright Nights" (CDDA BN). It parses game data to present items, monsters, and other game entities in a user-friendly format.

## Technology Stack

- **Framework**: [Svelte 4](https://svelte.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Styling**: Vanilla CSS / Svelte scoped styles.
- **Package Manager**: Yarn, npm.

## Project Structure

- **`src/`**: Source code root.
  - **`App.svelte`**: Main application component.
  - **`Thing.svelte`**: Detailed view for a game entity ("Thing").
  - **`data.ts`**: Core logic for handling/parsing game data.
  - **`colors.ts`**: Helper for game color handling.
  - **`types.ts`**: Main game entity types, maps external types, from the game files, to internal types.
  - **`types/`**: Defines rendering of game data into web views.
- **`public/`**: Static assets.
- **`fetch-fixtures.js`**: Script to fetch test/game data, used to populate `src/_test/`.
- **`package.json`**: Project dependencies and scripts.

## Development Workflow

### Installation
```bash
yarn install
```

### Running Locally
To start the development server:
```bash
yarn dev
```
Access at `http://localhost:3000`.

### Building
To build for production:
```bash
yarn build
```

### Testing & Validation
Run all tests and checks (lint, validate, unit tests):
```bash
yarn test
```

Specific checks:
- **Type Check**: `yarn validate` (Runs `svelte-check` and `tsc`)
- **Unit Tests**: `yarn vitest src` (or via `yarn test`)
- **Linting**: `yarn lint` / `yarn lint:fix`

## Conventions & Best Practices

1.  **TypeScript**: Always use TypeScript. Ensure robust typing, especially when dealing with game data structures. Check `src/types/` for existing definitions.
2.  **Svelte Components**:
    - Use `<script lang="ts">`.
    - Keep logic within components related to their display, move heavy data processing to `ts` files (e.g., `data.ts`).
3.  **Formatting**: The project uses Prettier. Ensure code is formatted before finalizing tasks (`yarn lint:fix`).
4.  **No `cd` commands**: When running commands, execute them from the root unless specified otherwise, but do not use `cd`.

## Common Tasks for Agents

- **Adding a new feature**:
    1.  Understand the data source (`src/data.ts`).
    2.  Create/Update Svelte components.
    3.  Add types in `src/types.ts` if needed.
    4.  Verify with `yarn validate` and `yarn test`.
- **Refactoring**:
    - Ensure no regressions by running tests.
    - Maintain Svelte reactivity best practices (avoid side effects in `render`, etc.).
