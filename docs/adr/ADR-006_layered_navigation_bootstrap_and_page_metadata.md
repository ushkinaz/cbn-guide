# ADR-006: Layered Navigation Bootstrap and Page Metadata

Date: 2026-04-03

## Status

Accepted

## Context

This ADR restructures the app around a few different concerns that were previously easy to blur together:

1. raw browser route state and history synchronization;
2. persisted display preference state such as the preferred tileset;
3. build metadata needed to resolve aliases like `stable` and `nightly`;
4. effective navigation context used by the shell, links, and page rendering;
5. page metadata such as title, description, canonical URL, and alternate-language links.

These concerns do not all move at the same speed or have the same lifetime. Some belong to the current history entry, some belong to browser persistence, some exist only after `builds.json` loads, and some should describe content identity rather than a user-specific presentation choice.

We need the architecture to preserve a few constraints simultaneously:

1. URLs remain shareable and canonicalizable;
2. build aliases and malformed version URLs are resolved before the shell renders from derived navigation state;
3. display preferences such as tileset can influence in-app links without polluting canonical metadata;
4. app-level data loading reacts to one coherent navigation model instead of re-deriving state independently in multiple places.

## Decision

### Navigation Is Layered by State Ownership

Navigation is split into dedicated owners:

- `src/routing.svelte.ts` owns raw URL parsing, URL building, history updates, and SPA interception rules;
- `src/preferences.svelte.ts` owns persisted display preferences;
- `src/builds.svelte.ts` owns `builds.json` loading and build alias resolution;
- `src/navigation.svelte.ts` owns the effective navigation read model used by the rest of the UI.

The effective navigation context is derived by combining route state, persisted preference state, and resolved build metadata at read time instead of letting individual consumers reconstruct those rules on their own.

### Bootstrap Completes Before App Mount

Application startup now establishes navigation prerequisites before `App.svelte` mounts:

1. initialize route state;
2. load persisted preferences;
3. load build metadata;
4. canonicalize malformed version URLs once aliases can be resolved;
5. apply the requested UI locale;
6. mount the shell.

This keeps the initial render aligned with the effective build, locale, tileset, and mod context instead of correcting them after the shell has already rendered.

### Soft and Hard Navigation Follow Data Lifetime

The app distinguishes between navigation that changes presentation and navigation that changes dataset identity.

- build, locale, and mods changes are treated as hard navigation because they change the loaded data context;
- tileset changes remain soft navigation because they change presentation only;
- search refinement can use debounced URL replacement when the user is already inside a search flow.

### Page Metadata Has a Dedicated Owner

`src/PageMeta.svelte` becomes the owner for document metadata.

It derives page title, description, canonical URL, and alternate-language links from the effective navigation context and currently loaded data. Canonical links omit the tileset because tileset is a display preference, not part of content identity. Canonical links use the stable route form for the current content target while preserving locale and mods.

## Consequences

### Positive

- ownership of route state, preferences, version resolution, and metadata is explicit;
- startup behavior becomes easier to reason about and test because the bootstrap sequence is centralized;
- in-app links preserve effective user context without forcing canonical metadata to encode presentation-only state;
- malformed version URLs are normalized through one intake path instead of being patched opportunistically in the shell.

### Negative

- navigation behavior now spans several small modules instead of one broader routing module;
- bootstrap is more sequential, so failures in build metadata loading become a visible gate before mount;
- page metadata rules now depend on a separate dedicated component that maintainers must keep aligned with navigation semantics.

### Neutral

- the app still uses the URL as the source of truth for requested route identity, but not every effective navigation value is stored literally in the URL;
- mod normalization and locale fallback still happen after data availability is known, but they now feed back into a more explicit navigation model.

## References

- `src/main.ts`
- `src/routing.svelte.ts`
- `src/preferences.svelte.ts`
- `src/builds.svelte.ts`
- `src/navigation.svelte.ts`
- `src/App.svelte`
- `src/PageMeta.svelte`
- `docs/routing.md`
- `docs/architecture.md`
- Related ADR: `docs/adr/ADR-002_mod_architecture_and_reload.md`
