# AGENTS.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible

This project uses a one-change-at-a-time workflow for **Bank the Catch** (Shellfish Tracker PWA).

## Mission
Ship small, safe, understandable progress while preserving earned work, reducing drift, and keeping the system reusable.

## Core rule
This file is the main operational source of truth for normal patch work in this project.

Helper docs are support tools only. They must not compete with or override this file.

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

## VibeCoder 4.5 repo-compatible identity
This workflow keeps the real 4.5 upgrades while staying compatible with the repo’s existing markdown helper seams:

- a locked compact command layer
- a Jeremy response layer
- a Suggestions workflow with simple promotion rules
- a compact state snapshot and handoff model
- entry-state and lane triage
- mode-aware execution guidance through existing helper docs
- runtime live-lock kept separate from project `Refresh`

## Helper docs
These files support the workflow, but do not outrank this file:

- `START-HERE.md`
- `PROJECT-INSTRUCTION-BLOCK.md`
- `STATE-SNAPSHOT.md`
- `RUNTIME-PULL-LOCK.md`
- `PARKING-LOT-GUIDE.md`
- `patch-prompt-style.md`
- `codex-app-style.md`
- `testing-checklist.md`

## Default workflow
Use this sequence for normal work:

1. classify the entry state
2. choose the right lane
3. identify the one active change
4. keep side ideas out of the active pass
5. turn the active change into the smallest useful pass
6. make the smallest safe edit set
7. run the relevant checks
8. review for drift, overlap, and widened scope
9. user manually commits
10. user manually creates PR
11. user reviews / merges PR
12. user verifies the result
13. only then remove, retire, or close the item

Do not turn one pass into multiple meaningful changes unless the user clearly wants bundling and the work is tightly related and low-risk.

## Official command layer
Keep the official command set small.

### `Refresh`
Refresh the VibeCoder project state.

It should:
- re-anchor to current rules
- re-check current authority files
- re-sync the active Parking Lot, Suggestions, and guardrails
- re-establish current lane, scope, and next best move

It does not automatically mean repo or runtime re-check.

### `Pull <item>`
Build the pass for one Parking Lot item or one safe combined batch.

Default output:
- Goal
- Now → Change → Better
- Done when
- Not in this pass
- likely files or surfaces
- next recommended action

### `Do <item>`
Execute the normal working output for the item.

Default output:
- the full working pass in the right shape for the lane
- implementation-ready guidance when relevant
- checks and handoff details when relevant

### `Recommend next`
Recommend the best next move.

Default output:
- the best recommendation
- why it is the best move now
- one lower-priority alternative when useful

### `Snapshot`
Produce the compact current-state snapshot from `STATE-SNAPSHOT.md`.

### `Audit`
Run a focused consistency, compatibility, logic, or drift audit.

## Jeremy response layer
Use this tone when replying to Jeremy:

- plain English first
- teach during the work
- recommendation first
- short “what this means” notes
- short “why this matters” notes
- clear “what changed / what stayed / what’s next”
- preserve momentum instead of over-stopping for tiny clarifications

This is a response layer only.
It is not a second rule system.

## Entry-state triage
Classify incoming work as one of:

- new
- early draft
- imported / in progress
- messy / scattered
- stalled
- rescue
- near-ready but unclear

Use the simplest accurate label.
Do not create a giant taxonomy.

## Lane selection
Choose the best lane for the current job:

- Project
- Patch
- Docs or workflow
- Rescue
- Audit
- Handoff
- Hybrid or staged path when clearly needed

Prefer one primary lane even when a hybrid path exists.

## Web Codex vs desktop/local
- Default to **Codex Web / browser sandbox** workflow.
- Use `patch-prompt-style.md` for Web Codex work.
- Use `codex-app-style.md` only when desktop/local repo workflow clearly applies.
- Do not mix Web and desktop styles in the same patch response.

## Patch classes
There are two patch classes in this project.

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
- `PROJECT-INSTRUCTION-BLOCK.md`
- `STATE-SNAPSHOT.md`
- `RUNTIME-PULL-LOCK.md`
- `PARKING-LOT-GUIDE.md`
- templates
- instruction docs
- process files
- Parking Lot files

## Earned patch sub-types (keep lightweight)
Use these only to clarify execution style. Do not treat them as a large taxonomy.

### 1) Standard runtime patch
Use for normal user-facing behavior/UI/runtime changes.

- follow normal runtime-facing rules
- require version bump +1 and aligned version chain
- require `npm run check:repo` and runtime preflight verify

### 2) Runtime correction/hotfix patch
Use when the immediately previous runtime patch introduced a real break, such as a boot/runtime regression.

- prioritize restoring stability over feature scope
- keep scope tighter than a normal runtime feature patch
- include Repro when applicable
- if runtime-facing, still do version bump +1 and required preflight/repo checks

### 3) Repo/workflow support patch
Use for smoke-track, repo-support, hotspot notes, and workflow/doc guidance updates.

- no runtime version bump
- no runtime preflight unless clearly needed
- run repo-side checks relevant to touched files

## Suggestions workflow
Keep strong optional improvements separate from the active pass unless the user explicitly chooses them.

Use Suggestions for ideas that are:
- worth keeping
- not part of the active pass
- not ready to become a Parking Lot item yet

Do not silently add suggestion items into the active pass.

## Suggestion promotion rules
A Suggestion can be promoted when:
- it solves a real repeated need
- it has a clear seam
- it is concrete enough to build
- it will not quietly widen the current pass

A Suggestion should stay parked when:
- it is promising but vague
- it belongs to a later lane
- it needs more evidence or clearer scope

Drop a Suggestion when:
- it is obsolete
- it conflicts with newer direction
- it no longer earns its keep

## Patch rules
- Do one main job per patch.
- Keep the diff as small as possible.
- Edit only the files needed for the requested task.
- Avoid unrelated cleanup, renaming, or formatting.
- Prefer local changes over global refactors.
- Keep risky work isolated.
- Preserve current behavior unless the requested change is behavioral.

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

## Runtime live-lock placement
Runtime re-sync and live-lock anti-drift guardrails belong in `RUNTIME-PULL-LOCK.md`.

Keep this file focused on baseline operating law and project-state workflow.

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

## Confidence language
When useful, separate:
- **solid** = directly supported by the current pack or request
- **inferred** = strong best-fit conclusion from the current evidence
- **recommended** = best move, even if other options exist
- **needs validation** = worth checking before adoption or ship

## Required patch output format
For normal runtime-facing app patch work, output in this order:

1. Goal
2. Now → Change → Better
3. Repro (only when this is a bug, regression, or visible trust seam)
4. Done when
5. Not in this patch
6. Files edited
7. Repo connection recommendation
8. Codex Task Prompt
9. Commit message
10. Changelog
11. Rollback rope: `If bad: revert the PR.`

## Repo-check rules
For runtime-facing app patches, require:

- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`

If the patch is project-files/docs/workflow only:
- do not force a runtime version bump
- do not force runtime preflight

If a stable smoke check exists for touched behavior, run it too.

## Final reminder
Keep the system simple enough to use under pressure.
If a helper and the law file seem to disagree, `AGENTS.md` wins.
