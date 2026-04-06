# ADR-007: Data Loading Orchestration - Fetch Boundary and Retry Removal

Date: 2026-04-06

## Status

Accepted

## Context

`src/data.ts` had accumulated four different kinds of responsibility in one place:

1. HTTP transport and retry behavior;
2. orchestration of `all.json`, locale, pinyin, and mod catalog downloads;
3. domain assembly into `CBNData`;
4. Svelte store lifecycle and generation-token cancellation.

That layering made the code harder to reason about than the real problem deserved. The previous `loadData()` path mixed transport concerns with domain fallback policy, mod parsing, progress aggregation, and stale-load protection in one long function.

The resulting architecture rests on simpler constraints:

1. `all.json` is the only required asset;
2. locale, pinyin, and `all_mods.json` are optional enrichments;
3. static CDN-hosted JSON files do not gain much from retry loops;
4. progress UI only needs to reflect the dominant `all.json` download.

## Decision

### Establish `data-loader.ts` as the Fetch-Orchestration Boundary

Within the `loadData()` refactor, `src/data-loader.ts` is the single public
transport entry point for game data loading through
`loadRawDataset(version, locale, onProgress)`.

It owns:

- raw HTTP transport for game JSON assets;
- parallel dispatch via `Promise.allSettled`;
- progress reporting from `all.json` only;
- conditional pinyin fetches for `zh_*` locales;
- swallowing failures for optional assets by returning `undefined`.

It does not own:

- locale fallback policy;
- mod catalog parsing or mod merge policy;
- `CBNData` construction;
- Svelte store lifecycle or generation-token cancellation.

### Remove Retry Logic from Data Loading

The data-loading path no longer retries `all.json`, locale files, or `all_mods.json`.

`all.json` failures are surfaced immediately. Optional asset failures are logged and degraded to `undefined`.

### Keep Domain Assembly in `data.ts`

`src/data.ts` remains the owner of:

- generation-token cancellation for stale in-flight loads;
- locale fallback to English when a requested locale payload is absent;
- parsing and validating `all_mods.json`;
- filtering active mods and merging mod data into the base dataset;
- publishing the final immutable `CBNData` instance to the Svelte store.

## Consequences

### Positive

- transport orchestration now has one explicit home instead of being embedded in the domain model;
- `loadData()` becomes shorter and easier to reason about because it only performs domain decisions after raw assets arrive;
- optional asset failures degrade consistently, which makes locale, pinyin, and mod catalog behavior easier to test;
- progress reporting is simpler and aligned with the only download users meaningfully perceive.

### Negative

- optional mod catalog failures are now always silent degradation, even when the underlying error is not a 404;
- loader diagnostics depend on console warnings rather than richer surfaced error states;
- `Promise.allSettled` may start optional requests that later prove unnecessary if the main dataset fails first.

### Neutral

- `retry.ts` remains in the codebase because other transport paths still use it;
- locale fallback still lives in `data.ts`, but it now operates on raw loader output rather than owning fetch sequencing;
- the public `data.loadData()` method signature changed from `setVersion(...)` but calling semantics remain analogous.

## References

- `src/data-loader.ts`
- `src/data.ts`
- `src/data-loader.test.ts`
- `src/data.test.ts`
- `src/data.mods.test.ts`
- `docs/architecture.md`
- Related ADR: `docs/adr/ADR-002_mod_architecture_and_reload.md`
