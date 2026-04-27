# Bank the Catch — brand source of truth (locked)

## Lock record
- **Item:** BRAND-0 — Brand Source Image Lock
- **Date locked:** 2026-04-27
- **Authority artifact:** `docs/brand/reference/bank-the-catch-brand-authority-2026-04-27.md`
- **Checksum file:** `docs/brand/reference/bank-the-catch-brand-authority-2026-04-27.sha256`
- **Scope:** Visual source-of-truth guidance only (docs/workflow lane).

## Official decision
The latest uploaded branding board is now the official Bank the Catch visual source of truth.

This decision **replaces prior branding references** for implementation planning and future exported asset work.

The checksum file is stored in standard `sha256sum --check` format for direct verification.

## What is current in the locked source
- Full premium Bank the Catch logo
- Square BTC app icon with **smaller BTC lettering**
- Compact horizontal logo lockup (current)
- Blue soft-shell clam mark (required shell basis)
- Blue wave strokes
- Green seagrass accent
- Blue/gold halo ring
- Gold divider ornaments
- Glossy electric-blue wordmark
- Smaller centered `the`
- Dark navy premium background

## Guardrails for future implementation
- Do not recreate branding from memory.
- Do not treat older logo or app-icon revisions as current.
- Future exported app assets must come from this locked image baseline, not older mockups.
- Keep shell imagery soft-shell clam based; do not substitute scallop, oyster, fish, anchor, generic shell, or mixed-shell imagery.
- Preserve the premium dark navy / blue / gold / green coastal style.
- Do not place the full logo on every card.

## Storage/location rule
If a raw source board image is committed, keep it under `docs/brand/reference/` only.
Do not promote this docs source board directly into runtime/public app assets.

## Source-input reference copies
The committed source-input files in `docs/brand/reference/source-inputs/` are the repo reference copies to use for future export passes:

- `btc-horizontal-logo-source-2026-04-27.jpg`
- `btc-square-app-icon-source-2026-04-27.jpg`
- `btc-wide-logo-lockup-source-2026-04-27.jpg`

If these binaries are not yet present in git, stage/upload them to that folder using the exact names above before any icon/export generation pass.
