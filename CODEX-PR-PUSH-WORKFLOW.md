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

## Remote Base Rule

Use latest remote `main` as the intended base.

If remote `main` cannot be verified locally, report that as a local environment limitation, not repo truth, and proceed only from the safest available base.

Remote `main` unavailable locally is not a blocker by itself and is not an approval checkpoint. Local Git limitations should affect report-back and manual next steps, not stop the patch before it starts unless the scoped patch is impossible.

Do not say the repo has no `main` branch unless the remote repo itself confirms that.

---

## Local Git Limitation Behavior

Local Git limitations should change the report-back, not stop the patch before it starts. They should not cause Codex to ask for confirmation after the pre-edit anchor unless the scoped patch is impossible.

The pre-edit anchor is not an approval gate. Report the anchor, then proceed directly with the scoped patch unless there is a real blocker.

Use these distinctions:

- Remote `main` unavailable locally: report it, then proceed from the safest available local base unless the scoped patch is impossible.
- Push unavailable: still patch and commit first, then report the exact manual push step for Jeremy.
- PR creation unavailable: still patch and commit first, then report the exact manual PR step for Jeremy.

## Push / PR Fallback Rule

Attempt to push the branch to GitHub.

If the local environment has no configured `origin` remote, cannot push, or does not have permission to push, report that clearly as a local environment limitation and stop after the commit so Jeremy can use the Push button or the appropriate GitHub step.

Open a pull request for Jeremy to review if PR creation is available.

Do not claim a PR exists unless a GitHub PR number or URL is confirmed.

If push or PR creation is unavailable, report:

- branch name
- commit SHA
- touched files or main surfaces changed
- tests/checks run
- whether push was attempted
- whether PR creation was attempted
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
- clear limitation statement
- exact next manual step for Jeremy

Use `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md` when separating Codex-verifiable checks from Jeremy device/browser checks.

---

## Codex Prompt Add-On

When the patch should use this workflow, include wording like:

```text
GitHub PR workflow:
- Create a new branch for this patch.
- Local Git limitations should affect report-back and manual next steps, not stop the patch before it starts unless the scoped patch is impossible.
- Apply the scoped changes.
- Commit the work with a clear commit message.
- Attempt to push the branch to GitHub.
- If push is unavailable because the local environment has no configured origin remote, lacks push permissions, or cannot push, report that clearly as a local environment limitation and stop after the commit so Jeremy can use the Push button or the appropriate GitHub step.
- Open a pull request for Jeremy to review if PR creation is available.
- Do not claim a PR exists unless a GitHub PR number or URL is confirmed.
- If push or PR creation is unavailable, report the branch name, commit SHA, touched files, tests run, and exact next manual step for Jeremy.
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
