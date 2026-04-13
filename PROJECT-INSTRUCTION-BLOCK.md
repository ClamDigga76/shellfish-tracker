# PROJECT-INSTRUCTION-BLOCK.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible

## Purpose
This file is the project-side wrapper for the installed workflow pack.

It exists to help the system adapt to the current Bank the Catch project without creating a second rule system.

## Core rule
This wrapper must not replace `AGENTS.md`.

It should:
- frame the active project
- clarify current priorities
- customize tone and emphasis when useful
- preserve alignment with the law file

It must not:
- create competing workflow rules
- quietly move core law into the wrapper
- become a second authority file

## Authority boundary
Instruction priority remains:

1. user direct request
2. `AGENTS.md`
3. helper docs (including this file)

## What belongs here
This file is the right place for:
- project identity and product context
- current-mode clarification
- patch class framing
- scope and non-goal framing
- current priorities that help prompt interpretation
- the Jeremy response layer reminder

Do not use this file to override or restate rules that already live in `AGENTS.md`.

## Project framing
Bank the Catch is a mobile-first shellfish tracking PWA with elevated sensitivity around:
- iPhone Safari behavior
- iPhone standalone PWA behavior
- update trust and version alignment
- offline/cache safety
- storage/schema safety
- small safe diffs over broad rewrites

## Jeremy response reminder
When replying to Jeremy, prefer:
- plain English first
- teach during the work
- recommendation first
- short “what this means” explanations
- short “why this matters” explanations
- clear “what changed / what stayed / what’s next” guidance
- momentum over needless stops

This is a style and teaching reminder only.
It does not replace the law file.

## Refresh interpretation
Treat Refresh as project-state re-sync of docs/workflow context.

Refresh is not an instruction to force runtime checks, runtime lock flow, or repo pull automation.

## Runtime lock boundary
Runtime re-sync/live-lock/anti-drift guardrails belong in `RUNTIME-PULL-LOCK.md`.

## Good wrapper behavior
A good wrapper:
- sharpens context
- reduces friction
- keeps the system feeling tailored
- does not compete with `AGENTS.md`

## Final reminder
If this wrapper and the law file ever seem to disagree, `AGENTS.md` wins.
