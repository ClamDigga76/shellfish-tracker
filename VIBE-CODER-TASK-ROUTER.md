# VIBE-CODER-TASK-ROUTER.md — Vibe Coder 5.0

## Purpose

Use this file as the first routing helper for Vibe Coder work.

Before producing a large answer, Pull Sheet, audit, MD update, visual handoff, asset pack, or Codex prompt, identify the task lane and use the right project files.

This router does **not** replace `AGENTS.md`, `START-HERE.md`, `patch-prompt-style.md`, or any project-specific helper file.

The router’s job is simple:

> Decide what kind of task this is, then use the lightest useful workflow.

---

## Authority

`AGENTS.md` is the authority file.

When factual repo state matters, repo truth should inform the answer, but repo truth does not replace the instruction priority in `AGENTS.md`.

If this router conflicts with `AGENTS.md`, `AGENTS.md` wins.

Use `START-HERE.md` to locate helper files fast.

---

## Core Rule

Do not start by overbuilding.

First decide what Jeremy is actually asking for:

- planning
- audit
- Pull Sheet / Codex prompt
- patch safety stack / decision locks
- GitHub PR push / review workflow
- runtime-facing patch
- visual patch / screenshot workflow
- MD pack update
- parking lot cleanup
- artifact / zip / asset pack
- product strategy
- post-patch review
- status / next move

Then answer in the smallest useful format.

The router should usually stay invisible. Do not announce the lane unless it helps Jeremy.

---

## Routing Map

### 1. Planning Lane

Use when Jeremy is exploring an idea, deciding between options, or asking what should happen.

Read when useful:

- `START-HERE.md`
- `PROJECT-INSTRUCTION-BLOCK.md`
- current project docs or parking lot when relevant

Output shape:

- recommended option first
- plain-language reasoning
- risks or tradeoffs
- smallest safe next move
- whether GitHub/repo access would help
- whether screenshots would help

Do not produce a full Pull Sheet unless Jeremy asks for one.

---

### 2. Audit Lane

Use when Jeremy asks to review landed work, screenshots, PRs, Codex comments, repo state, or current app behavior.

Read when useful:

- `AGENTS.md`
- `START-HERE.md`
- `testing-checklist.md`
- task-specific helper files

Output shape:

- what looks correct
- what is incomplete or risky
- bugs vs polish
- smallest safe next move
- whether the next step needs Codex, GitHub, screenshots, or device QA

Do not turn an audit into a patch unless Jeremy asks.

---

### 3. Pull Sheet / Codex Prompt Lane

Use when Jeremy asks for a pull, patch prompt, Codex-ready task, or implementation handoff.

Read when useful:

- `patch-prompt-style.md`
- `codex-app-style.md` when app/runtime behavior is involved
- `RUNTIME-PULL-LOCK.md` when runtime-facing
- `testing-checklist.md` for checks
- `PATCH-SAFETY-STACK.md` for meaningful patch safety headers, risk labels, Smallest Safe Patch, Codex Patch Contract, and Repo Truth vs Plan Guard
- `DECISION-LOCK-LEDGER.md` for relevant locked decisions
- `CODEX-PR-PUSH-WORKFLOW.md` when GitHub is connected and Codex should attempt to push/open a PR when available
- task-specific helper files

Output shape:

- follow the project-defined Pull Sheet / patch prompt structure
- apply the quiet safety stack when useful
- keep scope tight
- include Patch Risk, Smallest Safe Path, relevant Locked Decisions, Do Not Touch, and Repo Truth vs Plan labels when the patch needs safety framing
- include Acceptance checks inside the Codex prompt when the prompt needs pass/fail checks
- keep Manual QA for Jeremy outside the Codex prompt
- include the Real-World / In-App Explanation Layer near the end when the patch is technical, runtime-facing, PWA/cache-related, visual, user-facing, or hard to judge from code wording alone
- include rollback guidance when useful
- say whether GitHub/repo access is needed, helpful, or not needed
- when GitHub is connected, say whether Codex should attempt to push/open a PR for Jeremy review

Do not invent a new Pull Sheet format if the project files already define one.

---


### 4. Patch Safety / Decision Lock Lane

Use this lane when the task needs safety framing before implementation or audit.

Read when useful:

- `PATCH-SAFETY-STACK.md`
- `DECISION-LOCK-LEDGER.md`
- task-specific helper files

Output shape:

- Patch Type
- Patch Risk and Why
- Smallest Safe Path
- Repo Truth vs Plan when there is any chance of confusion
- Locked Decisions Applied, but only the relevant ones
- Do Not Touch guardrails
- Codex PR Route when GitHub is connected

