---
name: "add-data-index"
description: "Add or revise lookup indexes in `src/data.ts` for upstream data. Use when need to expose a new reverse lookup such as 'what objects yield item X', decide between lazy `ReverseIndex` and constructor-built maps, add a public accessor near similar helpers, or update tests/components that consume the new index."
---

# Add Data Index

Add the smallest index that matches the lookup.
Follow the existing shape of `src/data.ts` instead of inventing a new indexing style.

## Decide the Pattern

Use a lazy `ReverseIndex` when the lookup is naturally:

- derived from a flattened object
- keyed by some downstream id such as an item id or trap id
- expected to return source objects like `Monster[]`, `Trap[]`, `Item[]`, `furniture[]`
- safe to build on first use instead of during construction

Good local examples in `src/data.ts`:

- `#bashFromFurnitureIndex` / `bashFromFurniture`
- `#bashFromTerrainIndex` / `bashFromTerrain`
- `#disarmTrapIndex` / `disarmTrap`
- `#dissectedFromIndex` / `dissectedFrom`

Use an eager constructor-built map only when the index is part of the dataset's core invariants or cannot be expressed as a plain reverse lookup.

Good local examples:

- `_monsterVisibilityById` built by `_indexMonsterVisibilityPolicy()`
- inline constructor indexing such as `_toolReplacements`

Do not add a custom eager pass for an ordinary reverse lookup just because it feels straightforward. Constructor work becomes permanent weight.

## Workflow

1. Find the nearest existing pattern in `src/data.ts`.

   Match both the source type and the return shape before writing new code.

2. Choose the public return type first.

   Prefer returning the source objects directly.
   Only introduce a wrapper type when callers need more than the source object itself.

3. Write the key extraction logic.

   Rules:
   - start from the owning object family, not the looked-up id
   - return `[]` for missing ids, missing references, or unsupported variants
   - use `byIdMaybe()` when missing references are legal
   - flatten nested item groups with the same helpers nearby code already uses
   - let existing filtering rules stand; for example, monster visibility already flows through `byType("monster")` / `byIdMaybe("monster", ...)`

4. Place the code with the existing reverse indexes near the bottom of `CBNData`.

   Follow the naming convention:
   - private field: `#fooIndex`
   - public accessor: `foo(item_id: string)`

5. Sort only in the public accessor when callers expect stable presentation order.

   Use `.sort(byName)` in the accessor, not inside the index callback.

6. Keep constructor scope narrow.

   If the new lookup is only used by one helper or one component, prefer a lazy `ReverseIndex`.

## Templates

### Lazy Reverse Index

```ts
#exampleIndex = new ReverseIndex(this, "item", (item) => {
  if (!item.id) return [];
  return item.some_nested_values?.map((x) => x.target_id) ?? [];
});

example(target_id: string): Item[] {
  return this.#exampleIndex.lookup(target_id).sort(byName);
}
```

### Item Group Expansion

```ts
#exampleIndex = new ReverseIndex(this, "furniture", (f) => {
  return f.bash?.items
    ? this.flattenItemGroup({
        subtype: "collection",
        entries:
          typeof f.bash.items === "string"
            ? [{ group: f.bash.items }]
            : f.bash.items,
      }).map((x) => x.id)
    : [];
});
```

### Constructor-Built Map

Use this only when the lookup must exist as part of core load-time behavior.

```ts
_exampleById: Map<string, string[]> = new Map();

constructor(...) {
  ...
  this._indexExample();
}

_indexExample(): void {
  ...
}
```

If the result could have been `#exampleIndex = new ReverseIndex(...)`, prefer that instead.

## Testing

Add focused tests before broad ones.

- Put data-layer tests in `src/data.test.ts` unless there is already a closer test file.
- Put rendering assertions in the nearest component test if the index feeds UI.
- Cover:
  - direct match
  - nested or grouped match when relevant
  - missing reference behavior
  - duplicate handling if multiple source entries can map to the same returned object

When a component only needs source objects, test the visible behavior, not discarded internal metadata.

## Validation

Use the repository commands from `AGENTS.md`:

```bash
pnpm vitest run --no-color <targeted-test-files>
pnpm check
pnpm lint
```

Notes:

- do not append `--no-color` to `pnpm check`; `tsc` rejects it here
- inspect `_test/all.json` with `jq`, never with whole-file `grep`
- run broader suites only if the new index changes cross-cutting data behavior

## Review Checklist

Before finishing, confirm:

- the index pattern matches nearby `src/data.ts` conventions
- the public accessor returns only the data callers actually use
- no bespoke wrapper type survives without a real consumer
- missing references degrade to `[]` instead of throwing unless absence is impossible
- sorting happens at the accessor boundary, not in the index itself
- targeted tests cover the new lookup path
