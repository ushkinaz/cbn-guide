# Husky Git Hooks

This directory contains Git hooks that help maintain code quality and automate commit message formatting.

## Installation

Husky hooks are typically installed automatically during `yarn install` via the `prepare` script in `package.json`.

If you need to manually install or re-install them (e.g., after a fresh clone):

```bash
yarn prepare
```

## Active Hooks

### `pre-commit`

- **Purpose**: Runs `lint-staged`.
- **Details**: Executes the checks defined in `lint-staged.config.js` on staged files, including:
  - Formatting with Prettier
  - Svelte component validation (`svelte-check`)
  - TypeScript compilation check (`tsc --noEmit`)

### `prepare-commit-msg`

- **Purpose**: Automates backport attribution for cherry-picked commits.
- **Details**: When a commit is cherry-picked (e.g., from the original `nornagon/cdda-guide`), this hook rewrites the "cherry picked from commit ..." message to clearly indicate it as a backport from `nornagon/cdda-guide@hash`.

## Maintenance

To add or modify hooks, you can create or edit files in this directory. Husky hooks are just shell scripts that Git executes during various lifecycle events.

For more information, visit the [Husky documentation](https://typicode.github.io/husky/).
