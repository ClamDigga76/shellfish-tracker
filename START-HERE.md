# START-HERE.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible

## Purpose
This file is the quick map for the Bank the Catch workflow-doc set.

Use it to find the correct helper file quickly.
Do not treat this file as stronger than `AGENTS.md`.

## Read order
For normal work, use this order:

1. `AGENTS.md`
2. this file
3. the specific helper file for the task

## File roles
- `AGENTS.md` = operational law (primary)
- `PROJECT-INSTRUCTION-BLOCK.md` = wrapper/adaptation block for this project package
- `STATE-SNAPSHOT.md` = compact snapshot and handoff helper
- `RUNTIME-PULL-LOCK.md` = runtime re-sync and live-lock guardrails
- `PARKING-LOT-GUIDE.md` = Parking Lot and Suggestions behavior
- `patch-prompt-style.md` = Web Codex patch prompt style
- `codex-app-style.md` = desktop/local prompt style
- `testing-checklist.md` = post-patch test loop and hierarchy check

## Official commands
- `Refresh` = re-sync the VibeCoder project state
- `Pull <item>` = build the pass for one item or one safe batch
- `Do <item>` = execute the normal working output for the item
- `Recommend next` = recommend the best next move
- `Snapshot` = produce the compact state snapshot
- `Audit` = run a focused system or work audit

## Default mode
Default to **Web Codex / browser sandbox** workflow unless the task clearly requires desktop/local repo flow.

Do not mix Web Codex instructions and desktop/local instructions in one patch response.

## Patch classes
There are two patch classes:

### Runtime-facing app patch
Changes shipped app behavior, UI, runtime code, boot flow, app-loaded assets, or user-visible build/version output.

### Project-files / docs / workflow patch
Changes instructions, templates, helper docs, workflow files, or project support files without changing shipped runtime app behavior.

## Refresh meaning
In this workflow-doc set, **Refresh** means project-state re-sync of docs/instructions.

Refresh does **not** mean automatic runtime re-check or forced live repo/runtime operations.

## Important reminders
- Keep helper docs subordinate and non-competing.
- Keep runtime live-lock guidance in `RUNTIME-PULL-LOCK.md`.
- Keep `PROJECT-INSTRUCTION-BLOCK.md` as wrapper/adaptation text, not as a second law file.
- Keep `STATE-SNAPSHOT.md` compact and useful, not a second roadmap.

## Final reminder
If there is a conflict, `AGENTS.md` wins.
