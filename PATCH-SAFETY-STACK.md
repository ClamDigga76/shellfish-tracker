# PATCH-SAFETY-STACK.md — Vibe Coder 5.1

## Purpose

Use this helper as the quiet safety layer for meaningful Pull Sheets, Codex prompts, audits, visual patches, and PR-bound implementation work.

The goal is not to make Jeremy run more commands.

The goal is to make normal outputs safer behind the scenes by applying:

1. Smallest Safe Patch
2. Patch Risk Meter
3. Codex Patch Contract
4. Repo Truth vs Plan Guard

This file does not replace `AGENTS.md`, `patch-prompt-style.md`, `codex-app-style.md`, `CODEX-PR-PUSH-WORKFLOW.md`, or `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md`.

---

## Core Principle

Do the exact job.
Touch the least code.
Warn Jeremy about risk.
Respect locked decisions.
Separate repo truth from plans.
Use visuals correctly when visual references are present.
Default Jeremy's normal app Pulls to Codex Cloud / Web and PR-intended; Jeremy remains final reviewer and merge authority.

---

## When to Use This Safety Stack

Use this stack for meaningful patches, especially when work touches:

- app UI or layout
- runtime-visible behavior
- navigation
- filters or state behavior
- saved data
- auth, storage, backup, restore, payments, or paid/free logic
- PR-bound implementation work
- visual patches with screenshots, mockups, crops, or image packs
- project decisions that could drift

For tiny typo-only, comment-only, or doc-only fixes, keep the output lighter unless the risk is unclear.

---

## Safety Header

When useful, add a compact safety header near the top of a Pull Sheet or implementation handoff.

Recommended fields:

| Field | Purpose |
|---|---|
| Patch Type | Visual, layout, logic, copy, data, runtime, audit, docs, etc. |
| Patch Risk | Low / Medium / High / Critical |
| Why | Plain reason for the risk label |
| Smallest Safe Path | Narrowest implementation route |
| Repo Truth vs Plan | What is real now vs planned/targeted |
| Locked Decisions Applied | Relevant decisions from `DECISION-LOCK-LEDGER.md` |
| Do Not Touch | Files, systems, or behaviors Codex should avoid |
| Codex Surface | Codex Cloud / Web by default; Codex App / Desktop / Local / Worktree only when Jeremy explicitly says local/worktree |
| PR Mode | PR requested by Pull command / PR requested explicitly / PR required by active workflow / No PR requested / PR unavailable |
| Codex PR Route | Whether PR creation is requested/required, what Push/PR setup limitation fallback applies, and that Jeremy merges |

Keep this compact. Do not turn the safety header into a second Pull Sheet.

For normal Bank the Catch app Pulls, do not use `PR Mode: No PR requested` unless Jeremy explicitly says no PR, audit-only, planning-only, docs-only, or local-only.

---

## Real-World / In-App Explanation Layer

For technical, runtime-facing, PWA/cache, visual, or user-facing patches, include a plain-language app-use layer when it helps Jeremy judge the patch.

Use these sections when helpful:

- In real app use
- What the user will notice
- What stays the same
- Why this matters

In full Pull Sheets, place this layer near the end, after the Codex Task Prompt / Acceptance checks / Manual QA section and before Changelog / Rollback rope.

This layer belongs to Jeremy’s understanding of the change. It should not expand the active patch scope or replace Acceptance checks / Manual QA.

---

## 1. Smallest Safe Patch

Every meaningful Codex patch should include the smallest safe implementation route.

Use language like:

```text
Smallest Safe Path:
Update only the requested seam. Touch the fewest files possible. Do not redesign unrelated screens, systems, data logic, routing, auth, storage, or paid/free gates unless explicitly requested.
```

Jeremy-level meaning:

> Do the exact job. Do not get fancy. Do not touch the engine unless asked.

---

## 2. Patch Risk Meter

Use a simple risk label before Codex runs.

| Risk | Use when |
|---|---|
| Low | Text, colors, spacing, icons, image swaps, simple visual polish, doc-only changes |
| Medium | Component layout, filters, navigation, state behavior, reusable UI components |
| High | Saved data, paid/free gates, analytics, auth, storage, service worker/cache/version behavior |
| Critical | Payments, database, backup/restore, user records, destructive changes, production-deploy-impacting changes or deployment requests |

Add a short `Why` line so Jeremy knows whether the patch is a paint job, wiring job, or engine work.

Example:

```text
Patch Risk: Low
Why: Visual card spacing and button placement only. No saved data, routing, auth, or paid/free logic should be touched.
```

---

## 3. Codex Patch Contract

Every meaningful Codex prompt should define the patch boundaries.

