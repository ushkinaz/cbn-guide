---
name: memory-leak-triage
description: Diagnose JavaScript/TypeScript heap growth, Vitest OOMs, hanging test processes, async lifetime leaks, and worker-pressure failures in Node/Svelte repos. Use when requests mention memory leaks, runaway heap, `JavaScript heap out of memory`, `--logHeapUsage`, tests that pass but never exit, heavy happy-dom rendering, stale module caches or stores, missing teardown or reset logic, or CI failures that disappear with fewer workers.
---

# Memory Leak Triage

Use this skill to get from symptom to evidence to the smallest safe fix. Start with the narrowest reproducer, add one diagnostic at a time, decide whether the problem is a true leak or just peak-worker pressure, then verify with focused checks.

Read [memory-debug-commands.md](references/memory-debug-commands.md) for exact commands and search recipes.

## Triage Order

1. Reproduce on the smallest failing scope first.
2. Measure the symptoms instead of guessing.
3. Classify the failure mode.
4. Patch only the retaining lifecycle or pressure source.
5. Re-run the reproducer before broadening scope.

## Choose the Right Path

| Symptom                                           | First move                                        | Usually means                                                      |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| One test file grows across reruns                 | `--logHeapUsage` on that file, then repeat it     | retained module state, missing cleanup, repeated large allocations |
| Single file passes, suite fails with many workers | rerun with `--maxWorkers=1 --no-file-parallelism` | worker pressure, not necessarily a leak                            |
| Tests pass but Vitest never exits                 | use `--reporter=hanging-process`                  | timers, watchers, servers, unawaited teardown                      |
| OOM near the heap limit                           | capture heap snapshots near failure               | large retained graph or extreme allocation spike                   |
| Leak appears after route changes or unmounts      | inspect async work started before destroy/reset   | stale promises, listeners, or tokenless async updates              |

## Repo-Specific Hotspots

- `src/data.ts`, `src/search.ts`, `src/routing.ts`, and `src/tile-data.ts` contain long-lived state. Check whether `_reset()` or `reset()` exists and whether tests call it.
- `src/all.*.test.ts` and generated `src/__mod_tests__/**` are intentionally heavy. Failures here often come from worker pressure or huge DOM/data allocations.
- happy-dom render tests can look like leaks when components mount too many rows or cards. Treat DOM cardinality as a suspect.
- `_test/all.json` and `_test/all_mods.json` are large fixtures. Repeated parsing or cloning can dominate memory even without a leak. Never grep `_test/all.json`; use `jq`.

## What to Look For

- Module-level `Map`, `Set`, arrays, or singleton stores that only grow.
- Missing `afterEach` cleanup for mocks, timers, subscriptions, DOM roots, or fetch/request stubs.
- Async work that survives unmount, reset, or navigation because it lacks a token check or abort path.
- Test helpers that parse or clone the full fixture for every case.
- Render helpers that remove pagination or virtualization limits during tests.
- CI failures that vanish when the suite is serialized.

## Fix Patterns

- For retained references: clear caches, scope them per instance, or switch ownership to `WeakMap`/`WeakSet` when appropriate.
- For test lifecycle leaks: add `afterEach` cleanup, restore mocks, dispose roots, and reset module state explicitly.
- For async leaks: cancel with `AbortController`, invalidate with tokens, or ignore stale completions after reset.
- For fixture pressure: reuse immutable parsed data, avoid deep clones, and split heavy cases.
- For worker pressure: isolate the heavy file, reduce `--maxWorkers`, or keep generated-per-file test sharding.

Do not treat manual `global.gc()` calls as a real fix. They are diagnostic only.

## Search First, Then Patch

Use `rg` before editing:

- Cache/state suspects: `rg -n 'new (Map|Set)|cache|memo|singleton' src`
- Missing cleanup: `rg -n '_reset\\(|reset\\(|afterEach|beforeEach' src`
- Async/resource leaks: `rg -n 'setTimeout|setInterval|addEventListener|AbortController|listen\\(|watch\\(' src`

## Verification

1. Re-run the exact reproducer until it is stable and exits cleanly.
2. Run `pnpm lint`.
3. Run `pnpm check`.
4. Run the smallest justified test scope.
5. Run `pnpm test:full` only for cross-cutting fixes.

## Guardrails

- Prefer evidence over intuition.
- Keep scope tight; leak triage is not a general refactor.
- Change one variable at a time while diagnosing.
- If the issue is only peak concurrency, say so clearly instead of calling it a leak.
