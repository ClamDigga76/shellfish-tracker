# patch-prompt-style.md — VibeCoder 3.5

## Purpose
This file defines the default **Web Codex / browser sandbox** patch prompt style for Bank the Catch.

Use this when working in Codex Web.

## Core rule
Keep prompts tight, scoped, and implementation-ready.

Do not write a vague wish list.
Write a small engineering instruction.

## Default patch prompt structure
Use this order:

1. Goal
2. Now → Change → Better
3. Scope rules
4. Files to edit
5. Repo connection recommendation
6. Done when
7. Not in this patch
8. Repo checks
9. Output requirements

## Recommended template

```text
Goal

<one sentence goal>

Now → Change → Better

Now
<what the app does today and why that is a problem>

Change
<what this patch should do>

Better
<why this improves the app>

Scope rules
- keep the diff small and local
- preserve current behavior unless explicitly changing it
- do not broaden into nearby cleanup
- if this is a runtime-facing app patch, include the required build/version bump +1 and keep version-chain files aligned
- if this is a project-files/docs/workflow patch, do not do a runtime version bump

Files to edit
- <file 1>
- <file 2>

Repo connection recommendation
- Use GitHub/repo connection: Yes/No
- Why: <one short reason>

Done when
- <check 1>
- <check 2>
- <check 3>

Not in this patch
- <out-of-scope item 1>
- <out-of-scope item 2>

Repo checks
- run `npm run check:repo`
- run `node scripts/preflight-verify.mjs --expect-version=<new version>` for runtime-facing app patches
- if a stable smoke check exists for touched behavior, run it too

Output requirements
- return changed files
- return a concise changelog
- return a commit message
- always include Now → Change → Better for runtime-facing app patches
- always place Files edited before the Codex Task Prompt
- always output the Codex Task Prompt in its own clean copy/paste block
- present checks in this order when relevant: repo checks, stable smoke checks, human test loop
- keep the patch surgical
```

## Version rule
Only runtime-facing app patches require a build/version bump +1.

Project-files / docs / workflow patches do not require a runtime version bump.

## Earned patch sub-types (practical use)
`AGENTS.md` is the source of truth. Use this lightweight split when writing patch prompts:

- **Standard runtime patch**: runtime-facing scope, version bump +1, plus `npm run check:repo` and runtime preflight verify.
- **Runtime correction/hotfix patch**: same runtime checks as above, keep scope extra tight, and include Repro when applicable.
- **Repo/workflow support patch**: no runtime version bump or runtime preflight; run repo-side checks relevant to touched files.

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
- Files edited
- Repo connection recommendation
- Codex Task Prompt
- Commit message
- Changelog
- Rollback rope
