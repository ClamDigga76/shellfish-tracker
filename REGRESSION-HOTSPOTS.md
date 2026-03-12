# REGRESSION-HOTSPOTS.md — Bank the Catch

## Purpose
This is a short repo-side caution map for high-risk files and flows.

Use it before implementation so patch scope, review, and testing effort match real break risk.

## How to use before a patch
1. Identify whether your change touches any hotspot area below.
2. Copy the area’s caution note into your patch plan.
3. Add the listed sanity checks to your test loop.
4. If multiple hotspots are touched, consider narrowing the patch slice.

## Top hotspot areas

### 1) Boot/bootstrap/fatal recovery/diagnostics
- **Area/files:** `index.html`, `js/bootstrap/*`, startup wiring, fatal-safe fallback surfaces.
- **Why risky:** Boot path issues can block app start or hide recovery information.
- **Patch caution:** Keep startup edits minimal and avoid broad wiring moves in mixed-purpose patches.
- **Sanity check after change:** App boots cleanly on reopen/reload and fatal/diagnostic surfaces still render when expected.

### 2) Version/update/runtime status chain
- **Area/files:** runtime version source, version display/check surfaces, service worker version references, cache version keys.
- **Why risky:** Version drift breaks update trust and can create stale-runtime confusion.
- **Patch caution:** Keep version consumers aligned; do not update a single version reference in isolation.
- **Sanity check after change:** Version/build display is consistent and update/reload behavior does not show mismatched version signals.

### 3) Trip flow orchestration and save path
- **Area/files:** trip create/edit orchestration, save handlers, trip draft state transitions.
- **Why risky:** Small orchestration changes can break create/edit/save continuity or lose user progress.
- **Patch caution:** Avoid bundling trip-flow refactors with unrelated UI cleanup.
- **Sanity check after change:** New/edit/save flows complete without lost inputs across quick reopen/reload.

### 4) Storage/draft/recovery behavior
- **Area/files:** local persistence, draft restore, recovery helpers, backup/restore touchpoints.
- **Why risky:** Persistence regressions are high impact and often only show after reload or interrupted sessions.
- **Patch caution:** Isolate storage-adjacent edits; avoid hidden schema/model side effects.
- **Sanity check after change:** Draft/recovery/restore paths still retain expected data after reload.

### 5) Reports rendering/filter/chart path
- **Area/files:** reports data shaping, filter wiring, chart rendering and derived summaries.
- **Why risky:** Data transforms can fail silently and surface as incorrect totals/charts rather than explicit errors.
- **Patch caution:** Keep report logic changes local; avoid cross-cutting rename/refactor in the same patch.
- **Sanity check after change:** Filters, chart visuals, and totals remain coherent for representative recent data.

### 6) `index.html` + shared CSS + extracted style boundaries
- **Area/files:** `index.html`, shared style bundles, recently extracted style boundary files.
- **Why risky:** Small markup/style shifts can create mobile-only regressions (especially iPhone standalone and Android Chrome).
- **Patch caution:** Prefer local style edits; avoid broad selector churn unless explicitly required.
- **Sanity check after change:** No obvious spacing/tap-target regressions on key screens and quick reopen still looks correct.

### 7) Service worker/cache/install-update path
- **Area/files:** `sw.js`, cache naming/versioning, install/activate/update signaling surfaces.
- **Why risky:** Update flow regressions can ship stale code or break offline/startup behavior.
- **Patch caution:** Do not bundle service worker/cache changes with normal UI/runtime feature work.
- **Sanity check after change:** Install/update path behaves predictably and no stale-cache symptom appears after reload.

## Use with existing workflow docs
- Use `AGENTS.md` for policy and patch rules.
- Use this file to decide caution intensity and post-change sanity focus.
- Use `testing-checklist.md` to run the matching test loop.
