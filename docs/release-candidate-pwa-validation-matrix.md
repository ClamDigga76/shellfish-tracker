# Release-Candidate PWA Validation Matrix

## Purpose / when to use
Use this for **release-candidate builds**, not every small patch.

Use it when Bank the Catch is close to an initial PWA release and a candidate build needs a repeatable device + mode validation pass.

This is the release-candidate source of truth for:
- which device/mode combinations were tested
- which critical flows were checked
- who tested them and when
- what is still blocked, failed, or waiting on retry

Pair it with `testing-checklist.md` for the normal post-patch loop. Use this document when a build needs release-confidence tracking across real devices and installed-vs-browser modes.

## How to use
1. Fill in the candidate header before testing starts.
2. Run the device + mode matrix row by row.
3. For each row, mark **PASS**, **FAIL**, **NOT TESTED**, or **BLOCKED**.
4. If a row fails or is blocked, capture the blocker and the next retry note immediately.
5. Run the critical flows on each priority environment unless a row is blocked before launch.
6. Record the final **Go / No-Go / Hold** decision only after the ledger is complete.

## Candidate header block
- Candidate/build label:
- App version shown in UI (if applicable):
- Branch / commit:
- Test date:
- Tester:
- Notes on install/update setup:

## Device + mode matrix
Use one row per real test environment.

| Environment / device | Mode | Priority | What to verify first | Result (PASS / FAIL / NOT TESTED / BLOCKED) | Notes / blocker / retry notes |
| --- | --- | --- | --- | --- | --- |
| iPhone Safari | Browser | Required | Cold open, boot, top-nav sanity, reopen once in Safari |  |  |
| iPhone installed PWA | Installed PWA | Required | Standalone launch, shell rendering, reopen from home screen |  |  |
| Android Chrome | Browser | Required | Cold open, boot, top-nav sanity, reload once in Chrome |  |  |
| Android installed PWA | Installed PWA | Required | Standalone launch, shell rendering, reopen from app icon |  |  |
| Desktop browser sanity (optional) | Browser | Optional | Quick boot + navigation sanity only |  |  |

## Critical flow checklist
Run these flows for each required device/mode row unless blocked earlier.

| Flow | What counts as a pass | iPhone Safari | iPhone installed PWA | Android Chrome | Android installed PWA | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| App opens / boots | App launches without obvious fatal or blank-screen behavior. |  |  |  |  |  |
| Correct screen rendering | Home and first-open screen layout look intact with no obvious mobile breakage. |  |  |  |  |  |
| Core navigation works | Main navigation opens expected screens without dead taps or broken back-path behavior. |  |  |  |  |  |
| New trip entry basic sanity | New Trip opens, accepts basic input, and can reach a normal save/review point. |  |  |  |  |  |
| Edit/view existing trip sanity | Existing trip opens, shows expected data, and basic edit/view actions still work. |  |  |  |  |  |
| Reports opens + basic range/filter sanity | Reports opens and a basic date/range/filter change renders safely. |  |  |  |  |  |
| Settings opens + key actions render | Settings opens and key actions/status surfaces render without broken layout. |  |  |  |  |  |
| Backup/export surface sanity | Backup/export entry point opens and surface copy/actions render clearly. |  |  |  |  |  |
| Reload / reopen sanity | Reload in browser or reopen in installed mode does not break startup or obvious state continuity. |  |  |  |  |  |
| Browser vs installed mode clarity | Installed-vs-browser context is clear where release behavior differs. |  |  |  |  |  |
| Update / version trust surface check | Version/build/update surfaces look coherent for this candidate and do not create trust confusion. |  |  |  |  |  |

Status key: **PASS** / **FAIL** / **NOT TESTED** / **BLOCKED**.

## Pass ledger / results table
Use this ledger to track the actual run history for the candidate. Add rows instead of overwriting prior attempts.

| Candidate/build label | Test date | Tester | Environment / device | Mode | Flow or area checked | Result (PASS / FAIL / NOT TESTED / BLOCKED) | Notes / blocker / retry notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  | iPhone Safari | Browser |  |  |  |
|  |  |  | iPhone installed PWA | Installed PWA |  |  |  |
|  |  |  | Android Chrome | Browser |  |  |  |
|  |  |  | Android installed PWA | Installed PWA |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |

## Blockers / follow-up notes
- Blocking issue:
- Affected candidate/build label:
- Affected device/mode:
- Repro note:
- Retry owner:
- Retry plan:
- Retest result:

## Final go / no-go decision line
- Decision: Go / No-Go / Hold
- Decision date:
- Decision owner:
- Blocking risks still open:
- Follow-up required before next candidate:
