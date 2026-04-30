# CODEX-PR-PUSH-WORKFLOW.md — Vibe Coder 5.0

## Purpose

Use this helper when GitHub is connected and normal patch work can move toward a pull request.

This file defines the preferred PR flow:

**Codex may prepare, commit, attempt to push, and open a pull request when available. Codex may not merge pull requests. Jeremy remains the final reviewer and merge authority.**

This helper does not replace `AGENTS.md`, `START-HERE.md`, `patch-prompt-style.md`, or project-specific rules.

---

## Core Rule

Codex can prepare PR-ready work, but Jeremy merges.

For normal patch work, Codex may:

1. create a new branch
2. apply the requested code changes
3. commit the work
4. attempt to push the branch to GitHub
5. open a pull request for Jeremy to review if PR creation is available
6. leave a clear PR summary, test notes, and Acceptance checks

Jeremy reviews the pull request in GitHub before anything is merged.

Core policy:

> Codex patches and commits. Codex attempts to push the branch and open a PR when available. Jeremy reviews. Jeremy merges only after approval.

This can remove the manual push step when the environment supports it, without giving Codex final control over the app.

---

## Preferred Workflow

Old manual flow:

```text
ChatGPT plan → Codex patch → Jeremy manually pushes/applies → GitHub PR/review → merge
```

New preferred flow when GitHub push and PR creation are available:

```text
ChatGPT plan → Codex patch → Codex commits → Codex pushes branch and opens PR → Jeremy reviews in GitHub → Jeremy merges only if approved
```

Fallback flow when push or PR creation is unavailable:

```text
ChatGPT plan → Codex patch → Codex commits → Codex reports limitation and exact next manual step → Jeremy uses Push button / opens PR → Jeremy reviews and merges only if approved
```

Do not claim a PR exists unless a GitHub PR number or URL is confirmed.

---

## What Codex May Do Automatically

Codex may automatically handle:

- branch creation
- file edits
- commits
- attempting to push the branch
- PR creation when available
- PR descriptions when a PR is created
- Acceptance check summaries
- test notes
- screenshots or visual notes when relevant

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

---

## Push/PR Setup Limitation Label

When Codex cannot verify remote `main`, cannot push, cannot open a PR, or has no usable `origin` remote, label the condition as:

> **Push/PR setup limitation**

This label means the local worktree or execution environment cannot complete the remote GitHub step from here. It is **not repo truth** unless the remote repository itself confirms it.

Preferred wording:

```text
Push/PR setup limitation: this local worktree has no usable origin remote, so I could not verify remote main or push/open the PR from here. The scoped local patch and checks are complete. Jeremy’s next step is to push this branch with GitHub Desktop and open the PR.
```

Avoid vague or overbroad wording such as:

- “Remote main could not be verified.”
- “No origin configured.”
- “This repo has no origin.”
- “This repo has no main branch.”

Use the label plus the exact practical consequence and next step.

---

## Remote Base Rule

Use latest remote `main` as the intended base.

If remote `main` cannot be verified locally, report it as a **Push/PR setup limitation**, not repo truth, and proceed only from the safest available base.

Remote `main` unavailable locally is not a blocker by itself and is not an approval checkpoint. Local Git limitations should affect report-back and manual next steps, not stop the patch before it starts unless the scoped patch is impossible.

Do not say the repo has no `main` branch unless the remote repo itself confirms that.

---

## Local Git Limitation Behavior

Local Git limitations should change the report-back, not stop the patch before it starts. They should not cause Codex to ask for confirmation after the pre-edit anchor unless the scoped patch is impossible.

The pre-edit anchor is not an approval gate. Report the anchor, then proceed directly with the scoped patch unless there is a real blocker.

Use these distinctions:

- Remote `main` unavailable locally: report it as a **Push/PR setup limitation**, then proceed from the safest available local base unless the scoped patch is impossible.
- Push unavailable: still patch and commit first, then report the **Push/PR setup limitation** and the exact manual push step for Jeremy.
- PR creation unavailable: still patch and commit first, then report the **Push/PR setup limitation** and the exact manual PR step for Jeremy.

