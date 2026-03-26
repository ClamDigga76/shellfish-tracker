# RUNTIME-PULL-LOCK.md — Runtime Re-sync / Live-lock Guardrails (VibeCoder 4.0)

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
When runtime-facing work is requested, anchor the patch with current repo/runtime facts before editing.

Typical checks include:
- current version source value
- version references across runtime chain
- touched runtime file set

## Required checks for runtime-facing patches
- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`
- relevant stable smoke checks when available

## Non-runtime patch boundary
For project-files/docs/workflow support patches:
- do not force runtime preflight
- do not force runtime version bump
- keep checks limited to the touched workflow/doc files

## Relationship to AGENTS
`AGENTS.md` remains the main law file.

This file is a focused helper for runtime anti-drift and live-lock behavior only.
