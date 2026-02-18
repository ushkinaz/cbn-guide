# ADR-005: Robust Inheritance: Migrations and Self-Copy Handling

Date: 2026-02-12

## Status

Accepted

## Context

Two patterns frequently appear in BN/mod data:

1. legacy IDs that were renamed over time (migrations);
2. layered overrides that inherit from the same visible ID (self-copy).

Without explicit architectural handling, these patterns can cause broken inheritance, recursion issues, and misleading provenance.

## Decision

### Migration-Aware Identity Resolution

Item lookups and parent traversal follow migration mappings so legacy IDs resolve to the current canonical object identity.

### Layered Self-Copy Semantics

When an override inherits from its own ID, the parent is interpreted as the previous layer in load order, not the same node again.
This preserves incremental extension behavior across multiple mods.

### Provenance Chain Normalization

Provenance collapses repeated self-copy steps that keep the same identity, so lineage highlights meaningful identity changes instead of noisy intermediate hops.

### Scope Clarification

Public provenance queries currently expect canonical/current identifiers at entry.
Migration mapping is guaranteed inside object lookup and parent traversal logic.

## Consequences

### Positive

- stronger backward compatibility for renamed items;
- reliable behavior for common mod layering patterns;
- cleaner provenance narratives for heavily overridden objects.

### Negative

- more complex identity and parent resolution rules;
- migration quality must stay aligned with upstream data evolution.

## References

- `src/data.ts`
- Related: [ADR-003](ADR-003_mod_resolution_path.md), [ADR-004](ADR-004_mod_provenance.md)
