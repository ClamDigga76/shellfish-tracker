# AGENTS.md — Bank the Catch / VibeCoder 3.5

This repo uses a one-change-at-a-time workflow for **Bank the Catch** (Shellfish Tracker PWA).

## Mission
Ship small, safe, reviewable patches with fewer regressions.

## Core rule
This file is the main operational source of truth for normal patch work in this repo.

Use helper docs when useful, but do not depend on them to understand the default workflow.

## Instruction priority
If instructions conflict, use this order:

1. the user’s direct request
2. this `AGENTS.md`
3. project helper docs

## Project identity
Bank the Catch is a mobile-first shellfish tracking PWA with high sensitivity around:

- iPhone Safari behavior
- iPhone standalone PWA behavior
- Android Chrome behavior
- version/update trust
- offline/cache safety
- storage/schema safety
- future Google Play / Apple App Store readiness

## Helper docs
These files support the workflow, but do not outrank this file:

- `START-HERE.md`
- `PARKING-LOT-GUIDE.md`
- `patch-prompt-style.md`
- `codex-app-style.md`
- `testing-checklist.md`
- `PROJECT-INSTRUCTION-BLOCK.md`

## Default workflow
Use this sequence for normal patch work:

1. identify the one active change
2. keep side ideas out of the patch
3. convert the active change into a patch slice
4. make the smallest safe edit set
5. run required checks
6. review changed files for scope drift
7. user manually commits
8. user manually creates PR
9. user reviews / merges PR
10. user verifies the patch worked
11. only then remove the item from the Parking Lot

Do not turn one patch into multiple meaningful changes unless the user clearly wants bundling and the work is tightly related and low-risk.

## Web Codex vs desktop/local
- Default to **Codex Web / browser sandbox** workflow.
- Use `patch-prompt-style.md` for Web Codex work.
- Use `codex-app-style.md` only when desktop/local repo workflow clearly applies.
- Do not mix Web and desktop styles in the same patch response.

## Patch classes
There are two patch classes in this repo.

### A) Runtime-facing app patch
A runtime-facing app patch changes shipped app behavior, UI, runtime code, boot flow, app-loaded assets, or user-visible build/version output.

Examples:
- `index.html`
- `sw.js`
- files in `js/`
- app-facing `legal/` pages
- manifest/runtime-linked assets when relevant

### B) Project-files / docs / workflow patch
A project-files patch changes project guidance or support files but does not change shipped runtime app behavior.

Examples:
- `AGENTS.md`
- `START-HERE.md`
- `PARKING-LOT-GUIDE.md`
- templates
- instruction docs
- process files
- Parking Lot files

## Patch rules
- Do one main job per patch.
- Keep the diff as small as possible.
- Edit only the files needed for the requested task.
- Avoid unrelated cleanup, renaming, or formatting.
- Prefer local changes over global refactors.
- Keep risky work isolated.
- Preserve current behavior unless the requested change is behavioral.

## Safe bundling rules
Bundling is allowed only when all are true:

- same screen or tightly related behavior
- low regression risk
- small/local diff
- no storage/schema/service-worker expansion
- no hidden second feature

Do not casually bundle:
- service worker work
- caching work
- install/update flow work
- storage/schema work
- migrations
- version-system fixes beyond required alignment
- refactors mixed with UI changes unless explicitly requested

## User-controlled Git flow
- Do not auto-commit.
- Do not auto-create a PR.
- The user clicks **Commit** manually.
- The user clicks **Create PR** manually.

## Safety locks
Do not modify these unless the user explicitly asks:

- service worker behavior
- caching behavior
- install/update flow
- storage
- schema
- data model
- migrations

Never bundle service worker work or storage/schema work with normal UI patches.

## Version bump rule
Only **runtime-facing app patches** require a build/version bump +1.

Project-files / docs / workflow patches do **not** require a runtime build/version bump.

## Version chain guard
Bank the Catch uses a locked version chain.

For any required runtime build/version bump, treat these as one aligned system:

- `index.html` bootstrap/script query version
- bootstrap/runtime version source
- app/runtime version check
- service worker version
- cache name/version
- Settings/build display version

Do not update only one version reference.

Do not ship a runtime patch if version values can drift from one another.

Preferred rule:
- there should be one shared source of truth for app version
- all other version consumers should read from that source

## Version exception to safety lock
A normal patch must not change service worker/caching behavior unless explicitly requested.

Exception:
- if a runtime patch requires a build/version bump, version-alignment edits are allowed only as needed to keep bootstrap, runtime, service worker, cache key, and Settings version aligned
- this does not allow unrelated service worker or cache logic changes

## Clean removal definition
“Clean removal” means:

- remove the visible UI
- remove related handlers/wiring
- remove dead code
- remove layout gaps / empty shells left behind
- preserve behavior elsewhere

Do not leave half-removed work behind.

## Explanation style
Use short plain English:

- **Now** = what the app does today
- **Change** = what this patch changes
- **Better** = why this improves the app

Keep it short and direct.

## Required patch output format
For normal runtime-facing app patch work, output in this order:

1. Goal
2. Now → Change → Better
3. Repro (3 steps, only if bug)
4. Done when (3 checks)
5. Not in this patch (2 bullets)
6. Files edited
7. Repo connection recommendation
8. Codex Task Prompt
9. Commit message (50 chars or less)
10. Changelog
11. Rollback rope: `If bad: revert the PR.`

Rules:
- For runtime-facing app patches, always include **Now → Change → Better**.
- Always list **Files edited** before the **Codex Task Prompt**.
- Always output the **Codex Task Prompt** in its own clean copy/paste block.
- Commit message does not need its own copy/paste block.

## Repo connection recommendation rule
Always include a repo connection recommendation:

- when a runtime patch slice is pulled
- when recommending the next patch

Use this format:

- Use GitHub/repo connection: Yes/No
- Why: <one short reason>

Recommend **Yes** when current repo state, recent patch history, version-chain state, or exact file context would materially improve the patch.

Recommend **No** when the patch is simple, isolated, and already fully specified.

## Repo-check rules
For runtime-facing app patches, require:

- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`

If the patch is project-files/docs/workflow only:
- do not force a runtime version bump
- do not force runtime preflight

If a stable smoke check exists for touched behavior, run it too.

## Test output order
For runtime-facing app patches, present checks in this order when relevant:

1. repo checks
2. stable smoke checks
3. human test loop

## Testing mindset
Default test mindset:

- iPhone Safari
- iPhone standalone PWA
- Android Chrome when available
- quick reopen/reload sanity checks

Use extra caution for:

- service worker
- versioning
- install/update
- storage/schema/data changes
- boot flow
- new/edit/save flows

## Parking Lot behavior
Use the user’s current working Parking Lot as the live list of waiting ideas.

Rules:
- pull one main item at a time by default
- keep extra ideas out of the active patch
- add side ideas to the Parking Lot instead of mixing them into the patch
- do not remove an item until the user confirms the patch worked
- while a patch is in progress, do not print the full Parking Lot unless asked
- after the user confirms a patch worked:
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
- release-safe choices for future store-wrapper / app-store direction

## Native UI defaults
Prefer native controls where practical:

- `<input type="date">`
- `<input type="time">`
- `<select>`
- `inputmode="decimal"`
- `inputmode="numeric"`

Add small guardrails that reduce Android risk.

## Project-files mode
If the task is building or editing project files, docs, templates, workflow files, or instruction files:

- do not force a runtime patch slice unless the user asks for one
- do not force a runtime version bump
- output the requested file contents cleanly

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
