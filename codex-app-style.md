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

## Source-of-truth reminder
`AGENTS.md` is the operational source of truth.

Use this file as the helper style for desktop/local repo work, not as a competing rule set.

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
Desktop/local prompts should still follow the same Bank the Catch patch slice structure:

1. Goal
2. Now → Change → Better
3. Repro (if this is a bug, regression, or visible trust seam)
4. Done when
5. Not in this patch
6. Files edited
7. Repo connection recommendation
8. Codex Task Prompt
9. Commit message
10. Changelog
11. Rollback rope

Inside the **Codex Task Prompt**, prefer the same concrete structure used in Web Codex work:
- Goal
- Live repo finding
- Required behavior
- Non-goals
- Implementation guidance
- Likely files
- Possibly / Only if needed
- Validation
- Required checks
- Report back with

## Earned patch sub-types (lightweight)
Use these only when they help shape the prompt more accurately.

For the full operational rules, follow `AGENTS.md`.

### 1) Standard runtime patch
Use for normal user-facing behavior, UI, runtime, or shipped-app changes.

Prompt reminders:
- include required build/version bump +1
- keep version-chain files aligned
- require `npm run check:repo`
- require `node scripts/preflight-verify.mjs --expect-version=<new version>`
- if a stable smoke check exists for touched behavior, run it too

### 2) Runtime correction / hotfix patch
Use when the immediately previous runtime patch introduced a real break.

Prompt reminders:
- prioritize restoring stability over expanding scope
- keep the patch tighter than a normal runtime feature patch
- include **Repro** when applicable
- if runtime-facing, still require version bump +1 and runtime preflight
- prefer the smallest safe repair

### 3) Project-files / workflow support patch
Use for repo/process/docs/helper-file updates that do not change shipped runtime app behavior.

Prompt reminders:
- do **not** do a runtime version bump
- do **not** force runtime preflight unless clearly needed
- run repo-side checks relevant to touched files
- keep changes operational and lightweight

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
- include **Repro** when relevant
- always list **Files edited** before the **Codex Task Prompt**
- always output the **Codex Task Prompt** in its own clean copy/paste block
- keep **Not in this patch** explicit so the local diff stays focused

## Final reminder
Desktop/local mode changes the environment, not the discipline.

The patch should still stay small, local, and reviewable.
