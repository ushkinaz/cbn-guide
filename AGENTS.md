# Agent Development Guide

## Project Overview

- A Svelte 4 + Vite 5 application that provides an offline-capable wiki for Cataclysm: Bright Nights game data
- The app is a mirror of game data. Upstream source code and data may live at `../Cataclysm-BN`

## Tech Stack

- Node.js: 22
- pnpm: 10.x
- Core: `TypeScript` 5, `Svelte` 4 + `Vite` 5
- Testing: `vitest`, `puppeteer`
- Styling: Scoped CSS, custom design tokens in `/src/assets/game-palette.css` and `src/assets/design.css`.

## Project Structure

- `src/`: app source (key files: `src/data.ts`, `src/types.ts`; plus routing and type-specific views)
- `scripts/`: development scripts
- `_test/`: test fixtures (`all.json`, `all_mods.json`)

## Build, Lint & Test Commands

### Development

- `pnpm i` - install dependencies
- `pnpm dev` - Start Vite dev server at http://localhost:3000
- `pnpm build` - Build production bundle
- `pnpm preview` - Preview production build

### Code Quality

- `pnpm verify` - Run all checks
- `pnpm fix:format` - Auto-fix formatting issues

### Testing

Prefer targeted tests first; run full suite only for cross-cutting changes.

- `pnpm test --bail 1` - Full test suite
- `pnpm verify:types` for TypeScript/Svelte correctness
- `pnpm vitest run <path/to/test.ts>` - Run single test
- `pnpm test:nightly` - Test with the latest nightly data

#### Key Test Files

- `src/all.X.test.ts`: slow full-data rendering integration tests
- `src/schema.test.ts`: game data schema validation

### Data & Scripts

- `pnpm fetch:fixtures:nightly` - Download nightly test data required for tests
- `pnpm fetch:builds` - Download builds.json index

## Core Architecture104

- Route-Driven Remounting: main content components (`Thing`, `Catalog`, `SearchResults`) are wrapped in `{#key}` blocks and destroyed/recreated on every navigation. Do not use `$:` reactive statements for prop changes inside keyed components. 99% of other components are mounted inside keyed patents
- Global Data: `data` store from `src/data.ts` - write-once per page load
- URL as Source of Truth: Version and search params drive app state (see `docs/routing.md`)
- Reactivity: read `docs/reactivity.md`

## Code Style Guidelines

### TypeScript

- Strict mode enabled
- Always use explicit types for function parameters and return values
- Prefer `type` over `interface` for type definitions
- Use discriminated unions for complex state (see `src/types.ts`)
- No implicit any: All values must be typed

### Svelte Components

- Use `<script lang="ts">` for TypeScript
- Component-scoped styles are preferred over global
- Mark intentional a11y violations with `<!-- svelte-ignore a11y-* -->`

### Error Handling

- Try-catch for I/O: localStorage, fetch, etc. with fallback behavior
- Sentry.io logging: Use `Sentry.captureException()` for critical failures

### Comments

- JSDoc: For public functions and complex logic
- Inline comments: For non-obvious decisions
- TODO comments: Format as `//TODO: description`
- Never remove comments not related to the current task

### Formatting and Commit

- Imports ordering: external packages, internal modules, type-only imports, alphabetically
- Always auto-format before commit via `pnpm fix:format`
- Always use "Conventional Commits" format: `<type>(<optional scope>): <description>`. Scopes: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.

## Project-Specific Rules

- Colors usage: `.agent/rules/colors.md`
- i18n: use `t` from `@transifex/native` for all user-facing text. Read `.agent/rules/i18n.md` for details
- Truth: `_test/all.json` is the compiled data blob (~30MB)
- NEVER grep the whole file: Use `jq` to filter

  ```bash
  # Filter specific item
  jq '.data[] | select(.id=="<id>" and .type=="<type>")' _test/all.json

  # List all IDs of a type
  jq '.data[] | select(.type=="item") | .id' -r _test/all.json
  ```

- Inheritance: Raw JSON uses `copy-from` - check parent if property missing
- UI Verification: `.agent/rules/ui-verification.md`

## Documentation

### Architecture Decision Records (ADRs)

- Located in `docs/adr/`
- Use Lightweight ADR format (see `docs/adr/README.md`)
- Create ADR for significant architectural decisions

### Key Documentation

- `DEVELOPMENT.md` - Developer setup and workflows
- `docs/architecture.md` - High-level architecture overview
- `docs/reactivity.md` - Svelte reactivity patterns
- `docs/routing.md` - URL-based state management

## Common Workflows

### Adding a New Feature

1. Review relevant docs/patterns before coding
2. Implement with tests (or add tests immediately after)
3. Run targeted checks first; reserve full suite for cross-cutting work
4. Format (`pnpm fix:format`), verify (`pnpm verify`), then manually check UI changes

### Debugging Game Data Issues

1. Filter `_test/all.json` with `jq` (never grep the full blob)
2. Verify flatten/inheritance in `src/data.ts` (`copy-from` path)

### Fixing Type Errors

1. Run `pnpm verify:types`; fix with type guards/`unknown` (never `any`)

## Critical Anti-Patterns

Never add prop-watching `$:` inside `{#key}` blocks  
Never run `pnpm test` by default for tiny/localized changes  
Never commit without running `pnpm verify`
