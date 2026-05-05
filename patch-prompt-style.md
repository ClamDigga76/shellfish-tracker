# patch-prompt-style.md — Vibe Coder 5.1 Router-First Core

## Purpose
This file defines the default **browser-based Codex / web sandbox** patch prompt style.

Use this for browser-based Codex work and web sandbox patch shaping.
Do not use it as a replacement for desktop/app style.

## Source-of-truth reminder
`AGENTS.md` is the source of truth for workflow rules.

Use this file as a helper style guide only.

## Default patch slice structure
Use this order:

1. Goal
2. Now → Change → Better
3. Repro (if this is a bug, regression, or visible trust seam)
4. Done when
5. Not in this patch
6. Likely files / surfaces
7. Safety header from `PATCH-SAFETY-STACK.md` when useful
   - Patch Type
   - Patch Risk and Why
   - Smallest Safe Path
   - Repo Truth vs Plan
   - relevant Locked Decisions Applied
   - Do Not Touch
8. Repo connection recommendation
   - use GitHub needed / GitHub helpful / GitHub not needed when useful
   - include **Codex Surface** and **PR Mode** when PR behavior matters
   - use `CODEX-PR-PUSH-WORKFLOW.md` only when Jeremy explicitly requests PR creation or the active workflow requires a PR
9. Codex Task Prompt
   - include **Suggested commit message** inside the task prompt
   - include **Acceptance checks** inside the task prompt when needed
10. Manual QA for Jeremy, outside the Codex Task Prompt when needed
11. Real-World / In-App Explanation Layer from `AGENTS.md` when useful
    - In real app use
    - What the user will notice
    - What stays the same
    - Why this matters
12. Changelog
13. Rollback rope

## Prompt guidance
Keep prompts concrete, scoped, and implementation-ready.

When useful:
- identify likely files or surfaces early
- keep the seam explicit
- apply Smallest Safe Patch for meaningful implementation work
- include Patch Risk when the patch could touch runtime, data, navigation, paid/free logic, visual layout, or PR-bound code
- keep the explanation plain and recommendation-first
- do not widen scope just to make the output feel more complete

For project/workflow support patches:
- keep scope to docs/workflow files only
- avoid runtime edits
- avoid version bump/preflight unless runtime files were touched

## Real-World / In-App Explanation Layer
When a patch is technical, visual, user-facing, runtime-facing, PWA/cache-related, or hard to judge from code wording alone, include the real-world / in-app explanation layer from `AGENTS.md`.

Use these sections when helpful:
- In real app use
- What the user will notice
- What stays the same
- Why this matters

In full Pull Sheets, place this layer near the end, after the Codex Task Prompt / Acceptance checks / Manual QA section and before Changelog / Rollback rope.

This layer is for Jeremy’s judgment. It should explain what the change means in the app without expanding Codex scope.

## Execution reminders
When useful:
- classify the lane before writing the prompt
- use `VIBE-CODER-TASK-ROUTER.md` when task type or output shape is unclear
- keep Suggestions outside the active pass
- preserve Jeremy-style plain English in the framing
- use `Snapshot` when the work needs a compact handoff
- anchor the seam before real execution work

## Pre-edit anchor wording rule
When a Codex prompt needs a runtime pre-edit anchor, treat the anchor as report-and-proceed, not report-and-wait.

Do not write “Before editing, report…” by itself.

Use wording like this inside the actual generated Codex prompt:

> Report the pre-edit anchor, then proceed directly with the scoped patch unless there is a real blocker. The pre-edit anchor is not an approval gate. Do not pause after the anchor for confirmation.

The anchor should end with proceeding-directly language, such as:

> Proceeding directly with the scoped patch. I will stay within the listed touched-file scope, run the required checks, commit the work when appropriate, and follow the selected PR Mode. I will create/open a PR only if Jeremy explicitly requested PR creation or the active workflow requires it.

Do not end the anchor with “If you want…”, “Should I proceed?”, “I can now…”, “I’ll now execute…”, or similar confirmation language.

For Codex App / Local / Worktree prompts, local Git limitations such as unavailable origin, unavailable remote `main`, push access, or PR creation should be reported as **Push/PR setup limitations**, not repo truth. They should affect report-back and manual next steps, not stop the patch before it starts unless the scoped patch is impossible.

For Codex Cloud / Web prompts, do not require persistent local `origin` after setup. Do not use raw `git fetch origin main` or `git push origin` as the default readiness gate. A blank `git remote -v` after setup is not by itself proof that PR creation is unavailable.

