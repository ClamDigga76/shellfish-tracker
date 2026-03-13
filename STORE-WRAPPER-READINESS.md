# STORE-WRAPPER-READINESS.md

## Purpose
Track the app's current wrapper readiness baseline for future Google Play and Apple App Store submission work.

This file is prep guidance only. It does not change runtime behavior.

## Current baseline (already in repo)
- `manifest.webmanifest` includes core PWA identity fields (`name`, `short_name`, `id`, `start_url`, `scope`, `display`, `orientation`, colors, categories, and icon set).
- `index.html` includes manifest link, mobile web app capability tags, Apple web app tags, viewport with `viewport-fit=cover`, theme color, and touch icon.
- App remains offline-first and local-storage-first, with privacy/terms docs already in repo.

## Wrapper readiness assumptions (now explicit)
1. **Single-app shell assumption**
   - Wrapper should load only this app origin and app entrypoint.
   - No cross-origin iframe/embed dependency is assumed.

2. **Storage ownership assumption**
   - Trip data is local-device data and should be treated as app-owned local state in wrappers.
   - Backup/restore remains required for device migration safety.

3. **Update-trust assumption**
   - PWA version-chain discipline remains important even before wrapper adoption.
   - Wrapper rollout/update strategy should not weaken current version visibility expectations.

4. **Mobile-safe UI assumption**
   - Runtime should continue to prefer native mobile controls and avoid platform-fragile hacks.
   - iPhone Safari/PWA and Android Chrome parity stays the default compatibility target.

## Known submission-path blockers (not solved in this patch)
- Native wrapper project is not scaffolded yet (Capacitor/Cordova/Ionic or equivalent not chosen).
- Store-required native metadata/assets are not complete yet (splash set, store listing packs, signing/release pipeline).
- Policy/compliance checklist for app-store submission is not yet codified as a release gate.

## Next prep steps (small and safe)
- Choose wrapper stack and lock minimal configuration conventions.
- Add a store-readiness checklist doc with pass/fail gates for metadata, icons/splash, privacy/terms links, and release signing.
- Add CI or scripted checks only after wrapper path is selected, to avoid premature tooling drift.
