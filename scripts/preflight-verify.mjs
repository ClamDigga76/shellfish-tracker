#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  STARTUP_MODULE_PATHS,
  SW_CORE_JS_PATHS,
  SW_CORE_JS_EXCLUDED_PATHS,
  APP_ENTRY_MODULE_PATH,
} from "../js/startup_asset_manifest_v5.js";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const expectedArg = args.find((arg) => arg.startsWith("--expect-version="));
const expectedVersionOverride = expectedArg ? expectedArg.split("=")[1] : null;

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

let indexHtml = "";
let bootstrapJs = "";
let swJs = "";
let appJs = "";
let runtimeStatusJs = "";
let canonicalVersion = "";

try {
  indexHtml = read("index.html");
  bootstrapJs = read("js/bootstrap_v5.js");
  swJs = read("sw.js");
  appJs = read("js/app_v5.js");
  runtimeStatusJs = read("js/update_runtime_status_v5.js");
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
  const startupRefs = [
    "./utils_v5.js?v=${APP_VERSION}",
    "./settings.js?v=${APP_VERSION}",
    "./migrations_v5.js?v=${APP_VERSION}",
    "./navigation_v5.js?v=${APP_VERSION}",
    "./app_v5.js?v=${APP_VERSION}",
    "./sw.js?v=${APP_VERSION}",
  ];

  for (const ref of startupRefs) {
    if (bootstrapJs.includes(ref)) {
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

  const swCoreMatch = swJs.match(/const CORE_JS_PATHS = \[(?<body>[\s\S]*?)\];/);
  if (!swCoreMatch || !swCoreMatch.groups) {
    fail("service worker core js ownership list", "CORE_JS_PATHS list is missing");
  } else {
    const swCorePaths = Array.from(swCoreMatch.groups.body.matchAll(/"(\.\/js\/[^"?]+\.js)"/g), (match) => match[1]);
    const expectedSwCorePaths = SW_CORE_JS_PATHS.map((relPath) => `./js/${relPath.slice(2)}`);

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

  if (appJs.includes("window.__SHELLFISH_STARTUP_IMPORTS__ = [...STARTUP_MODULE_URLS];")) {
    pass("app exposes startup module diagnostics");
  } else {
    fail("app exposes startup module diagnostics");
  }

  for (const rel of STARTUP_MODULE_PATHS) {
    const relPath = `js/${rel.slice(2)}`;
    if (existsSync(path.join(ROOT, relPath))) {
      pass(`startup module parity: ${rel}`);
    } else {
      fail(`startup module parity: ${rel}`);
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
