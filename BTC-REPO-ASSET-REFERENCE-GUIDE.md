# BTC-REPO-ASSET-REFERENCE-GUIDE.md

## Purpose

Use this guide with the uploaded `BANK-THE-CATCH-REPO-ASSET-REFERENCE-PACK.zip` asset reference pack.

The asset pack is a **Bank the Catch project resource**, not a Vibe Coder core workflow rule.

It helps Vibe Coder understand what repo-side image assets are available for app UI, branding, mastheads, icons, empty states, share images, install/update/offline screens, and visual Codex patches.

## Core Rule

Asset exists does **not** always mean the app currently uses it.

Use the asset pack to identify available asset candidates.

Use repo truth to confirm whether an asset is currently wired into the app.

## Current Asset Pack Summary

Uploaded reference pack:

`BANK-THE-CATCH-REPO-ASSET-REFERENCE-PACK.zip`

Observed contents:

- 42 total files
- 28 PNG files
- 12 SVG files
- 1 CSV manifest
- 1 README text file

Main folders:

- `icons/`
- `assets/brand/`
- `assets/brand/backgrounds/`
- `assets/brand/transparent/`
- `assets/brand/vector/`
- `assets/illustrations/`
- `assets/meta/`

## Important Included Reference Files

- `FULL-ASSET-PACK-MANIFEST.csv` = asset manifest with repo paths, action notes, dimensions, modes, sizes, and hash snippets
- `README-FULL-ASSET-PACK.txt` = explains that this is the full repo-side reference/source pack

## Use Labels

When discussing assets, use these labels:

| Label | Meaning |
|---|---|
| Asset Available | The asset exists in the uploaded asset pack |
| Repo Truth to Verify | Need repo/code check to confirm current app usage |
| Patch Candidate | Asset looks suitable for the requested UI/change |
| Runtime Asset | Asset appears intended for app runtime use based on path/manifest |
| Do Not Use | Asset appears outdated, wrong context, duplicate, low-quality, or not suited to the task |

## Known Asset Groups

### App Icons and PWA Icons

Use for favicon, app icon, maskable icons, shortcuts, and PWA/install surfaces.

Examples:

- `icons/favicon-32.png`
- `icons/icon-180.png`
- `icons/icon-192.png`
- `icons/icon-192-maskable.png`
- `icons/icon-512.png`
- `icons/icon-512-maskable.png`
- `icons/shortcut-new-trip.png`
- `icons/shortcut-trips.png`
- `icons/shortcut-reports.png`
- `icons/shortcut-backup.png`

### Brand Assets

Use for logo, masthead, brand cards, app icon references, and brand system review.

Examples:

- `assets/brand/btc-app-icon.png`
- `assets/brand/btc-brand-sheet-reference.png`
- `assets/brand/btc-logo-full.png`
- `assets/brand/btc-logo-horizontal.png`
- `assets/brand/btc-mark-card.png`

### Transparent Brand Assets

Use when a transparent no-wording or emblem-style asset is needed.

Examples:

- `assets/brand/transparent/btc-emblem-transparent.png`
- `assets/brand/transparent/btc-app-icon-transparent-source.png`

### Vector Brand Assets

Use for scalable marks, dividers, small UI icons, empty-state icons, update/offline icons, and decorative wave/clam marks.

Examples:

- `assets/brand/vector/btc-simple-mark.svg`
- `assets/brand/vector/btc-simple-mark-blue.svg`
- `assets/brand/vector/btc-simple-mark-mono.svg`
- `assets/brand/vector/btc-clam-outline.svg`
- `assets/brand/vector/btc-wave-mark.svg`
- `assets/brand/vector/btc-divider-gold.svg`
- `assets/brand/vector/btc-glow-frame.svg`
- `assets/brand/vector/btc-empty-trips-icon.svg`
- `assets/brand/vector/btc-empty-reports-icon.svg`
- `assets/brand/vector/btc-backup-icon.svg`
- `assets/brand/vector/btc-offline-icon.svg`
- `assets/brand/vector/btc-update-icon.svg`