Use the contract fields that fit the patch:

| Contract Item | Meaning |
|---|---|
| Scope | What Codex is allowed to change |
| Smallest Safe Patch | Reminder to use the narrowest safe route |
| Locked Decisions | Relevant decisions from `DECISION-LOCK-LEDGER.md` |
| Risk Level | Low / Medium / High / Critical |
| Do Not Touch | Specific files, systems, or behaviors to avoid |
| Pre-edit anchor | If required, report the anchor and proceed directly; the anchor is not an approval gate |
| Acceptance checks | Pass/fail checks Codex should verify or protect |
| PR Rule | Normal app Pulls are PR-intended by default; Jeremy merges |

Example wording:

```text
Do Not Touch:
- Do not change auth, saved data, paid/free logic, backup/restore, app routing, or unrelated screens.

Acceptance checks:
- The requested UI seam updates as described.
- Existing nearby behavior still works.
- No unrelated routes, data logic, auth, or paid/free gates are changed.

Pre-edit anchor, when required:
Report the pre-edit anchor, then proceed directly with the scoped patch. The anchor is not an approval gate. Do not end with “If you want…”, “Should I proceed?”, “I can now…”, or similar confirmation language.

PR Route:
State Codex Surface and PR Mode. For Jeremy's normal app Pulls, use `Codex Surface: Codex Cloud / Web` and `PR Mode: PR requested by Pull command` unless Jeremy says no PR, audit-only, planning-only, docs-only, or local-only. Codex may create/open a PR when PR creation is intended by Pull command, explicitly requested, or required. Do not claim PR success unless a real GitHub PR URL or PR number is confirmed. For Codex Cloud / Web, use the connected-repository PR creation flow and do not require persistent local `origin` after setup. For Codex App / Desktop / Local / Worktree, report true local push/PR failures as a Push/PR setup limitation and include branch name, commit SHA, touched files, tests run, whether remote/main verification was attempted, whether push was attempted, whether PR creation was attempted, and exact next manual step for Jeremy. Jeremy reviews and merges.
```

Jeremy-level meaning:

> Codex, stay inside the fence.

Use `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md` when separating Codex checks from Jeremy device/browser QA.

Use `CODEX-PR-PUSH-WORKFLOW.md` when PR behavior matters, including Jeremy's normal app `Pull <item>` workflow, explicit PR creation, PR review/diagnosis, or active workflows that require a PR.

---

## 4. Repo Truth vs Plan Guard

Do not confuse planned direction with current repo reality.

Use these labels when helpful:

| Label | Meaning |
|---|---|
| Repo Truth | Exists in the current app/code now |
| Repo Truth to Verify | Likely exists, but should be checked in code |
| Approved Plan | Decided direction, but may not be coded yet |
| Patch Target | What this patch is supposed to make real |
| Parking Lot | Good idea, not active right now |
| Experiment | Try carefully; do not treat as final |
| Deprecated / Avoid | Do not reintroduce unless Jeremy asks |
| Locked Decision | Settled decision from `DECISION-LOCK-LEDGER.md` |

Example:

```text
Repo Truth vs Plan:
- Current label may still exist in code: Repo Truth to Verify
- New approved wording: Patch Target
- Related future idea: Parking Lot
- Old direction: Deprecated / Avoid
```

Jeremy-level meaning:

> Do not treat what we planned as already coded.

---

## Visual Work

When screenshots, mockups, crops, or image packs are part of the task, use `CODEX-IMAGE-PACK-HANDOFF-RULE.md` as the Visual Patch Protocol.

Visual rules should activate only when visuals are present or clearly helpful.

---

## Decision Locks

When a patch touches a settled direction, check `DECISION-LOCK-LEDGER.md`.

Only include the relevant locked decisions in the Pull Sheet or Codex prompt.

Do not dump the whole ledger into every output.

---

## Push/PR setup limitation

Use **Push/PR setup limitation** when the current execution surface cannot complete a remote GitHub step that was requested or required.

For Codex App / Desktop / Local / Worktree lanes, this can include unavailable Git remote setup, remote-main verification, push, or PR creation.

For Codex Cloud / Web lanes, missing persistent local `origin` after setup is not by itself a Push/PR setup limitation.

This is not repo truth unless the remote repo itself confirms it. It should affect report-back and Jeremy’s manual next step, not stop a safe scoped patch before it starts.

## What Not to Add

Do not add a Launch Readiness Board as part of this 5.1 safety stack.

That may be useful later, but it is not active workflow now.

Do not create extra user-facing commands for this safety stack.

The stack should be applied quietly inside existing Pull, Do, Audit, visual, and Codex prompt workflows.
