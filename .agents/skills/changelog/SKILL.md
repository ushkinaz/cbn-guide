---
name: changelog
description: This agent generates a CHANGELOG.md for the cbn-guide application by analyzing git history.
---

# Parameters

## Inputs

- `window`: (String) Time window for git log (default: "1 month ago").
- `output_file`: (String) Target file to update (default: "CHANGELOG.md").

# Instructions & Rules

## Analysis & Tone

- **Player-Centric Benefits**: Explain _what_ the user experiences, not _how_ it was implemented.
  - Bad: "Optimized search index loading speed."
  - Good: "Faster search with less stuttering when you are typing."
- **Group Related Fixes**: If there are multiple technical fixes for a single system (e.g., mapgen, loot), aggregate them into one impactful line.
  - Bad:
    - "[FIX] Correct loot calculations..."
    - "[FIX] Fixed mapgen probability..."
    - "[FIX] Fixed parameterized mapgen..."
  - Good: "[FIX] Corrected loot calculations chances and mapgen logic."
- **Active & Simple**: Use natural language. Avoid "Improved X" if you can say "X is now Y".
- **Volume**: It is better to list _more_ candidates than fewer. The user will curate the list. Do not aggressive filter out minor valid user-facing changes, but DO group highly redundant ones.

## Mapping & Prefixes

Map conventional commit types (extracted from `git log`) to these prefixes:

- `feat` -> `[FEATURE]`
- `fix` -> `[FIX]`
- `style`, `ui` -> `[UI]`
- `perf` -> `[PERF]`
- Search/Typing related -> `[SEARCH]`

## GitHub Issue Enrichment

- If a commit message contains an issue reference (e.g., `#123` or `closes #123`), use the `remote-github` MCP server (`issue_read`) to fetch the issue title and body.
- Use the issue information to find the _user-facing symptom_ or _benefit_, rather than the technical bug description.

## Formatting (Markdown)

- Entries should be grouped by month.
- Each month section must use this structure:
  - `## <Month YYYY>`
  - `### Highlights`
  - `### Changes`
- `Highlights` must contain **1-3 bullets max** and only the most important end-user outcomes for that month.
- `Changes` contains the fuller grouped list of user-facing bullets.
- Each change entry is a markdown bullet: `- [PREFIX] Description`.
- Highlight bullets are plain bullets without prefixes unless explicitly requested.
- No PR numbers, links, or usernames in the bullet text itself.

# Examples

## Example 1: Grouping Fixes

**Input Commits:**

- `fix: correct fill_ter tile count`
- `fix: handle ammo in mapgen`
- `fix: resolve parameterized mapgen values`

**Output:**

- `[FIX] Corrected loot calculations and mapgen logic`

## Example 2: User Benefit

**Input Commit:**

- `perf(search): optimize search index initialization by avoiding eager flattening`

**Output:**

- `[SEARCH] Faster search with less stuttering when you are typing`

## Example 3: Feature Summary

**Input Commits:**

- `feat(i18n): add Transifex API scripts`
- `feat(i18n): simplify strings`
- `chore(i18n): own instance`

**Output:**

- `[FEATURE] Translations moved to Transifex project`

## Example 4: Month Section Format

**Output:**

```md
## February 2026

### Highlights

- Full mod support landed with dependency-aware selection and shareable URLs.
- Data and mapgen parsing became more accurate for real BN content.

### Changes

- [FEATURE] Mod loading now respects order and provenance.
- [FEATURE] Mod selector UX was improved with better defaults and sorting.
- [FIX] Data normalization fixes improved correctness for BN edge cases.
```

# Execution Plan

1. Run `git log --since="{window}" --pretty=format:"%h %ad %s" --date=short`.
2. Group commits by scope/topic where possible.
3. For each group/commit:
   - Identify the type and user benefit.
   - Fetch issue details if unclear.
4. For each month, pick **1-3** headline `Highlights` (most important to end users).
5. Generate `### Changes` bullets using the specific prefixes.
6. Insert/update month sections in `{output_file}` using the required structure.
