# START-HERE.md — Vibe Coder 5.1 Router-First Core

## Purpose
This file is the complete quick map for the router-first Vibe Coder 5.1 pack.

Use it to find the right helper file fast.
Do not treat this file as stronger than `AGENTS.md`.

## Read order
For normal work, use this order:

1. `AGENTS.md`
2. this file
3. the specific helper file for the task

## Active core file index
These are the generic Vibe Coder 5.1 operating files.

| File | Role |
|---|---|
| `AGENTS.md` | Operational law |
| `START-HERE.md` | Complete helper-file index and quick map |
| `VIBE-CODER-TASK-ROUTER.md` | First-step task lane routing helper |
| `PROJECT-INSTRUCTION-BLOCK.md` | Project Instructions paste-in / boot layer |
| `STATE-SNAPSHOT.md` | Compact snapshot and handoff shape |
| `RUNTIME-PULL-LOCK.md` | Runtime re-sync and live-lock helper |
| `PARKING-LOT-GUIDE.md` | Parking Lot and Suggestions behavior |
| `patch-prompt-style.md` | Browser-based Codex / web sandbox patch prompt style |
| `codex-app-style.md` | Desktop app / local / worktree patch style |
| `testing-checklist.md` | Verification loop and hierarchy checks |
| `CODEX-IMAGE-PACK-HANDOFF-RULE.md` | Visual reference / Codex image pack workflow |
| `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md` | Separates Codex acceptance checks from Jeremy manual QA |
| `CODEX-PR-PUSH-WORKFLOW.md` | Explicit PR workflow, Codex Cloud vs App/local split, PR success standard, and Jeremy-only merge authority |
| `PATCH-SAFETY-STACK.md` | Quiet safety stack for meaningful Pull Sheets, Codex prompts, audits, and visual patches |
| `DECISION-LOCK-LEDGER.md` | Locked/active/watch/deprecated/avoid decision ledger for drift control |

## Optional project overlays
Optional overlays are project-specific. They are not generic Vibe Coder law.

| File | Use when |
|---|---|
| `BANK-THE-CATCH-YTD-PAID-STRATEGY.md` | Bank the Catch Home / Trips / Insights / YTD / free-paid strategy |

If an optional overlay is installed directly into a project root, use the project-local path for that file. In the transport zip, optional overlays may appear under `_optional-overlays/`.

## Optional project resource guides
Optional project resource guides are project-specific references. They are not generic Vibe Coder law.

| File | Use when |
|---|---|
| `BTC-REPO-ASSET-REFERENCE-GUIDE.md` | Bank the Catch repo-side image/brand asset selection, mastheads, icons, illustrations, or visual asset patch planning |

If an optional resource guide is installed directly into a project root, use the project-local path for that file. In the transport zip, optional resources may appear under `_optional-resources/`.

## Pack notes
Pack notes are delivery/install documentation, not operating rules.

| File | Role |
|---|---|
| `_pack-notes/VIBE-CODER-5.1-PACK-NOTES.md` | Pack summary, install notes, and repo update checklist |

## Official commands
Command behavior is defined by `AGENTS.md`.

Quick reference:

- `Refresh` = re-sync the Vibe Coder project state and return the compact current working state
- `Read pack` = re-read the workflow pack and return the compact current rule/state anchor
- `Pull <item>` = default full working execution output for one item or one safe batch
- `Do <item>` = compatibility alias for `Pull <item>`
- `Recommend next` = recommend the best next move
- `Snapshot` = produce the compact state snapshot
- `Audit <item>` = run a focused audit without building the full pull sheet

## What to read for common jobs
- command, authority, or workflow confusion → `AGENTS.md`
- task type, lane, or output-shape confusion → `VIBE-CODER-TASK-ROUTER.md`
- Project Instructions setup / boot text → `PROJECT-INSTRUCTION-BLOCK.md`
- handoff or resume work → `STATE-SNAPSHOT.md`
- runtime re-sync / live-lock / anti-drift → `RUNTIME-PULL-LOCK.md`
- Parking Lot or Suggestions behavior → `PARKING-LOT-GUIDE.md`
- browser-based Codex / web sandbox patch work → `patch-prompt-style.md`
- desktop app / local / worktree patch work → `codex-app-style.md`
- verification and hierarchy check → `testing-checklist.md`
- screenshot, mockup, crop, or Codex image pack work → `CODEX-IMAGE-PACK-HANDOFF-RULE.md`
- Codex acceptance checks vs Jeremy device/manual QA → `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md`
- explicit PR creation, PR review, or Codex Cloud vs App/local PR behavior → `CODEX-PR-PUSH-WORKFLOW.md`
- patch safety header, risk meter, smallest safe path, Codex patch contract, or repo-truth labels → `PATCH-SAFETY-STACK.md`
- locked/active/watch/deprecated decisions or drift protection → `DECISION-LOCK-LEDGER.md`
- Bank the Catch Home / Trips / Insights / YTD / free-paid strategy → `BANK-THE-CATCH-YTD-PAID-STRATEGY.md` wherever it is installed
- Bank the Catch repo image/brand asset selection or available-asset review → `BTC-REPO-ASSET-REFERENCE-GUIDE.md` when installed
- pack install/update notes → `_pack-notes/VIBE-CODER-5.1-PACK-NOTES.md`

## Router-first note
This installed pack keeps the existing helper seams intact while adding a first-step router for task lane selection.

The router helps choose the right helper file and output shape. It does not replace `AGENTS.md` or redefine Pull Sheet structure.

## Final reminder
Use `AGENTS.md` as the source of truth for rules, commands, and decisions.
If there is a conflict, `AGENTS.md` wins.

## Command note
`Pull` is the main day-to-day working command.
Use `Audit` when you want inspection first.
Use `Do` only as a compatibility alias if that wording feels more natural.
