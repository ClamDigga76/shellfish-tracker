# codex-app-style.md — Vibe Coder 5.1 Router-First Core

## Purpose
This file defines the **desktop app / local / worktree** patch style.

Use this only when the workflow clearly involves the Codex desktop app, a local checkout, a worktree handoff, desktop review flow, or desktop tools. Jeremy's default Codex surface is Codex Cloud / Web unless he explicitly says desktop/app/local/worktree.

## Source-of-truth reminder
`AGENTS.md` is the operational source of truth.

Use this file as helper style for desktop/app work, not as a competing rule set.

## Codex App / Local / Worktree opt-in rule
Codex App / Desktop / Local / Worktree behavior is opt-in by Jeremy's wording.

Use this file when Jeremy explicitly says he is using Codex App, desktop app, local checkout, local worktree, or asks for local/worktree behavior.

Do not apply local/worktree Git assumptions to Codex Cloud / Web prompts by default.

## Execution surface note
When useful, name the execution surface clearly enough to prevent drift.

Use the smallest clear label that fits:
- `Codex Local`
- `Codex Worktree`
- `GitHub PR review`
- `PR requested by Jeremy`
- `PR required by active workflow`

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
9. when PR creation is intended by Pull command, explicitly requested, or required, use `CODEX-PR-PUSH-WORKFLOW.md`; if this is truly local/worktree and PR creation is unavailable, commit when safe and report the Push/PR setup limitation
10. verify after PR review, merge, or handoff


## Codex App / Local / Worktree PR behavior
This file applies to Codex App, desktop, local, and worktree workflows.

In this lane, normal Git concepts such as `origin`, branch, commit, push, and manual PR steps may apply.

Normal app Pulls are PR-intended by default in Jeremy's workflow, but this local/worktree file applies only when Jeremy explicitly says he is using that surface. Use `CODEX-PR-PUSH-WORKFLOW.md` when PR creation is intended, explicitly requested, or required.

When PR creation is intended/requested/required, Codex may prepare, commit, push, and open a PR only if the local/worktree setup supports it.

If the patch is PR-intended but push or PR creation is unavailable, report it as a **Push/PR setup limitation** and provide Jeremy’s exact next manual step.

Do not turn local push/origin limitations into `No PR requested`. Do not apply Codex Cloud-specific assumptions here. Codex Cloud / Web may use a different connected-repo PR creation flow and should not be forced to prove readiness through persistent local `origin` state after setup.

Codex may not merge pull requests. Jeremy remains the final reviewer and merge authority.

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

Do not pause after the anchor just to ask for confirmation. Do not end the anchor with “If you want…”, “Should I proceed?”, “I can now…”, “I’ll now execute…”, or similar approval-gate language. Origin, remote-main, push, or PR creation limitations should be reported as **Push/PR setup limitations**, not repo truth. They should not stop the patch before it starts unless the scoped patch is impossible.

## Push/PR setup limitation wording

For Codex Local / Worktree prompts, use **Push/PR setup limitation** when origin, remote-main verification, push, or PR creation is unavailable.

Do not leave the limitation as a vague routine note. State what was attempted, what could not be completed from this local environment, and Jeremy’s exact manual next step.

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