Local patch work can continue when the scoped files are present locally, the base is safe enough for the requested patch, the patch is not destructive or high-risk, and no real blocker exists.

## Push / PR Fallback Rule

Attempt to push the branch to GitHub.

If the local environment has no usable `origin` remote, cannot push, or does not have permission to push, report a **Push/PR setup limitation** and stop after the commit so Jeremy can use the Push button or the appropriate GitHub step.

Open a pull request for Jeremy to review if PR creation is available.

Do not claim a PR exists unless a GitHub PR number or URL is confirmed.

If push or PR creation is unavailable, report:

- branch name
- commit SHA
- touched files or main surfaces changed
- tests/checks run
- whether remote/main verification was attempted
- whether push was attempted
- whether PR creation was attempted
- **Push/PR setup limitation** statement
- the exact next manual step for Jeremy

---

## PR Output Requirements

When Codex opens a PR, the PR should include:

- PR number or URL
- summary of changes
- files changed or main surfaces touched
- test commands run
- Acceptance checks and whether they passed
- known risks, limitations, or follow-ups
- screenshots or visual notes when relevant
- rollback note when useful

When Codex cannot push or open a PR, the report-back should include:

- branch name
- commit SHA
- touched files or main surfaces changed
- test commands run
- whether remote/main verification was attempted
- whether push was attempted
- whether PR creation was attempted
- clear **Push/PR setup limitation** statement
- exact next manual step for Jeremy

Use `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md` when separating Codex-verifiable checks from Jeremy device/browser checks.

---

## Codex Prompt Add-On

When the patch should use this workflow, include wording like:

```text
GitHub PR workflow:
- Create a new branch for this patch.
- If origin, remote-main verification, push, or PR creation is unavailable, report it as a Push/PR setup limitation, not as repo truth. Continue the scoped patch only if local files are sufficient and safe.
- Local Git limitations should affect report-back and manual next steps, not stop the patch before it starts unless the scoped patch is impossible.
- Apply the scoped changes.
- Commit the work with a clear commit message.
- Attempt to push the branch to GitHub.
- If push is unavailable because the local environment has no usable origin remote, lacks push permissions, or cannot push, report the Push/PR setup limitation and stop after the commit so Jeremy can use the Push button or the appropriate GitHub step.
- Open a pull request for Jeremy to review if PR creation is available.
- Do not claim a PR exists unless a GitHub PR number or URL is confirmed.
- If push or PR creation is unavailable, report the branch name, commit SHA, touched files, tests run, whether remote/main verification was attempted, whether push was attempted, whether PR creation was attempted, the Push/PR setup limitation, and exact next manual step for Jeremy.
- Include a PR summary, test notes, Acceptance checks, known risks/follow-ups, and rollback note when a PR is created.
- Do not merge the PR.
- Do not deploy production.
```

If the patch is visual, include screenshot or image-pack notes from `CODEX-IMAGE-PACK-HANDOFF-RULE.md` when relevant.

If the patch is runtime-facing, include the runtime checks from `RUNTIME-PULL-LOCK.md` and `testing-checklist.md`.

---

## High-Risk Review Areas

Treat these as review-heavy areas:

- auth
- payments
- subscriptions
- paid gating
- backup / restore
- data integrity
- saved records
- destructive migrations
- production-deploy-impacting changes or deployment requests
- service worker / cache/version behavior
- privacy, export, or account logic

Codex may prepare a PR-ready branch for these areas only when the prompt clearly scopes the work, but Jeremy must review before merge.

---

## Optional Project Overlay Note: Bank the Catch

When the Bank the Catch overlay is installed, this workflow is especially useful because the app is close to free-tier launch.

Codex may move faster by preparing PR-ready work and opening PRs when available, but Jeremy still protects:

- free vs paid boundaries
- trip history access
- YTD / Season Preview logic
- Insights gating
- saved trip data
- mobile layout quality
- visual brand consistency

Use `BANK-THE-CATCH-YTD-PAID-STRATEGY.md` wherever it is installed when the patch touches Bank the Catch Home, Trips, Insights, YTD, or free/paid strategy.

Default transport-zip path, if not installed flat:
`_optional-overlays/BANK-THE-CATCH-YTD-PAID-STRATEGY.md`
