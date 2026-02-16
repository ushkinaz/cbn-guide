---
name: fix-schema-validation
description: Fix Schema Validation Errors
---

This workflow guides you through resolving schema validation errors, typically caused by upstream changes in `Cataclysm-BN`.

1. **Run Tests to Identify Failure**
   Run the schema validation tests to isolate the failure.

   ```bash
   pnpm vitest --run schema.test.ts --bail 2
   ```

   - Look for errors like `schema matches <type> <id>`.
   - Note the error detail, e.g., `/property/0 must NOT have more than 2 items`.

2. **Locate Failing Data**
   Find the specific object in the test data that causes the failure.
   - Use a script or `jq` on `_test/all.json`.
   - Example script pattern (create as `debug_find.cjs`):

   ```bash
   jq  -r '.data[] | select(.type? == "item_type" and .category == "category_id" and .id="book") ' _test/all.json

   ```

3. **Check TypeScript Definition**
   Open `src/types.ts` and locate the interface matching the failure `type`.
   - Compare the `interface` or `type` definition with the failing data structure.

4. **Verify Upstream (Optional)**
   If you have access to `Cataclysm-BN` source code:
   - Search for the C++ struct definition (often in `src/mapdata.h`, `src/vitamin.h`, etc.).
   - Check the `load` function in the corresponding `.cpp` file to see how the JSON is parsed.
   - _Crucial_: Check if the C++ parser ignores extra elements (e.g., uses `get_int(0)` and `get_int(1)` on a larger array).

5. **Update Schema (`src/types.ts`)**
   Modify the TypeScript definition to accommodate the new data format.
   - If C++ ignores extra data, document this in a comment and make the type permissive (e.g., `(string|number)[][]` instead of `[string, number][]`).
   - If new variants are added (e.g., object wrapper `{ ter: ... }` vs string), use Union types.

6. **Update Parsing Logic (If Needed)**
   If the data structure change affects how data is used in the app (e.g., not just extra ignored fields, but a fundamental change in shape like Object vs Array):
   - Check `src/types/item/spawnLocations.ts` (for Mapgen).
   - Check relevant Svelte components.
   - Update parsing functions (e.g., `getMapgenValueDistribution`) to handle the new shape.

7. **Verify Fix**
   Re-run the tests.
   // turbo

   ```bash
   pnpm fix:format && pnpm vitest --run schema.test.ts --bail 2
   ```