### Illustrations

Use for empty states, install/update/offline experiences, backup trust screens, and onboarding/supportive visuals.

Examples:

- `assets/illustrations/backup-trust-illustration.png`
- `assets/illustrations/empty-backups-illustration.png`
- `assets/illustrations/empty-reports-illustration.png`
- `assets/illustrations/empty-trips-illustration.png`
- `assets/illustrations/install-illustration.png`
- `assets/illustrations/offline-illustration.png`
- `assets/illustrations/update-illustration.png`

### Share / Social / Meta Assets

Use for share cards, Open Graph imagery, branded export/share surfaces, and watermark-style visuals.

Examples:

- `assets/meta/og-image.png`
- `assets/brand/backgrounds/btc-share-background-template.png`
- `assets/brand/backgrounds/btc-share-logo-wide.png`
- `assets/brand/backgrounds/btc-watermark-mark.png`

## How to Use in Vibe Coder Workflows

### For asset selection

When Jeremy asks what asset to use:

1. Check the asset pack contents.
2. Identify likely candidates by role and filename.
3. Label them as `Asset Available` or `Patch Candidate`.
4. Say whether repo usage needs verification.
5. Recommend the smallest safe asset choice.

### For Codex patch prompts

When a patch should use one of these assets:

- reference exact repo paths
- tell Codex to verify the file exists in the repo before wiring it
- do not assume an asset is already imported or used
- do not create new image assets unless Jeremy asks
- do not replace existing asset paths without checking manifest/runtime references

### For visual patches

If screenshots, mockups, crops, or visual references are part of the task, also use:

`CODEX-IMAGE-PACK-HANDOFF-RULE.md`

If an image pack is prepared for Codex, the image zip should contain only renamed image files. The Codex patch prompt stays outside the zip.

## Guardrails

Do not treat this asset pack as repo truth for current usage.

Do not assume an uploaded asset is currently wired into the app.

Do not use generic shellfish imagery when soft-shell-clam-specific branding is required.

Do not add, remove, rename, or replace runtime assets without a scoped patch.

Do not change PWA icons, manifest references, service-worker cache lists, or versioned runtime asset references without runtime checks.

For runtime-facing asset changes, use:

```bash
npm run check:repo
node scripts/preflight-verify.mjs --expect-version=<new version>
npm run smoke
```

If `npm run smoke` is unavailable, report that clearly and run the nearest stable smoke or verification check available. Do not silently skip it.

## Recommended Project Setup

Keep `BANK-THE-CATCH-REPO-ASSET-REFERENCE-PACK.zip` uploaded as a project source/reference file.

Keep this guide with the Vibe Coder 5.0 project files as an optional Bank the Catch resource guide.

Do not merge the image zip into the Vibe Coder core markdown pack.

## Naming / Legacy Filename Guard

Some repo asset filenames may still contain older app wording such as `reports`.

Treat those as repo paths or legacy asset filenames, not user-facing product language.

For Bank the Catch product wording, prefer `Insights` when discussing the app section, unless repo truth requires quoting an existing filename/path.

Do not rename runtime asset files only to match newer wording unless Jeremy asks for a scoped asset/manifest rename patch with runtime checks.

## Manifest Action Note Guard

The manifest may contain action notes such as `STAYS`, `OVERWRITE`, or `drop-in optimized asset` from the asset-pack build process.

Use those notes as reference history only.

Do not treat manifest action notes as permission to overwrite, rename, delete, or wire assets into the app without a scoped patch prompt.

## Project File Visibility Guard

The asset zip is a reference pack.

If a task requires precise visual inspection of an image, Jeremy may need to provide the specific image, crop, screenshot, or proof sheet directly in the chat.

Do not assume every image inside the zip has been visually inspected just because the zip is uploaded.
