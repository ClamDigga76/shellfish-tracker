# STORE-RELEASE-GATES.md

## Purpose
Use this checklist before any Google Play or Apple App Store release work.

This is a docs-only release gate. It does not change runtime behavior.

## How to use
- Mark each row as **Pass**, **Fail**, or **N/A**.
- Add brief evidence notes (file path, screenshot, test note, or decision log).
- Do not move to store submission while any required row is **Fail**.

## Store release gates

| Gate area | Pass criteria | Status (Pass/Fail/N/A) | Evidence / notes |
| --- | --- | --- | --- |
| Wrapper path decision | A wrapper path is explicitly chosen (or explicitly deferred) and the decision owner/date is recorded. |  |  |
| Manifest and app identity sanity | App identity values (`name`, `short_name`, `id`, `start_url`, `scope`, icon references) are internally consistent and match release naming intent. |  |  |
| Icon and splash asset readiness | Required launcher/store/wrapper icon sizes exist and are reviewed for clarity on light/dark backgrounds; splash requirements are listed for the selected wrapper path. |  |  |
| Privacy, terms, and support presence | Privacy policy, terms, and user support/contact surfaces are present, reachable, and match release labeling. |  |  |
| Visible version and release labeling | End users can see a clear app version/build label in-app, and release notes map to that version. |  |  |
| Backup and restore confidence | Backup/export and restore/import flow is tested on realistic data and verified on a second device/profile when possible. |  |  |
| Install and update confidence | Install, reopen, and update behavior is verified with no data-loss surprises across target mobile environments. |  |  |
| Platform verification targets | Verification run is completed for iPhone Safari, iPhone standalone PWA, and Android Chrome; wrapper-target checks are listed if wrapper path is selected. |  |  |
| Final release decision state | A named owner records **Go / No-Go / Hold**, date, and any blocking risks. |  |  |

## Final decision record (required)
- Decision: Go / No-Go / Hold
- Owner:
- Date:
- Blocking risks (if any):
- Follow-up actions:
