# Bank the Catch

Bank the Catch is a mobile-first shellfish trip logging PWA focused on local-first recordkeeping, report clarity, offline/update trust, and future release readiness for mobile-style use.

## Current posture

This repo is currently being prepared for an initial web release candidate.

The active release workflow is:
- keep changes small and safe
- validate runtime version/update alignment
- run repo checks before release-sensitive changes
- use manual device validation for release-candidate signoff

## Core repo scripts

The repo uses these core commands:

- `npm run check:repo`  
  Runs repository quality checks.

- `npm run preflight`  
  Runs runtime/version-chain preflight verification.

- `npm run smoke`  
  Runs the lightweight smoke-check suite.

- `npm run check`  
  Runs repo checks plus preflight.

- `npm run check:smoke`  
  Runs repo checks plus smoke validation.

## Release-validation guidance

For runtime-facing app changes, use:

- `npm run check:repo`
- `node scripts/preflight-verify.mjs --expect-version=<new version>`

Run smoke checks when the touched behavior has a relevant smoke surface.

For docs/workflow-only changes:
- no runtime version bump
- no runtime preflight required

## Workflow docs

The repo uses a slim VibeCoder 4.5 workflow-doc set.

Start here:
- `AGENTS.md` — primary workflow law file
- `START-HERE.md` — quick map
- `PROJECT-INSTRUCTION-BLOCK.md` — project wrapper
- `STATE-SNAPSHOT.md` — compact handoff/resume helper
- `RUNTIME-PULL-LOCK.md` — runtime re-sync / anti-drift helper
- `PARKING-LOT-GUIDE.md` — Parking Lot / Suggestions behavior
- `testing-checklist.md` — verification loop

## Release-candidate note

The current hosted version serves as both:
- the active work-in-progress build
- the temporary release-candidate source of truth

Netlify-specific RC wording and final hosted cutover validation should be finalized when the Netlify move is near.

## Hosting and deployment

The repo already includes:
- `netlify.toml`
- `_headers`
- `_redirects`

Those files support a clean hosted app path, but release signoff should still be driven by actual hosted/device validation.

## Legal

See:
- `legal/privacy.html`
- `legal/terms.html`
- `legal/license.html`

## License / ownership

This project is not open source for reuse.
See the root `LICENSE` file for ownership and usage limits.