Keep this quiet and compact. Do not make Jeremy manage another workflow.

---

### 5. GitHub PR Push / Review Lane

Use when GitHub is connected and normal patch work can safely move toward a branch and pull request.

Read when useful:

- `CODEX-PR-PUSH-WORKFLOW.md`
- `PATCH-SAFETY-STACK.md`
- `DECISION-LOCK-LEDGER.md` when relevant
- `patch-prompt-style.md`
- `codex-app-style.md` when app/runtime behavior is involved
- `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md`
- `CODEX-IMAGE-PACK-HANDOFF-RULE.md` when screenshots or visual references are involved

Output shape:

- make clear that Codex may create a branch, commit, attempt to push, and open a PR when available
- make clear that Codex must not merge the PR
- Jeremy remains the final reviewer and merge authority
- if push or PR creation is unavailable, require branch name, commit SHA, touched files, tests run, and exact next manual step for Jeremy
- include PR summary expectations, test notes, Acceptance checks, known risks/follow-ups, rollback note, and fallback report-back requirements
- keep Manual QA for Jeremy outside the Codex prompt unless the project format says otherwise

Do not use this lane to bypass review, deploy production, approve Codex's own work, or merge into `main`.

---

### 6. Runtime-Facing Patch Lane

Use when the task touches UI, JS, CSS, service worker, cache, install/update behavior, versioned app behavior, PWA behavior, or runtime-visible app behavior.

Read when useful:

- `RUNTIME-PULL-LOCK.md`
- `testing-checklist.md`
- `patch-prompt-style.md`
- `codex-app-style.md`

Codex prompt should include the project pre-edit anchor.

Runtime-facing checks normally include:

```bash
npm run check:repo
node scripts/preflight-verify.mjs --expect-version=<new version>
npm run smoke
```

Use the actual expected version only after Codex confirms the current runtime version source value.

If `npm run smoke` is unavailable in the project, Codex should report that clearly and run the nearest stable smoke or verification check available. Do not silently skip it.

Codex should report the pre-edit anchor and then proceed directly unless there is a real blocker.

The anchor is not an approval gate. Do not end it with “If you want…”, “Should I proceed?”, “I can now…”, or similar confirmation language.

Real blockers include:

- missing files
- impossible repo state
- required guarded-file changes
- missing required screenshots or references
- destructive or high-risk choices outside the prompt

---

### 7. Visual Patch / Screenshot Lane

Use when the task includes screenshots, mockups, crops, target images, current UI images, or visual references.

Read when useful:

- `CODEX-IMAGE-PACK-HANDOFF-RULE.md` when installed
- `PATCH-SAFETY-STACK.md` for visual patch risk, Do Not Touch, and Repo Truth vs Plan labels when useful
- `patch-prompt-style.md`
- `codex-app-style.md` when app UI is involved

Output shape:

- say what screenshots or crops would help
- name the image pack if one is needed
- list image roles: `CURRENT`, `TARGET`, `REFERENCE`
- tell Codex how to use each image
- keep the patch prompt outside the image zip
- use images for hierarchy, spacing, layout, style direction, and visual rhythm
- do not pixel-copy unless Jeremy explicitly asks

If locked, paid, premium, or upgrade visuals appear, treat them as visual direction only unless the patch specifically requests gating, purchase logic, subscription enforcement, or a full upgrade flow.

---

### 8. MD Pack Update Lane

Use when Jeremy wants to add, revise, merge, slim, or audit project markdown files.

Read when useful:

- `START-HERE.md`
- `AGENTS.md`
- current source markdown files
- the newest Jeremy-provided rule text

Output shape:

- what file should receive the rule
- whether it should be a new helper file or an edit to an existing file
- what is duplicate or already covered
- the smallest clean MD addition
- avoid creating overlapping rules

Do not put project-specific strategy into generic core files unless Jeremy asks.

---

### 9. Parking Lot Cleanup Lane

Use when Jeremy wants to clean, combine, sort, revise, or submit parking lot items.

Read when useful:

- `PARKING-LOT-GUIDE.md`
- `AGENTS.md`
- current parking lot source of truth when available

Output shape:

- cleaned item wording
- safe grouping recommendations
- what should stay separate
- priority or sequencing when useful
- parking lot follow-ups instead of widening active pulls

---

### 10. Artifact / Zip / Asset Pack Lane

Use when Jeremy asks for files, zips, image packs, asset packs, markdown packs, or generated deliverables.

Read when useful:

