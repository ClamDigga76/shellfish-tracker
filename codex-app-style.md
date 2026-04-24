# codex-app-style.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible Slim Core

## Purpose
This file defines the **desktop app / local / worktree** patch style.

Use this only when the workflow clearly involves local checkout, branch handling, and local or worktree tooling.

## Source-of-truth reminder
`AGENTS.md` is the operational source of truth.

Use this file as helper style for desktop app/local/worktree work, not as a competing rule set.

## Execution surface note
Use compact execution-surface wording when relevant in prompts or handoff:

- Codex Local
- Codex Worktree
- GitHub PR review

## Desktop app/local/worktree workflow shape
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

## Prompt shape
Desktop app/local/worktree prompts follow the same patch slice structure:

1. Goal
2. Now → Change → Better
3. Repro (if this is a bug, regression, or visible trust seam)
4. Done when
5. Not in this patch
6. Likely files / surfaces
7. Repo connection recommendation
8. Plain-language patch layer (from `AGENTS.md`) when useful
9. Codex Task Prompt (include Suggested commit message inside this section)
10. Changelog
11. Rollback rope

## 4.5 execution reminders
When useful:
- classify the lane before writing the prompt
- keep Suggestions outside the active pass
- use `Snapshot` when handoff clarity matters
- keep the explanation plain and recommendation-first

## Pull / Do command rule
When the user says `Pull <item>`, treat it as the default full working execution output for that item.

`Do <item>` is a compatibility alias, not a separate stage.

Use `Audit <item>` when the user wants repo-truth or logic inspection first without the full pull sheet.

## Refresh wording rule
Refresh in this doc set means project-state sync and instruction alignment.

Refresh does not auto-trigger runtime pull/lock/preflight behavior.

## Runtime live-lock boundary
Keep runtime re-sync/live-lock/anti-drift guardrails in `RUNTIME-PULL-LOCK.md`.
