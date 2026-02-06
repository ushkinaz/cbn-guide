# Agent Development Guide

## Project Overview

- A Svelte 4 + Vite 5 application that provides an offline-capable wiki for Cataclysm: Bright Nights game data.
- It provides a searchable, visual interface for items, monsters, and mechanics.
- The app is a mirror of game data. Upstream source code and data may live at `../Cataclysm-BN

## Tech Stack

- Node.js: 22
- pnpm: 10.x (see `packageManager` in package.json)
- Core: `TypeScript` 5, `Svelte` 4 + `Vite` 5.
- Testing: `vitest`, `puppeteer`.
- Styling: Scoped CSS, custom design tokens in `/src/assets/game-palette.css` and `src/assets/design.css`.
- Python: 3.x for auxiliary scripts.

## Project Structure

- `src/`: Application source code.
  - `src/App.svelte`: Entry component.
  - `src/data.ts`: Central data store logic (`CBNData`).
  - `src/types.ts`: Core TypeScript definitions.
  - `src/routing.ts`: URL-based routing logic.
  - `src/types/`: Type-specific logic and specialized components (e.g., `src/types/item/`).
  - `src/assets/`: Static assets and icons.
- `scripts/`: Development scripts (fetching data, generating CSS/sitemaps).
- `_test/`: Data fixtures for testing.
  - `all.json`: Main game data dump (downloaded via `pnpm fetch:fixtures`).
- `public/`: Static files served by the app.

## Build, Lint & Test Commands

### Development

- `pnpm i` - install dependencies
- `pnpm dev` - Start Vite dev server at http://localhost:3000
- `pnpm build` - Build production bundle
- `pnpm preview` - Preview production build

### Code Quality

- `pnpm verify` - Run all checks
- `pnpm verify:format` - Check formatting
- `pnpm verify:types` - Run `svelte-check` and `tsc`
- `pnpm fix:format` - Auto-fix formatting issues

### Testing

- `pnpm test --bail 1` - Full test suite (verify + vitest run)
- `pnpm vitest run <path/to/test.ts>` - Run single test
- `pnpm test:nightly` - Test with the latest nightly data

#### Key Test Files

- `src/all.X.test.ts` - Integration tests rendering all game items (split into chunks)
- `src/routing.test.ts` - Routing logic tests
- `src/schema.test.ts` - Validates game data schema
- `src/search.test.ts` - Search functionality

### Data & Scripts

- `pnpm fetch:fixtures:nightly` - Download nightly test data required for tests
- `pnpm fetch:builds` - Download builds.json index

## Core Architecture

### Route-Driven Remounting

Main content components (`Thing`, `Catalog`, `SearchResults`) are wrapped in `{#key}` blocks and destroyed/recreated on every navigation. This means:

- DO NOT use `$:` reactive statements for prop changes inside keyed components
- DO use `$:` for long-lived components (app shell, header, footer)
- DO use `$:` for store subscriptions that update without remount (e.g., `$tileData`)

### State Management

- Global Data: `data` store from `src/data.ts` - write-once per page load
- URL as Source of Truth: Version and search params drive app state (see `docs/routing.md`)
- `docs/reactivity.md` for comprehensive reactivity patterns.

## Code Style Guidelines

### TypeScript

- Strict mode enabled: `strict: true`, `checkJs: true`
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
- Always use Conventional Commits forma: `<type>(<optional scope>): <description>`. Scopes: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.

## Project-Specific Rules

### Colors (.agent/rules/colors.md)

- Game Colors: `--cata-color-*` (from game data) - ONLY for game entities
- App UI Colors: Hex/HSL from `src/assets/design.css` - ONLY for buttons, nav, text
- NEVER mix them

### Localization (.agent/rules/localization.md)

Use `t` from `i18n.ts` for ALL user-facing text:

```sveltehtml
// Static
t("Text")

// Interpolation
t("Cost: {n}", { n: 22 })

// In Svelte
<p>{t("Hello {name}", { userName })}</p>

// AVOID: String concatenation
t("A") + b  // Wrong
```

Transifex note: extraction only sees direct string-literal keys in `t("...")`. Calls like `t(cat.label)` or `t(plural(type))` are not extracted.

### Data Source (.agent/rules/data-source.md)

- Truth: `_test/all.json` is the compiled data blob (~30MB)
- NEVER read the whole file: Use `jq` to filter

  ```bash
  # Filter specific item
  jq '.data[] | select(.id=="<id>" and .type=="<type>")' _test/all.json

  # List all IDs of a type
  jq '.data[] | select(.type=="item") | .id' -r _test/all.json
  ```

- Inheritance: Raw JSON uses `copy-from` - check parent if property missing
- Resolution: Use `src/data.ts` (`CBNData._flatten`) for resolved values

### Running commands

Always start new terminal sessions with `[ -f "$HOME/.env_ai" ] && . "$HOME/.env_ai" || true`

### UI Verification (.agent/rules/ui-verification.md)

When making UI changes, verify with `browser_subagent` on local dev server.

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

1. Read relevant documentation (`DEVELOPMENT.md`, ADRs)
2. Check existing patterns in similar components
3. Write tests first (if applicable)
4. Implement feature following code style
5. Format code with `pnpm fix:format`
6. Run `pnpm verify` before committing
7. Test in browser if UI changes

### Debugging Game Data Issues

1. Use `jq` to filter `_test/all.json`
2. Check `src/data.ts` for resolution logic (`_flatten` method)
3. Verify schema with `pnpm vitest --run schema.test.ts --bail 1`
4. Check for `copy-from` inheritance in raw JSON

### Fixing Type Errors

1. Run `pnpm verify:types` to see all errors
2. Never use `any` - use `unknown` and type guards instead

## Critical Anti-Patterns

Never install tools – Ask user and provide command  
Never add prop-watching `$:` inside `{#key}` blocks  
Never mix game colors (`--cata-color-*`) with app UI colors  
Never concatenate translated strings – use interpolation  
Never commit without running `pnpm verify`
