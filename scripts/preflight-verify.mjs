#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  STARTUP_MODULE_PATHS,
  SW_CORE_JS_PATHS,
  SW_CORE_JS_EXCLUDED_PATHS,
  STARTUP_APP_OWNED_MODULE_PATHS,
  APP_ENTRY_MODULE_PATH,
  BOOTSTRAP_SANITY_REFERENCE_PATHS,
} from "../js/startup_asset_manifest_v5.js";
import {
  SW_CORE_GENERATED_START_MARKER,
  SW_CORE_GENERATED_END_MARKER,
  buildGeneratedSwCoreJsBlock,
  buildSwCoreJsPaths,
} from "./sync-sw-core-js-from-manifest.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const expectedArg = args.find((arg) => arg.startsWith("--expect-version="));
const expectedVersionOverrideRaw = expectedArg ? expectedArg.split("=")[1] : null;
const expectedVersionOverride = expectedVersionOverrideRaw
  ? String(expectedVersionOverrideRaw).replace(/^v/i, "")
  : null;

const checks = [];

function pass(name, detail = "") {
  checks.push({ ok: true, name, detail });
}

function fail(name, detail = "") {
  checks.push({ ok: false, name, detail });
}

function read(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!existsSync(fullPath)) {
    throw new Error(`${relPath} is missing`);
  }
  return readFileSync(fullPath, "utf8");
}

function extractStartupImportDestructureBody(source = "") {
  const match = source.match(/const\s+\[(?<body>[\s\S]*?)\]\s*=\s*await\s+Promise\.all\(\[/m);
  return match?.groups?.body || "";
}

function countTopLevelArrayEntries(body = "") {
  let count = 0;
  let tokenActive = false;
  let pendingElision = true;
  let sawTopLevelSlotSignal = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = "";
  let escaping = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    const next = body[i + 1] || "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      tokenActive = true;
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        escaping = true;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === "\"" || ch === "`") {
      quote = ch;
      tokenActive = true;
      continue;
    }

    if (ch === "{") {
      braceDepth += 1;
      tokenActive = true;
      continue;
    }
    if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      tokenActive = true;
      continue;
    }
    if (ch === "[") {
      bracketDepth += 1;
      tokenActive = true;
      continue;
    }
    if (ch === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      tokenActive = true;
      continue;
    }
    if (ch === "(") {
      parenDepth += 1;
      tokenActive = true;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      tokenActive = true;
      continue;
    }

    if (ch === "," && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      if (tokenActive || pendingElision) count += 1;
      tokenActive = false;
      pendingElision = true;
      sawTopLevelSlotSignal = true;
      continue;
    }

    if (!/\s/.test(ch)) {
      tokenActive = true;
      pendingElision = false;
      sawTopLevelSlotSignal = true;
    }
  }

  if (!sawTopLevelSlotSignal && body.trim() === "") return 0;
  if (tokenActive || pendingElision) count += 1;
  return count;
}

let indexHtml = "";
let bootstrapJs = "";
let swJs = "";
let appJs = "";
let runtimeStatusJs = "";
let manifestWebmanifest = "";
let shellSharedCss = "";
let canonicalVersion = "";

try {
  indexHtml = read("index.html");
  bootstrapJs = read("js/bootstrap_v5.js");
  swJs = read("sw.js");
  appJs = read("js/app_v5.js");
  runtimeStatusJs = read("js/update_runtime_status_v5.js");
  manifestWebmanifest = read("manifest.webmanifest");
  shellSharedCss = read("css/shell_shared_v5.css");
} catch (error) {
  fail("core files load", String(error.message || error));
}