- relevant helper file for the artifact type
- `CODEX-IMAGE-PACK-HANDOFF-RULE.md` for visual Codex image packs when installed
- project-specific asset reference guides when installed, such as `BTC-REPO-ASSET-REFERENCE-GUIDE.md` for Bank the Catch repo-side image/brand assets

Output shape:

- create the requested file or pack when possible
- keep pack contents clean and focused
- include a short preflight report when useful
- report file count, filenames, dimensions, transparency, or duplicates when relevant
- do not include prompts inside image zips unless a specific rule says to
- for repo asset work, remember: asset exists does not prove the app currently uses it

---

### 11. Product Strategy Lane

Use when Jeremy asks about app direction, free/paid scope, gating, dashboards, records, analytics, KPIs, reports, feature value, or product positioning.

For Bank the Catch examples, this may include Home, Trips, Insights, YTD, and season intelligence.

Read when useful:

- project-specific strategy helper files when installed
- `DECISION-LOCK-LEDGER.md` when settled decisions may apply
- current project docs / parking lot
- newest Jeremy instruction

For Bank the Catch YTD/free-paid work, use `BANK-THE-CATCH-YTD-PAID-STRATEGY.md` wherever it is installed.

Default transport-zip path, if not installed flat:

- `_optional-overlays/BANK-THE-CATCH-YTD-PAID-STRATEGY.md`

Output shape:

- recommended product direction
- what belongs in free vs paid
- what belongs in each app section
- what should not be built yet
- whether the decision should become a parking lot item or Pull Sheet

Do not turn product strategy into implementation unless Jeremy asks.

---

### 12. Post-Patch Review Lane

Use when Jeremy shares Codex output, a landed patch, a PR result, a screenshot after patching, or says something is working/not working.

Read when useful:

- `testing-checklist.md`
- `patch-prompt-style.md`
- relevant task helper file

Output shape:

- pass/fail style review when possible
- what changed
- what still needs checking
- bugs vs polish
- Manual QA for Jeremy when device/browser checks are needed
- smallest safe follow-up pull if needed

---

### 13. Status / Next Move Lane

Use when Jeremy asks “what’s next?”, “next?”, “where are we?”, or asks for a recommendation.

Read when useful:

- `STATE-SNAPSHOT.md`
- current project docs / parking lot
- repo truth if available and needed

Output shape:

- current state in a few bullets
- recommended next move first
- why that move is safest
- whether GitHub/repo access is needed
- whether screenshots would help

Keep it compact unless Jeremy asks for a full report.

---

## GitHub / Repo Access Flag

When recommending a pull, audit, or next move, include one of these when useful:

- GitHub needed: yes
- GitHub helpful: yes
- GitHub not needed

Use “needed” only when repo truth, PR state, file paths, or landed code must be checked.

When GitHub is connected and normal patch work is ready for implementation, prefer the `CODEX-PR-PUSH-WORKFLOW.md` flow: Codex may attempt to push/open a PR when available; Jeremy reviews and merges. Do not claim a PR exists unless a PR number or URL is confirmed.

---

## Screenshot Flag

When screenshots would improve the task, say so clearly.

Use screenshots especially for:

- visual layout pulls
- app UI spacing
- card/KPI/masthead work
- before/after audits
- image-pack Codex prompts
- mobile/PWA polish

---

## Anti-Drift Rules

- Do not create a Pull Sheet when Jeremy is only asking for advice.
- Do not create a new MD file when a small edit to an existing file is cleaner.
- Do not repeat rules already covered by project files.
- Do not widen a visual patch into routing, data, subscription, or backend logic unless requested.
- Do not treat screenshots as source code truth.
- Do not put Manual QA inside the Codex prompt when Acceptance checks are the right label.
- Do not overuse copy-paste blocks unless Jeremy asks for a handoff, prompt, MD file, parking lot submission, Codex prompt, or reusable artifact.

---

## 5.0 Success Test

Vibe Coder 5.0 should handle a request like:

> Pull the new app filter/card polish using these screenshots.

By routing it as:

- Pull Sheet / Codex prompt lane
- visual patch / screenshot lane
- runtime-facing app patch lane if app UI changes are involved

And then automatically:

- use the project Pull Sheet rules
- use the image pack rule
- include runtime checks when needed
- put Acceptance checks in the Codex prompt
- keep Manual QA for Jeremy outside the Codex prompt
- say whether GitHub/repo access is needed
- use the Codex PR push workflow when GitHub is connected and the patch should become PR-ready
- avoid widening into unrelated subscription, routing, backend, or analytics logic
