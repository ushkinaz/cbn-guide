# Reactivity in CBN Guide (Svelte 5)

This project is fully on **Svelte 5 runes**. The core architectural rule is still the same: main pages are route-keyed and remounted on navigation.

## Architecture

### Route-Keyed Content (Remounted)

Main content is mounted behind `{#key}` blocks in `App.svelte`:

- `{#key item}` remounts `Thing` and `Catalog`
- `{#key search}` remounts `SearchResults`
- Home dashboard lives in an `{:else}` branch and remounts when view mode changes

Because these components are recreated, they should not implement prop-diff logic for route changes.

### Long-Lived Shell (Not Remounted)

These areas stay alive and should use runes for reactive behavior:

- App shell UI (header/search/footer controls)
- Global stores (`data`, `tileData`, routing `page` store)
- UI-only local state (expanded/collapsed controls, loading flags)

## Rune Usage Rules

### `$state`

Use for mutable local UI state:

- `App.svelte`: `scrollY`, `builds`, `resolvedVersion`, warning visibility
- `LimitedList.svelte`: `expanded`

### `$derived`

Use for pure computed values:

- `App.svelte`: `item` from `$page.route.item`
- `SearchResults.svelte`: `matchingObjectsList` from `$searchResults`
- `LimitedList.svelte`: computed limits

Keep `$derived` side-effect free.

### `$effect` and `$effect.pre`

Use effects only for imperative synchronization:

- URL-driven sync and scroll behavior in `App.svelte`
- Reset-on-input-change behavior in list components (`$effect.pre` in `LimitedList.svelte`)

Effects should be idempotent and limited to explicit side effects (DOM, metrics, navigation, store writes).

## Props and Typing

All component props use typed `$props()`.

```svelte
<script lang="ts">
interface Props {
  data: CBNData;
  search: string;
}

let { data, search }: Props = $props();
</script>
```

Do not use untyped `$props()` destructuring.

## Snippets and `{@render}`

Reusable list rendering uses Svelte 5 snippets:

```svelte
<LimitedList items={results} limit={25}>
  {#snippet children({ item: result })}
    <ItemLink type={mapType(result.item.type)} id={result.item.id} />
  {/snippet}
</LimitedList>
```

Consumer components should render optional snippets with `{@render ...}`.

## Route-Driven Remounting and `untrack`

For keyed route components where props are treated as mount-time inputs, use `untrack` when you need a stable local value (for context wiring or one-time setup) instead of effect-based prop mirroring.

## Anti-Patterns

Avoid the following:

- Prop-mirroring effects inside route-keyed pages (`Thing`, `Catalog`, `SearchResults`)
- Side effects inside `$derived`
- Untyped `$props()`
- Reintroducing legacy compatibility patterns (`svelte/legacy`, component constructor API assumptions)

## Quick Checklist

- Use `$state` for mutable local state
- Use `$derived` for computed state
- Use `$effect` only for side effects
- Keep route-keyed pages mount-driven, not prop-diff-driven
- Keep snippets typed and rendered via `{@render}`
