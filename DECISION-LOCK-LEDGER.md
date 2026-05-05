# DECISION-LOCK-LEDGER.md — Vibe Coder 5.1

## Purpose

Use this file to protect settled workflow and project decisions from drift.

The ledger is not a planning board. It is a compact source of remembered decisions that Vibe Coder should respect when creating Pull Sheets, Codex prompts, audits, visual patches, and PR handoffs.

`AGENTS.md` remains the authority file. This ledger supports it.

---

## Core Rule

When a patch touches a settled decision, apply only the relevant ledger entries.

Do not paste the whole ledger into every output.

If Jeremy explicitly changes a decision, update the ledger status instead of arguing with the new direction.

---

## Status Definitions

| Status | Meaning |
|---|---|
| Locked | Settled decision. Do not change unless Jeremy explicitly changes it. |
| Active | Current working direction, but still flexible. |
| Watch | Promising, but not fully committed. |
| Deprecated | Old direction. Avoid using. |
| Avoid | Do not bring back unless Jeremy asks. |

---

## Generic Vibe Coder 5.1 Decisions

| Decision | Status | Applies To | Why It Matters |
|---|---|---|---|
| `AGENTS.md` remains the authority file | Locked | All workflow | Prevents helper files from becoming competing law |
| Use `START-HERE.md` as the complete helper-file index | Locked | File routing | Reduces duplicate file lists and drift |
| Use `VIBE-CODER-TASK-ROUTER.md` when task lane or output shape is unclear | Locked | Task routing | Keeps work in the right lane before output grows |
| Apply Smallest Safe Patch to meaningful Codex work | Locked | Pull Sheets / Codex prompts | Prevents overbuilding and unrelated changes |
| Add Patch Risk for meaningful implementation patches | Locked | Pull Sheets / Codex prompts | Helps Jeremy judge safety before Codex runs |
| Separate Repo Truth from Approved Plan | Locked | Pull Sheets / audits | Prevents planned decisions from being treated as already coded |
| Use Acceptance checks inside Codex prompts | Locked | Codex prompts | Gives Codex pass/fail completion criteria |
| Use Manual QA for Jeremy outside Codex prompts | Locked | Post-patch/user checks | Keeps human device/browser checks separate |
| Normal Bank the Catch Pulls are Codex Cloud / Web and PR-intended; Jeremy merges | Locked | GitHub / Codex workflow | Restores Jeremy's normal Pull-to-PR workflow while preserving final merge control and preventing false PR claims |
| Visual references require role-based handling | Locked | Visual patches | Prevents screenshots from causing unrelated redesigns |
| Do not add Launch Readiness Board to active 5.1 workflow | Locked | 5.1 scope | Keeps 5.1 low-intrusion |

---

## Project-Specific Decisions

Project-specific decisions should live in project overlays or be added below when the ledger is installed into that project.

For Bank the Catch, use the installed Bank overlay when available:

- `BANK-THE-CATCH-YTD-PAID-STRATEGY.md`

Default transport-zip path, if not installed flat:

- `_optional-overlays/BANK-THE-CATCH-YTD-PAID-STRATEGY.md`

If the overlay is installed in the project root, use the project-local path.

---

## Project-Specific Ledger Template

Use this table when adding project decisions:

| Decision | Status | Applies To | Why It Matters |
|---|---|---|---|
| Example decision | Active | Feature / screen / workflow | Short reason |

---

## How Pull Sheets Should Use This Ledger

Pull Sheets should include only the relevant decisions.

Example:

```text
Locked Decisions Applied:
- Normal Bank the Catch Pulls use Codex Cloud / Web and are PR-intended unless Jeremy says no PR; Jeremy merges.
- Use Smallest Safe Patch.
- Do not treat planned direction as current repo truth.
```

For project-specific work, include only the project decisions that matter to the patch seam.
