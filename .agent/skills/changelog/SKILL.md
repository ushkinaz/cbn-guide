---
name: changelog-app
description: This agent generates a CHANGELOG.md for the cbn-guide application by analyzing git history from the last month. It maps conventional commit types to preferred user-friendly prefixes and enriches entries with GitHub issue descriptions if referenced.
---
# Parameters

## Inputs

- `window`: (String) Time window for git log (default: "1 month ago").
- `output_file`: (String) Target file to update (default: "CHANGELOG.md").

# Instructions & Rules

## Analysis & Tone

- **Player-Centric Benefits**: Explain *what* the user experiences, not *how* it was implemented.
    - Bad: "Optimized search index loading speed."
    - Good: "Faster search with less stuttering when you are typing."
- **Group Related Fixes**: If there are multiple technical fixes for a single system (e.g., mapgen, loot), aggregate them into one impactful line.
    - Bad:
        - "[FIX] Correct loot calculations..."
        - "[FIX] Fixed mapgen probability..."
        - "[FIX] Fixed parameterized mapgen..."
    - Good: "[FIX] Corrected loot calculations chances and mapgen logic."
- **Active & Simple**: Use natural language. Avoid "Improved X" if you can say "X is now Y".
- **Volume**: It is better to list *more* candidates than fewer. The user will curate the list. Do not aggressive filter out minor valid user-facing changes, but DO group highly redundant ones.

## Mapping & Prefixes

Map conventional commit types (extracted from `git log`) to these prefixes:

- `feat` -> `[FEATURE]`
- `fix` -> `[FIX]`
- `style`, `ui` -> `[UI]`
- `perf` -> `[PERF]`
- Search/Typing related -> `[SEARCH]`

## GitHub Issue Enrichment

- If a commit message contains an issue reference (e.g., `#123` or `closes #123`), use the `remote-github` MCP server (`issue_read`) to fetch the issue title and body.
- Use the issue information to find the *user-facing symptom* or *benefit*, rather than the technical bug description.

## Formatting (Markdown)

- Entries should be grouped by month.
- Each entry is a markdown bullet: `- [PREFIX] Description`.
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

# Execution Plan

1. Run `git log --since="{window}" --pretty=format:"%h %ad %s" --date=short`.
2. Group commits by scope/topic where possible.
3. For each group/commit:
   - Identify the type and user benefit.
   - Fetch issue details if unclear.
4. Generate the markdown list using the specific prefixes.
5. Prepend the new entries to `{output_file}`.
