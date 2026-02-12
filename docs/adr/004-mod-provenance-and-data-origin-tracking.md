# ADR-004: Mod Provenance and Data Origin Tracking

Date: 2026-02-12

## Status

Accepted

## Context

When multiple mods are active, they often override the same game entities or contribute to a shared inheritance chain. For example, `DinoMod` might add a new property to a creature, while another mod changes its health. In the UI, users see the final resolved values but lack visibility into which mod is responsible for a particular value or change.

Tracking this "provenance" (the origin of each data point) is critical for debugging mod compatibility and providing high-value feedback to users (e.g., displaying "Modified by: [Mod A, Mod B]").

Standard bottom-up merging makes this tracking easier but is rejected in [ADR-003](003-mod-resolution-path.md) due to performance constraints. Our lazy resolution strategy requires a provenance system that is equally lightweight and on-demand.

## Decision

We will implement a dedicated provenance tracking system within `CBNData` that mirrors the lazy, top-down resolution logic of the data store.

### Key Implementation Details:

1.  **Entity-Level Tracking**: We track provenance at the **object level**. We identify which mods provided a definition or override for a given ID/abstract, but we **do not** track which specific properties (e.g., `weight`, `health`) were modified by which mod.
2.  **On-Demand Provenance Sidecar**: We will not pre-index provenance for all objects at startup. Instead, when a user requests the origins of an entity, we trigger a dedicated resolution pass.
3.  **Direct Mod Identification**: Use `getDirectModsForId` to identify mods that directly override an object's ID or its ancestors in the inheritance chain. This uses the same memoized scanning logic used for data flattening.
4.  **Inheritance Tracing**: Implement `getContributingModsForId` to trace the full inheritance chain. This involves identifying parental definitions in other mods (including the base game data) to show the complete path of data evolution.
5.  **Memoization**: Results of provenance scans will be memoized independently of the flattened game data to avoid redundant scans while keeping the core `byId` cache lean.

## Consequences

### Positive

- **High Developer/User Value**: Provides clear visibility into mod interactions, making the wiki a powerful tool for modders and power users.
- **Minimal Load Impact**: Consistent with [ADR-003](003-mod-resolution-path.md), this system avoids heavy pre-processing. The "cost" is only paid when a user actually views an entity's provenance.
- **Architectural Consistency**: Reuses the existing `_directModsForTypeIdByScan` infrastructure, reducing implementation complexity.

### Negative

- **Increased Complexity in `CBNData`**: Adds more specialized resolution logic to an already complex central data store.
- **Lack of Field-Level Granularity**: Users can see that "Mod A" modified an item, but the UI cannot automatically say "Mod A changed the weight". This is a deliberate trade-off to keep resolution fast.
- **UI Latency**: The first open of a "Mod Provenance" UI panel might have a slight delay while scans are performed.

### Neutral

- **Data Consistency**: The provenance system must be kept in sync with the flattening logic. Any change to how inheritance is unfurled must be reflected in the provenance sidecar.

---

## References

- Implementation: [src/data.ts](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/data.ts)
- Related ADRs: [ADR-003: Mod Resolution Path](003-mod-resolution-path.md)
