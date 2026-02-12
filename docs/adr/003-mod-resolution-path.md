# ADR-003: Mod Resolution Path

Date: 2026-02-12

## Status

Accepted

## Context

Cataclysm: Bright Nights (upstream) resolves mod data by merging it from the bottom up. It starts with the base game data (and core "bn" mod), then sequentially applies each active mod, overwriting existing entries. This approach ensures that the final state accurately reflects the desired mod order.

However, implementing this bottom-up merging strategy in a client-side web application presents significant challenges:

1.  **CPU Performance**: Merging ~30MB of JSON data sequentially for every active mod would require substantial CPU resources, leading to a significant delay in the initial application load.
2.  **Memory Overhead**: Maintaining multiple versions of the game data during the merge process could quickly exhaust browser memory limits.
3.  **Impractical Pre-caching**: While pre-caching resolved data is possible for the base game, it becomes impractical for mods due to the exponential number of potential mod combinations.

## Decision

We have decided to implement a **top-to-bottom inheritance unfurling strategy** for resolving modded objects.

Instead of merging the entire dataset at startup, we resolve each object's inheritance chain on-demand (lazy resolution) starting from the most specific definition (the "top") and traversing down to the base game data (the "bottom").

### Key Implementation Details:

1.  **Lazy Flattening**: Objects are only fully resolved ("flattened") when they are first accessed via `byId` or `byIdMaybe`.
2.  **Top-Down Traversal**: When an object is requested, we identify all mods that "touch" its ID or abstract. We then traverse the `copy-from` inheritance chain from parents to children, merging properties as we go.
3.  **Provenance Scanning**: Since we don't pre-index every mod's contribution to every object (which would be slow), we use `_directModsForTypeIdByScan` to scan active mods for overrides on-demand. These results are memoized in `_directModsByTypeByIdCache`.
4.  **Self-Copy Handling**: We specifically handle "self-looking" `copy-from` patterns (where a mod overrides an object with the same ID) by using an internal `_overrides` map to point to the previously defined version of the object.

## Consequences

### Positive

- **Initial Load Speed**: Significantly faster startup time as we only load the raw mod data and defer inheritance resolution.
- **Memory Efficiency**: Only the requested objects are flattened and cached, reducing the memory footprint for users who only view a subset of the game data.
- **Dynamic Compatibility**: Effectively handles any combination of mods provided in the URL without requiring pre-computed builds.

### Negative

- **Scan Latency**: The first time an object is accessed, scanning active mods for overrides can introduce minor latency. This is mitigated by memoization.
- **Complex Inheritance Risks**: Non-linear inheritance or loops in mod data are harder to detect and handle compared to a simple bottom-up merge. We use cycle detection in `_flatten` and `_modsForTypeIdChain` to mitigate this.
- **Shadowing Edge Cases**: Rare edge cases where multiple mods modify the same object in complex ways (e.g., partial deletes vs. extends) require careful handling in the flattening logic.

### Neutral

- **Departure from Upstream**: Our resolution logic differs fundamentally from the game's engine, requiring regular verification against actual game behavior to ensure parity.

---

## References

- Implementation: [src/data.ts](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/data.ts) (specifically `_flatten`, `_modsForTypeIdChain`, and `_directModsForTypeIdByScan`)
- Related ADRs: [ADR-002: Mod Architecture and Reload Strategy](002-mod-architecture-and-reload-strategy.md)
