---
trigger: model_decision
description: Use when debugging game content, investigating data values, updating data schema, filtering JSON fixtures (jq), or creating new test cases
---

- **Truth**: `_test/all.json` is the compiled data blob.
- **Large File Handling**: ~30MB. **Never** read the whole file. Use `jq`.
  - Filter specific item: `jq '.data[] | select(.id=="<id>" and .type=="<type>")' _test/all.json`
  - List all IDs of a type: `jq '.data[] | select(.type=="item") | .id' -r _test/all.json`
  - Find items with specific property: `jq '.data[] | select(.color == "RED")' _test/all.json`
- **Inheritance**: Raw JSON uses `copy-from`. If a property is missing, check the parent.
- **Resolution**: Use `src/data.ts` (`CBNData` / `_flatten`) to see ultimate resolved values as they appear in-app.
- **Tests**: `yarn vitest --run schema.test.ts --bail 1`