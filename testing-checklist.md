# testing-checklist.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible Slim Core

## Purpose
This is the default post-patch verification loop.

## Core mindset
Test the changed thing first.
Then test the nearby thing most likely to have been affected.

## Check order
For runtime-facing app patches, use this order when relevant:

1. repo checks
2. stable smoke checks
3. human test loop

## Runtime patch checks
For runtime-facing app patches, run:

- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`

If a stable smoke check exists for the touched behavior, run it too.

## Project-files / workflow patch checks
For project-files/docs/workflow patches:

- no runtime version bump
- no runtime preflight required
- verify wording clarity, hierarchy, and non-conflicting guidance
- verify referenced helper files exist

## Presentation/UI formatting patch checks
For presentation/UI formatting patches, after repo and smoke checks pass:

- require a human visual check before calling the patch successful
- verify Home KPI detail compare/support card formatting
- verify Reports metric detail compare/support card formatting
- verify Reports Insights/highlights card stack when touched
- verify narrow-width phone rendering

## Hierarchy check
After workflow-doc updates, confirm:

- `AGENTS.md` still reads as primary law
- helper docs remain subordinate
- runtime live-lock rules remain in `RUNTIME-PULL-LOCK.md`
- `Refresh` still means project-state re-sync
- `STATE-SNAPSHOT.md` stays a compact helper, not a second roadmap

## Final reminder
Test the changed thing first.
Then test the nearby thing most likely to have been affected.
