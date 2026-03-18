---
name: fix-schema-validation
description: Investigate and fix manual or CI schema test failures in `src/schema.test.ts` and `src/mod-schema.test.ts`, especially after upstream Cataclysm-BN data changes.
---

This skill is for schema test failures only.

Use it when:

- `pnpm vitest run src/schema.test.ts --no-color` fails
- `pnpm vitest run src/mod-schema.test.ts --no-color` fails
- scheduled CI or daily/nightly builds fail during schema validation
- freshly fetched fixtures introduce new JSON shapes that no longer match `src/types.ts`

Do not use this skill for:

- generic rendering failures with no schema assertion
- routing/UI regressions unrelated to data shape validation
- upstream gameplay bugs that do not break this app's schema tests

## Goal

Make the guide accept current Cataclysm-BN data with the smallest accurate schema change possible.

That usually means:

- updating `src/types.ts`
- sometimes updating a local normalization/helper path when the accepted shape is materially different at runtime
- verifying both core and mod schema tests when the change can affect shared types

## First Principles

- We are consumers of upstream JSON, not its authors.
- Prefer narrow, discriminated unions over vague permissive types.
- Only relax the schema as far as current upstream behavior requires.
- Verify whether the new shape exists in core data, mod data, or both.
- If local upstream source is stale, trust the fetched fixture and then confirm provenance via GitHub history/PRs.

## Useful Sources

Prefer linking to canonical project docs over duplicating their instructions here.

### Local upstream Cataclysm-BN checkout

Try these likely locations first:

- `~/Workspace/C-BN/Cataclysm-BN`
- `../Cataclysm-BN`

If neither exists, ask the user for the path to their Cataclysm-BN checkout.

Before trusting a local checkout, check whether it is actually current:

```bash
git -C ~/Workspace/C-BN/Cataclysm-BN branch -vv
git -C ~/Workspace/C-BN/Cataclysm-BN log --oneline -n 20 --decorate
```

Important: CI daily failures may use fresher nightly fixtures than a nearby local clone. Do not assume the local checkout contains the same change that broke the nightly build.

### Fixture data

- Core merged data: `_test/all.json`
- Mod-scoped data: `_test/all_mods.json`
- JSON exploration help: [`_test/AGENTS.md`](_test/AGENTS.md)

### Upstream GitHub provenance

When the failure appears to come from a recent upstream change:

- inspect the upstream JSON file history
- inspect recently merged Cataclysm-BN PRs
- look for commit messages that mention the failing object/file/feature

Useful targets:

- upstream repo: `https://github.com/cataclysmbn/Cataclysm-BN`
- failing workflow run in this repo
- upstream PRs/commits that introduced the new JSON shape

If `gh api` is awkward or blocked, `curl` against the GitHub API is acceptable.

## Commands

For canonical test/fixture workflow and guardrails, see [`AGENTS.md`](AGENTS.md).

Schema-specific commands worth calling out here:

Refresh fixtures when debugging nightly failures:

```bash
pnpm fetch:fixtures:nightly
```

Run the core schema test:

```bash
pnpm vitest run src/schema.test.ts --no-color
```

Run the mod schema test:

```bash
pnpm vitest run src/mod-schema.test.ts --no-color
```

Note: do not append `--no-color` to `pnpm check`; `tsc` in this project does not accept it.

## Workflow

1. Identify exactly which schema test failed.

   Distinguish:
   - core schema failure in `src/schema.test.ts`
   - mod schema failure in `src/mod-schema.test.ts`
   - broader test failure where schema is only one symptom

   Capture:
   - failing object `type`
   - failing id/result/abstract
   - `__filename` from the test output
   - failing property path such as `/use_action/0`

2. Reproduce against the right dataset.

   For daily/nightly CI failures, start with:

   ```bash
   pnpm fetch:fixtures:nightly
   pnpm vitest run src/schema.test.ts --no-color
   pnpm vitest run src/mod-schema.test.ts --no-color
   ```

   If only one suite is implicated, you can stop at the failing one first.

3. Locate the failing object with `jq`.

   Core examples:

   ```bash
   jq '.data[] | select(.id=="<id>" and .type=="<type>")' _test/all.json
   jq '.data[] | select((.__filename // "") | contains("<file-fragment>"))' _test/all.json
   jq '[.data[] | select(.type=="<type>") | keys[]] | unique | sort' _test/all.json
   ```

   Mod examples:

   ```bash
   jq 'keys[]' -r _test/all_mods.json
   jq '.aftershock.data[] | select(.id=="<id>" and .type=="<type>")' _test/all_mods.json
   jq '[.aftershock.data[] | select(.type=="<type>") | keys[]] | unique | sort' _test/all_mods.json
   ```

4. Decide whether the break is caused by:
   - a genuinely new upstream variant that should be modeled in `src/types.ts`
   - an existing variant that the schema forgot to include
   - a permissive loader pattern upstream that requires a looser local type
   - a runtime shape difference that also requires helper/component updates
   - mod inheritance/override behavior that only appears in `src/mod-schema.test.ts`

