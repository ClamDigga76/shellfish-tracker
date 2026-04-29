# Home KPI drill-down validation lane

Use this lane when validating Home KPI drill-down behavior for a release candidate.

## Tap flow

1. Open Home.
2. Tap each KPI card one at a time: Trips, Pounds, Amount, Avg $/lb.
3. Use in-view back navigation to return to Home between checks.

## Expected Home KPI detail contract

For each of the four KPI drill-down screens:

- Back button appears at the top and returns to Home state.
- Quiet top utility row shows `← Home` on the left and selected context text like `YTD • 38 trips` on the right.
- One normal-size KPI title appears above a calm full-width hero card.
- Hero card uses business labels and rounded values (e.g., pounds with lbs unit, amount rounded to whole dollars).
- 2x2 mini metric grid is filled (no empty grid holes on mobile).
- Meaning note appears in plain English for the selected KPI.
- No duplicate insight card repeats the hero value.
- If a simple Home chart is part of the existing free detail contract, it still renders below the card stack.

Cross-surface contract:

- Reports metric detail still opens and behaves normally.
- Back navigation returns cleanly to the prior Home state.

## Pass/fail definition

- **Pass**: Item behaves as described without visual break, dead tap, or navigation glitch.
- **Fail**: Missing section, broken/open failure, unreadable compare rows, chart placement issue, or back-navigation defect.
- **Not run**: Validation step intentionally skipped.

## Concise manual validation steps

1. Capture runtime context with `getHomeKpiValidationSnapshot()`.
2. Run the 15 checklist items in `formatHomeKpiValidationLedger(...)`.
3. Mark each item pass/fail/not-run.
4. Add notes only for fails or edge observations.
5. Save the ledger output into release notes or QA handoff.


## Contract checks after HOME-KPI-DETAIL-PRO-FIX-1
- Compact header/back appears at top of Home KPI detail.
- Hero value remains primary visual focus and title is reduced.
- Home pounds text shows rounded pounds (no raw decimals).
- Snapshot section renders 4 true cards in a 2x2 layout for every KPI, using truthful labels (for example `Latest month` when month-rollup data is shown).
- Meaning note is visible before chart-heavy content.
- No extra teaser/nudge block appears in the Home summary stack.
- Reports metric detail still opens and preserves fractional precision behavior.
- Mobile layout has no stretched third card pretending to be 2x2.


## Final polish checks (HOME-KPI-HERO-FINAL-POLISH-1)
- KPI title text is centered while top utility row stays split left/right.
- Pounds hero shows the unit (for example `2,638 lbs`).
- Amount hero displays whole dollars in Home detail hero (for example `$7,119`).
- Home support money values suppress trailing `.00` but keep non-zero cents.
- Avg Pay Rate title area does not repeat formula lines above the hero.
- Trips snapshot smartly swaps `Busiest month` for `Months shown` when both month values match.