Future generated Codex prompts should include this language when relevant:

> If origin, remote-main verification, push, or PR creation is unavailable in a local/worktree lane, report it as a Push/PR setup limitation, not as repo truth. For Codex Cloud / Web, do not treat missing persistent origin after setup as a failure by itself. Continue the scoped patch only if local files are sufficient and safe. At report-back, include the exact manual push/PR step for Jeremy when one is needed.

Avoid vague standalone wording such as “Remote main could not be verified,” “No origin configured,” “This repo has no origin,” or “This repo has no main branch.” Use the Push/PR setup limitation label only when it is the accurate practical consequence.

## Pull / Do command rule
When the user says `Pull <item>`, treat it as the default full working execution output.

That means the response should usually include the full usable pull sheet in the right lane shape, not just a light preview.

For browser/web sandbox work, the output should normally be patch-ready or handoff-ready, not just descriptive.

`Do <item>` is a compatibility alias for the same behavior.

Use `Audit <item>` only when the user wants inspection without the full pull sheet.

## Success handoff note
When the `AGENTS.md` success tail applies, use normal chat formatting by default.

Use fenced copy/paste blocks only when Jeremy asks for a handoff, prompt, MD file, parking lot submission, Codex prompt, or reusable artifact.


## Patch safety stack
Use `PATCH-SAFETY-STACK.md` for meaningful Pull Sheets and Codex prompts.

Apply it quietly. Jeremy should not need a new command.

When useful, include the safety header fields from `PATCH-SAFETY-STACK.md`:

- Patch Type
- Patch Risk and Why
- Smallest Safe Path
- Repo Truth vs Plan
- relevant Locked Decisions Applied
- Do Not Touch
- Codex Surface
- PR Mode
- Codex PR Route

Then include **Acceptance checks** inside the Codex Task Prompt when needed.

Put **Manual QA for Jeremy** outside the Codex Task Prompt.

Use `DECISION-LOCK-LEDGER.md` for settled decisions that apply to the patch seam.

Do not dump the whole ledger into the output.

## Codex PR workflow
Codex PR creation is explicit, not automatic.

For normal patch work, ask Codex to prepare the patch, commit when appropriate, and report clearly.

Ask Codex to create/open a PR only when Jeremy explicitly requests PR creation or the active workflow requires it.

When PR creation is requested or required, use `CODEX-PR-PUSH-WORKFLOW.md`.

When PR behavior matters, include these fields near the safety header:

- Codex Surface: Codex Cloud / Web OR Codex App / Desktop / Local / Worktree
- PR Mode: No PR requested / PR requested by Jeremy / PR required by active workflow / PR unavailable / Push/PR setup limitation

Inside the Codex Task Prompt, include PR expectations only when PR creation is requested or required:

- identify the Codex Surface
- identify PR Mode
- create or use the appropriate branch when needed
- commit the scoped work when appropriate
- create/open a PR only in explicit PR mode
- for Codex Cloud / Web, use the connected-repository PR creation flow and do not require persistent local `origin` after setup
- for Codex App / Desktop / Local / Worktree, use local Git push/PR behavior only when the local setup supports it
- do not claim a PR exists unless a GitHub PR number or URL is confirmed
- local branch names, commits, tool metadata, `make_pr` metadata, or task status messages are not enough to claim a PR exists
- if Push/PR setup limitation applies, include branch name, commit SHA, touched files, tests run, whether remote/main verification was attempted, whether push was attempted, whether PR creation was attempted, and the exact next manual step for Jeremy
- include PR summary, test notes, Acceptance checks, known risks/follow-ups, and rollback note when a PR is created
- do not merge
- do not deploy production

Do not use PR workflow to bypass review or approve Codex's own work.

## Acceptance checks vs Manual QA
Use `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md` when a patch needs both Codex-verifiable checks and Jeremy device/browser checks.

Inside the Codex Task Prompt, use **Acceptance checks** for short pass/fail items Codex can verify or protect.

Outside the Codex Task Prompt, use **Manual QA for Jeremy** for iPhone, Android, PWA, screenshot, or human visual checks.

Do not mix the two labels.

## Refresh wording rule
When using **Refresh** in prompt text, treat it as project-state re-sync.

Do not interpret Refresh as automatic runtime validation, runtime pull, or live repo lock checks.

## Runtime live-lock boundary
Runtime re-sync/anti-drift/live-lock controls live in `RUNTIME-PULL-LOCK.md`.

Do not duplicate that policy text here.
