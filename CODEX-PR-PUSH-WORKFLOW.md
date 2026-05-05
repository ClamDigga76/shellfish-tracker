# CODEX-PR-PUSH-WORKFLOW.md — Vibe Coder 5.1

## Purpose

Use this helper when a task involves pull-request creation, pull-request review, diagnosing PR creation, or deciding whether Codex Cloud / Web or Codex App / Desktop / Local / Worktree behavior applies.

This file defines the Vibe Coder 5.1 PR workflow split:

- default Codex surface for Jeremy's normal app pulls is **Codex Cloud / Web**
- Codex App / Desktop / Local / Worktree behavior is opt-in by Jeremy's wording
- normal Bank the Catch `Pull <item>` work is **PR-intended** unless Jeremy says no PR
- Codex may not merge pull requests
- Jeremy remains the final reviewer and merge authority

This helper does not replace `AGENTS.md`, `START-HERE.md`, `patch-prompt-style.md`, `codex-app-style.md`, or project-specific rules.

---

## Core Rule: Pull Is PR-Intended for Jeremy's Normal App Workflow

For Jeremy's normal Bank the Catch app workflow, `Pull <item>` counts as explicit PR intent unless Jeremy says no PR, audit-only, planning-only, docs-only, local-only, or otherwise limits the task.

For normal app `Pull <item>` work, Codex should:

1. use **Codex Cloud / Web** as the default Codex surface
2. create or use the appropriate branch when needed
3. apply the requested scoped changes
4. commit the work when appropriate
5. create/open a real PR through the connected Codex Cloud / GitHub flow when supported
6. report the result clearly

Core policy:

> Pull prepares the patch, commit, and PR when the connected Codex Cloud / GitHub surface supports it. Codex may not merge. Jeremy reviews and merges only after approval.

Do not label ordinary Bank the Catch app pulls as `PR Mode: No PR requested` unless Jeremy explicitly says no PR or the task is audit-only, planning-only, docs-only, local-only, or otherwise not PR-bound.

---

## General PR Rule

For general tasks outside Jeremy's normal app `Pull <item>` workflow, PR creation is explicit, not automatic.

Create/open a PR only when:

- Jeremy's command or wording requests PR creation, including normal app `Pull <item>` work
- Jeremy explicitly asks for PR creation
- the active workflow specifically requires a PR

Do not infer PR mode from “GitHub connected” alone.

---

## Default Codex Surface

Default to **Codex Cloud / Web** for Codex prompts, Pull Sheets, PR-intended app patches, and Bank the Catch workflow work.

Use **Codex App / Desktop / Local / Worktree** only when Jeremy explicitly says he is using the desktop app, Codex App, local checkout, local worktree, or asks for local/worktree behavior.

Do not apply local/worktree Git assumptions to Codex Cloud / Web prompts by default.

---

## PR Mode

Use one of these labels when a task touches GitHub / PR flow:

| PR Mode | Meaning |
|---|---|
| PR requested by Pull command | Normal Bank the Catch `Pull <item>` app work. Create/open a real PR through the connected Codex Cloud / GitHub flow when supported. |
| PR requested explicitly | Jeremy explicitly asked for PR creation outside the normal Pull command. Use the correct Codex surface behavior. |
| PR required by active workflow | The current workflow requires a PR. Use the correct Codex surface behavior. |
| No PR requested | Jeremy explicitly said no PR, or the task is audit-only, planning-only, docs-only, local-only, or otherwise not PR-bound. |
| PR unavailable / Push/PR setup limitation | PR creation was requested/intended/required, but the current surface cannot complete it. |

Do not use `No PR requested` for normal Bank the Catch app Pulls unless Jeremy explicitly limits the task away from PR creation.

---

## Codex Surface

Use one of these labels when the distinction matters:

| Codex Surface | Meaning |
|---|---|
| Codex Cloud / Web | Browser/cloud connected-repo task. This is the default surface for Jeremy's normal app pulls. PR creation may use Codex Cloud's connected GitHub flow. |
| Codex App / Desktop / Local / Worktree | Local or worktree task where normal Git remote, branch, push, and manual PR behavior may apply. Use only when Jeremy explicitly says this is the surface. |
| Unknown / to verify | The surface is unclear. Use Codex Cloud / Web as the default unless Jeremy's wording points to local/worktree behavior. |

