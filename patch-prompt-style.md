# patch-prompt-style.md — VibeCoder 3.5

## Purpose
This file defines the default **Web Codex / browser sandbox** patch prompt style for Bank the Catch.

Use this when working in Codex Web.

## Core rule
Keep prompts tight, scoped, and implementation-ready.

Do not write a vague wish list.
Write a small engineering instruction.

## Source-of-truth reminder
`AGENTS.md` is the source of truth for workflow rules.

Use this file as the helper style for writing clean Codex prompts, not as a competing rule set.

## Default patch slice structure
Use this order:

1. Goal
2. Now → Change → Better
3. Repro (if this is a bug, regression, or visible trust seam)
4. Done when
5. Not in this patch
6. Files edited
7. Repo connection recommendation
8. Codex Task Prompt
9. Commit message
10. Changelog
11. Rollback rope

## Codex Task Prompt shape
Inside the **Codex Task Prompt**, prefer this structure when it helps:

1. Goal
2. Live repo finding
3. Required behavior
4. Non-goals
5. Implementation guidance
6. Likely files
7. Possibly / Only if needed
8. Validation
9. Required checks
10. Report back with

This does not have to be mechanically rigid, but it should stay concrete, scoped, and implementation-ready.

## Earned patch sub-types (lightweight)
Use these only when they help shape the prompt more accurately.

For the full operational rules, follow `AGENTS.md`.

### 1) Standard runtime patch
Use for normal user-facing behavior, UI, runtime, or shipped-app changes.

Prompt reminders:
- include required build/version bump +1
- keep version-chain files aligned
- require `npm run check:repo`
- require `node scripts/preflight-verify.mjs --expect-version=<new version>`
- if a stable smoke check exists for touched behavior, run it too

### 2) Runtime correction / hotfix patch
Use when the immediately previous runtime patch introduced a real break.

Prompt reminders:
- prioritize restoring stability over expanding scope
- keep the patch tighter than a normal runtime feature patch
- include **Repro** when applicable
- if runtime-facing, still require version bump +1 and runtime preflight
- prefer the smallest safe repair

### 3) Project-files / workflow support patch
Use for repo/process/docs/helper-file updates that do not change shipped runtime app behavior.

Prompt reminders:
- do **not** do a runtime version bump
- do **not** force runtime preflight unless clearly needed
- run repo-side checks relevant to touched files
- keep changes operational and lightweight

## Recommended template

```text
Goal

<one sentence goal>

Now → Change → Better

Now
<what the app or workflow does today and why that is a problem>

Change
<what this patch should do>

Better
<why this improves the result>

Repro
1. <step 1>
2. <step 2>
3. <step 3>

Done when
1. <check 1>
2. <check 2>
3. <check 3>

Not in this patch
- <out-of-scope item 1>
- <out-of-scope item 2>

Files edited

Most likely:
- <file 1>
- <file 2>

Possibly:
- <file 3>

Only if needed:
- <tiny helper seam>

Repo connection recommendation
- Use GitHub/repo connection: Yes/No
- Why: <one short reason>

Codex Task Prompt

<copy/paste block>
Implement a focused follow-up to parking lot item <id> — <title>.

Goal:
<one sentence goal>

Live repo finding:
- <current seam>
- <current seam>
- Current runtime version in `index.html` is `<old version>`, so this runtime-facing patch should bump to `<new version>`.

Required behavior:
- <behavior 1>
- <behavior 2>
- <behavior 3>

Non-goals:
- <non-goal 1>
- <non-goal 2>

Implementation guidance:
- inspect the primary seam first
- keep the change localized
- preserve current logic unless this patch is explicitly behavioral

Likely files:
- <file 1>
- <file 2>

Possibly:
- <file 3>

Only if needed:
- <tiny helper seam>

Validation:
- verify the visible issue is fixed
- verify unchanged behavior still works
- verify logic/output remains unchanged where required
- confirm runtime version chain is aligned when this is runtime-facing

Required checks:
- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`
- if a stable smoke check exists for touched behavior, run it too

Report back with:
- files changed
- version bumped to
- checks run and pass/fail result
- any intentionally unchanged behavior
- any follow-up risk notes
</copy/paste block>

Commit message

<short action-oriented commit message>

Changelog

<one or two sentences>

Rollback rope

If bad: revert the PR.
```

## Version rule
Only runtime-facing app patches require a build/version bump +1.

Project-files / docs / workflow patches do not require a runtime version bump.

## Scope reminders
Prefer:
- one screen
- one behavior cluster
- one seam extraction
- one focused visual polish
- one repair

Avoid:
- refactor plus redesign plus bugfix in one patch
- service worker work mixed with UI polish
- storage/schema work mixed with normal screen work
- hidden cleanup bundles

## Output reminder
For Bank the Catch patch work, prefer outputs that are easy to copy into your normal workflow:

- Goal
- Now → Change → Better
- Repro when relevant
- Done when
- Not in this patch
- Files edited
- Repo connection recommendation
- Codex Task Prompt
- Commit message
- Changelog
- Rollback rope
