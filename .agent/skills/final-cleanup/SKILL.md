---
name: final-cleanup
description: Perform a final, surgical cleanup pass on code introduced or touched in the current task while preserving strict scope boundaries. Use when the user asks for "final cleanup", "polish pass", "surgical refactor", or "last pass" before handoff, and when changes must be limited to newly edited files/hunks without modifying unrelated legacy code.
---

# Final Cleanup

Perform a constrained cleanup that improves quality without expanding scope.
Operate only inside files and code regions changed in the current task unless the user explicitly broadens scope.

## Scope Lock First

Establish the editable boundary before making any changes.

1. Identify scope from the current task using `git diff` (or the user-provided file list).
2. Treat only touched files and touched hunks as editable.
3. Refuse legacy drive-by edits outside that boundary.
4. If a required fix appears out of scope, pause and ask for explicit approval.

## Cleanup Workflow

### 1) Targeted Cleanup

Within touched regions only:

- Remove unused imports, variables, functions, and dead branches introduced during the task.
- Simplify trivial logic where behavior stays identical.
- Improve naming clarity for newly introduced symbols when low risk.
- Keep style and formatting aligned with project conventions.

### 2) Documentation Hygiene

Within new/touched code only:

- Add missing doc comments for new public functions.
- Add short comments for non-trivial control flow or data transformations.
- Update docs only when directly related to touched behavior.

### 3) Local Reorganization

Improve readability without widening impact:

- Reorder helper functions inside a touched module when it improves comprehension.
- Collapse obvious duplication inside changed blocks.
- Avoid cross-module architecture changes during cleanup mode.

### 4) Validation

Confirm cleanup is behavior-safe:

1. Run focused checks first (targeted tests, typecheck, lint, or project-specific verify commands relevant to touched files).
2. Run broader checks only if risk is cross-cutting or the user asks.
3. Report any checks not run.

## Decision Rules

Use these tie-breakers when uncertain:

- Prefer no edit over risky edit.
- Prefer minimal diff over broad refactor.
- Prefer explicit user confirmation over assumption when scope is ambiguous.
- Never "fix nearby" legacy code unless the user explicitly asks.

## Typical Trigger Phrases

Activate this skill when prompts resemble:

- "Do a final cleanup pass."
- "Polish only what we touched."
- "Remove dead code from this task, but avoid legacy changes."
- "Surgical refactor before merge."

## Output Checklist

Return results with:

- Scope confirmation (what was considered in-bounds).
- Cleanup actions performed.
- Validation commands run and outcomes.
- Explicit note that legacy untouched code was not modified.
