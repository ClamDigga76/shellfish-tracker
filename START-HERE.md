# START-HERE.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible Slim Core

## Purpose
This file is the quick map for the repo-compatible slim installed VibeCoder 4.5 core.

Use it to find the right file fast.
Do not treat this file as stronger than `AGENTS.md`.

## Read order
For normal work, use this order:

1. `AGENTS.md`
2. this file
3. the specific helper file for the task

## Installed core file roles
- `AGENTS.md` = operational law
- `PROJECT-INSTRUCTION-BLOCK.md` = project-side wrapper and customization layer
- `STATE-SNAPSHOT.md` = compact snapshot and handoff shape
- `RUNTIME-PULL-LOCK.md` = runtime re-sync and live-lock helper
- `PARKING-LOT-GUIDE.md` = Parking Lot and Suggestions behavior
- `patch-prompt-style.md` = Web Codex / browser patch style
- `codex-app-style.md` = desktop/local patch style
- `testing-checklist.md` = verification loop and hierarchy checks

## Official commands
- `Refresh` = re-sync the VibeCoder project state
- `Pull <item>` = default full working execution output for one item or one safe batch
- `Do <item>` = compatibility alias for `Pull <item>`
- `Recommend next` = recommend the best next move
- `Snapshot` = produce the compact state snapshot
- `Audit <item>` = run a focused audit without building the full pull sheet

## What to read for common jobs
- command, authority, or workflow confusion → `AGENTS.md`
- project-specific adaptation → `PROJECT-INSTRUCTION-BLOCK.md`
- handoff or resume work → `STATE-SNAPSHOT.md`
- runtime re-sync / live-lock / anti-drift → `RUNTIME-PULL-LOCK.md`
- Parking Lot or Suggestions behavior → `PARKING-LOT-GUIDE.md`
- Web Codex/browser patch work → `patch-prompt-style.md`
- desktop/local repo patch work → `codex-app-style.md`
- verification and hierarchy check → `testing-checklist.md`

## Repo-compatible slim-core note
This installed pack keeps the repo's existing helper seams intact instead of replacing them with new helper names.

That means it stays lean for daily use while still matching the repo's current markdown workflow structure.

## Final reminder
Use `AGENTS.md` as the source of truth for rules, commands, and decisions.
If there is a conflict, `AGENTS.md` wins.

## Command note
`Pull` is the main day-to-day working command.
Use `Audit` when you want inspection first.
Use `Do` only as a compatibility alias if that wording feels more natural.