---

## Codex Cloud / Web Behavior

For Codex Cloud / Web tasks, do not require `origin` to remain configured after setup.

Codex Cloud may fetch the connected GitHub repository through a temporary authenticated remote and remove that remote afterward.

A blank `git remote -v` after setup is not, by itself, proof that PR creation is unavailable.

Do not use persistent local `origin`, raw `git fetch origin main`, or raw `git push origin` as the default PR-readiness gate for Codex Cloud.

When PR creation is intended or requested, use Codex Cloud's connected-repository PR creation flow.

Do not claim PR success unless a real GitHub PR URL or PR number is confirmed.

A local branch, commit, tool metadata, `make_pr` metadata, or task status message alone is not enough to claim that a PR exists.

---

## Codex App / Desktop / Local / Worktree Behavior

Use this lane only when Jeremy explicitly says he is using Codex App, desktop app, local checkout, local worktree, or asks for local/worktree behavior.

For Codex App, desktop, local, or worktree tasks, normal Git remote behavior may apply.

In this lane, `origin`, remote branch verification, local branch creation, commit, push access, and manual PR steps can be relevant.

If origin, remote-main verification, push, or PR creation is unavailable locally when PR/push work was requested or intended, report it as a **Push/PR setup limitation** and provide Jeremy's exact next manual step.

Do not apply Codex Cloud-specific assumptions to local/worktree tasks.

---

## PR Success Standard

Do not claim PR success unless a real GitHub PR URL or PR number is confirmed.

The following are not enough by themselves:

- local branch name
- local commit SHA
- task status message
- tool metadata
- `make_pr` metadata
- a statement that the work is PR-ready

If no PR URL or number is confirmed, say that no confirmed PR exists yet.

---

## Push/PR Setup Limitation Label

Use **Push/PR setup limitation** when the current execution surface cannot complete the remote GitHub step that was requested, intended, or required.

This is most common in Codex App / Desktop / Local / Worktree workflows.

Examples:

- local worktree has no usable `origin`
- remote-main verification is unavailable locally
- push access is unavailable locally
- PR creation is unavailable locally

This label means the local worktree or execution environment cannot complete the remote GitHub step from here. It is **not repo truth** unless the remote repository itself confirms it.

For Codex Cloud / Web, missing persistent `origin` after setup is not by itself a Push/PR setup limitation.

Preferred wording:

```text
Push/PR setup limitation: this local worktree cannot complete the requested push/PR step from here. The scoped local patch and checks are complete. Jeremy's next step is to push this branch with the available GitHub/Codex UI and open the PR.
```

Avoid vague or overbroad wording such as:

- “Remote main could not be verified.”
- “No origin configured.”
- “This repo has no origin.”
- “This repo has no main branch.”

Use the label plus the exact practical consequence and next step.

---

## Remote Base Rule

Use latest remote `main` as the intended base when the execution surface can verify it safely.

For Codex Cloud / Web, do not require persistent `origin` after setup as proof of readiness.

For Codex App / Desktop / Local / Worktree, if remote `main` cannot be verified locally, report it as a **Push/PR setup limitation**, not repo truth, and proceed only from the safest available base.

Remote `main` unavailable locally is not a blocker by itself and is not an approval checkpoint. Local Git limitations should affect report-back and manual next steps, not stop the patch before it starts unless the scoped patch is impossible.

Do not say the repo has no `main` branch unless the remote repo itself confirms that.

---

## Report-and-Proceed Rule

Local Git limitations should change the report-back, not stop the patch before it starts. They should not cause Codex to ask for confirmation after the pre-edit anchor unless the scoped patch is impossible.

The pre-edit anchor is not an approval gate. Report the anchor, then proceed directly with the scoped patch unless there is a real blocker.

Real blockers stay narrow:

- missing required files
- impossible repo state
- guarded-file change required
- destructive/high-risk decision outside the prompt
- missing required screenshot/image reference
- required user choice not provided

