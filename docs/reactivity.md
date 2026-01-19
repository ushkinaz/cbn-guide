# Reactivity in CBN Guide

This project uses **route-driven remounting** for main content. The key architecture decision: wrap content in `{#key}` blocks that destroy and recreate components on navigation.

## Architecture

### Remounted on Every Route Change
- `{#key item}` → remounts `Thing` and `Catalog`
- `{#key search}` → remounts `SearchResults`
- Home view is in the `{:else}` branch, remounts when switching views

**Implication**: Prop-change reactivity (`$:`) is unnecessary inside these components—they start fresh on every navigation.

### Long-Lived (Not Remounted)
- App shell: header, search bar, footer
- Global stores: `data` and `tileData`

## Data Model

- `data` store is **write-once** per page load (`setVersion` throws if called twice)
- Version/language changes trigger **full page reload**
- Tileset changes update `tileData` **without** reload

## When to Use `$:` Reactive Statements

**Use `$:` for:**
- **Store subscriptions** that change without remount (e.g., `$tileData` in `ItemSymbol.svelte`)
- **Local state derivation** (e.g., `expanded` in `LimitedList.svelte`)
- **App-level logic** in long-lived components (e.g., document title in `App.svelte`)

**Avoid `$:` for:**
- Prop changes inside `Thing`, `Catalog`, `SearchResults` and descendants (keyed blocks handle this)
- Any component that only exists inside `{#key}` blocks and doesn't observe changing stores

## Legacy Anti-Patterns

Some components still use discouraged patterns:
- `SearchResults.svelte`: `$: setContext("data", data)` — doesn't update children reactively, only appears to work because component is keyed and recreated

## Summary

Main content is **route-driven**: navigation remounts the page. Use `$:` for stores and local state, but **prop-change reactivity is unnecessary** inside keyed content blocks.
