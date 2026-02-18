# ADR-003: Mod Resolution Path

Date: 2026-02-12

## Status

Accepted

## Context

A full eager merge of all inheritance outcomes for every active modset is expensive in browser CPU and memory.
At the same time, the Guide must preserve mod order semantics and produce game-like final objects.

## Decision

We use a **lazy inheritance resolution model**.

### Resolution Model

1. Startup builds a single ordered raw dataset: base first, then active mods in URL order.
2. Object identity lookup uses the final definition at each key, preserving override precedence.
3. Full inheritance resolution happens on demand when an object is requested.
4. Resolved objects are cached for the page lifetime.

### Scope Boundary

This ADR covers object resolution for rendered data.
Origin/provenance reporting is a separate concern (see [ADR-004](ADR-004_mod_provenance.md)), even though both follow the same mod order and inheritance semantics.

### Safety Behavior

The resolver is defensive against malformed inheritance (for example cycles or missing parents) to avoid crashes and keep navigation usable.

## Consequences

### Positive

- faster initial load than eager full flattening;
- better memory profile for typical browsing sessions;
- supports arbitrary active mod combinations without precomputed bundles.

### Negative

- first access to some objects can be slower than subsequent accesses;
- inheritance semantics are more complex than simple eager merge;
- parity with upstream behavior must be re-validated as data patterns evolve.

## References

- `src/data.ts`
- Related: [ADR-002](ADR-002_mod_architecture_and_reload.md), [ADR-004](ADR-004_mod_provenance.md), [ADR-005](ADR-005_data_inheritance.md)
