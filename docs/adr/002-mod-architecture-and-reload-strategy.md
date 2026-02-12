# ADR-002: Mod Architecture and Reload Strategy

Date: 2026-02-12

## Status

Accepted

## Context

The Guide must support shareable modded views while keeping data behavior predictable.

We need to:

1. represent active mods in a URL that can be bookmarked and shared;
2. preserve mod override order deterministically;
3. avoid partial in-place reconfiguration of a large immutable data model.

## Decision

### URL is the Source of Truth for Modset

Active mods are represented by the `mods` query parameter as an ordered comma-separated list.
Order defines precedence: later mods override earlier layers.

Normalization rules:

1. empty entries are ignored;
2. duplicates are removed;
3. core `bn` is excluded from the URL-level active set.

### Runtime Does Not Solve Mod Dependencies

The app does not compute or validate dependency graphs from arbitrary URLs.
It accepts only known non-core mods and applies them in the provided order.

### Modset Change Requires Full Reload

Changing the mod list (add/remove/reorder) triggers a full page reload.
This keeps the data model single-lifetime and avoids complex invalidation logic.

### Merge Strategy at Startup

At initialization, the app builds one data stream by appending selected mod data to base data in active order, then constructs the runtime indexes once for that page lifetime.

## Consequences

### Positive

- deterministic and shareable modded URLs;
- simple and robust state model (no hot-swapping complexity);
- stable override behavior tied directly to URL order.

### Negative

- changing mods has reload latency;
- invalid dependency combinations are not corrected client-side.

### Neutral

- behavior depends on upstream `all_mods.json` completeness and quality.

## References

- `src/routing.ts`
- `src/App.svelte`
- `src/data.ts`