5. Analyze upstream Cataclysm-BN source and PR history.

   Check the local upstream clone first if available and current enough:

   ```bash
   rg -n '<symbol-or-json-key>' ~/Workspace/C-BN/Cataclysm-BN/data ~/Workspace/C-BN/Cataclysm-BN/src
   git -C ~/Workspace/C-BN/Cataclysm-BN log --oneline -- <likely-json-file>
   ```

   If the local clone is behind nightly:
   - ask user to permission to update or ask him to update
   - inspect the commit history for that file
   - inspect recently merged upstream PRs related to the feature

   The purpose is not busywork. It tells you whether the fixture change is:
   - isolated to one new data shape
   - part of a larger upstream feature rollout
   - likely to have follow-on effects in mods or render tests

6. Update `src/types.ts`.

   Most schema failures should be fixed here.

   Preferred patterns:
   - add a new discriminated union member for a new object shape
   - extend an existing union when upstream now permits an extra variant
   - keep field types precise
   - add brief comments only when the permissiveness would otherwise look suspicious

   Avoid:
   - replacing a specific type with `any`
   - widening everything to `unknown` or `Record<string, unknown>` unless absolutely necessary
   - adding broad catch-all strings when the code intentionally wants warnings for newly introduced upstream actions

7. Update runtime handling only if the accepted shape is used by the app.

   Common places to inspect:
   - `src/data.ts`
   - `src/types/*.svelte`
   - normalization helpers such as `normalizeUseAction`

   Heuristic:
   - if the failure is only that the schema rejects a shape already handled by runtime code, stop at `src/types.ts`
   - if the new shape changes how data is read, normalized, indexed, or rendered, patch runtime logic too

8. Decide whether UI or presentation changes are needed.

   Some JSON shape changes are not just schema work. They may require:
   - new UI for a newly introduced concept
   - updated labels or presentation in existing components
   - better rendering of newly accepted fields

   When that happens, consult the user before expanding scope.

   Common options:
   - fix schema only now to restore CI / validation
   - fix schema plus minimal runtime/UI support now
   - fix schema now and defer UI/presentation to a follow-up task

   Default bias for CI repair:
   - restore schema validation first
   - then ask whether UI work should happen in the same change or later

9. Handle mod-specific fallout explicitly.

   If the failure is in `src/mod-schema.test.ts`:
   - inspect `_test/all_mods.json`
   - identify the mod id and object source chain
   - consider whether the same fix belongs in shared types or in mod-specific inheritance handling

   If a shared type change could affect mod rendering, run:

   ```bash
   pnpm gen:mod-tests
   pnpm vitest run src/__mod_tests__/mod.<mod_id>.test.ts --no-color
   ```

   Or, if needed:

   ```bash
   pnpm test:render:mods --no-color
   ```

   Remember:
   - generated files in `src/__mod_tests__/` are derived artifacts
   - mod schema failures and mod render failures are related but not identical

10. Verify narrowly, then more broadly as needed.

Minimum verification for a core schema change:

```bash
pnpm vitest run src/schema.test.ts --no-color
pnpm check
pnpm lint
```

Minimum verification for a mod-related schema change:

```bash
pnpm vitest run src/mod-schema.test.ts --no-color
pnpm check
pnpm lint
```

If the touched type is shared between core and mods, run both schema suites.

11. Summarize provenance in the final write-up.

Always record:

- the failing CI run or local command
- the upstream file/object that introduced the new shape
- the relevant upstream Cataclysm-BN commit or PR if known
- whether the scope appears isolated or broader

## What Usually Matters Most

- `src/types.ts`: source of truth for schema generation
- `src/schema.test.ts`: validates `_test/all.json`
- `src/mod-schema.test.ts`: validates `_test/all_mods.json`
- `src/data.ts`: flattening/normalization/runtime use of accepted shapes
- `scripts/fetch-fixtures.ts`: nightly fixture source
- `scripts/gen-mod-tests.ts`: regenerate mod render tests when checking downstream mod fallout
- `src/types/*.svelte`: presentation/components that may need updates after schema acceptance
- [`AGENTS.md`](AGENTS.md): canonical project workflow and test matrix
- [`_test/AGENTS.md`](_test/AGENTS.md): canonical `jq` exploration patterns for fixture blobs

## Practical Heuristics

- If the error says `must be string, but was [...]` or `must be object, but was [...]`, suspect a newly allowed union branch or array wrapper.
- If only one or two new object `type` values appear in nightly data, prefer adding those explicit variants rather than broadening the whole field.
- If the failing object comes from a newly added upstream JSON file, inspect that file and its introducing PR before deciding how much to widen the schema.
- If core schema passes but mod schema fails, investigate mod inheritance or mod-only legacy shapes before changing shared runtime logic.
- If the local Cataclysm-BN checkout lacks the failing file, it may simply be older than the nightly fixture. Confirm before drawing conclusions.

## Anti-Patterns

- Do not grep `_test/all.json` or `_test/all_mods.json`.
- Do not “fix” schema failures by skipping tests.
- Do not widen a type beyond what the fixture and upstream parser justify.
- Do not stop after `src/schema.test.ts` if the changed type is shared and mods plausibly use it too.
- Do not commit generated `src/__mod_tests__/` files unless the task truly requires regenerated artifacts.
