# AGENTS.md — Bank the Catch

This repo uses a one-change-at-a-time workflow for **Bank the Catch** (Shellfish Tracker PWA).

## Mission
Ship small, safe patches with fewer regressions.

## Source of truth
Use these files together:

- `START-HERE.md`
- `PARKING-LOT-GUIDE.md`
- `patch-prompt-style.md`
- `codex-app-style.md`
- `testing-checklist.md`

If instructions conflict, use this order:
1. the user’s direct request
2. this `AGENTS.md`
3. the file-specific workflow docs

## Default workflow
- Default to **Codex Web / browser sandbox** workflow.
- Use `patch-prompt-style.md` for Web Codex work.
- Use `codex-app-style.md` only when desktop/local repo workflow clearly applies.
- Do not mix Web and desktop styles.

## Patch rules
- Do one main job per patch.
- Keep the diff as small as possible.
- Every patch includes a **build/version bump +1**.
- Edit only the files needed for the requested task.
- Avoid unrelated cleanup, renaming, or formatting.
- Prefer local changes over global refactors.
- Keep risky work isolated.

## User-controlled Git flow
- Do not auto-commit.
- Do not auto-create a PR.
- The user clicks **Commit** manually.
- The user clicks **Create PR** manually.

## Safety locks
Do not modify these unless the user explicitly asks:

- service worker
- caching
- install/update flow
- storage
- schema
- data model
- migrations

Never bundle service worker work or storage/schema work with normal UI patches.

## Explanation style
Use short plain-English:

- **Now** = what the app does today
- **Change** = what this patch changes
- **Better** = why this improves the app

Keep it short.

## Normal patch output
For app patch work, output:

- Goal
- Now → Change → Better
- Repro (3 steps, only if bug)
- Done when (3 checks)
- Not in this patch (2 bullets)
- Files edited
- Codex Task Prompt
- Commit message (50 chars or less)
- Changelog
- Rollback rope: `If bad: revert the PR.`

## Parking Lot behavior
Use the user’s current working Parking Lot as the live list of waiting ideas.

Rules:
- Pull one main item at a time by default.
- Keep extra ideas out of the active patch.
- Add side ideas to the Parking Lot instead of mixing them into the patch.
- Do not remove an item until the user confirms the patch worked.
- While a patch is in progress, do not print the full Parking Lot unless asked.
- After the user confirms a patch worked:
  - remove that item from the working Parking Lot
  - show the updated Parking Lot
  - recommend the next best item with a short why

## Recommendation rules
When choosing the next patch, prefer:
- high user value
- low regression risk
- small/local diff
- iPhone PWA safety
- Android Chrome safety
- native-feeling mobile UI
- release-safe choices for eventual Google Play and Apple App Store direction

## Native UI defaults
Prefer native controls where practical:
- `<input type="date">`
- `<input type="time">`
- `<select>`
- `inputmode="decimal"`
- `inputmode="numeric"`

Add small guardrails that reduce Android risk.

## Testing rule
After each patch, use `testing-checklist.md`.

Default test mindset:
- iPhone Safari
- iPhone PWA
- Android Chrome when available
- quick reopen/reload sanity checks

Use extra caution for:
- service worker
- versioning
- install/update
- storage/schema/data changes

## Project files mode
If the user says the task is building project files, docs, templates, or instruction files:
- do not output a patch slice
- output only the requested file contents

## Shorthand commands
Treat these as valid:
- `Do 8`
- `Pull 11`
- `Recommend next`
- `Desktop 5`

Interpret the number as the user’s current Parking Lot item number.

## Operating principle
Ship one clean fish at a time.
Do not turn one patch into three patches.