if (indexHtml) {
  const bootstrapMatch = indexHtml.match(/<script\s+type="module"\s+src="\.\/js\/bootstrap_v5\.js\?v=(\d+)"\s*>\s*<\/script>/i);
  if (!bootstrapMatch) {
    fail("index bootstrap query version", "index.html is missing ./js/bootstrap_v5.js?v=<build>");
  } else {
    canonicalVersion = bootstrapMatch[1];
    pass("index bootstrap query version", `v=${canonicalVersion}`);

    const expectedVersion = expectedVersionOverride || canonicalVersion;

    if (expectedVersion !== canonicalVersion) {
      fail("expected version", `expected ${expectedVersion}, found ${canonicalVersion}`);
    } else if (expectedVersionOverride) {
      pass("expected version", `matches ${expectedVersionOverride}`);
    } else {
      pass("expected version", `auto-resolved to ${expectedVersion}`);
    }

    const cssVersionMatches = Array.from(indexHtml.matchAll(/<link\s+rel="stylesheet"\s+href="([^"?]+\.css)\?v=(\d+)"\s*>/gi));
    if (cssVersionMatches.length === 0) {
      fail("index stylesheet query versions", "no stylesheet query versions found");
    } else {
      for (const [, href, cssVersion] of cssVersionMatches) {
        if (cssVersion === canonicalVersion) {
          pass(`index css version aligned: ${href}`, `v=${cssVersion}`);
        } else {
          fail(`index css version aligned: ${href}`, `expected v=${canonicalVersion}, found v=${cssVersion}`);
        }
      }
    }

    const requiredCssRefs = [
      `./css/shell_shared_v5.css?v=${canonicalVersion}`,
      `./css/shell_feature_surfaces_v5.css?v=${canonicalVersion}`,
      `./css/trip_form_v5.css?v=${canonicalVersion}`,
      `./css/reports_v5.css?v=${canonicalVersion}`,
    ];

    for (const ref of requiredCssRefs) {
      if (indexHtml.includes(ref)) {
        pass(`index required css ref: ${ref}`);
      } else {
        fail(`index required css ref: ${ref}`);
      }
    }

    const manifestMatch = indexHtml.match(/<link\s+rel="manifest"\s+href="([^"?]*manifest\.webmanifest)\?v=(\d+)"\s*>/i);
    if (!manifestMatch) {
      fail("index manifest query version", "index.html is missing manifest.webmanifest?v=<build>");
    } else {
      const [, manifestPath, manifestVersion] = manifestMatch;
      if (manifestVersion === canonicalVersion) {
        pass("index manifest query version", `${manifestPath}?v=${manifestVersion}`);
      } else {
        fail("index manifest query version", `expected v=${canonicalVersion}, found v=${manifestVersion}`);
      }
    }
  }
}

const requiredFiles = [
  "index.html",
  "sw.js",
  "js/bootstrap_v5.js",
  "js/app_v5.js",
  "js/update_runtime_status_v5.js",
  "js/startup_asset_manifest_v5.js",
  ...new Set([
    ...STARTUP_MODULE_PATHS,
    ...SW_CORE_JS_PATHS,
    APP_ENTRY_MODULE_PATH,
    ...SW_CORE_JS_EXCLUDED_PATHS,
    ...STARTUP_APP_OWNED_MODULE_PATHS,
  ]).values(),
].map((relPath) => relPath.startsWith("./") ? `js/${relPath.slice(2)}` : relPath);

for (const relPath of requiredFiles) {
  if (existsSync(path.join(ROOT, relPath))) {
    pass(`boot-critical file present: ${relPath}`);
  } else {
    fail(`boot-critical file present: ${relPath}`);
  }
}

if (bootstrapJs) {
  const startupRefs = BOOTSTRAP_SANITY_REFERENCE_PATHS.map((path) => `${path}?v=\${APP_VERSION}`);
  const bootstrapSanityDerived =
    bootstrapJs.includes("BOOTSTRAP_SANITY_REFERENCE_PATHS") &&
    bootstrapJs.includes("buildVersionedPath(path, \"${APP_VERSION}\")");

  for (const ref of startupRefs) {
    if (bootstrapSanityDerived) {
      pass(`startup reference sanity: ${ref}`);
    } else {
      fail(`startup reference sanity: ${ref}`);
    }
  }

  if (bootstrapJs.includes("window.APP_BUILD = `v5.${APP_VERSION}`;")) {
    pass("bootstrap exposes APP_BUILD from APP_VERSION");
  } else {
    fail("bootstrap exposes APP_BUILD from APP_VERSION");
  }
}

