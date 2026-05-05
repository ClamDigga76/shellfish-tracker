# RUNTIME-PULL-LOCK.md — Runtime Re-sync / Live-lock Guardrails (Vibe Coder 5.1 Router-First Core)

## Purpose
This helper file isolates runtime-facing re-sync and anti-drift guardrails.

Use it when a task touches shipped runtime behavior, version chain, update trust, or other runtime-sensitive seams.

## Scope
This file applies to runtime-facing app patches only.

It does not expand scope for project-files/docs/workflow-only patches.

## Guardrail goals
- prevent version-chain drift
- prevent stale assumptions about live runtime state
- keep runtime checks explicit and intentional
- keep aggressive runtime lock behavior out of baseline docs

## Live-lock principles
- Do not assume runtime state from old context.
- Re-verify runtime-sensitive values when a runtime patch is being prepared.
- Keep runtime checks explicit in the patch request and report-back.
- Do not silently infer version alignment; verify it.

## Runtime re-sync guidance
When runtime-facing work is requested, use the pre-edit anchor to report current repo/runtime facts, then proceed directly with the scoped patch unless there is a real blocker.

Typical checks include:
- current version source value
- version references across runtime chain
- touched runtime file set

## Pre-edit anchor
For runtime-facing patches, the pre-edit anchor is a **report-and-proceed** step. Codex must report:

- current branch/base used
- current base commit
- current runtime version source value
- whether runtime/version files need a bump
- exact intended touched files
- whether remote `main` verification was attempted and whether it was verified or unavailable locally

Use latest remote `main` as the intended base when the execution surface can verify it safely. For Codex Cloud / Web, do not require persistent `origin` after setup as proof of readiness. For Codex App / Local / Worktree, if remote `main` cannot be verified locally, report it as a **Push/PR setup limitation**, not repo truth, and proceed only from the safest available base.

After reporting the pre-edit anchor, Codex must proceed directly with the scoped patch.

The pre-edit anchor is not an approval gate. It must end with proceeding-directly language, not confirmation language.

Use wording like:

> Proceeding directly with the scoped patch. I will stay within the listed touched-file scope, run the required checks, commit the work when appropriate, and follow the selected PR Mode. I will create/open a PR only if Jeremy explicitly requested PR creation or the active workflow requires it.

Do not end the anchor with “If you want…”, “Should I proceed?”, “I can now…”, “I’ll now execute…”, or similar approval-gate language.

A local-only remote/main limitation is not a blocker by itself. In Codex App / Local / Worktree lanes, report it as a **Push/PR setup limitation**, not repo truth. In Codex Cloud / Web lanes, missing persistent `origin` after setup is not by itself proof of a Push/PR setup limitation.


## Push/PR setup limitation reporting

For Codex App / Local / Worktree lanes, if origin, remote-main verification, push, or PR creation is unavailable when relevant, report it as a **Push/PR setup limitation**, not as repo truth.

Use preferred wording like:

```text
Push/PR setup limitation: this local worktree has no usable origin remote, so I could not verify remote main or push/open the PR from here. The scoped local patch and checks are complete. Jeremy’s next step is to push this branch with GitHub Desktop and open the PR.
```

Avoid vague or overbroad wording such as:

- “Remote main could not be verified.”
- “No origin configured.”
- “This repo has no origin.”
- “This repo has no main branch.”

Local patch work can continue when the scoped files are present locally, the base is safe enough for the requested patch, the patch is not destructive or high-risk, and no real blocker exists.

When push or PR creation is unavailable, final report-back must include branch name, commit SHA, touched files, tests/checks run, whether remote/main verification was attempted, whether push was attempted, whether PR creation was attempted, the Push/PR setup limitation, and Jeremy’s exact next manual step.


Stop only for a real blocker:

- missing required files
- impossible repo state
- guarded-file change required
- destructive/high-risk decision outside the prompt
- missing required screenshot/image reference
- required user choice not provided

## Required checks for runtime-facing patches
- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`
- `npm run smoke`

If `npm run smoke` is unavailable in the project, report that clearly and run the nearest stable smoke or verification check available. Do not silently skip it.

## Non-runtime patch boundary
For project-files/docs/workflow support patches:
- do not force runtime preflight
- do not force runtime version bump
- keep checks limited to the touched workflow/doc files

## Relationship to AGENTS
`AGENTS.md` remains the main law file.

This file is a focused helper for runtime anti-drift and live-lock behavior only.
