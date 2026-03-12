# Changelog

This is a monthly changelog for The Hitchhiker's [Guide](https://cataclysmbn-guide.com/) for Cataclysm: Bright Nights. It tries to be as user-centric as possible, with little to no technical details. For full technical details, see commit messages.

## February 2026

### Highlights

- Full mod support landed: you can pick mods, auto-include dependencies, see what each mod adds, and keep selections in shared URLs.
- The guide became friendlier to browse, with a redesigned front page, stronger monster/item presentation, clearer loading states, and better mobile behavior.
- BN data compatibility was tightened across mapgen, vehicles, monsters, mutations, and tilesets, so pages line up more closely with real game content.

### Changes

- [FEATURE] Added addictions support in item data presentation.
- [FEATURE] Gun mods and other item pages now show more useful related stats and data instead of hiding important context.
- [FEATURE] Monster pages got a stronger header layout and clearer localized helper text for behavior and regeneration details.
- [FEATURE] The front page was refreshed with a new intro layout, better category presentation, and a clearer PWA prompt.
- [FEATURE] Translation support moved forward with Transifex integration, locale fallback handling, and cleaner language selection.
- [UI] Loading feedback is clearer with improved spinners, steadier selectors, cleaner list styling, and better small-screen layout touches.
- [PERF] Search, loot sorting, Found In tables, and caching behavior were tuned to feel faster and stutter less while browsing.
- [FIX] Retry logic now skips permanent 404 failures, reducing wasted requests and noisy errors.
- [FIX] Data normalization fixes improved correctness for vehicles, monsters, mutations, flags, hand-cranked gear, and mapgen item placement edge cases.
- [FIX] iOS WebKit no longer clips some sprites because of the old contrast filter.
- [FIX] Schema and mapgen handling now cover more BN cases, including Lua mapgen and direct item ids in placement data.

## January 2026

New address for the project: https://cataclysmbn-guide.com/

### Highlights

- Search became noticeably faster and smoother, including Enter-to-open-first-result.
- Loot and mapgen summaries were corrected to better match real in-game data.
- Routing/version handling became much more reliable for stable/nightly and legacy links.

### Changes

- [SEARCH] Search feels faster and smoother, especially while typing and opening results.
- [SEARCH] Pressing Enter in search now jumps straight to the first result.
- [FEATURE] JSON view now has a copy button and clearer expand/collapse behavior.
- [FEATURE] Vehicle pages now render tile graphics with stronger fallbacks.
- [FEATURE] Monster pages now show both what a monster upgrades from and what it can upgrade into.
- [FIX] Loot and mapgen summaries now match game data much more closely across nested chunks, repeat rules, amounts, ammo, and conditional placements.
- [FIX] Probabilities and counts in location loot summaries are more accurate and no longer spike above valid limits.
- [UI] Obsolete entries and long result lists are easier to read with clearer warnings, better buttons, and stronger focus behavior.
- [UI] Small screens handle long names and dense tables better.
- [PERF] Initial page loading and data fetch feel faster thanks to smarter preloading and cache behavior.

## December 2025

### Highlights

- Added support for newer BN versions with clearer stable/nightly version selection.
- Major fixes reduced broken/incorrect navigation paths.
- Heavy data sections (loot/locations) switched to on-demand loading for a faster initial page load.

### Changes

- [FEATURE] Added support for newer BN versions and clearer stable/nightly version selection.
- [FIX] Language and locale handling is more reliable, including safer fallback behavior when localization data is broken.
- [FEATURE] Long item lists and table lists can now be expanded and collapsed.
- [FEATURE] Added ammo, gun, and magazine compatibility details on item pages.
- [FEATURE] Skill pages now list training items grouped by max level.
- [FEATURE] Tileset selection became more flexible, including URL-driven selection and safer default behavior.
- [UI] Home and navigation were refreshed with clearer category icons, better footer/header layout, and improved loading visuals.
- [FEATURE] Heavy sections such as loot and location lists now load on demand instead of blocking the first load.
- [FEATURE] Added scroll-to-top and several navigation polish updates for easier browsing on long pages.
- [FIX] Asset and static path issues were corrected, reducing broken links and missing resources.
- [PERF] Service worker and caching behavior were tuned to improve offline stability and reduce stale-cache surprises.

## July 2025

### Changes

- [FIX] Core dependencies were refreshed to reduce breakage risk and keep the app reliable on current toolchains.

## March 2025

### Highlights

- The front page was redesigned for clearer navigation and a cleaner first impression.
- Version selection became more predictable by saving your chosen version and narrowing visible options.
- BN data compatibility kept improving, reducing mismatches in displayed game details.

### Changes

- [UI] The front page layout was refreshed.
- [FEATURE] Selected game version is now persisted, so returning users keep their preferred version.
- [FIX] Monster, construction, loudness, vitamins, and flag data handling was updated to better match BN formats.
- [FIX] Page titles were clarified for easier orientation while browsing.

## February 2025

Restarted development by ushkinaz at https://github.com/ushkinaz/cbn-guide

### Highlights

- Overmap special and location browsing became much more powerful, with searchable pages and better loot visibility.
- Item pages gained richer gameplay context, including construction/tool-quality relationships and action links.
- Data compatibility and parsing accuracy improved substantially, reducing incorrect or missing information.

### Changes

- [FEATURE] Added dedicated overmap-special pages, improved search results, and grouped location outcomes for easier exploration.
- [FEATURE] Loot presentation became more useful with expected counts, better sorting, and improved charge-based item handling.
- [FEATURE] Item pages now show more practical relationships, including constructions using items/tool qualities and linked item actions.
- [FEATURE] Added support for more BN mapgen patterns.
- [FEATURE] Tileset can now be selected via URL parameter for easier sharing and reproducible views.
- [FEATURE] Added Technique page support.
- [FIX] Numerous type/schema mismatches were corrected for BN-specific fields, reducing broken or misleading values.
- [FIX] Search and routing behavior improved with better query encoding and URL state preservation while navigating.

## June 2023

Initial port to "Cataclysm: Bright Nights" by mythosmod at https://github.com/nornagon/cdda-guide

## March 2021

Original project started by nornagon for "Cataclysm: Dark Days" Ahead at https://github.com/mythosmod/cbn-guide

## Notes

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Generated by [changelog](./.agents/skills/changelog/SKILL.md), edited by hand
