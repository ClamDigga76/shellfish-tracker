#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const expectedArg = args.find((arg) => arg.startsWith("--expect-version="));
const expectedVersion = expectedArg ? expectedArg.split("=")[1] : null;

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

try {
  indexHtml = read("index.html");
  bootstrapJs = read("js/bootstrap_v5.js");
  swJs = read("sw.js");
  appJs = read("js/app_v5.js");
} catch (error) {
  fail("core files load", String(error.message || error));
}

if (indexHtml) {
  const bootstrapMatch = indexHtml.match(/<script\s+type="module"\s+src="\.\/js\/bootstrap_v5\.js\?v=(\d+)"\s*>\s*<\/script>/i);
  if (!bootstrapMatch) {
    fail("index bootstrap query version", "index.html is missing ./js/bootstrap_v5.js?v=<build>");
  } else {
    const indexVersion = bootstrapMatch[1];
    pass("index bootstrap query version", `v=${indexVersion}`);

    if (expectedVersion && expectedVersion !== indexVersion) {
      fail("expected version", `expected ${expectedVersion}, found ${indexVersion}`);
    } else if (expectedVersion) {
      pass("expected version", `matches ${expectedVersion}`);
    }
  }
}

const requiredFiles = [
  "index.html",
  "sw.js",
  "js/bootstrap_v5.js",
  "js/app_v5.js",
  "js/utils_v5.js",
  "js/settings.js",
  "js/migrations_v5.js",
  "js/navigation_v5.js",
  "js/reports_charts_v5.js",
  "js/quick_chips_v5.js",
  "js/reports_filters_v5.js",
  "js/settings_list_management_v5.js",
];

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

if (appJs && swJs) {
  const startupImports = Array.from(
    appJs.matchAll(/import\s+[^;]*?from\s+"(\.\/[^"?]+\.js)";/g),
    (match) => match[1],
  );

  for (const rel of startupImports) {
    const swNeedle = `"./js/${rel.slice(2)}?v="+SW_V`;
    if (swJs.includes(swNeedle)) {
      pass(`service worker startup parity: ${rel}`);
    } else {
      fail(`service worker startup parity: ${rel}`);
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
