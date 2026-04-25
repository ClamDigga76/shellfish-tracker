# Settlement amount policy (PL-MATH-3 audit baseline)

This document records the **current** amount-policy behavior so future changes can be intentional.

## Current policy (no behavior change in this pass)

- Home earnings math uses `trip.amount` totals.
- Reports earnings math uses `trip.amount` totals (`amt` rollups).
- CSV export writes `Amount` from `trip.amount`.
- `trip.amount` currently represents the **calculated ticket amount** used by earnings math.
- `calculatedAmount` records the calculated ticket amount.
- `writtenCheckAmount` records the user-entered written check amount, or defaults to `calculatedAmount` when missing.
- `dealerAdjustment` records `writtenCheckAmount - calculatedAmount`.
- `writtenCheckAmount` currently **does not** power Home/Reports earnings aggregation math.

## Audit trace by surface

### Settlement derivation (`js/utils_v5.js`)

- `deriveTripSettlement()` returns:
  - `calculatedAmount`
  - `writtenCheckAmount`
  - `dealerAdjustment`
  - `adjustmentClass` / `adjustmentClassification`
- The written-check default is `calculatedAmount` when no positive written check is provided.
- Adjustment is computed as written minus calculated.

### Save seam (`js/trip_flow_save_seam_v5.js`)

- `buildNewTripSaveSnapshot()` keeps `amount` and `writtenCheckAmount` as separate draft inputs.

### Commit lifecycle (`js/trip_mutation_lifecycle_v5.js`)

- `commitTripFromDraft()` derives settlement from calculated amount + written check amount.
- It persists:
  - `amount` from `settlement.calculatedAmount`
  - `calculatedAmount`, `writtenCheckAmount`, `dealerAdjustment`, and adjustment classification fields.

### Shared normalization (`js/trip_shared_engine_v5.js`)

- `normalizeTripRow()` preserves/resolves `amount` for trip earnings math.
- It derives settlement metadata (`calculatedAmount`, `writtenCheckAmount`, `dealerAdjustment`, classifications) from `amount` + `writtenCheckAmount`.

### Home (`js/home_dashboard_v5.js`)

- Home totals and rollups sum `trip.amount` for earnings.

### Reports (`js/reports_aggregation_v5.js`)

- Reports aggregation rolls earnings into `amt` from `trip.amount`.

### CSV (`js/utils_v5.js`)

- `toCSV()` writes the `Amount` column from `t.amount`.

### Backup/restore (`js/backup_restore_v5.js`)

- Backup payload includes `data.trips` as stored objects.
- Restore/import keeps trip objects and re-normalizes through `normalizeTrip`, preserving settlement fields while recomputing normalized shape.

## Mismatch outcome and follow-up

- Audit result: **no policy mismatch found** for PL-MATH-3 baseline.
- No formula/behavior change was made in this pass.
- Optional future behavior patch (separate pass): if product direction changes, consider making Home/Reports earnings aggregate from final written check amount instead of calculated amount.
