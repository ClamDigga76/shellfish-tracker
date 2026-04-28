# Repo Image Inventory Audit — 2026-04-28

## Scope and method
- Audit-only inventory pass (no runtime behavior changes).
- Image file extensions included: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`.
- Reference scan included all repo files for path/string mentions of those extensions.

Commands used:
- `rg --files -g '*.{png,jpg,jpeg,webp,svg}' | sort`
- `rg -n --hidden --glob '!.git' -e '\\.(png|jpg|jpeg|webp|svg)' .`

---

## 1) Image files currently in repo

### icons/
| Path | Type | Referenced by runtime code? | Docs/reference-only? | Candidate for replacement by new asset ZIP? |
|---|---|---:|---:|---|
| `icons/favicon-32.png` | png | Yes (`index.html`) | No | Likely yes (app icon set candidate) |
| `icons/hero.svg` | svg | No direct reference found | No | Possible (needs ZIP comparison) |
| `icons/icon-152.png` | png | No direct reference found | No | Likely yes (icon set candidate) |
| `icons/icon-167.png` | png | No direct reference found | No | Likely yes (icon set candidate) |
| `icons/icon-180.png` | png | Yes (`index.html`) | No | Likely yes (icon set candidate) |
| `icons/icon-192.png` | png | Yes (`manifest.webmanifest`, `js/share_card_v5.js`) | No | Likely yes (icon set candidate) |
| `icons/icon-192-maskable.png` | png | Yes (`manifest.webmanifest`) | No | Likely yes (icon set candidate) |
| `icons/icon-512.png` | png | Yes (`manifest.webmanifest`) | No | Likely yes (icon set candidate) |
| `icons/icon-512-maskable.png` | png | Yes (`manifest.webmanifest`) | No | Likely yes (icon set candidate) |

### docs/brand/reference/source-inputs/
| Path | Type | Referenced by runtime code? | Docs/reference-only? | Candidate for replacement by new asset ZIP? |
|---|---|---:|---:|---|
| `docs/brand/reference/source-inputs/bank-the-catch-app-icon.png` | png | No direct reference found | Yes | Likely yes (brand source asset) |
| `docs/brand/reference/source-inputs/bank-the-catch-logo-full.png` | png | No direct reference found | Yes | Likely yes (brand source asset) |
| `docs/brand/reference/source-inputs/bank-the-catch-logo-horizontal.png` | png | Yes (`js/home_dashboard_v5.js`, `js/share_card_v5.js`) | No | Likely yes (brand logo candidate) |
| `docs/brand/reference/source-inputs/btc-horizontal-logo-source-2026-04-27.jpg` | jpg | No | Yes (`docs/brand/*`) | Likely yes (reference source asset) |
| `docs/brand/reference/source-inputs/btc-square-app-icon-source-2026-04-27.jpg` | jpg | No | Yes (`docs/brand/*`) | Likely yes (reference source asset) |
| `docs/brand/reference/source-inputs/btc-wide-logo-lockup-source-2026-04-27.jpg` | jpg | No | Yes (`docs/brand/*`) | Likely yes (reference source asset) |

### assets/
- No image files found under `assets/`.

### Total image files found
- **15** total image files.

---

## 2) All code/docs references to image paths

> Note: This section lists all extension matches found by repo-wide grep, grouped by requested folder/surface.

### root files (`index.html`, `manifest.webmanifest`)
- `index.html:14` → `icons/favicon-32.png`
- `index.html:15` → `icons/icon-180.png`
- `manifest.webmanifest:29` → `icons/icon-192.png`
- `manifest.webmanifest:35` → `icons/icon-192-maskable.png`
- `manifest.webmanifest:41` → `icons/icon-512.png`
- `manifest.webmanifest:47` → `icons/icon-512-maskable.png`

### js/
- `js/home_dashboard_v5.js:552` → `docs/brand/reference/source-inputs/bank-the-catch-logo-horizontal.png?v=696`
- `js/share_card_v5.js:106` → `./icons/icon-192.png${iconVersion}`
- `js/share_card_v5.js:124` → `./docs/brand/reference/source-inputs/bank-the-catch-logo-horizontal.png?v=696`
- `js/share_card_v5.js:238` → generated output filename `bank-the-catch-trip-...png` (output artifact name, not repo asset path)

### css/
- No `.png/.jpg/.jpeg/.webp/.svg` references found in `css/`.

### docs/brand/reference/
- `docs/brand/reference/README.md:25` → `btc-horizontal-logo-source-2026-04-27.jpg`
- `docs/brand/reference/README.md:26` → `btc-square-app-icon-source-2026-04-27.jpg`
- `docs/brand/reference/README.md:27` → `btc-wide-logo-lockup-source-2026-04-27.jpg`

### docs/ (other)
- `docs/brand/brand-source-of-truth.md:45` → `btc-horizontal-logo-source-2026-04-27.jpg`
- `docs/brand/brand-source-of-truth.md:46` → `btc-square-app-icon-source-2026-04-27.jpg`
- `docs/brand/brand-source-of-truth.md:47` → `btc-wide-logo-lockup-source-2026-04-27.jpg`

### icons/
- No files inside `icons/` contain extension-string references.

### assets/
- No `assets/` folder references found in grep hits.

### anything else found
- No additional folders beyond root files, `js/`, and `docs/` produced image-extension hits.

---

## 3) Group summary (requested buckets)

- `icons/`: 9 image files present; 6 direct runtime references found.
- `assets/`: no folder/files found for image inventory.
- `docs/brand/reference/`: references found in README; source image files found in `source-inputs/`.
- `js/`: runtime references to `icons/icon-192.png` and `docs/brand/reference/source-inputs/bank-the-catch-logo-horizontal.png`.
- `css/`: no image extension references found.
- Root files: `index.html` and `manifest.webmanifest` contain icon references.
- Anything else: docs in `docs/brand/` reference `.jpg` source inputs.

---

## 4) Likely non-ZIP image paths to review

These paths are likely operational/runtime-critical and should be reviewed carefully before any replacement batch is applied:

- `icons/favicon-32.png`
- `icons/icon-180.png`
- `icons/icon-192.png`
- `icons/icon-192-maskable.png`
- `icons/icon-512.png`
- `icons/icon-512-maskable.png`
- `docs/brand/reference/source-inputs/bank-the-catch-logo-horizontal.png`

Potentially in-repo but currently unreferenced (verify intent before replacing):
- `icons/hero.svg`
- `icons/icon-152.png`
- `icons/icon-167.png`
- `docs/brand/reference/source-inputs/bank-the-catch-app-icon.png`
- `docs/brand/reference/source-inputs/bank-the-catch-logo-full.png`

Docs/reference-source only (non-runtime references found):
- `docs/brand/reference/source-inputs/btc-horizontal-logo-source-2026-04-27.jpg`
- `docs/brand/reference/source-inputs/btc-square-app-icon-source-2026-04-27.jpg`
- `docs/brand/reference/source-inputs/btc-wide-logo-lockup-source-2026-04-27.jpg`

---

## 5) Runtime cleanup note (2026-04-28, patch BRAND-ASSET-PATHS-AND-RETIRE-1)

Follow-up runtime cleanup rewired Screenshot Card logo usage to `assets/brand/btc-logo-horizontal.png?v=714` and retired these previously listed candidates after confirming no active runtime/code/manifest/CSS references remained:

- `docs/brand/reference/source-inputs/bank-the-catch-app-icon.png`
- `docs/brand/reference/source-inputs/bank-the-catch-logo-full.png`
- `docs/brand/reference/source-inputs/bank-the-catch-logo-horizontal.png`
- `icons/hero.svg`
- `icons/icon-152.png`
- `icons/icon-167.png`

The source/reference JPEGs remain in `docs/brand/reference/source-inputs/`.

