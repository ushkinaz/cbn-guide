---
description: Process for fixing a project issue (TDD-first)
---

Follow these steps to fix an issue from the user provided file:

1. **GitHub Issue Creation**:
   - Create a corresponding GitHub issue using `remote-github_issue_write`.
   - Take note of the GitHub issue ID.

2. **File Renaming**:
   - Rename the local issue file to include the GitHub ID.
   - Format: `[GITHUB_ID]-[Original-Name].md`.
   - Example: `34-param-defaults-ignored-without-fallback.md`.

3. **Worktree & Branch**:
   - Create a git worktree at `../guide-trees/issue-[GITHUB_ID]-[name]`.
   - Create a new branch `fix/[GITHUB_ID]-[name]`.
   - Copy the renamed issue file to the root of the new worktree.

4. **Worktree Setup**:
   - Run `yarn install` and `yarn fetch:fixtures:nightly` inside the worktree directory.

5. **Test-Driven Development (TDD)**:
   - Create a new test case in the relevant `.test.ts` file that reproduces the issue and fails.
   - Run the tests to confirm they fail.

6. **Implementation Planning**:
   - Create or update `implementation_plan.md` in the artifacts directory.
   - Describe the fix and any discovered technical details during the TDD phase.
   - Use `notify_user` to get approval for the plan.

7. **Execution**:
   - Implement the fix in the worktree.
   - Verify the fix by running the reproduction tests (they should now pass).

8. **Verification**:
   - Run mandatory schema tests: `yarn vitest schema.test.ts --run --bail 1`.
   - Address any regressions.

9. **Completion**:
   - Create a `walkthrough.md` artifact.
   - Commit the changes referencing the GitHub issue ID.
   - Format: `fix: [fix description] #[GITHUB_ID]`
   - [fix description] should be one liner, describing what problem the commit fixes
   - Use `notify_user` of the completion.