You are an expert frontend and Svelte developer and architect for this project.

# Overview

- **The Hitchhiker's Guide to the Cataclysm: Bright Nights** is an interactive encyclopedia and companion tool for the "Cataclysm: Bright Nights" game.
- It provides a searchable, visual interface for items, monsters, and mechanics.
- **Data-Driven**: The app is a mirror of game data. Upstream source code and data may live at `../Cataclysm-BN`.
- **Additional resources**: Read [[DEVELOPMENT.md]].

# Quick Decision Tree

1.  **Touching schema, fixtures, or filtering JSON?**
    Read [[.agent/rules/data-source.md]].
2.  **Touching UI/layout/colors?**
    Read [[.agent/rules/colors.md]] and [[.agent/rules/ui-verification.md]].
3.  **Adding/changing UI text?**
    Read [[.agent/rules/localization.md]].
4.  **Using browser agent?**
    Read [[.agent/rules/browser-nightly.md]].
5.  **Starting a new feature or fixing a bug?**
    Check [[.agent/workflows/]] for [[.agent/workflows/fix-issue.md]], [[.agent/workflows/create-adr.md]], [[.agent/workflows/create-feature.md]], etc.

# Tech Stack

- **Core**: `TypeScript` 5, `Svelte` 4 + `Vite` 5.
- **Testing**: `vitest`, `puppeteer`.
- **Styling**: Scoped CSS, custom design tokens in `colors.ts`.
- **Package Manager**: `pnpm`.
- **Key Files**:
  - `src/App.svelte`: Entry component.
  - `src/data.ts`: Central data store logic (`CBNData`).
  - `src/types.ts`: Core TypeScript definitions.
  - `src/routing.ts`: URL-based routing logic.

# Project Structure

- `src/`: Application source code.
  - `src/types/`: Type-specific logic and specialized components (e.g., `src/types/item/`).
  - `src/assets/`: Static assets and icons.
- `scripts/`: Development scripts (fetching data, generating CSS/sitemaps).
- `_test/`: Data fixtures for testing.
  - `all.json`: Main game data dump (downloaded via `pnpm fetch:fixtures`).
- `public/`: Static files served by the app.
- `.agent/`: Instructions and workflows for AI agents.

# Useful Commands

### Development

- **Install**: `pnpm install --frozen-lockfile`
- **Dev Server**: `pnpm dev` (usually on port 3000)
- **Format & Fix**: `pnpm fix:format`
- **Type Check**: `pnpm verify:types`

### Testing

- **Run All**: `pnpm test`
- **Schema Only**: `pnpm vitest schema.test.ts --run --bail 1`
- **Spawn Logic**: `pnpm vitest spawnLocations.test.ts --run`

### Data Management

- **Fetch Default Data**: `pnpm fetch:fixtures`
- **Fetch Nightly Data**: `pnpm fetch:fixtures:nightly`

# Development Guidelines

## Key Principles

- **Clean Code**: Prioritize readability and maintainability.
- **SRP**: Keep components and modules focused on a single responsibility.
- **TDD**: When fixing bugs, always start with a failing test case.
- **Data Immortality**: The `data` store is effectively immutable; replace it wholesale on version changes.

## Best Practices

- **Reactivity**: Use `$:` for derived state only. Avoid side effects in reactive statements. See [DEVELOPMENT.md](DEVELOPMENT.md#L3-L33).
- **Architecture**: Move heavy data logic into `.ts` modules, keep `.svelte` components focused on rendering.
- **Styling**: Never mix game palette (`--cata-color-*`) with app UI colors.
- **Localization**: Use `t()` from `@transifex/native`. Avoid string concatenation for translatable strings.

## Engineering Hygiene

- **Environment**: **Always** disable terminal shell history to avoid pollution: `unset HISTFILE; unsetopt share_history`.
- **Cross-Version Compatibility**: Maintain compatibility with stable and nightly Cataclysm-BN where feasible.

# Testing Strategy

- **Integration Tests (`src/all.X.test.ts`)**: Renders every item to catch runtime errors and binding issues.
- **Schema Tests (`src/schema.test.ts`)**: Validates that game data matches expected TypeScript interfaces.
- **Feature Tests**: Unit and integration tests for specific functionality (Search, Routing, Spawning).
- **UI Verification**: Use the browser subagent to visually verify changes against the local dev server.

# Boundaries & Security

- **Secrets**: Never commit or log API keys or sensitive environment variables.
- **History**: Ensure `terminal-history.md` rule is followed (unset `HISTFILE`).
- **Data Volume**: Don't `cat` `_test/all.json`. Use `jq` filters as specified in `data-source.md`.
