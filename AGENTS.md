# cbn-guide Agent Handbook

Focused rules for AI agents. Keep this open while working.

## Scope & precedence

- This file covers the whole repo; nested `AGENTS.md` files override for their folders.
- Specialized rules live in `./.agent/rules/*.md`; workflows in `./.agent/workflows/*.md`.
- Stay in the repo root (no `cd`). Yarn only.

## Start-of-session checklist

- Disable shell history to avoid pollution: `unset HISTFILE; unsetopt share_history`.
- Scan for nested `AGENTS.md` if you touch new directories.
- Note whether the task touches UI, localization, or data schema so you can pull the matching rule file early.

## Project snapshot

- Svelte 4 + Vite, TypeScript (ES2023), Vitest, scoped CSS. Prettier formatting.
- App mirrors Cataclysm: Bright Nights data; upstream checkout may live at `../Cataclysm-BN` for cross-reference.
- Core files: `src/App.svelte`, `src/Thing.svelte`, `src/data.ts`, `src/colors.ts`, `src/types.ts`, `src/types/*`, assets in `src/assets`, tests as `*.test.ts`, static files in `public/`.
- Test fixtures: `_test/all.meta.json` (tracked), `_test/all.json` (downloaded), `_test/builds.json` (downloaded). `yarn fetch:fixtures` populates `_test/all.json`.
- Developer primers live in `README.md` and `DEVELOPMENT.md`; keep agent-facing rules here.

## Commands you actually need

- Install deps: `yarn install`
- Dev server: `yarn dev` (http://localhost:3000)
- Build: `yarn build`
- Full check (downloads fixtures if missing): `yarn test --bail 2`
- Type checks: `yarn verify`
- Lint / format: `yarn verify:format`, `yarn fix:format` (run before committing)

## Data handling (always-on truthiness)

- Source of truth is `_test/all.json`; use `jq` filters to avoid loading everything:
  - `jq '.data[] | select(.id==\"<id>\" and .type==\"<type>\")' _test/all.json`
- Raw JSON inherits via `copy-from`; rely on `src/data.ts` (`CddaData` + `_flatten`) to resolve final values.
- For schema issues, run `yarn vitest --run schema.test.ts --bail 1` or follow `.agent/workflows/fix-schema-validation.md`.

## UI, styling, and colors

- Keep game palette (`--cata-color-*`) for in-game data only; keep app UI colors from `global.css` separate. Never mix palettes.
- Verify UI changes visually via the browser subagent against `http://localhost:3000/` when you touch components.

## Localization

- Use `t` from `@transifex/native` for UI strings: `t("Text")`, `t("Cost: {n}", { n })`.
- Avoid string concatenation; prefer inline interpolation.
- Game-derived strings should come from the i18n helpers in `data.ts` (`singular`, `plural`, `translate`, etc.).

## Engineering hygiene

- Always TypeScript (`<script lang="ts">` in Svelte). Keep heavy data logic in `.ts` modules, not Svelte templates.
- Maintain reactivity; avoid side effects during render.
- Preserve compatibility with current and latest-stable Cataclysm-BN when it does not add significant complexity.

## Quick decision tree

1. Touching schema or fixtures? Read `.agent/rules/data-source.md`.
2. Touching UI/layout/colors? Read `.agent/rules/colors.md` and `.agent/rules/ui-verification.md`.
3. Adding/changing UI text? Read `.agent/rules/localization.md`.
4. Filtering JSON? `jq` guidance lives in `.agent/rules/jq.md`.
5. Using browser agent? Read `.agent/rules/browser-nightly.md`.
