# Parking Lot

## Current status note — 2026-04-30

This repo file is **not currently the full working master parking lot**.

It currently preserves the locked/historical brand docs item below. The full working parking lot should be refreshed in a separate pass so this workflow-doc cleanup does not widen into a parking-lot source-of-truth rewrite.

Follow-up item:

### PARKINGLOT-REFRESH-2 — Replace repo parking lot with current working master

- **Status:** Needed as a separate docs/parking-lot pass
- **Goal:** Replace this repo parking lot with the latest confirmed working master parking lot.
- **Do not combine with:** Vibe Coder workflow file syncs, runtime patches, visual asset patches, or release candidate runtime checks.

---

## Historical / locked brand docs items

### BRAND-0 — Brand Source Image Lock
- **Status:** Locked (completed in docs lane)
- **Locked on:** 2026-04-27
- **Source of truth:** `docs/brand/reference/bank-the-catch-brand-authority-2026-04-27.md` (with checksum in `docs/brand/reference/bank-the-catch-brand-authority-2026-04-27.sha256`).
- **Decision:** This latest image is now the official Bank the Catch visual source of truth and **replaces all older branding references**.
- **Implementation rule:** Future exported app assets must be derived from this locked image (or files exported from it), not older mockups.
- **Current variants confirmed in the locked source:**
  - Full premium Bank the Catch logo
  - Square BTC app icon with **smaller BTC lettering**
  - Compact horizontal logo lockup
  - Soft-shell clam mark (no mixed-shell substitution)
  - Blue wave strokes
  - Green seagrass accent
  - Blue/gold halo ring
  - Gold divider ornaments
  - Glossy electric-blue wordmark with smaller centered "the"
  - Dark navy premium background styling
- **Not in this pass:** app/runtime/public asset changes, icon replacement, PWA changes, or image slicing/export.
