# ADR-002: Mod Architecture and Reload Strategy

Date: 2026-02-12

## Status

Accepted

## Context

Cataclysm: Bright Nights supports a wide variety of mods that can override or extend base game data. The C-BN Guide needs a robust way to:

1. Load mod data alongside base data.
2. Handle overrides correctly (data shadowing).
3. Manage active mods via URL to support deep linking and sharing.
4. Ensure data consistency given that the `CBNData` store is a singleton designed for a single version/modset per page load.

## Decision

We have implemented the following architectural patterns for mods:

### 1. URL-Based State

The active modset is stored in the `mods` URL query parameter as a comma-separated list of mod IDs (e.g., `?mods=DinoMod,Magiclysm`).

- **Order is Important**: The order of IDs in the URL parameter defines the loading and override precedence. Mods listed later can override data from previous mods or the base game.
- **No Dependency Validation**: The application does not perform dependency validation on the mods listed in the URL. We rely on the tool that generated the URL (e.g., the `ModSelector` UI) to have ensured a valid load order.

### 2. Full Page Reload on Change

Any change to the active modset (adding, removing, or reordering mods) triggers a full page reload using `location.href`.

- **Reasoning**: The `CBNData` architecture is optimized for immutability and high performance. It processes and flattens ~30MB of data into optimized lookup maps once per load. Allowing hot-swapping mods without a reload would significantly complicate state management and risk data inconsistencies or memory leaks.
- **Consistency**: This aligns with how we handle Version and Language changes.

### 3. Data Merging at Initialization

Mod data is fetched and merged with base data during the `CBNData.setVersion` initialization phase. Shadowed entities are resolved based on the order provided in the URL.

## Consequences

### Positive

- **Simplicity**: State management is simplified by treating data as immutable for the lifetime of the page.
- **Deep Linking**: Users can share links that include their exact mod configuration.
- **Performance**: High-performance lookup maps don't need logic for dynamic invalidation.

### Negative

- **UX Latency**: Changing mods requires a full reload and re-initialization of game data, which can take a few seconds.

### Neutral

- **External Dependency**: We rely on upstream builds (via `all_mods.json`) to provide the necessary mod data and metadata.

---

## References

- Implementation: [routing.ts](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/routing.ts)
- Implementation: [App.svelte](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/App.svelte)
- Implementation: [data.ts](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/data.ts)
- Project Rules: [data-source.md](file:///Users/dmitry/Workspace/C-BN/cbn-guide/.agent/rules/data-source.md)
