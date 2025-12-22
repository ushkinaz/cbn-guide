---
trigger: model_decision
description: When making Changes to Svelte components (`.svelte`), CSS, or data presentation logic.
---

**Rule**:

- A local dev server is running at `http://localhost:3000/`.
- **ALWAYS** verify UI changes by visiting this URL using the `browser_subagent`.
- Do not assume code correctness without visual verification.
- Common verification paths:
  - Home: `/`
  - Search: Use the search bar on the home page.
  - Item Details: `/item/<id>` (pick a valid ID from `_test/all.json`)
- **Search Verification**: When performing a search test from the browser, the search box **must always be cleared first** before typing a new query.

**Reasoning**:
Visual regressions are easy to miss in code reviews. The active dev server provides immediate feedback. Clearing the search box ensures isolation between tests.
