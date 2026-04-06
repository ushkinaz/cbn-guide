# ADR-008: Mod Preset Persistence

- **Status:** Accepted
- **Context:** Users repeatedly configure the same modset. The URL is the source of truth (ADR-002), but bare URLs have no mods.
- **Decision:** `localStorage` stores a default mod preset under `cbn-guide:default-mods`. On bootstrap, bare URLs (no `mods` param) get the saved preset injected via `replaceState`. Applying mods in the ModSelector automatically saves them. Saving an empty modset clears the preset.
- **Consequences:**
  - Positive: users configure once, bare URLs auto-load their preset.
  - Negative: `localStorage` adds a persistence dependency; clearing browser data loses the preset.
  - Neutral: shared URLs with explicit `?mods=` are unaffected.
- **References:** `src/preferences.svelte.ts`, `src/navigation.svelte.ts`, ADR-002.
