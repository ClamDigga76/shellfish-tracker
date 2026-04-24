# AGENTS.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible Slim Core

This project uses a one-change-at-a-time workflow for VibeCoder-guided build, patch, audit, and rescue work.

## Mission
Ship small, safe, understandable progress while preserving earned work, reducing drift, and keeping the system reusable.

## Core rule
This file is the main operational source of truth for normal work.

Helper docs are support tools only. They must not compete with or override this file.

## Instruction priority
If instructions conflict, use this order:

1. the user’s direct request
2. this `AGENTS.md`
3. project helper docs

## VibeCoder 4.5 repo-compatible identity
This slim pack keeps the real 4.5 upgrades while staying compatible with the repo's existing markdown helper seams:

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

## Anti-drift anchoring rule
Before planning or executing a pass, re-anchor to current authority and scope.

Minimum anchor set:
- user request and done criteria
- this `AGENTS.md`
- active lane and single active change
- pass boundaries (`Not in this pass`)

If drift appears mid-pass, pause and re-anchor before continuing.

## Automatic check priority
Run only the checks that match the lane and changed surfaces.

Priority order:
1. hierarchy and authority consistency checks for docs/workflow changes
2. targeted repo checks directly tied to touched files
3. broader checks only when risk, scope, or user request requires them

Do not default to runtime preflight for docs-only passes.

## Default workflow
Use this sequence for normal work:

1. classify the entry state
2. choose the right lane
3. identify the one active change
4. keep side ideas out of the active pass
5. turn the active change into the smallest useful pass
6. run the relevant checks
7. review for drift, overlap, and widened scope
8. user adopts, commits, or applies changes when relevant
9. user verifies the result
10. only then remove, retire, or close the item

Do not turn one pass into multiple meaningful changes unless the user clearly wants bundling and the work is tightly related and low-risk.

## Official command layer
Keep the official command set small.

### `Read pack`
Read the compact workflow pack and restate the active operating frame.

Default output:
- current authority order
- current lane and active change
- command map and intended use
- key guardrails likely to matter for this pass

Use this when re-entering work, after interruptions, or when command drift is suspected.

### `Refresh`
Refresh the VibeCoder project state.

It should:
- re-anchor to current rules
- re-check current authority files
- re-sync the active Parking Lot, Suggestions, and guardrails
- re-establish current lane, scope, and next best move

Output contract (compact):
- authority check result
- lane + active item
- guardrail reminders
- next best move

`Refresh` is project-state sync only. It does not automatically imply runtime validation, repo fetch, or environment diagnostics.

### `Pull <item>`
Default execution command.

Use it to do the real working pass for one Parking Lot item or one safe combined batch.

Default output:
- quick audit result when relevant
- Goal
- Now → Change → Better
- Done when
- Not in this pass
- repo-aware assumptions when needed
- likely files or surfaces
- patch-ready or handoff-ready output in the right lane shape
- relevant checks only
- small changelog
- rollback rope
- next action when relevant

### `Do <item>`
Compatibility alias for `Pull <item>`.

Do not treat `Do` as a separate stage.
By default, `Pull` and `Do` execute together.

### `Recommend next`
Recommend the best next move.

Default output:
- the best recommendation
- why it is the best move now
- one lower-priority alternative when useful

### `Snapshot`
Produce the compact current-state snapshot from `STATE-SNAPSHOT.md`.

### `Audit <item>`
Run a focused consistency, compatibility, logic, repo-truth, or drift audit without building the full pull sheet.

## Plain-language patch translation rule
When a patch plan is technical, include a plain-language translation.

Keep it short and practical:
- what changed
- why it matters
- what stays the same
- what to verify next

## Success tail rule
End execution responses with a short success tail when relevant:
- what changed
- what stayed stable
- what checks were run
- what the immediate next action is

## Initiative rule
Take the smallest safe initiative that unblocks momentum inside the approved scope.

Do not widen scope silently.
If a useful adjacent idea appears, park it as a Suggestion unless the user explicitly pulls it into the active pass.

## Practical success target
Prefer “usefully correct and easy to adopt” over “maximal rewrite.”

A pass is practically successful when it is:
- scoped tightly
- understandable on first read
- reversible with low risk
- verified at the right depth for the lane

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

## Runtime live-lock placement
Runtime re-sync and live-lock anti-drift guardrails belong in `RUNTIME-PULL-LOCK.md`.

Keep this file focused on baseline operating law and project-state workflow.

## Repo truth guardrail for future pulls
Before reporting branch or remote limitations, distinguish **repo truth** from **local worktree state**.

### Repo truth
- The GitHub remote is the source of truth for default branch and branch existence.
- Do not say the repo has no `main` branch unless the remote repo itself confirms that.
- When asked to use latest `main`, treat remote `main` as the intended base unless the remote proves otherwise.

### Local worktree limitations
If the current local worktree does not have a configured `origin` remote, does not have a local `main`, or cannot fetch `origin/main`, report that as a **local environment limitation**, not repo truth.

Use wording like:
- `The local worktree does not have a configured origin remote.`
- `The local worktree does not currently have a local main branch checked out.`
- `I could not verify origin/main from this local environment, so I proceeded from the available local base.`

Do **not** use wording like:
- `This repo has no main branch`
- `This repo has no configured origin remote`

unless the remote repo itself confirms those statements.

### Required reporting when local environment limits a pull
Always report:
- the local branch used
- the local base commit used
- whether remote `main` was verified or unavailable from the local environment
- whether the limitation is local-only or repo truth

## Confidence language
When useful, separate:
- **solid** = directly supported by the current pack or request
- **inferred** = strong best-fit conclusion from the current evidence
- **recommended** = best move, even if other options exist
- **needs validation** = worth checking before adoption or ship

## Final reminder
Keep the system simple enough to use under pressure.
If a helper and the law file seem to disagree, `AGENTS.md` wins.
