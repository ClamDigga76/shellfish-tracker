# testing-checklist.md — VibeCoder 3.5

## Purpose
This is the default post-patch human test loop for Bank the Catch.

Use it after patches to reduce regressions, especially on mobile.

## Core mindset
Test the changed thing first.
Then test the nearby thing most likely to have been affected.

## Hotspot-first caution
Before test selection, quickly check `REGRESSION-HOTSPOTS.md` and increase caution around any touched high-risk area.

## Check order
For runtime-facing app patches, use this order when relevant:

1. repo checks
2. stable smoke checks
3. human test loop

## Repo checks
For runtime-facing app patches, run:

- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`

If a stable smoke check exists for the touched behavior, run it too.

Project-files / docs / workflow patches do not require runtime preflight.

## Default human test targets
Prefer this order when relevant:

1. iPhone Safari
2. iPhone standalone PWA
3. Android Chrome when available
4. quick reopen/reload sanity

## Basic post-patch loop
Use this lightweight loop:

1. open the changed screen/flow
2. confirm the main change works
3. confirm there is no obvious layout break
4. confirm nearby actions still work
5. reopen/reload once
6. if relevant, verify version display/update trust surfaces
7. only then mark the patch as worked

## Extra caution areas
Be especially careful with:

- service worker
- version chain
- cache/update flow
- boot flow
- new trip flow
- edit trip flow
- save behavior
- reports filters
- settings actions
- backup/restore
- storage/schema/data behavior

## Runtime patch quick checklist
Use what applies:

- app boots
- changed screen opens
- no obvious console/runtime error
- no broken spacing/layout
- primary interaction still works
- nearby interaction still works
- version/build display is correct when applicable
- reload/reopen does not break the change

## Project-files / workflow patch checklist
For project files, confirm:

- file wording is correct
- hierarchy is clear
- rules do not conflict
- version rules are scoped correctly
- output examples still match workflow intent

## iPhone PWA sanity checks
When the patch touches runtime behavior or UI, try to verify:

- standalone launch works
- screen renders correctly after reopen
- no stale-version confusion
- no obvious broken tap target
- no unexpected scroll/tap issue

## Final rule
Do not remove a Parking Lot item until the user confirms the patch worked.
