---
name: create-pr
description: Prepare and open a pull request from the current local branch by analyzing the diff against a target branch, extracting architectural intent from local docs like ADRs or tech specs, drafting a reviewer-facing PR body, pushing the branch, checking for an existing PR, and creating a draft PR by default.
---

Use this skill when the user wants to prepare, draft, or create a pull request from the current local branch.

The purpose is not merely to open a PR, but to describe the branch truthfully:

- what changed
- why it changed
- what improved
- what compromises were accepted
- what behavior changed
- how to test it manually
- what might surprise a reviewer.

## Inputs To Confirm

Ask only when these are genuinely unclear:

- target branch
- whether local uncommitted changes belong in the PR
- whether the PR should be draft or ready for review

Reasonable defaults:

- target branch: the user-specified branch, otherwise the repo default branch
- PR state: draft
- scope: tracked changes on the current branch; treat untracked notes/specs as context unless the user says they belong in the PR

## Workflow

1. Inspect branch state.
   - Run `git status --short --branch`.
   - Capture the current branch name.
   - Check whether the worktree is mixed or whether untracked files appear to be context-only.

2. Compare against the target branch.
   - Use `git merge-base HEAD <target>`.
   - Read `git log <target>..HEAD --oneline`.
   - Read `git diff --stat <target>...HEAD`.
   - Skim focused diffs for the files that carry the architectural or behavioral center of gravity.

3. Read local intent sources.
   - Prefer ADRs, local tech specs, architecture docs, and project workflow docs.
   - If an uncommitted local file like `spec.md` exists and clearly explains the change, use it as context for the PR body without assuming it belongs in the branch.
   - If a prior issue-writing or documentation skill exists, borrow a useful structure but adapt it to reviewer-facing PR prose.

4. Identify the branch thesis.
   - Reduce the diff to a few coherent themes.
   - Separate architecture changes from renames, test churn, or mechanical fallout.
   - Identify reviewer triggers:
     - removed APIs
     - removed lazy paths
     - changed failure handling
     - changed loading strategy
     - changed user-visible UI states

5. Draft the PR title and body.
   - Use a title that reflects the main architectural move, not every side effect.
   - The body should be real Markdown prose, not raw notes.
   - Cover at least:
     - `Summary`
     - `Why`
     - `What Changed`
     - `What's Improved`
     - `Compromises / Trade-offs`
     - `Behavior Changes`
     - `Reviewer Notes / Potential Triggers`
     - `Critical Path For Manual Testing`
     - `Verification`

6. Verify publication readiness.
   - Ensure the branch is the one the user intends to publish.
   - If tracked, local changes exist and obviously belong in scope, stage and commit them intentionally.
   - If the worktree is mixed, do not stage silently; ask the user which files belong in the PR.

7. Push the branch.
   - Push the current branch to `origin`.
   - If upstream tracking cannot be written locally but the remote branch is created successfully, note that as a local bookkeeping failure, not a PR blocker.

8. Avoid duplicate PRs.
   - Search for an existing open PR for the same `head` and `base`.
   - If one exists, update or report it instead of creating another.

9. Create the PR.
   - Prefer the GitHub connector/app when available.
   - Use the current branch as `head`.
   - Use the requested target branch as `base`.
   - Default to a draft PR unless the user explicitly asked for ready review.

10. Report the result.

- Return the PR URL, branch, target branch, and any residual caveats.
- Mention if checks were not run as part of the PR creation pass.

## PR Body Heuristics

### Summary

State the architectural center of the branch in 2-4 sentences. If the branch is large, group related changes into a short flat list.

### Why

Explain the problem the old code had:

- too many responsibilities in one place
- mismatched abstractions
- hidden loading phases
- misleading error handling
- drift between docs and code

Prefer architectural causes over line-by-line narration.

### What Changed

Group by change area, for example:

- loading architecture
- failure handling
- UI/data flow
- locale/i18n cleanup
- test/doc updates

### What's Improved

Call out the benefits a reviewer should care about:

- clearer ownership boundaries
- simpler runtime model
- less state drift
- easier testing
- more direct user flow

### Compromises / Trade-offs

Name the costs plainly. Good PRs do not pretend every choice is free.

Examples:

- more eager fetching
- quieter degradation on optional failures
- less granular progress reporting
- one extra request to eliminate a second loading path

### Behavior Changes

Split into:

- user-visible changes
- internal or reviewer-relevant changes

If behavior changed because of an architectural simplification, say so directly.

### Reviewer Notes / Potential Triggers

Use this section to preempt confusion around:

- removed functions
- renamed modules
- deleted loading spinners or error states
- changed fallback behavior
- retired retries or lazy loaders

Do not hide removals. Explain why they were removed and what replaced them.

### Critical Path For Manual Testing

List a short, ordered path through the UI or runtime behavior.

Prefer high-signal checks:

1. happy path load
2. feature path touched by the refactor
3. degraded path
4. cancellation/reload/race path

### Verification

State what was actually verified.

If checks were not run during PR creation, say so explicitly.

## Safety Rules

- Never invent checks that were not run.
- Never claim a local spec or notes file is included in the PR unless it is actually tracked in the diff.
- Never create duplicate PRs for the same branch/base pair.
- Never stage unrelated changes without confirmation.
- Do not bury removed behavior; surface it in reviewer notes.

## Output Shape

When asked only to draft PR text, return:

- suggested title
- full PR body
- any short questions only if blockers remain

When asked to create the actual PR, complete the full flow and return:

- PR URL
- branch name
- base branch
- whether it is draft or ready
- any caveats about local git state or skipped verification
