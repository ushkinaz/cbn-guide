# ADR-005: Robust inheritance: Migrations and Self-Copy Handling

Date: 2026-02-12

## Status

Accepted

## Context

Inheritance in Cataclysm-BN and its mods is complex due to two recurring patterns:

1.  **Migrations**: The base game frequently renames items. Mods may still inherit from old names via `copy-from`.
2.  **Self-Inheritance**: Mods often override an item and use `copy-from` targeting the same ID to extend it. This "self-copying" creates a chain of overrides where each mod wants to inherit from the state produced by lower-priority mods.

Without explicit support, these patterns can lead to:

- Broken inheritance when a parent is renamed.
- Infinite loops if an object tries to `copy-from` itself without a mechanism to reach the "previous" version in the load order.
- Incorrect provenance data if the resolution logic doesn't trace through these mappings.

## Decision

We implement explicit support for item migrations and self-copy overrides in the data resolution and provenance systems:

1.  **Transparent Migration Handling**: The data lookup logic is aware of migration mappings. When an object is requested by an old ID that has been migrated, the system automatically redirects the lookup to the new ID. This applies both to direct retrievals and to parent resolution in inheritance chains.
2.  **Layered Override Resolution (Self-Inheritance)**: The inheritance system distinguishes between "external" references (to a different ID) and "self" references (to the same ID). When an object inherits from itself, the system resolves the parent by looking into the layer immediately below the current mod in the load order. This allows mods to extend existing entities without causing infinite recursion.
3.  **Provenance Chain Collapsing**: The provenance system collapses "self-copy" chains where the identity of the object remains constant across multiple mod overrides. Instead of tracking every intermediate override as a parent change, the system treats them as a single inheritance path until it identifies a parent with a genuinely different ID or abstract template.

## Consequences

### Positive

- **Backward Compatibility**: Mods referencing legacy item IDs continue to function correctly.
- **Robust Modding Support**: Enables incremental overrides (extend/self-copy) as a first-class citizen.
- **Accurate Provenance**: Correctly attributes changes across renamed or multiple-times overridden objects.

### Negative

- **System Complexity**: The data resolution layer must account for redirection and layered lookups, which adds internal complexity.
- **Data Maintenance**: The migration maps must be synchronized with upstream game data changes to remain effective.

### Neutral

- **State Management**: Requires maintaining a history of object versions (overrides) during the data loading phase to support self-reference resolution.

---

## References

- Implementation: [src/data.ts](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/data.ts)
  - Data lookup redirection (migrations).
  - Chain collapsing in provenance tracing.
  - Self-inheritance resolution via override history.
- Related ADRs: [ADR-003](003-mod-resolution-path.md), [ADR-004](004-mod-provenance-and-data-origin-tracking.md)
