# Development Guide

## Overview

`cbn-guide` is a Svelte 5 + Vite 7 application that renders Cataclysm: Bright Nights data from external JSON snapshots. The app is mostly a reader of a very large truth that lives elsewhere. Its job is to load that truth, index it once, and let the URL decide what should be visible.

Core constraints:

- The main data blob is large (`all.json` is roughly 30 MB), so the app prefers coarse reload boundaries over clever incremental mutation.
- The URL is the source of truth for routing and user-visible configuration.
- Svelte 5 runes are the reactive model.

Useful companion docs:

- [docs/architecture.md](docs/architecture.md)
- [docs/reactivity.md](docs/reactivity.md)
- [docs/routing.md](docs/routing.md)
- [docs/adr/README.md](docs/adr/README.md)

## Prerequisites

- Node.js: 24 recommended. Repository engines currently allow `^20.19.0 || >=22.12.0`.
- pnpm: 10.x
- Python: 3.x for image/font generation scripts such as `gen-ogimage.py` and `gen-unifont.py`
- `jq`/`jaq`: strongly recommended for inspecting `_test/all.json` without grepping the void

## Initial Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Fetch fixtures for local testing and data inspection:

   ```bash
   pnpm fetch:fixtures
   ```

   For nightly fixtures:

   ```bash
   pnpm fetch:fixtures:nightly
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

## Architecture Mental Model

### The Three UI Lifetimes

1. **Long-lived shell**

   `App.svelte` stays mounted and owns startup, routing sync, search input state, metadata updates, mod selector UI, and tileset persistence.

2. **Route-keyed detail/catalog views**

   `Thing.svelte` and `Catalog.svelte` are rendered behind a `{#key item}` block in `App.svelte`. When the route changes, they are destroyed and recreated. They should treat props as mount-time inputs, not as a stream to diff against.

3. **Fine-grained search results**

   `SearchResults.svelte` is intentionally **not** wrapped in a `{#key}` block. Search updates are frequent, and preserving DOM state is cheaper than remounting while the user types.

### Data Flow

The core data flow, including bootstrap sequencing and runtime asset loading, is documented in detail in [docs/architecture.md#core-data-flow](docs/architecture.md#core-data-flow).

The app reads route state, preferences, and builds data to form an effective navigation context, which in turn triggers data loads and UI updates.

### Why This Design Exists

- Version, language, tileset, and mod changes can imply a different dataset or asset universe. The code accepts this and uses hard reload boundaries where needed.
- Item and catalog pages are keyed so they can stay simple. The route change is the reset mechanism.
- Search stays unkeyed because remounting on every keystroke would waste work and disrupt the interface.

## Svelte 5 Reactivity Rules

This codebase is on Svelte 5 runes.

### `$state`

Use `$state` for mutable local UI state.

Real examples:

- `App.svelte`: `scrollY`, `builds`, `resolvedVersion`, modal state, metadata
- `LimitedList.svelte`: `expanded`
- `search-state.svelte.ts`: internal reactive search state object

### `$derived`

Use `$derived` for pure computed values with no side effects.

Real examples:

- `App.svelte`: `item` projected from navigation context
- `SearchResults.svelte`: `results` and `matchingObjectsList`
- `LimitedList.svelte`: `initialLimit` and `realLimit`

Do not write to stores, touch the DOM, or mutate state inside `$derived`.

### `$effect` and `$effect.pre`

Use effects only for imperative synchronization.

Real examples:

- `App.svelte`: sync route changes into local `search`
- `App.svelte`: update document title and meta description
- `App.svelte`: call `searchState.sync(search, $data)`
- `App.svelte`: schedule derived-cache prewarming with `requestIdleCallback`

### Typed `$props()`

Component props should be typed explicitly.

```svelte
<script lang="ts">
import type { CBNData } from "./data";

interface Props {
  data: CBNData;
  search: string;
}

let { data, search }: Props = $props();
</script>
```

Do not use untyped `$props()` destructuring.

### Snippets and `{@render}`

Svelte 5 snippets are the preferred way to pass list/item rendering behavior.

Real examples:

- `LimitedList.svelte`
- `Catalog.svelte`
- `SearchResults.svelte`

Pattern:

```svelte
<LimitedList items={results} limit={25}>
  {#snippet children({ item })}
    <ItemLink type="item" id={item.id} />
  {/snippet}
</LimitedList>
```

Inside the reusable component:

```svelte
<li>{@render children?.({ item })}</li>
```

### `untrack` in Route-Keyed Components

`Thing.svelte`, `Catalog.svelte`, and several type views use `untrack(...)` to freeze props at mount time. This is deliberate. In keyed pages, the route remount is the update boundary.

Use `untrack` when:

- the component is mounted under a `{#key}` route boundary
- you want a stable local value or context input for that mount

Do not add effects that mirror props back into local state inside those keyed pages.

### Anti-Patterns

Avoid these:

- Svelte 4-style `$:` prop mirroring
- side effects inside `$derived`
- `setContext(...)` inside a reactive effect
- assuming all route-driven views are keyed; `SearchResults.svelte` is intentionally not

## Key Files and Responsibilities

| File                     | Responsibility                                                                          | Important side effects                                                                |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `App.svelte`             | Holds long-lived UI state, chooses top-level view to render based on navigation context | Reacts to navigation changes by loading data, updates document metadata, syncs search |
| `routing.svelte.ts`      | URL parsing, building URLs, raw history synchronization                                 | uses `history.pushState` and `history.replaceState`                                   |
| `navigation.svelte.ts`   | Effective navigation context and app link policy                                        | Integrates routing, preferences, and builds; exposes navigation actions               |
| `data.ts`                | Orchestrates data load, locale fallback, mod merge, and flattening for `CBNData`        | Calls `data-loader.ts` to fetch external JSON, replaces the global `data` store       |
| `search-state.svelte.ts` | Search indexing and debounced result production                                         | rebuilds index when `CBNData` changes, debounces search by `150ms` outside tests      |
| `Thing.svelte`           | Renders a single object view                                                            | sets `data` context once per mount                                                    |
| `Catalog.svelte`         | Renders a type catalog grouped by domain-specific rules                                 | sets `data` context once per mount                                                    |
| `SearchResults.svelte`   | Renders grouped search results without route-keyed remounting                           | derives from `searchState.results` or injected `results`                              |
| `LimitedList.svelte`     | Reusable truncated-list UI using snippets                                               | expands to full list in tests by using `Infinity`                                     |

## State Ownership

| State              | Type                  | Owner                    | Scope     | Notes                                           |
| ------------------ | --------------------- | ------------------------ | --------- | ----------------------------------------------- |
| Navigation Context | derived state         | `navigation.svelte.ts`   | global    | Combines route, prefs, and builds logic         |
| `data`             | writable Svelte store | `data.ts`                | global    | replaced wholesale when a new dataset is loaded |
| `tileData`         | store/helper module   | `tile-data.ts`           | global    | updated from `App.svelte` when tileset changes  |
| `searchState`      | rune-based singleton  | `search-state.svelte.ts` | global    | owns debounced query results                    |
| `search`           | local rune state      | `App.svelte`             | shell     | synced from URL and user input                  |
| `item`             | `$derived`            | `App.svelte`             | shell     | projected from navigation context via helper    |
| Build Metadata     | local rune state      | `builds.svelte.ts`       | global    | Resolves aliases like `stable` and `nightly`    |
| `expanded`         | local rune state      | `LimitedList.svelte`     | component | UI-only disclosure state                        |

## Routing and Reload Boundaries

Routing is deeply layered integrating URL state, browser preferences, build metadata, and a derived navigation context. For comprehensive details on navigation rules, link policy, and ownership, see [docs/routing.md](docs/routing.md).

### Soft navigation

SPA navigation happens when the destination keeps the same active data context (version, locale, mods).

Mechanisms, exposed primarily by `navigation.svelte.ts`:

- `navigateTo(...)`: move to an item, catalog or search view.
- `updateSearchRoute(...)`: updates query string without full reload for immediate search UX.
- Internal link clicks are intercepted where possible if data context doesn't change.

### Hard navigation

Full reloads are used when the navigation intent changes the required dataset:

- version changes
- language changes
- mod changes

Such changes are handled by dedicated actions in `navigation.svelte.ts` which ensure a full navigation trigger.

## Working with Game Data

### Fixture Inspection

Never grep `_test/all.json`. Use `jq`.

Examples:

```bash
# Inspect one object
jq '.data[] | select(.id=="rock" and .type=="item")' _test/all.json

# List IDs for a type
jq '.data[] | select(.type=="item") | .id' -r _test/all.json
```

### Important Data Facts

- Raw game JSON often uses `copy-from`; missing fields may live in a parent object.
- `CBNData` handles flattening and indexing after fetch.
- Locale fallback is explicit: if a requested locale is missing, `data.loadData(...)` falls back to English and `App.svelte` shows a warning.
- Active mods come from the URL, but unknown mod IDs are removed after the loaded dataset resolves the real active mod list.

## Testing

Prefer targeted tests first. Full render regressions are expensive and should be chosen because the change deserves them, not because anxiety asked for a sacrifice.

### Recommended Workflows

- Tiny/localized change:

  ```bash
  pnpm test:changed --maxWorkers=50% --bail 1
  ```

- Normal feature or bugfix:

  ```bash
  pnpm lint
  pnpm check
  pnpm test:fast
  ```

- Cross-cutting data-model, routing, or rendering change:

  ```bash
  pnpm lint
  pnpm check
  pnpm gen:mod-tests
  pnpm vitest run src --maxWorkers=50% --bail 1
  ```

### Command Reference

#### Code Quality

- `pnpm lint`: runs `prettier -c .`
- `pnpm lint:fix`: runs `prettier -w .`
- `pnpm check`: runs `pnpm check:types`
- `pnpm check:types`: runs `svelte-check && tsc --noEmit`

#### Test Scripts

- `pnpm test`: runs `lint`, `check`, `gen:mod-tests`, then `test:full`
- `pnpm test:full`: runs `vitest run src`
- `pnpm test:fast`: excludes `all.*.test.ts` and `__mod_tests__/**`
- `pnpm test:render:core`: runs only the core render regression files
- `pnpm test:render:mods`: runs only generated mod render tests
- `pnpm test:changed`: runs `lint`, `check`, then `vitest run --changed --run`

### Important Test Files

- `all.*.test.ts`: renders large slices of the dataset to catch runtime/template failures
- `routing.test.ts`: routing and URL behavior
- `schema.test.ts`: schema validation against upstream data changes
- `data.test.ts`: `CBNData` behavior
- `search.test.ts`: search rendering and behavior
- `__mod_tests__/mod.*.test.ts`: generated per-mod render isolation tests

Why generated mod tests exist:

- rendering the mod matrix in a single worker is memory-heavy
- `pnpm gen:mod-tests` creates one Vitest file per mod
- isolated workers give memory a chance to die with dignity between runs

## Scripts

### Data and Assets

- `pnpm fetch:fixtures`: fetch default fixtures for local dev and tests
- `pnpm fetch:fixtures:nightly`: fetch nightly fixtures
- `pnpm fetch:builds`: fetch `builds.json`
- `pnpm fetch:icons`: fetch or render icon assets
- `pnpm gen:css`: generate palette CSS
- `pnpm gen:sitemap`: generate `public/sitemap.xml`
- `pnpm gen:ogimage`: generate the Open Graph image
- `pnpm gen:unifont`: subset Unifont for the current data

### Benchmarks

- `pnpm bench:node`
- `pnpm bench:browser`
- `pnpm bench:browser:batch`
- `pnpm bench:report`

### Transifex

- `pnpm i18n:push`: push extracted UI strings
- `pnpm i18n:download`: download existing translations to local JSON
- `pnpm i18n:upload`: upload updated translations from local JSON

Example workflow:

```bash
TRANSIFEX_API_TOKEN='1/...' pnpm i18n:download --out='./tmp/transifex-download'
# translate JSON files with your workflow
TRANSIFEX_API_TOKEN='1/...' pnpm i18n:upload --dir='./tmp/transifex-download'
```

Important boundary:

- Transifex extraction only sees literal `t("...")` calls
- dynamic expressions such as `t(variable)` do not create new extractable keys

## Common Maintenance Recipes

### Add UI-only local state

Use `$state` in the component that owns the interaction.

Good:

- disclosure state
- modal open/closed state
- loading spinners for a local async action

Bad:

- mirroring route props into local state inside `Thing.svelte` or `Catalog.svelte`

### Add a computed view of existing state

Use `$derived` when the value is a pure function of other state.

Good:

- filtered lists
- grouped search results
- derived limits or labels

Bad:

- DOM writes
- store writes
- async work

### Add a route-driven page behavior

1. Decide whether the behavior belongs to the long-lived shell or a keyed route page.
2. If it belongs to `Thing` or `Catalog`, prefer mount-time setup and `untrack(...)`.
3. If it belongs to the shell, react to `$page`, `search`, or `$data` with `$effect`.

### Add a new search presentation

1. Put indexing/search logic in `search-engine.ts` or `search-state.svelte.ts`.
2. Keep `SearchResults.svelte` focused on grouping and rendering.
3. Use snippets and `LimitedList.svelte` for repeated item rendering.
4. Do not wrap the whole search results tree in a `{#key search}` block.

### Change URL behavior safely

Use actions from `navigation.svelte.ts` rather than touching history directly or hardcoding `href` changes. This ensures data context and history state are managed correctly according to the rules in [docs/routing.md](docs/routing.md).

### Add user-facing text

- Use `t` from `@transifex/native` for UI strings
- Use `i18n/game-locale.ts` for game-data translations
- Keep extraction constraints in mind: literal `t("...")` strings are safest

### Add or change architectural behavior

If the change alters reload boundaries, routing authority, data lifetime, or mod resolution semantics, add or update an ADR in `docs/adr/`.

## Limits and Edge Cases

- `SearchResults.svelte` is not keyed. Advice that assumes all top-level route views are remounted is wrong.
- `data` is replaced wholesale when a new dataset is loaded. Code that assumes incremental mutation of the active dataset will eventually lie to you.
- Search is debounced by `150ms` outside tests and by `0ms` in tests.
- `LimitedList.svelte` expands to `Infinity` during tests so hidden render failures do not evade the suite.
- Malformed URLs are canonicalized and rewritten using `history.replaceState` before the app consumes them, managed by `routing.svelte.ts` alongside build metadata.
- Local storage access for tileset preference is wrapped in `try/catch` because browser security modes can deny it.
