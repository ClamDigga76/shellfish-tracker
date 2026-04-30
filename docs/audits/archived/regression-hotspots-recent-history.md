# Regression Hotspots (recent-history guide)

Scope: quick caution map based on recent merged patches (`#195` to `#204`). Use this when planning or testing new patch slices.

## 1) Trip flow orchestration seam
- **Likely files/areas:** `js/app_v5.js`, `js/trip_screen_orchestrator_v5.js`, trip entry/edit/review route wiring in `index.html` bootstrap.
- **Why high risk:** this seam was just extracted, then immediately patched for dependency wiring. Recent break/fix pattern suggests high sensitivity at module boundaries.
- **Verify when touched:**
  - New Trip opens and saves normally.
  - Edit existing trip works end-to-end.
  - Review/list transitions do not drop handlers or stale state.

## 2) Settings update/release surfaces
- **Likely files/areas:** `js/settings_screen_v5.js`, version/update strings and wiring in `js/app_v5.js`, `index.html` versioned bootstrap links.
- **Why high risk:** Settings and update messaging were recently adjusted as release-confidence work; this area also depends on version-chain consistency.
- **Verify when touched:**
  - Settings shows expected build/update status text.
  - Update/check actions still trigger expected prompts/results.
  - Version shown in UI matches runtime bootstrap version.

## 3) Version-chain and boot surfaces
- **Likely files/areas:** `index.html`, `js/app_v5.js`.
- **Why high risk:** these files have the highest recent churn and are central fan-out points for route boot, runtime wiring, and app start behavior.
- **Verify when touched:**
  - App boots cleanly from cold load.
  - Top routes (Home/New Trip/Reports/Settings/Help) still mount.
  - No stale asset/version mismatch symptoms after reload.

## 4) Smoke-check lane drift
- **Likely files/areas:** `scripts/smoke-check.mjs`, `package.json` (`check:smoke` / related scripts).
- **Why high risk:** smoke lane was added, expanded, then stabilized for brittleness; quick iterations can cause test-app behavior drift or false confidence.
- **Verify when touched:**
  - `npm run check:smoke` passes on current branch.
  - Assertions still match current UI text/routes (not stale selectors).
  - Coverage still includes boot, top routes, Settings, and New Trip.

## 5) Reports presentation vs aggregation seam
- **Likely files/areas:** `js/reports_screen_v5.js`, `js/reports_charts_v5.js`.
- **Why high risk:** recent reports polish changed presentation details; these surfaces are sensitive to subtle coupling between computed aggregates and chart/render output.
- **Verify when touched:**
  - Summary values and chart visual outputs agree.
  - Empty/small datasets render safely.
  - Date/range displays remain consistent with selected filters.

## 6) Help + contextual guidance surfaces
- **Likely files/areas:** `js/help_about_render_v5.js`, `js/trip_form_render_v5.js`, guidance markup in `index.html`.
- **Why high risk:** recent add/remove cycle for contextual hints indicates UX copy and UI affordances here are still settling.
- **Verify when touched:**
  - Help content matches current product behavior.
  - Trip form guidance appears where expected and does not crowd controls.
  - iPhone Safari and Android Chrome layout remains readable.
