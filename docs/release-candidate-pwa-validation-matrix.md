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

## Status legend (use everywhere in this doc)
- **PASS** = tested and acceptable for release confidence in that scope.
- **FAIL** = tested and not acceptable; needs a fix before release.
- **NOT TESTED** = not run yet (capacity or sequencing), not a pass.
- **BLOCKED** = cannot complete test due to a known blocker; must include blocker ID.

Quick scan rule:
- **GO** requires all required environments and critical flows at **PASS**.
- Any required-row **FAIL** = **NO-GO**.
- Any required-row **BLOCKED** or **NOT TESTED** = **HOLD** unless explicitly waived by decision owner.

## How to use
1. Fill in the candidate header before testing starts.
2. Run required environments first, then optional environments.
3. For each matrix row, mark **PASS**, **FAIL**, **NOT TESTED**, or **BLOCKED**.
4. If a row fails or is blocked, create/update a blocker entry and assign retry owner + target date immediately.
5. Run the critical flows on each required environment unless blocked before launch.
6. Append all attempts to the pass ledger (do not overwrite earlier entries).
7. Record the final **Go / No-Go / Hold** decision only after matrix + ledger + blockers are current.

## Candidate header block
- Candidate/build label:
- App version shown in UI (if applicable):
- Branch / commit:
- Test date:
- Tester:
- Notes on install/update setup:

## Device + mode matrix
Use one row per real test environment.

### Required release-gate environments
| Environment / device | Mode | What to verify first | Result (PASS / FAIL / NOT TESTED / BLOCKED) | Blocker ID (if BLOCKED/FAIL) | Retry owner | Retry target date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| iPhone Safari | Browser | Cold open, boot, top-nav sanity, reopen once in Safari |  |  |  |  |  |
| iPhone installed PWA | Installed PWA | Standalone launch, shell rendering, reopen from home screen |  |  |  |  |  |
| Android Chrome | Browser | Cold open, boot, top-nav sanity, reload once in Chrome |  |  |  |  |  |
| Android installed PWA | Installed PWA | Standalone launch, shell rendering, reopen from app icon |  |  |  |  |  |

### Optional confidence environments
| Environment / device | Mode | What to verify first | Result (PASS / FAIL / NOT TESTED / BLOCKED) | Notes |
| --- | --- | --- | --- | --- |
| Desktop browser sanity (optional) | Browser | Quick boot + navigation sanity only |  |  |

## Critical flow checklist
Run these flows for each required device/mode row unless blocked earlier.

| Flow | What counts as a pass | iPhone Safari | iPhone installed PWA | Android Chrome | Android installed PWA | Blocker ID (if BLOCKED/FAIL) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App opens / boots | App launches without obvious fatal or blank-screen behavior. |  |  |  |  |  |  |
| Correct screen rendering | Home and first-open screen layout look intact with no obvious mobile breakage. |  |  |  |  |  |  |
| Core navigation works | Main navigation opens expected screens without dead taps or broken back-path behavior. |  |  |  |  |  |  |
| New trip entry basic sanity | New Trip opens, accepts basic input, and can reach a normal save/review point. |  |  |  |  |  |  |
| Edit/view existing trip sanity | Existing trip opens, shows expected data, and basic edit/view actions still work. |  |  |  |  |  |  |
| Reports opens + basic range/filter sanity | Reports opens and a basic date/range/filter change renders safely. |  |  |  |  |  |  |
| Settings opens + key actions render | Settings opens and key actions/status surfaces render without broken layout. |  |  |  |  |  |  |
| Backup/export surface sanity | Backup/export entry point opens and surface copy/actions render clearly. |  |  |  |  |  |  |
| Reload / reopen sanity | Reload in browser or reopen in installed mode does not break startup or obvious state continuity. |  |  |  |  |  |  |
| Browser vs installed mode clarity | Installed-vs-browser context is clear where release behavior differs. |  |  |  |  |  |  |
| Update / version trust surface check | Version/build/update surfaces look coherent for this candidate and do not create trust confusion. |  |  |  |  |  |  |

## Pass ledger / results table
Use this ledger to track run history for the candidate. Add rows for retries; do not delete prior attempts.

| Candidate/build label | Test date | Tester | Environment / device | Mode | Flow or area checked | Result (PASS / FAIL / NOT TESTED / BLOCKED) | Blocker ID (if BLOCKED/FAIL) | Retry owner | Retry target date | Retest status | Notes / retry outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  | iPhone Safari | Browser |  |  |  |  |  |  |  |
|  |  |  | iPhone installed PWA | Installed PWA |  |  |  |  |  |  |  |
|  |  |  | Android Chrome | Browser |  |  |  |  |  |  |  |
|  |  |  | Android installed PWA | Installed PWA |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |

## Blockers / retry ownership log
Use one blocker entry per issue. Keep blocker IDs stable for scan clarity.

- Blocker ID (e.g., B-01):
- Blocking issue:
- Affected candidate/build label:
- Affected device/mode:
- Repro note:
- Severity (release blocking / high / medium):
- Retry owner:
- Retry target date:
- Current status (open / in-progress / fixed / retest-needed / closed):
- Retest date:
- Retest result:
- Notes:

## Final release decision (Go / No-Go / Hold)
- Decision: Go / No-Go / Hold
- Decision date:
- Decision owner:
- Candidate/build label:

Decision guidance:
- **Go** when all required environments are PASS, critical required flows are PASS, and no open release-blocking blocker remains.
- **No-Go** when a required environment/flow is FAIL and no acceptable mitigation exists for this candidate.
- **Hold** when required scope is BLOCKED or NOT TESTED, or when retry work is in progress and decision must wait.

Decision summary fields:
- Required environments status summary:
- Critical flow status summary:
- Open blockers by ID:
- Waivers/accepted risks (if any, explicit owner sign-off):
- Follow-up required before next candidate:
