# Reactivity Guide

This project uses Svelte 5 runes. The important part is not the syntax but the lifecycle model: some parts of the UI are recreated on navigation, while others stay mounted and react in place.

## Architecture

### Route-Keyed Content

Main content pages are mounted behind route keys in [`src/App.svelte`](../src/App.svelte).

- item pages remount when the viewed object changes
- catalog pages remount when the viewed category changes

These views treat their inputs as mount-time context. They are not responsible for reconciling route changes inside the same component instance.

### Fine-Grained Reactive Views

Search results stay mounted and react to changing search state without a keyed remount.

That decision preserves DOM continuity during typing and avoids unnecessary teardown of a view that is expected to change frequently.

### Long-Lived Shell

The app shell stays mounted across navigation.

This includes:

- the header and search UI
- selectors for build, locale, tileset, and mods
- notification and metadata wiring
- the global state bridges that react to navigation and load data

## Rune Usage Rules

### `$state`

Use `$state` for mutable UI state and for stable singleton state objects.

Typical uses in this codebase:

- local shell state such as search input, modal state, and warning deduplication
- small view-local UI state such as disclosure toggles
- long-lived singleton state owned by routing, preferences, and build metadata modules

### `$derived`

Use `$derived` for pure projections.

Typical uses in this codebase:

- turning navigation context into the active page model
- projecting build metadata into shell-friendly values
- converting grouped search results into structures that are easy to render
- computing display limits and similar view-only transformations

Keep `$derived` free of side effects. If a value needs to mutate the DOM, write to a store, or trigger navigation, it belongs in an effect instead.

### `$effect`

Use effects only for imperative synchronization.

In [`src/App.svelte`](../src/App.svelte), effects are used for:

- keeping the local search box aligned with navigation
- resetting scroll position on route changes
- loading data when the effective data context changes
- applying tileset changes to tile rendering
- updating document metadata
- syncing the search subsystem with current input and loaded data
- scheduling background prewarm work when data becomes available

Effects should be narrow, repeatable, and clearly tied to an external side effect.

## Props and Typing

All component props should use typed `$props()`.

This matters most for long-lived maintenance. The codebase relies on props carrying real domain objects and navigation context, so implicit typing makes it easier to smuggle mistakes into render logic.

## Snippets and `{@render}`

Reusable list rendering uses snippets rather than older slot-heavy patterns.

That pattern is useful when a list component owns pagination or disclosure logic, while the caller still controls how each row is rendered.

## Route-Driven Remounting and `untrack`

For route-keyed components, props are treated as mount-time inputs. When a child view needs a stable value for context setup or expensive local structure, it can capture that value with `untrack` instead of trying to mirror prop changes over time.

Use this pattern when all of the following are true:

- the component lives under a keyed route boundary
- a route change should produce a new mount, not incremental reconciliation
- the component needs stable setup values during its lifetime

Do not use `untrack` to suppress legitimate reactivity in long-lived shell code.

## Common Patterns

### Add a New Route-Keyed Page

1. Decide whether the page should remount when its route identity changes.
2. If yes, place it behind a route key in the app shell.
3. Treat its props as mount-time context.
4. Avoid prop-mirroring effects inside the page.

### Add a New Reactive Shell Behavior

1. Start with a pure derived value if the result only affects rendering.
2. Use an effect only if the behavior synchronizes with something outside pure rendering.
3. Keep the effect focused on one job.

### Preserve DOM Continuity During Frequent Updates

If a view is expected to change rapidly, such as search results during typing, prefer keeping it mounted and feeding it reactive state rather than forcing repeated remounts.

## Anti-Patterns

Avoid the following:

- prop-mirroring effects inside route-keyed pages
- side effects inside `$derived`
- untyped `$props()`
- using long-lived shell components as if they were keyed pages
- using keyed remounting for views that are supposed to update continuously in place

## Quick Checklist

- Use `$state` for mutable local state and stable singleton state.
- Use `$derived` for pure computed state.
- Use `$effect` only for side effects.
- Keep route-keyed pages mount-driven.
- Keep search-style views reactive in place when continuity matters.
- Keep snippets typed and rendered via `{@render}`.
