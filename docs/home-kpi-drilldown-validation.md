# Home KPI drill-down validation lane

Use this lane when validating Home KPI drill-down behavior for a release candidate.

## Tap flow

1. Open Home.
2. Tap each KPI card one at a time: Trips, Pounds, Amount, Avg $/lb.
3. Use in-view back navigation to return to Home between checks.

## Expected Home KPI detail contract

For each of the four KPI drill-down screens:

- Back button appears at the top and returns to Home state.
- Compact title and selected-period context chip appear above the hero.
- Hero card uses business labels and rounded values (no raw pound decimals).
- Compact insight strip appears under hero.
- 2x2 mini metric grid is filled (no empty grid holes on mobile).
- Meaning note appears in plain English for the selected KPI.
- Reports nudge appears with understated copy.
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
2. Run the 11 checklist items in `formatHomeKpiValidationLedger(...)`.
3. Mark each item pass/fail/not-run.
4. Add notes only for fails or edge observations.
5. Save the ledger output into release notes or QA handoff.
