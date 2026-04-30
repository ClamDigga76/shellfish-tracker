# ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md

## Purpose

Use this rule when writing Codex patch prompts, Pull Sheets, post-patch reviews, or QA instructions.

The goal is to keep Codex-verifiable checks separate from Jeremy's real device/browser checks.

This file supports `patch-prompt-style.md` and `testing-checklist.md`. It does not replace `AGENTS.md`.

---

## Core Rule

Inside a Codex patch prompt, use **Acceptance checks**.

Outside the Codex prompt, use **Manual QA for Jeremy**.

Do not mix the two labels.

---

## Acceptance Checks Are for Codex

Acceptance checks tell Codex what must be true before the patch is considered complete.

Use them inside the Codex prompt.

Acceptance checks should be:

- short
- pass/fail
- tied directly to the patch scope
- focused on what Codex can verify, preserve, or protect
- written so Codex can use them while editing or reviewing files

Acceptance checks should not ask Codex to verify things that require Jeremy's phone, installed PWA, real account state, or human visual judgment unless Codex has the required evidence in the prompt.

### Neutral app example

```text
Acceptance checks:
- The default dashboard shows the expected primary and secondary range controls.
- Locked or placeholder controls do not change the active range unless the patch explicitly enables them.
- Each enabled range control resolves to the correct date or data window.
- Summary cards, saved-item preview, main filters, and navigation still render.
- Existing route names, storage keys, and public labels remain unchanged unless scoped by the patch.
```

---

## Manual QA Is for Jeremy

Manual QA tells Jeremy what to check after Codex finishes.

Use it outside the Codex patch prompt unless the project format explicitly says otherwise.

Manual QA should be:

- practical
- plain-language
- device/browser focused when needed
- focused on what Jeremy should tap, see, or compare
- separate from Codex acceptance checks

Manual QA is especially useful for:

- iPhone standalone PWA checks
- Android Chrome/PWA checks
- visual spacing and hierarchy checks
- screenshots after patching
- install/update behavior
- anything Codex cannot truly verify locally

### Neutral app example

```text
Manual QA for Jeremy:
- Open the updated screen on iPhone standalone PWA.
- Confirm the control row fits without crowding or clipping.
- Tap each enabled control and confirm the visible result matches the label.
- Confirm summary cards update without layout jumping.
- Open nearby screens and confirm navigation still feels normal.
- Take a screenshot if spacing, hierarchy, or locked/placeholder visuals look off.
```

---

## When a Pull Sheet Includes Both

A Pull Sheet may include both Acceptance checks and Manual QA for Jeremy.

Use this split:

- **Inside the Codex Task Prompt:** Acceptance checks
- **Outside the Codex Task Prompt:** Manual QA for Jeremy

This prevents Codex from claiming it verified human/device checks that Jeremy still needs to run.

---

## Do Not Use

Do not put these inside Acceptance checks:

- “Jeremy confirms..."
- “Check on your iPhone..."
- “Looks good visually...” without a provided target/reference image
- “Verify in the installed PWA...” unless Codex can actually run that environment
- broad requests like “make sure everything still works”

Instead, move those items to Manual QA for Jeremy.

---

## Good Pattern

```text
Acceptance checks:
- The touched component renders without TypeScript/lint errors.
- The selected chip state remains keyboard/tap accessible.
- The fallback state still renders when no saved items exist.
- Existing route names and storage keys are unchanged.

Manual QA for Jeremy:
- Open the screen on iPhone standalone PWA.
- Confirm the chip row fits without horizontal crowding.
- Tap each chip and confirm the visible result matches the label.
- Take a screenshot if spacing looks off.
```

---

## Final Reminder

Acceptance checks are for Codex completion.

Manual QA for Jeremy is for real-world verification after the patch.
