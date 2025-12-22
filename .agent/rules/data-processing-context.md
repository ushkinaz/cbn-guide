---
trigger: model_decision
description: When working on data parsing, `types.ts`, or `src/data.ts`.
---

# Data Processing Context

**Rule**:

- The raw JSON data uses extensive inheritance via `copy-from`.
- **BEWARE**: A raw JSON entry might be incomplete. The application uses `src/data.ts` (specifically the `CddaData` class and `_flatten` method) to resolve inheritance and relative values.
- When debugging "missing" data, checks if it's being correctly inherited/flattened in `src/data.ts`.
