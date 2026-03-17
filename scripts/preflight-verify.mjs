#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

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
let appStartupImports = [];
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
  "js/utils_v5.js",
  "js/settings.js",
  "js/migrations_v5.js",
  "js/navigation_v5.js",
  "js/reports_charts_v5.js",
  "js/quick_chips_v5.js",
  "js/reports_filters_v5.js",
  "js/settings_list_management_v5.js",
  "js/reports_aggregation_v5.js",
  "js/backup_restore_v5.js",
  "js/trip_shared_engine_v5.js",
  "js/trip_cards_v5.js",
  "js/help_about_render_v5.js",
  "js/trip_form_render_v5.js",
  "js/home_dashboard_v5.js",
  "js/settings_screen_v5.js",
  "js/reports_screen_v5.js",
  "js/feedback_seam_v5.js",
  "js/app_shell_v5.js",
];

if (appJs) {
  appStartupImports = Array.from(
    appJs.matchAll(/import\s+[^;]*?from\s+"(\.\/[^"?]+\.js)";/g),
    (match) => match[1],
  );

  for (const rel of appStartupImports) {
    const relPath = `js/${rel.slice(2)}`;
    if (requiredFiles.includes(relPath)) continue;
    requiredFiles.push(relPath);
  }
}

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

  const swCoreRefs = [
    "`./js/bootstrap_v5.js?v=${SW_V}`",
    '"./js/utils_v5.js?v="+SW_V',
    '"./js/settings.js?v="+SW_V',
    '"./js/migrations_v5.js?v="+SW_V',
    '"./js/navigation_v5.js?v="+SW_V',
    '"./js/reports_charts_v5.js?v="+SW_V',
    '"./js/quick_chips_v5.js?v="+SW_V',
    '"./js/reports_filters_v5.js?v="+SW_V',
    '"./js/settings_list_management_v5.js?v="+SW_V',
    '"./js/app_v5.js?v="+SW_V',
  ];

  for (const ref of swCoreRefs) {
    if (swJs.includes(ref)) {
      pass(`service worker core reference: ${ref}`);
    } else {
      fail(`service worker core reference: ${ref}`);
    }
  }
}

if (bootstrapJs && appJs) {
  if (bootstrapJs.includes("await import(APP_URL);")) {
    pass("bootstrap startup parity: imports APP_URL");
  } else {
    fail("bootstrap startup parity: imports APP_URL");
  }

  for (const rel of appStartupImports) {
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
  if (runtimeStatusJs.includes("Current build: ${displayBuildVersion}")) {
    pass("settings update status shows displayBuildVersion");
  } else {
    fail("settings update status shows displayBuildVersion");
  }

  if (runtimeStatusJs.includes("const parts = [`App ${displayBuildVersion}`];")) {
    pass("settings build badge uses displayBuildVersion");
  } else {
    fail("settings build badge uses displayBuildVersion");
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
