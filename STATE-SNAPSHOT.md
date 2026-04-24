# STATE-SNAPSHOT.md — Bank the Catch / VibeCoder 4.5 Repo-Compatible Slim Core

## Purpose
This file defines the compact current-state snapshot for handoff and resumption.

Use it when the work is long, the system has evolved, or the chat may need a clean restart point.

## Core rule
Keep the snapshot compact.
It should help the next pass start cleanly without turning into a heavy reporting system.

## Snapshot fields
Use these fields when relevant:

- **Version:** current VibeCoder version or pack state
- **Lane:** current primary lane
- **Entry state:** current entry-state classification
- **Execution surface:** where the pass is being executed or handed off
- **Active item:** the one main item in focus
- **Authority files:** law, wrapper, and most relevant helpers
- **Guardrails:** active temporary rules or special cautions
- **Suggestions in play:** only the few that still matter
- **Next recommended pass:** the most grounded next move
- **Do not widen:** what should stay out of the next pass

## Execution surface examples
Use short labels such as:

- ChatGPT
- ChatGPT + GitHub app
- Codex Local
- Codex Worktree
- GitHub PR review

## Compact template
```text
Version:
Lane:
Entry state:
Execution surface:
Active item:
Authority files:
Guardrails:
Suggestions in play:
Next recommended pass:
Do not widen:
```

## Handoff rule
A handoff should:
- preserve earned progress
- preserve current direction
- preserve the active seam
- avoid restarting good work
- avoid importing stale assumptions

## Final reminder
A good snapshot should be enough to restart the next pass cleanly.
It should not feel like a second roadmap.
