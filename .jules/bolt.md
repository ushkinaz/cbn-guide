# Bolt's Journal

## 2025-02-18 - JSON.parse(JSON.stringify) Optimization
**Learning:** The codebase heavily uses `JSON.parse(JSON.stringify(x))` for deep cloning in the hot path `_flatten` method. `AGENTS.md` explicitly calls this out as a performance opportunity.
**Action:** Replacing with a manual deep clone function should yield significant speedups for object resolution.
