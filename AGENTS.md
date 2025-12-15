# AI Agent Guide for cbn-guide (Hitchhiker's Guide to the Cataclysm - Bright Nights)

This document provides context, conventions, and guidelines for AI agents working on this codebase.

## Project Overview

**Project Name**: hhg-bn (cbn-guide)
**Description**: Web-based guide for Cataclysm: Bright Nights that presents searchable, browsable data about game entities such as items and monsters.
The goal is to provide players with a quick reference for in-game information, mirroring the semantics from the upstream C:BN codebase and JSON data.
When behavior or terminology is unclear, cross-reference the official Cataclysm-BN source, which may already be checked out in ../Cataclysm-BN.

## Technology Stack

- **Framework**: [Svelte 4](https://svelte.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Testing**: [Vitest](https://vitest.dev/)
- **Styling**: Vanilla CSS / Svelte scoped styles.
- **Package Manager**: Yarn, do not use npm.

## Project Structure

- **`package.json`**: Project dependencies and scripts.
- **`src/`**: Source code root.
  - **`App.svelte`**: Main application component.
  - **`Thing.svelte`**: Detailed view for a game entity ("Thing").
  - **`data.ts`**: Core logic for handling/parsing game data.
  - **`colors.ts`**: Helper for game color handling.
  - **`types.ts`**: Main game entity types, maps external types, from the game files, to internal types.
  - **`types/`**: Defines rendering of game data into web views.
  - **`types/item/`**, **`types/monster/`** – submodules for item and monster details
  - **`assets/`** – bundled images
  - **`*.test.ts`** – unit tests
  - **`public/`**: Static assets.
- **`fetch-fixtures.js`**: Script to fetch test/game data, used to populate `src/_test/`.
- **`_test/`** – downloaded test fixtures (`all.meta.json` is tracked, `all.json` is fetched on demand)
- **`_test/all.meta.json`** determines game data version for `fetch-fixtures.js` script.
- **`_test/all.json`** contains game data, transient file.
- **`_test/builds.json`** contains list of available game data versions, transient file.

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

`yarn test` fetches data into `_test/all.json` if needed via `fetch-fixtures.js`.

Specific checks:

- **Type Check**: `yarn validate` (Runs `svelte-check` and `tsc`)
- **Linting**: `yarn lint`
- **Lint Fix**: `yarn lint:fix`, run it before committing to apply **Prettier** formatting.

## Backwards compatibility

cbn-guide is intended to function with data from the master branch of Cataclysm-BN, as well as with the most recent stable version.
Compatibility with older versions is desirable but not required.
When making changes, if it is easy to maintain compatibility with older versions, please do so. However, if it would require a significant amount of work, it is acceptable to only support the latest stable version and master.

## Translation

There are two sources for translation strings:

- For text from the game itself, we rely on the translations provided by the Cataclysm-DDA project.
  These are usable via the i18n.gettext helpers (`singular` / `plural` / `translate` / etc. in data.ts for data from items, or `i18n.__` / `i18n.gettext` for UI strings).
  It's preferable to use these when possible as they match the in-game strings and don't require further translation.
- For UI strings and any additional text we add, we use Transifex via the `t("English String", { _context?: string, _comment?: string })` helper.
  If a string requires interpolation, and the interpolated values are basic values (e.g. strings or numbers), they can be passed using the `t("{n}", {n})` syntax.
  If the interpolated values aren't basic strings (e.g. they are links or Svelte components), the \<InterpolatedString> component can be used.

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