if (swJs) {
  if (swJs.includes('searchParams.get("v")')) {
    pass("service worker uses URL v param");
  } else {
    fail("service worker uses URL v param");
  }

  if (swJs.includes("const CACHE_VERSION = `v${SW_V}`;") && swJs.includes("const CACHE_NAME = `shellfish-tracker-${CACHE_VERSION}`;")) {
    pass("service worker cache version derived from SW_V");
  } else {
    fail("service worker cache version derived from SW_V");
  }

  if (swJs.includes("`./manifest.webmanifest?v=${SW_V}`")) {
    pass("service worker manifest core ref versioned from SW_V");
  } else {
    fail("service worker manifest core ref versioned from SW_V");
  }

  const hasGeneratedMarkers = swJs.includes(SW_CORE_GENERATED_START_MARKER) && swJs.includes(SW_CORE_GENERATED_END_MARKER);
  if (hasGeneratedMarkers) {
    pass("service worker core js generated markers present");
  } else {
    fail("service worker core js generated markers present");
  }

  const generatedSwCoreBlock = buildGeneratedSwCoreJsBlock();
  if (swJs.includes(generatedSwCoreBlock)) {
    pass("service worker core js generated block aligned", `${SW_CORE_JS_PATHS.length} entries`);
  } else {
    fail("service worker core js generated block aligned");
  }

  const swCoreMatch = swJs.match(/const CORE_JS_PATHS = \[(?<body>[\s\S]*?)\];/);
  if (!swCoreMatch || !swCoreMatch.groups) {
    fail("service worker core js ownership list", "CORE_JS_PATHS list is missing");
  } else {
    const swCorePaths = Array.from(swCoreMatch.groups.body.matchAll(/"(\.\/js\/[^"?]+\.js)"/g), (match) => match[1]);
    const expectedSwCorePaths = buildSwCoreJsPaths();

    if (swCorePaths.length === expectedSwCorePaths.length && swCorePaths.every((path, idx) => path === expectedSwCorePaths[idx])) {
      pass("service worker core js parity with startup manifest", `${swCorePaths.length} entries`);
    } else {
      fail(
        "service worker core js parity with startup manifest",
        `expected [${expectedSwCorePaths.join(", ")}], found [${swCorePaths.join(", ")}]`
      );
    }

    const swCoreVersionedMapMarker = "...CORE_JS_PATHS.map((path) => `${path}?v=${SW_V}`),";
    if (swJs.includes(swCoreVersionedMapMarker)) {
      pass("service worker versioned core js mapping");
    } else {
      fail("service worker versioned core js mapping");
    }
  }

  for (const rel of SW_CORE_JS_PATHS) {
    const swPath = `./js/${rel.slice(2)}`;
    if (swJs.includes(`"${swPath}"`)) {
      pass(`service worker core ownership includes: ${rel}`);
    } else {
      fail(`service worker core ownership includes: ${rel}`);
    }
  }

  for (const rel of SW_CORE_JS_EXCLUDED_PATHS) {
    const swPath = `./js/${rel.slice(2)}`;
    if (!swJs.includes(swPath)) {
      pass(`service worker core ownership excludes: ${rel}`);
    } else {
      fail(`service worker core ownership excludes: ${rel}`, `${swPath} is present in sw.js`);
    }
  }
}

if (manifestWebmanifest) {
  try {
    const manifest = JSON.parse(manifestWebmanifest);
    const requiredManifestKeys = ["display_override", "launch_handler", "handle_links"];
    for (const key of requiredManifestKeys) {
      if (Object.hasOwn(manifest, key)) {
        pass(`manifest enrichment key present: ${key}`);
      } else {
        fail(`manifest enrichment key present: ${key}`);
      }
    }
  } catch (error) {
    fail("manifest parse", String(error.message || error));
  }
}

if (bootstrapJs && appJs) {
  if (bootstrapJs.includes("await import(APP_URL);")) {
    pass("bootstrap startup parity: imports APP_URL");
  } else {
    fail("bootstrap startup parity: imports APP_URL");
  }

  if (appJs.includes("const STARTUP_MODULE_URLS = STARTUP_MODULE_PATHS.map(getVersionedModuleHref);")) {
    pass("app startup modules derive versioned URLs");
  } else {
    fail("app startup modules derive versioned URLs");
  }

  if (appJs.includes("return import(getVersionedModuleHref(relPath));")) {
    pass("app versioned module loader uses versioned href");
  } else {
    fail("app versioned module loader uses versioned href");
  }

  if (appJs.includes("...STARTUP_MODULE_PATHS.map(importVersionedModule)")) {
    pass("app startup loads use versioned module list");
  } else {
    fail("app startup loads use versioned module list");
  }

  if (
    appJs.includes("window.__SHELLFISH_STARTUP_IMPORTS__ = startupImportUrls;") &&
    appJs.includes("window.__BOOT_DIAG__.startupModuleUrls = startupImportUrls;")
  ) {
    pass("app exposes startup module diagnostics");
  } else {
    fail("app exposes startup module diagnostics");
  }

  const startupImportDestructureBody = extractStartupImportDestructureBody(appJs);
  if (startupImportDestructureBody) {
    pass("app startup import destructure present");
    const expectedStartupImportSlotCount = STARTUP_MODULE_PATHS.length + STARTUP_APP_OWNED_MODULE_PATHS.length;
    const actualStartupImportSlotCount = countTopLevelArrayEntries(startupImportDestructureBody);
    if (actualStartupImportSlotCount === expectedStartupImportSlotCount) {
      pass("app startup import slot count matches manifest lists", `${actualStartupImportSlotCount} slots`);
    } else {
      fail(
        "app startup import slot count matches manifest lists",
        `expected ${expectedStartupImportSlotCount}, found ${actualStartupImportSlotCount}`
      );
    }
  } else {
    fail("app startup import destructure present");
  }

  const requiresExtractedTripHelperGap =
    STARTUP_MODULE_PATHS.includes("./trip_screen_shared_helpers_v5.js") &&
    STARTUP_MODULE_PATHS.includes("./trip_screen_field_bindings_v5.js");
  if (requiresExtractedTripHelperGap) {
    const tripHelperGapPattern = /\{\s*createFeedbackSeam\s*\}\s*,\s*_tripScreenSharedHelpersModule\s*,\s*_tripScreenFieldBindingsModule\s*,\s*\{\s*createTripScreenOrchestrator\s*\}/m;
    if (tripHelperGapPattern.test(startupImportDestructureBody || appJs)) {
      pass("app startup extracted trip helper alignment gap preserved");
    } else {
      fail(
        "app startup extracted trip helper alignment gap preserved",
        "expected createFeedbackSeam -> trip helper placeholders -> createTripScreenOrchestrator order"
      );
    }
  }

  for (const rel of STARTUP_MODULE_PATHS) {
    const relPath = `js/${rel.slice(2)}`;
    if (existsSync(path.join(ROOT, relPath))) {
      pass(`startup module parity: ${rel}`);
    } else {
      fail(`startup module parity: ${rel}`);
    }
  }

  if (appJs.includes("...STARTUP_APP_OWNED_MODULE_PATHS.map(importVersionedModule)")) {
    pass("app startup app-owned modules derive from manifest list");
  } else {
    fail("app startup app-owned modules derive from manifest list");
  }

  if (
    appJs.includes('importVersionedModule("./app_local_utils_v5.js")') ||
    appJs.includes('importVersionedModule("./trips_unified_filter_bridge_v5.js")') ||
    appJs.includes('importVersionedModule("./theme_runtime_seam_v5.js")') ||
    appJs.includes('importVersionedModule("./ui_browser_helpers_v5.js")')
  ) {
    fail("app startup app-owned modules not hardcoded");
  } else {
    pass("app startup app-owned modules not hardcoded");
  }

  for (const rel of STARTUP_APP_OWNED_MODULE_PATHS) {
    const relPath = `js/${rel.slice(2)}`;
    if (existsSync(path.join(ROOT, relPath))) {
      pass(`startup app-owned module present: ${rel}`);
    } else {
      fail(`startup app-owned module present: ${rel}`);
    }

    if (SW_CORE_JS_EXCLUDED_PATHS.includes(rel)) {
      pass(`startup app-owned module excluded from SW core: ${rel}`);
    } else {
      fail(`startup app-owned module excluded from SW core: ${rel}`);
    }
  }
}

