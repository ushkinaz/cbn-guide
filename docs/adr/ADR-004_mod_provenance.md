# ADR-004: Mod Provenance and Data Origin Tracking

Date: 2026-02-12

## Status

Accepted

## Context

Users need to understand _which mods contributed_ to a final object, not only the final flattened value.
Because object resolution is lazy [ADR-003](ADR-003_mod_resolution_path.md), provenance must also be lazy to avoid large upfront indexing costs.

## Decision

We provide provenance as a **separate on-demand sidecar** with two query levels:

1. **Direct contributors**: mods that directly define/override the queried object key.
2. **Contributing chain**: mods that contribute across the full inheritance lineage of that object.

### Provenance Semantics

- Results are object-level, not field-level.
- Results follow active mod order.
- Core/base content is not reported as a mod contributor.
- Results are memoized to keep repeated provenance requests cheap.

### Scope Boundary

This ADR tracks _which mods participated_, not _which exact field each mod changed_.

## Consequences

### Positive

- strong debugging value for mod interactions;
- low startup overhead;
- consistent semantics with lazy object resolution.

### Negative

- no automatic field-by-field blame;
- first provenance lookup for an object can be slower than repeated lookups;
- adds conceptual complexity to the data layer.

## References

- `src/data.ts`
- Related: [ADR-003](ADR-003_mod_resolution_path.md), [ADR-005](ADR-005_data_inheritance.md)
