# Brand reference image staging (docs-only)

Use this folder for raw or exported **reference-only** branding boards that support docs and planning.

## Current official source image
- Official source artifact: `bank-the-catch-brand-authority-2026-04-27.md`
- SHA-256: see `bank-the-catch-brand-authority-2026-04-27.sha256`
- Status: locked as source of truth on 2026-04-27
- Replaces: older logo/app-icon reference boards and earlier layout ideas


## Verify checksum
```bash
cd docs/brand/reference
sha256sum -c bank-the-catch-brand-authority-2026-04-27.sha256
```

## Usage boundary
Files in this folder are not runtime/public app assets.
Any production-ready assets should be exported intentionally from the locked source image as a separate implementation step.

## Source input files (committed reference copies)
Stored under `docs/brand/reference/source-inputs/`:

- `btc-horizontal-logo-source-2026-04-27.jpg`
- `btc-square-app-icon-source-2026-04-27.jpg`
- `btc-wide-logo-lockup-source-2026-04-27.jpg`

If the binary files are not committed in a given pass, keep the folder path and upload these exact filenames before export work.