---

## PR Workflow

Use this when PR creation is requested, intended by Pull command, or required.

When PR creation is requested/intended/required:

1. identify the Codex Surface
2. identify PR Mode
3. create or use the correct branch when needed
4. apply and commit the scoped patch when appropriate
5. use the correct PR creation path for the surface
6. confirm a PR number or URL before claiming success
7. leave PR summary, test notes, Acceptance checks, risks/follow-ups, and rollback notes when a PR is created

For Jeremy's normal app Pulls, default to:

```text
Codex Surface: Codex Cloud / Web
PR Mode: PR requested by Pull command
```

For Codex Cloud / Web, use the connected-repository PR creation flow.

For Codex App / Desktop / Local / Worktree, push/open PR only if the local setup supports it. If not, report a Push/PR setup limitation and Jeremy's exact next manual step.

---

## Report-Back Requirements

When a patch is committed or PR-ready, report:

- Codex Surface
- PR Mode
- branch name
- commit SHA, if committed
- touched files or main surfaces changed
- tests/checks run
- whether remote/main verification was attempted when relevant
- whether push was attempted when relevant
- whether PR creation was attempted when relevant
- whether a confirmed GitHub PR URL or PR number exists
- Push/PR setup limitation statement, if applicable
- exact next manual step for Jeremy, if applicable

Use `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md` when separating Codex-verifiable checks from Jeremy device/browser checks.

---

## Codex Prompt Add-On

When PR creation is requested, intended by Pull command, or required, include wording like:

```text
Codex Surface: Codex Cloud / Web
PR Mode: PR requested by Pull command

Create/open a real PR through the connected Codex Cloud / GitHub flow when supported. Do not claim PR success unless a real GitHub PR URL or PR number is confirmed. A local branch, commit, tool metadata, or task status message alone is not enough.

For Codex Cloud / Web, do not require persistent local origin after setup. Use the connected-repository PR creation flow.

For Codex App / Desktop / Local / Worktree, use that lane only when Jeremy explicitly says he is using it. If origin, remote-main verification, push, or PR creation is unavailable, report a Push/PR setup limitation and Jeremy's exact next manual step.

Codex may not merge. Jeremy remains the final reviewer and merge authority.
```

If Jeremy explicitly says no PR, audit-only, planning-only, docs-only, or local-only, set the PR Mode accordingly and do not force PR creation.

---

## What Codex Must Not Do Automatically

Codex must not automatically:

- merge into `main`
- deploy production
- bypass PR review
- approve its own work
- make destructive choices outside the prompt
- make paid gating, auth, backup, payment, or data-integrity changes without clear review
- treat visual changes as accepted without Jeremy checking them on device when visual QA matters
- claim a branch was pushed if push failed or was unavailable
- claim a PR exists unless a GitHub PR number or URL is confirmed

Codex should not create/open a PR when Jeremy explicitly says no PR, audit-only, planning-only, docs-only, local-only, or otherwise limits the task away from PR creation.

---

## Optional Project Overlay Note: Bank the Catch

For Bank the Catch, normal `Pull <item>` app workflow is PR-intended unless Jeremy says no PR.

PR review is especially important because the app is close to free-tier launch.

Use `BANK-THE-CATCH-YTD-PAID-STRATEGY.md` wherever it is installed.

Default pack path:

```text
_optional-overlays/BANK-THE-CATCH-YTD-PAID-STRATEGY.md
```

Codex may prepare and create PR-ready work when PR creation is intended by Pull command, explicitly requested, or required, but Jeremy still protects:

- free vs paid boundaries
- trip history access
- YTD / Season Preview logic
- Insights gating
- saved trip data
- mobile layout quality
- visual brand consistency

---

## Final Policy

Use this as the standing PR policy:

> Default to Codex Cloud / Web for Jeremy's normal app pulls. `Pull <item>` is PR-intended unless Jeremy says no PR. Codex may prepare branches and commits, and may create/open real pull requests when PR creation is intended, requested, or required. Codex may not merge pull requests. Jeremy remains the final reviewer and merge authority.
