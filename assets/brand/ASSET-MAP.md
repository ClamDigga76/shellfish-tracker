# Bank the Catch — Asset Map

This pack adds app-organization and metadata assets.

## Pack 7 contents

### Brand / vector
- `assets/brand/vector/btc-simple-mark-mono.svg`
  - Simple monochrome brand mark for tiny UI use.
- `assets/brand/vector/btc-simple-mark-blue.svg`
  - Simple blue brand mark for UI accents and lightweight branding.

### Shortcut icons
- `icons/shortcut-new-trip.png`
  - For future PWA shortcut: New Trip
- `icons/shortcut-trips.png`
  - For future PWA shortcut: Trips
- `icons/shortcut-reports.png`
  - For future PWA shortcut: Reports
- `icons/shortcut-backup.png`
  - For future PWA shortcut: Backup

### Metadata
- `assets/meta/og-image.png`
  - Open Graph / social link preview image for the app website.

## Suggested repo usage

### Manifest shortcut lane (later, when routes are stable)
Potential shortcut names:
- New Trip
- Trips
- Reports
- Backup

### UI usage
Use the simple mark SVGs for:
- tiny buttons
- compact headers
- subtle app branding
- loading/inline brand mark

### Keep using prior packs for:
- Pack 1: install icons / manifest icons
- Pack 2: in-app branding logos
- Pack 3: share/background/watermark pieces
- Pack 5: in-app utility illustrations
- Pack 6: vector decorative/supporting UI assets

## Notes
- Pack 7 is intentionally small and app-specific.
- Shortcut icons are prepared assets only; wiring them into the manifest can happen later.
- The OG image should be referenced in site metadata when the launch/share setup is ready.
