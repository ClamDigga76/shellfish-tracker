# STATE-SNAPSHOT.md — Vibe Coder 5.0 Router-First Core

## Purpose
This file defines the compact current-state snapshot for handoff and resumption.

Use it when the work is long, the system has evolved, or the chat may need a clean restart point.

## Core rule
Keep the snapshot compact.
It should help the next pass start cleanly without turning into a heavy reporting system.

## Snapshot fields
Use these fields when relevant:

- **Version:** current Vibe Coder version or pack state
- **Lane:** current primary lane
- **Entry state:** current entry-state classification
- **Active item:** the one main item in focus
- **Execution surface:** where the work is happening now
- **Authority files:** active law file and most relevant helper files
- **Guardrails:** active temporary rules or special cautions
- **Suggestions in play:** only the few that still matter
- **Next recommended pass:** the most grounded next move
- **Do not widen:** what should stay out of the next pass

### Execution surface examples
Use the smallest clear label that fits:

- `ChatGPT`
- `ChatGPT + GitHub app`
- `Codex Local`
- `Codex Worktree`
- `GitHub PR review`

Add more detail only when it helps restart cleanly.
Prefer the smallest useful execution-surface label.

## Compact template
```text
Version:
Lane:
Entry state:
Active item:
Execution surface:
Authority files:
Guardrails:
Suggestions in play:
Next recommended pass:
Do not widen:
```

## Snapshot use rule
Use `Snapshot` to preserve just enough context to restart cleanly without rebuilding the whole chat.

A good snapshot should make these clear fast:
- what is active
- where the work is happening
- what rules matter most right now
- what should happen next
- what should not be widened

Do not turn the snapshot into a long status report.
Do not use it as a second roadmap.

## Handoff rule
A handoff should:
- preserve earned progress
- preserve current direction
- preserve the active seam
- avoid restarting good work
- avoid importing stale assumptions

When relevant, preserve the execution surface so the next pass does not have to rediscover where the work was happening.

## Final reminder
A good snapshot should be enough to restart the next pass cleanly.
It should not feel like a second roadmap.
