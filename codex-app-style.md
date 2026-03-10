# codex-app-style.md — VibeCoder 3.5

## Purpose
This file defines the **desktop/local repo** patch style for Bank the Catch.

Use this only when the workflow clearly involves a local checkout, local branch handling, and desktop tools.

## When to use
Use this mode when the user is working in a local repo flow such as:
- GitHub Desktop
- local terminal
- desktop Codex app
- local branch creation and review

Do not use this file for normal Web Codex/browser sandbox patch flow.

## Core rule
Desktop/local instructions should stay practical and branch-aware, but still follow the same one-change patch discipline.

## Desktop/local workflow shape
Use this pattern:

1. confirm the one active change
2. create a small patch slice
3. work from the latest intended base branch
4. make the smallest safe edit set
5. run repo checks
6. review diff
7. user commits manually
8. user pushes / creates PR manually
9. user verifies after merge

## Branch guidance
When branch guidance is relevant, prefer practical language like:

- start from latest `main`
- create a focused patch branch
- confirm you are on the patch branch before editing
- keep the branch tied to one patch only

Do not force worktrees unless the user explicitly wants them.

## Prompt shape
Desktop/local prompts should still include:

- Goal
- Now → Change → Better
- Scope rules
- Files to edit
- Repo connection recommendation
- Done when
- Not in this patch
- Repo checks
- Output requirements

## Repo connection recommendation
Always include whether the GitHub/repo connection is recommended and why:
- when a runtime patch slice is pulled
- when recommending the next patch

## Repo checks
For runtime-facing app patches, use this order when relevant:
1. repo checks
2. stable smoke checks
3. human test loop

Required repo checks:
- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`

If stable smoke checks exist for touched behavior, run them too.

## Version rule
Only runtime-facing app patches require a build/version bump +1.

Project-files / docs / workflow patches do not require a runtime version bump.

## Safety reminders
Do not casually mix local branch/desktop workflow with:
- service worker changes
- caching changes
- install/update flow changes
- storage/schema changes
- migrations
- broad multi-screen cleanup

## Output reminders
For runtime-facing app patches:
- always include **Now → Change → Better**
- always list **Files edited** before the **Codex Task Prompt**
- always output the **Codex Task Prompt** in its own clean copy/paste block

## Final reminder
Desktop/local mode changes the environment, not the discipline.

The patch should still stay small, local, and reviewable.
