# PROJECT-INSTRUCTION-BLOCK.md — VibeCoder 4.0 Wrapper

## Purpose
This file is a **portable wrapper/adaptation block** for Bank the Catch instructions when moving between prompt contexts.

It helps carry project framing into task prompts without turning helper docs into competing policy.

## Authority boundary
This file is **not** operational law.

Instruction priority remains:
1. user direct request
2. `AGENTS.md`
3. helper docs (including this file)

## Use
Use this wrapper when drafting task prompts that need:
- project identity context
- patch class framing
- scope and non-goal framing
- reporting format reminders

Do not use this file to override or restate rules that already live in `AGENTS.md`.

## Refresh interpretation
Treat Refresh as project-state re-sync of docs/workflow context.

Refresh is not an instruction to force runtime checks, runtime lock flow, or repo pull automation.

## Runtime lock boundary
Runtime re-sync/live-lock/anti-drift guardrails belong in `RUNTIME-PULL-LOCK.md`.
