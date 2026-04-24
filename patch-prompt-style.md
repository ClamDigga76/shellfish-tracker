# patch-prompt-style.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible Slim Core

## Purpose
This file defines the default **browser-based Codex / web sandbox** patch prompt style.

## Source-of-truth reminder
`AGENTS.md` is the source of truth for workflow rules.

Use this file as a helper style guide only.

## Default patch slice structure
Use this order:

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

## Prompt guidance
Keep prompts concrete, scoped, and implementation-ready.

For project/workflow support patches:
- keep scope to docs/workflow files only
- avoid runtime edits
- avoid version bump/preflight unless runtime files were touched

For presentation/UI formatting patches:
- include a short human visual verification note in Done when or Validation
- keep full visual-check policy in `testing-checklist.md` (do not duplicate it here)

Include a short success handoff note when useful:
- what changed
- what stayed stable
- what checks were run
- what immediate next action is

## 4.5 execution reminders
When useful:
- classify the lane before writing the prompt
- keep Suggestions outside the active pass
- preserve Jeremy-style plain English in the framing
- use `Snapshot` when the work needs a compact handoff

## Pull / Do command rule
When the user says `Pull <item>`, treat it as the default full working execution output.

That means the response should usually include the full usable pull sheet in the right lane shape, not just a light preview.

`Do <item>` is a compatibility alias for the same behavior.

Use `Audit <item>` only when the user wants inspection without the full pull sheet.

## Refresh wording rule
When using **Refresh** in prompt text, treat it as project-state re-sync.

Do not interpret Refresh as automatic runtime validation, runtime pull, or live repo lock checks.

## Runtime live-lock boundary
Runtime re-sync/anti-drift/live-lock controls live in `RUNTIME-PULL-LOCK.md`.

Do not duplicate that policy text here.
