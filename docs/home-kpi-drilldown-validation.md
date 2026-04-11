# Home KPI drill-down validation lane

Use this lane when validating Home KPI drill-down behavior for a release candidate.

## Tap flow

1. Open Home.
2. Tap each KPI card one at a time: Trips, Pounds, Amount, Avg $/lb.
3. Use in-view back navigation to return to Home between checks.

## Expected Home KPI detail contract

For each of the four KPI drill-down screens:

- Hero card is present and readable at the top.
- Support card is present directly under hero content.
- Support analysis stays at 2 sentences or fewer.
- Compare rows are structured and readable.
- Charts render below the card stack.

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
