# Bank the Catch

Bank the Catch is a mobile-first shellfish trip logging PWA focused on local-first recordkeeping, Insights clarity, offline/update trust, and future release readiness for mobile-style use.

## Current posture

This repo is currently being prepared for an initial web release candidate.

The active release workflow is:
- keep changes small and safe
- validate runtime version/update alignment for runtime-facing changes
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
- `npm run smoke`

If `npm run smoke` is unavailable in a local environment, report that clearly and run the nearest stable smoke or verification check available.

For docs/workflow-only changes:
- no runtime version bump
- no runtime preflight required
- verify wording clarity, helper hierarchy, and non-conflicting guidance

## Workflow docs

The repo uses a Vibe Coder 5.0 router-first workflow-doc set.

Start here:
- `AGENTS.md` — primary workflow law file
- `START-HERE.md` — complete helper-file index and quick map
- `VIBE-CODER-TASK-ROUTER.md` — first-step task lane routing helper
- `PROJECT-INSTRUCTION-BLOCK.md` — project boot layer / instruction wrapper
- `STATE-SNAPSHOT.md` — compact handoff/resume helper
- `RUNTIME-PULL-LOCK.md` — runtime re-sync / anti-drift helper
- `PARKING-LOT-GUIDE.md` — Parking Lot / Suggestions behavior
- `patch-prompt-style.md` — browser-based Codex / web sandbox patch prompt style
- `codex-app-style.md` — desktop app / local / worktree patch style
- `testing-checklist.md` — verification loop and hierarchy checks
- `PATCH-SAFETY-STACK.md` — quiet safety stack for meaningful patch work
- `DECISION-LOCK-LEDGER.md` — locked/active/watch/deprecated/avoid decision ledger
- `CODEX-PR-PUSH-WORKFLOW.md` — GitHub-connected PR workflow; Codex may attempt push/PR, Jeremy merges
- `CODEX-IMAGE-PACK-HANDOFF-RULE.md` — visual reference / Codex image-pack workflow
- `ACCEPTANCE-CHECKS-VS-MANUAL-QA-RULE.md` — separates Codex acceptance checks from Jeremy manual QA
- `BANK-THE-CATCH-YTD-PAID-STRATEGY.md` — Bank the Catch Home / Trips / Insights / YTD / free-paid strategy
- `BTC-REPO-ASSET-REFERENCE-GUIDE.md` — repo-side image/brand asset reference guidance
- `docs/PARKING-LOT.md` — active parking lot status / follow-up tracking
- `docs/brand/brand-source-of-truth.md` — current brand source-image lock
- `docs/brand/reference/README.md` — docs-only brand source staging rules
- `docs/release-candidate-pwa-validation-matrix.md` — release-candidate device/mode validation matrix

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
