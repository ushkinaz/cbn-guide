# Memory Debug Commands

Use one diagnostic at a time. All test commands here include `--no-color` to match repo guidance.

## Smallest Reproducer

```bash
pnpm vitest run <path/to/test.ts> --run --no-color
```

## Per-File Heap Trend

```bash
pnpm vitest run <path/to/test.ts> --run --no-color --logHeapUsage
```

Repeat the same file to prove cumulative growth:

```bash
for i in {1..5}; do pnpm vitest run <path/to/test.ts> --run --no-color --logHeapUsage || break; done
```

Use this when a single file slows down, keeps growing, or eventually OOMs.

## Leak or Worker Pressure?

```bash
pnpm vitest run src --run --no-color --maxWorkers=1 --no-file-parallelism
```

If this passes but the parallel run fails, suspect worker pressure, large fixtures, or too much concurrent happy-dom rendering.

For cross-cutting repros aligned with repo guidance:

```bash
pnpm test:full -- --maxWorkers=50% --bail 1 --no-color
```

## Hanging Process

```bash
pnpm vitest run <path/to/test.ts> --run --no-color --reporter=hanging-process
```

Look for dangling timers, intervals, watchers, servers, or teardown promises that never settle.

## GC Pressure

```bash
NODE_OPTIONS='--trace-gc --trace-gc-verbose --max-old-space-size=4096' pnpm vitest run <path/to/test.ts> --run --no-color
```

Use this when you need proof that old-space keeps climbing instead of being reclaimed.

## Heap Snapshot Near OOM

```bash
NODE_OPTIONS='--heapsnapshot-near-heap-limit=2 --max-old-space-size=2048' pnpm vitest run <path/to/test.ts> --run --no-color
```

Use this for large retained graphs or when the process dies before you can inspect it live.

## Inspector

```bash
pnpm vitest run <path/to/test.ts> --run --no-color --inspect-brk
```

Use this only when CLI evidence is not enough and you need DevTools heap inspection.

## Optional Async-Leak Pass

Current repo Vitest is `4.0.18`, so `--detect-async-leaks` is not available by default. If the failure strongly looks like stale async work and a temporary Vitest bump is acceptable, use:

```bash
pnpm add -D vitest@^4.1.0-beta.6
pnpm vitest run <path/to/test.ts> --run --no-color --detect-async-leaks
```

Good fit for route-change, unmount, and store-reset leaks where promises or callbacks finish after the owner is gone.

## Search Recipes

Cache and singleton growth:

```bash
rg -n 'new (Map|Set)|cache|memo|singleton' src
```

Reset and cleanup coverage:

```bash
rg -n '_reset\\(|reset\\(|afterEach|beforeEach' src
```

Async and resource lifetime suspects:

```bash
rg -n 'setTimeout|setInterval|addEventListener|AbortController|listen\\(|watch\\(' src
```

Repo-specific reset points already worth checking:

```bash
rg -n '_reset\\(|reset\\(' src/data.ts src/search.ts src/routing.ts src/tile-data.ts
```

## Fixture Inspection

Never grep `_test/all.json`. Use `jq`:

```bash
jq '.data[] | select(.id=="<id>" and .type=="<type>")' _test/all.json
```

```bash
jq '.data[] | select(.type=="item") | .id' -r _test/all.json
```

## Verification

```bash
pnpm lint
pnpm check
pnpm test:fast -- --no-color
```

Only run `pnpm test:full` when the fix changes shared lifecycle, routing, data loading, or test architecture.
