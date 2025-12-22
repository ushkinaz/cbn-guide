---
trigger: model_decision
description: When investigating game data, debugging content issues, or generating new test cases.
---

# Data Source and Test Cases

**Rule**:

- The file `_test/all.json` is the designated source of truth for "actual JSON data".
- Use this file to find real-world examples and test cases.
- This file is large (~30MB). Use strict filters with `jq` or `grep` to read it.
  - Example: `jq '.data[] | select(.id=="<id>")' _test/all.json`

**Reasoning**:
The project handles complex game data including inheritance (`copy-from`). The raw data in `all.json` provides the ground truth for what the application consumes.
