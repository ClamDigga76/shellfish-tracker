# testing-checklist.md — Vibe Coder 5.0 Router-First Core

## Purpose
This is the default post-patch verification loop.

## Core mindset
Test the changed thing first.
Then test the nearby thing most likely to have been affected.

## Check order
For runtime-facing app patches, use this order when relevant:

1. repo checks
2. smoke check
3. human test loop

If `npm run smoke` is unavailable in the project, report that clearly and run the nearest stable smoke or verification check available. Do not silently skip it.

## Runtime patch checks
For runtime-facing app patches, run:

- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`
- `npm run smoke`

Use the actual expected runtime version after the current runtime version source value is confirmed.

## Project-files / workflow patch checks
For project-files/docs/workflow patches:

- no runtime version bump
- no runtime preflight required
- verify wording clarity, hierarchy, and non-conflicting guidance
- verify referenced helper files exist
- verify anti-drift anchoring language is consistent where relevant
- verify updated `Pull <item>` expectations stay aligned across the law file and helper docs
- verify helper docs point back to `AGENTS.md` instead of quietly owning duplicated law

## Hierarchy check
After workflow-doc updates, confirm:

- `AGENTS.md` still reads as primary law
- helper docs remain subordinate
- runtime live-lock rules remain in `RUNTIME-PULL-LOCK.md`
- `Refresh` still means project-state re-sync
- the `Refresh` output contract stays compact and does not widen scope
- `STATE-SNAPSHOT.md` stays a compact helper, not a second roadmap
- `STATE-SNAPSHOT.md` uses execution-surface wording compactly when relevant

## Practical consistency check
After workflow-doc updates, also confirm:

- anti-drift anchoring is described consistently where it appears
- likely files / surfaces language is used consistently
- helper docs adapt `AGENTS.md` rules instead of restating them as competing law
- any success-tail or copy/paste handoff wording remains subordinate to `AGENTS.md`
- Acceptance checks stay inside Codex prompts and Manual QA for Jeremy stays outside Codex prompts when both are used