if (appJs) {
  if (appJs.includes('const APP_VERSION = (window.APP_BUILD || "v5");')) {
    pass("app version source uses window.APP_BUILD");
  } else {
    fail("app version source uses window.APP_BUILD");
  }
}

if (runtimeStatusJs) {
  if (runtimeStatusJs.includes("Version ${displayBuildVersion}")) {
    pass("settings update status shows displayBuildVersion");
  } else {
    fail("settings update status shows displayBuildVersion");
  }

  if (runtimeStatusJs.includes("const parts = [`App ${displayBuildVersion}`];")) {
    pass("settings build badge uses displayBuildVersion");
  } else {
    fail("settings build badge uses displayBuildVersion");
  }

  if (runtimeStatusJs.includes("async function getRuntimeVersionDiagnostics()")) {
    pass("settings runtime diagnostics helper present");
  } else {
    fail("settings runtime diagnostics helper present");
  }

  if (runtimeStatusJs.includes("Version check: warning") && runtimeStatusJs.includes("Version check: aligned")) {
    pass("settings version guardrail messaging present");
  } else {
    fail("settings version guardrail messaging present");
  }
}

if (shellSharedCss) {
  const standalonePlusRestRule =
    ':root[data-display-mode="standalone"] #tabbar .tabbtn.plus,\nbody[data-display-mode="standalone"] #tabbar .tabbtn.plus{';
  const standalonePlusActiveRule =
    ':root[data-display-mode="standalone"] #tabbar .tabbtn.plus:active,\nbody[data-display-mode="standalone"] #tabbar .tabbtn.plus:active{';

  if (shellSharedCss.includes(standalonePlusRestRule)) {
    pass("standalone plus rest selector pair present");
  } else {
    fail("standalone plus rest selector pair present");
  }

  if (
    shellSharedCss.includes(standalonePlusActiveRule) &&
    shellSharedCss.includes("transform:translateY(1px) scale(.98);")
  ) {
    pass("standalone plus active press feedback guardrail");
  } else {
    fail("standalone plus active press feedback guardrail");
  }
}

let passCount = 0;
let failCount = 0;

for (const item of checks) {
  if (item.ok) {
    passCount += 1;
    console.log(`PASS ${item.name}${item.detail ? ` (${item.detail})` : ""}`);
  } else {
    failCount += 1;
    console.error(`FAIL ${item.name}${item.detail ? ` (${item.detail})` : ""}`);
  }
}

if (failCount > 0) {
  console.error(`\nPreflight failed: ${failCount} failed, ${passCount} passed.`);
  process.exit(1);
}

console.log(`\nPreflight passed: ${passCount} checks.`);
