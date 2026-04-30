# codex-app-style.md — Vibe Coder 5.0 Router-First Core

## Purpose
This file defines the **desktop app / local / worktree** patch style.

Use this when the workflow clearly involves the Codex desktop app, a local checkout, a worktree handoff, desktop review flow, or desktop tools.

## Source-of-truth reminder
`AGENTS.md` is the operational source of truth.

Use this file as helper style for desktop/app work, not as a competing rule set.

## Execution surface note
When useful, name the execution surface clearly enough to prevent drift.

Use the smallest clear label that fits:
- `Codex Local`
- `Codex Worktree`
- `GitHub PR review`

Do not add ceremony when the execution surface is already obvious.

## Desktop/app workflow shape
Use this pattern:

1. confirm the one active change
2. create a small patch slice
3. choose the right execution surface: Local or Worktree
4. work from the intended base
5. make the smallest safe edit set
6. run the relevant repo checks
7. review in the app diff / review flow
8. stage, revert, and commit in-app or locally when useful
9. when GitHub is connected and the patch should become a PR, use `CODEX-PR-PUSH-WORKFLOW.md` so Codex can attempt to push the branch and open a PR for Jeremy review when available
10. verify after PR review, merge, or handoff


## Codex PR push workflow
When GitHub is connected and normal patch work should move toward a pull request, use `CODEX-PR-PUSH-WORKFLOW.md`.

Codex may prepare, commit, attempt to push, and open pull requests when available.

Codex may not merge pull requests.

Jeremy remains the final reviewer and merge authority. If push or PR creation is unavailable, Codex should report the branch name, commit SHA, touched files, tests run, and exact next manual step for Jeremy.

## Prompt shape
Desktop/app prompts still follow the same patch slice structure:

1. Goal
2. Now → Change → Better
3. Repro (if this is a bug, regression, or visible trust seam)
4. Done when
5. Not in this patch
6. Likely files / surfaces
7. Execution surface recommendation
8. Codex Task Prompt
   - include **Suggested commit message** inside the task prompt
   - include **Acceptance checks** inside the task prompt when needed
9. Manual QA for Jeremy, outside the Codex Task Prompt when needed
10. Real-World / In-App Explanation Layer from `AGENTS.md` when useful
    - In real app use
    - What the user will notice
    - What stays the same
    - Why this matters
11. Changelog
12. Rollback rope

## Real-World / In-App Explanation Layer
For technical, runtime-facing, visual, or user-facing patches, include this layer near the end of the Pull Sheet, after Manual QA for Jeremy and before Changelog / Rollback rope.

It should explain:
- In real app use
- What the user will notice
- What stays the same
- Why this matters

This is for Jeremy’s judgment and should not expand the Codex patch scope.

## Execution reminders
When useful:
- classify the lane before writing the prompt
- keep Suggestions outside the active pass
- use `Snapshot` when handoff clarity matters
- anchor the seam before real execution work
- identify likely files or surfaces early
- keep the explanation plain and recommendation-first
- do not widen scope just to make the output feel more complete

## Codex Local pre-edit anchor rule
In Codex Local / Worktree prompts, the pre-edit anchor is a report-and-proceed step.

Codex should report the anchor, then continue directly into the scoped patch unless a real blocker exists.

The pre-edit anchor is not an approval gate. The generated Codex Local / Worktree prompt should say to proceed directly after the anchor, not wait for another confirmation.

Do not pause after the anchor just to ask for confirmation. Do not end the anchor with “If you want…”, “Should I proceed?”, “I can now…”, “I’ll now execute…”, or similar approval-gate language. Local Git limitations should be reported clearly, but they should not stop the patch before it starts unless the scoped patch is impossible.

## Pull / Do command rule
When the user says `Pull <item>`, treat it as the default full working execution output for that item.

For desktop/app work, the output should normally be handoff-ready for Codex use, not just descriptive.

`Do <item>` is a compatibility alias, not a separate stage.

Use `Audit <item>` when the user wants repo-truth or logic inspection first without the full pull sheet.

## Refresh wording rule
Refresh in this doc set means project-state sync and instruction alignment.

Refresh does not auto-trigger runtime pull/lock/preflight behavior.

## Runtime live-lock boundary
Keep runtime re-sync/live-lock/anti-drift guardrails in `RUNTIME-PULL-LOCK.md`.
