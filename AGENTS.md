# Agent Development Guide

This guide is for AI coding agents working on the Cataclysm: Bright Nights Guide project.

## Project Overview

- A Svelte 4 + Vite 5 application that provides an offline-capable wiki for Cataclysm: Bright Nights game data.
- It provides a searchable, visual interface for items, monsters, and mechanics.
- The app is a mirror of game data. Upstream source code and data may live at `../Cataclysm-BN

## Tech Stack

- **Node.js**: 22
- **pnpm**: 10.x (see `packageManager` in package.json)
- **Core**: `TypeScript` 5, `Svelte` 4 + `Vite` 5.
- **Testing**: `vitest`, `puppeteer`.
- **Styling**: Scoped CSS, custom design tokens in `colors.ts`.
- **Python**: 3.x (for Unifont generation)

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
- `.agent/`: Instructions and workflows for AI agents.

## Build, Lint & Test Commands

### Development

- `pnpm i` - install dependencies
- `pnpm dev` - Start Vite dev server at http://localhost:3000
- `pnpm build` - Build production bundle
- `pnpm preview` - Preview production build

### Code Quality

- `pnpm verify` - Run all checks (formatting + types)
- `pnpm verify:format` - Check Prettier formatting
- `pnpm verify:types` - Run `svelte-check` and `tsc`
- `pnpm fix:format` - Auto-fix Prettier issues

### Testing

- `pnpm test` - Full test suite (verify + vitest run)
- **Run single test**: `pnpm vitest run <path/to/test.ts>`
- `pnpm test:nightly` - Test with latest nightly data

#### Key Test Files

- `src/all.X.test.ts` - Integration tests rendering all game items (split into chunks)
- `src/schema.test.ts` - Validates game data schema
- `src/types/item/spawnLocations.test.ts` - Loot spawn probability logic
- `src/search.test.ts` - Search functionality

### Data & Scripts

- `pnpm fetch:fixtures` - Download test data (required for testing)
- `pnpm fetch:fixtures:nightly` - Download nightly test data
- `pnpm gen:css` - Generate colors.css from game data
- `pnpm gen:unifont` - Generate Unifont subset
- `pnpm gen:sitemap` - Generate sitemap.xml

## Core Architecture

### Route-Driven Remounting

Main content components (`Thing`, `Catalog`, `SearchResults`) are wrapped in `{#key}` blocks and **destroyed/recreated on every navigation**. This means:

- **DO NOT** use `$:` reactive statements for prop changes inside keyed components
- **DO** use `$:` for long-lived components (app shell, header, footer)
- **DO** use `$:` for store subscriptions that update without remount (e.g., `$tileData`)

### State Management

- **Global Data**: `data` store from `src/data.ts` - write-once per page load
- **URL as Source of Truth**: Version and search params drive app state (see `docs/routing.md`)

See `docs/reactivity.md` for comprehensive reactivity patterns.

## Code Style Guidelines

### TypeScript

- **Strict mode enabled**: `strict: true`, `checkJs: true`
- **Always use explicit types** for function parameters and return values
- **Prefer `type` over `interface`** for type definitions
- **Use discriminated unions** for complex state (see `src/types.ts`)
- **No implicit any**: All values must be typed

### Imports

```typescript
// External packages first, alphabetically
import { fade } from "svelte/transition";
import type { BuildInfo } from "./routing";

// Internal modules, alphabetically
import CategoryGrid from "./CategoryGrid.svelte";
import { data, singularName } from "./data";
import { t } from "./i18n";

// Type-only imports use `type` keyword
import type { SupportedTypesWithMapped } from "./types";
```

### Naming Conventions

- **Files**: PascalCase for components (`Thing.svelte`, `SearchResults.svelte`)
- **Files**: camelCase for utilities (`data.ts`, `routing.ts`)
- **Variables/Functions**: camelCase (`loadRoute`, `buildUrl`)
- **Types/Interfaces**: PascalCase (`BuildInfo`, `SupportedTypesWithMapped`)
- **Constants**: SCREAMING_SNAKE_CASE (`DEFAULT_TILESET`, `GAME_REPO_URL`)
- **Private fields**: underscore prefix (`_raw`, `_byType`)

### Formatting

- **Prettier**: Auto-formats via `pnpm fix:format`
- **No semicolons**: Prettier config omits semicolons
- **Double quotes**: For strings
- **2-space indentation**: Standard across project

### Svelte Components

- Use `<script lang="ts">` for TypeScript
- Component-scoped styles preferred over global
- Use `{#key}` for explicit remounting
- Mark intentional a11y violations with `<!-- svelte-ignore a11y-* -->`

### Error Handling

- **Try-catch for I/O**: localStorage, fetch, etc. with fallback behavior
- **Swallow security errors**: localStorage in incognito mode (see `App.svelte:92`)
- **Console logging**: Use `console.error()` for critical failures
- **User feedback**: Use Loading component or inline messages

### Comments

- **JSDoc**: For public functions and complex logic
- **Inline comments**: For non-obvious decisions
- **TODO comments**: Format as `//TODO: description`

## Project-Specific Rules

### Colors (.agent/rules/colors.md)

- **Game Colors**: `--cata-color-*` (from game data) - ONLY for game entities
- **App UI Colors**: Hex/HSL from `global.css` - ONLY for buttons, nav, text
- **NEVER mix them**

### Localization (.agent/rules/localization.md)

Use `t` from `@transifex/native` for ALL user-facing text:

```sveltehtml
// Static
t("Text")

// Interpolation
t("Cost: {n}", { n: value })

// In Svelte
<p>{t("Hello {name}", { name })}</p>

// AVOID: String concatenation
t("A") + b  // ❌ Wrong
```

### Data Source (.agent/rules/data-source.md)

- **Truth**: `_test/all.json` is the compiled data blob (~30MB)
- **NEVER read whole file**: Use `jq` to filter

  ```bash
  # Filter specific item
  jq '.data[] | select(.id=="<id>" and .type=="<type>")' _test/all.json

  # List all IDs of a type
  jq '.data[] | select(.type=="item") | .id' -r _test/all.json
  ```

- **Inheritance**: Raw JSON uses `copy-from` - check parent if property missing
- **Resolution**: Use `src/data.ts` (`CBNData._flatten`) for resolved values

### Terminal History (.agent/rules/terminal-history.md)

**Always** start new terminal sessions with:

```zsh
unset HISTFILE; unsetopt share_history
```

### UI Verification (.agent/rules/ui-verification.md)

When making UI changes, verify with `browser_subagent` on local dev server.

## Documentation

### Architecture Decision Records (ADRs)

- Located in `docs/adr/`
- Use Lightweight ADR format (see `docs/adr/README.md`)
- Create ADR for significant architectural decisions

### Key Documentation

- `DEVELOPMENT.md` - Developer setup and workflows
- `docs/reactivity.md` - Svelte reactivity patterns
- `docs/routing.md` - URL-based state management

## Common Workflows

### Adding a New Feature

1. Read relevant documentation (`DEVELOPMENT.md`, ADRs)
2. Check existing patterns in similar components
3. Write tests first (if applicable)
4. Implement feature following code style
5. Run `pnpm verify` before committing
6. Test in browser if UI changes

### Debugging Game Data Issues

1. Use `jq` to filter `_test/all.json`
2. Check `src/data.ts` for resolution logic (`_flatten` method)
3. Verify schema with `pnpm vitest --run schema.test.ts --bail 1`
4. Check for `copy-from` inheritance in raw JSON

### Fixing Type Errors

1. Run `pnpm verify:types` to see all errors
2. Check `tsconfig.json` - strict mode enabled
3. Never use `any` - use `unknown` and type guards instead
4. For Svelte components, ensure `lang="ts"` in script tag

### Running Specific Tests

```bash
# Single file
pnpm vitest run src/data.test.ts

# With bail on first failure
pnpm vitest --run schema.test.ts --bail 1

# Watch mode
pnpm vitest --watch src/search.test.ts
```

## Critical Anti-Patterns

❌ **Never install tools** - Ask user and provide command  
❌ **Never** use `$:` for side effects - use `onMount` or event handlers  
❌ **Never** add prop-watching `$:` inside `{#key}` blocks  
❌ **Never** call `$: setContext(...)` - doesn't work  
❌ **Never** mix game colors (`--cata-color-*`) with app UI colors  
❌ **Never** concatenate translated strings - use interpolation  
❌ **Never** commit without running `pnpm verify`

## Helpful Tips

- **Browser testing**: Dev server supports hot reload, use for quick iteration
- **Performance**: Integration tests (`all.X.test.ts`) are split to prevent timeouts
