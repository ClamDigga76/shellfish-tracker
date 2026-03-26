# patch-prompt-style.md — VibeCoder 4.0

## Purpose
This file defines the default **Web Codex / browser sandbox** patch prompt style for Bank the Catch.

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
6. Files edited
7. Repo connection recommendation
8. Codex Task Prompt
9. Commit message
10. Changelog
11. Rollback rope

## Prompt guidance
Keep prompts concrete, scoped, and implementation-ready.

For project/workflow support patches:
- keep scope to docs/workflow files only
- avoid runtime edits
- avoid version bump/preflight unless runtime files were touched

## Refresh wording rule
When using **Refresh** in prompt text, treat it as project-state re-sync.

Do not interpret Refresh as automatic runtime validation, runtime pull, or live repo lock checks.

## Runtime live-lock boundary
Runtime re-sync/anti-drift/live-lock controls live in `RUNTIME-PULL-LOCK.md`.

Do not duplicate that policy text here.
