# START-HERE.md — VibeCoder 3.5

## Purpose
This file is the quick map for the Bank the Catch workflow system.

Use it to find the right file fast.
Do not treat this file as stronger than `AGENTS.md`.

## Read order
For normal work, use this order:

1. `AGENTS.md`
2. this file
3. the specific helper file for the task

## File roles
- `AGENTS.md` = operational law (including earned patch sub-type guidance)
- `PARKING-LOT-GUIDE.md` = Parking Lot behavior
- `patch-prompt-style.md` = Web Codex patch prompt style
- `codex-app-style.md` = desktop/local prompt style
- `testing-checklist.md` = post-patch test loop

## Default mode
Default to **Web Codex / browser sandbox** workflow unless the task clearly requires desktop/local repo flow.

Do not mix Web Codex instructions and desktop/local instructions in one patch response.

## Patch classes
There are two patch classes:

### Runtime-facing app patch
Changes shipped app behavior, UI, runtime code, boot flow, app-loaded assets, or user-visible build/version output.

### Project-files / docs / workflow patch
Changes instructions, templates, helper docs, workflow files, or project support files without changing shipped runtime app behavior.

## Important output reminders
For runtime-facing app patches:
- always include **Now → Change → Better**
- always list **Files edited** before the **Codex Task Prompt**
- always output the **Codex Task Prompt** in its own clean copy/paste block
- always include a **Repo connection recommendation**

## Important version rule
Only **runtime-facing app patches** require a build/version bump +1.

Project-files / docs / workflow patches do **not** require a runtime version bump.

## Quick command examples
Valid shorthand includes:
- `Pull 22`
- `Do 8`
- `Recommend next`
- `Desktop 5`

Interpret the number from the user’s current working Parking Lot.

## Safety reminders
Do not casually mix normal UI work with:
- service worker changes
- cache logic
- storage/schema
- migrations
- install/update flow changes

Keep risky work isolated.

## Clean removal reminder
“Clean removal” means:
- remove UI
- remove handlers
- remove dead code
- remove layout gaps
- preserve behavior elsewhere

## Final reminder
If there is a conflict, `AGENTS.md` wins.
