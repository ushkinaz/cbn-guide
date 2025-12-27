---
trigger: model_decision
description: Use when debugging game content, investigating data values, updating data schema,or creating new test cases using the _test/all.json source of truth.
---

- **Truth**: `_test/all.json`.
- **Large File**: ~30MB. Use `jq` or `grep` filters.
  - `jq '.data[] | select(.id=="<id>" and .type=="<type>")' _test/all.json`
- Raw JSON uses `copy-from` inheritance.
- Always use `src/data.ts` (`CddaData` / `_flatten`) to resolve values.
- If data is "missing" in raw JSON, it's likely inherited.
- **Tests** `yarn vitest --run schema.test.ts --bail 1`
