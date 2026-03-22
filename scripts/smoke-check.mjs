#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const checks = [];

function pass(name, detail = '') {
  checks.push({ ok: true, name, detail });
}

function fail(name, detail = '') {
  checks.push({ ok: false, name, detail });
}

function checkFileExists(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (existsSync(fullPath)) {
    pass(`file present: ${relPath}`);
  } else {
    fail(`file present: ${relPath}`);
  }
}

function readSource(relPath) {
  try {
    return readFileSync(path.join(ROOT, relPath), 'utf8');
  } catch (error) {
    fail(`read ${relPath}`, String(error.message || error));
    return '';
  }
}

function checkIncludes(source, checkName, token, detail = token) {
  if (source.includes(token)) {
    pass(checkName);
  } else {
    fail(checkName, `missing ${detail}`);
  }
}

function checkIncludesAny(source, checkName, tokens) {
  const hit = tokens.find((token) => source.includes(token));
  if (hit) {
    pass(checkName, `matched ${hit}`);
  } else {
    fail(checkName, `expected one of: ${tokens.join(' | ')}`);
  }
}

function checkPattern(source, checkName, pattern, detail = pattern.toString()) {
  if (pattern.test(source)) {
    pass(checkName);
  } else {
    fail(checkName, `missing ${detail}`);
  }
}

const requiredFiles = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'js/bootstrap_v5.js',
  'js/app_v5.js',
  'js/utils_v5.js',
  'js/settings.js',
];

for (const relPath of requiredFiles) {
  checkFileExists(relPath);
}

let indexHtml = '';
indexHtml = readSource('index.html');

if (indexHtml) {
  const bootstrapPattern = /<script\s+type="module"\s+src="\.\/js\/bootstrap_v5\.js\?v=(\d+)"\s*>\s*<\/script>/i;
  const bootstrapMatch = indexHtml.match(bootstrapPattern);

  if (bootstrapMatch) {
    pass('index bootstrap module loader versioned', `v=${bootstrapMatch[1]}`);
  } else {
    fail('index bootstrap module loader versioned', 'missing ./js/bootstrap_v5.js?v=<number>');
  }

  if (indexHtml.includes('manifest.webmanifest')) {
    pass('index manifest reference present');
  } else {
    fail('index manifest reference present');
  }
}

const appSource = readSource('js/app_v5.js');
const runtimeOrchestrationSource = readSource('js/runtime_orchestration_seam_v5.js');
const homeSource = readSource('js/home_dashboard_v5.js');
const shellSource = readSource('js/app_shell_v5.js');
const settingsScreenSource = readSource('js/settings_screen_v5.js');
const tripFormSource = readSource('js/trip_form_render_v5.js');
const tripScreenSource = readSource('js/trip_screen_orchestrator_v5.js');
const reportsScreenSource = readSource('js/reports_screen_v5.js');
const updateStatusSource = readSource('js/update_runtime_status_v5.js');

if (appSource) {
  checkIncludes(appSource, 'boot startup marker initialized', 'window.__SHELLFISH_APP_STARTED = false;');
  checkPattern(appSource, 'boot dispatcher present', /function\s+render\s*\(/, 'function render(...)');
}

if (runtimeOrchestrationSource) {
  checkIncludes(runtimeOrchestrationSource, 'boot startup marker finalized', 'window.__SHELLFISH_APP_STARTED = true;');
  checkPattern(runtimeOrchestrationSource, 'boot home default render', /if\s*\(\s*!state\.view\s*\)\s*state\.view\s*=\s*["']home["']\s*;/, 'state.view defaults to "home"');
  checkPattern(runtimeOrchestrationSource, 'boot all_trips route wired', /state\.view\s*===\s*["']all_trips["']\s*\)\s*renderers\.renderAllTrips\(/, 'dispatcher branch for all_trips');
  checkPattern(runtimeOrchestrationSource, 'home route reachable from dispatcher', /else\s+renderers\.renderHome\s*\(/, 'dispatcher fallback to renderHome(...)');
  checkPattern(runtimeOrchestrationSource, 'settings route reachable from dispatcher', /state\.view\s*===\s*["']settings["']\s*\)\s*renderers\.renderSettings\(/, 'dispatcher branch for settings');
  checkPattern(runtimeOrchestrationSource, 'new trip route reachable from dispatcher', /state\.view\s*===\s*["']new["']\s*\)\s*renderers\.renderNewTrip\(/, 'dispatcher branch for new');
}

if (homeSource) {
  checkIncludes(homeSource, 'home renderer factory exists', 'export function createHomeDashboardRenderer({');
  checkPattern(homeSource, 'home render function exists', /function\s+renderHome\s*\(/, 'function renderHome(...)');
  checkIncludesAny(homeSource, 'home view marker present', ['renderPageHeader("home")', 'renderPageHeader(\'home\')']);
}

if (appSource) {
  checkIncludesAny(appSource, 'home renderer import wired', [
    'from "./home_dashboard_v5.js"',
    "from './home_dashboard_v5.js'",
    '"./home_dashboard_v5.js"',
  ]);
  checkIncludes(appSource, 'home renderer created', 'const { renderHome } = createHomeDashboardRenderer({');
  checkPattern(appSource, 'trips screen render function exists', /function\s+renderAllTrips\s*\(/, 'function renderAllTrips(...)');
  checkIncludesAny(appSource, 'settings renderer import wired', [
    'from "./settings_screen_v5.js"',
    "from './settings_screen_v5.js'",
    '"./settings_screen_v5.js"',
  ]);
  checkIncludes(appSource, 'settings renderer created', 'const { renderSettings } = createSettingsScreenOrchestrator({');
  checkIncludes(appSource, 'startup module list versioned loader present', 'const STARTUP_MODULE_URLS = STARTUP_MODULE_PATHS.map(getVersionedModuleHref);');
}

if (shellSource) {
  checkIncludesAny(shellSource, 'trips tab present', ['{ key: "all_trips", label: "Trips"', "{ key: 'all_trips', label: 'Trips'"]);
  checkIncludesAny(shellSource, 'new trip title marker present', ['new: "New Trip"', "new: 'New Trip'"]);
}

if (settingsScreenSource) {
  checkIncludes(settingsScreenSource, 'settings screen orchestrator export exists', 'export function createSettingsScreenOrchestrator({');
  checkIncludesAny(settingsScreenSource, 'settings page header marker present', ['renderPageHeader("settings")', "renderPageHeader('settings')"]);
  checkPattern(settingsScreenSource, 'settings updates section marker present', /settingsMiniTitle[\s\S]*Updates/, 'settings updates section anchor');
  checkIncludes(settingsScreenSource, 'settings update status row marker present', 'id="updateBigStatus"');
  checkIncludes(settingsScreenSource, 'settings build version row marker present', 'id="updateVersionLine"');
  checkIncludes(settingsScreenSource, 'settings backup action marker present', 'id="downloadBackup"');
  checkIncludes(settingsScreenSource, 'settings restore action marker present', 'id="restoreBackup"');
}

if (tripFormSource) {
  checkIncludes(tripFormSource, 'new trip form renderer export exists', 'export function renderTripEntryForm({');
  checkIncludesAny(tripFormSource, 'new trip primary action marker present', ['"saveTrip"', "'saveTrip'"]);
  checkIncludesAny(tripFormSource, 'new trip form foundation marker present', ['tripFormFoundation', 'trip-section']);
  checkIncludes(tripFormSource, 'new/edit form mode support marker present', 'const isEdit = mode === "edit";');
}

if (tripScreenSource) {
  checkIncludes(tripScreenSource, 'trip save orchestrator export exists', 'export function createTripScreenOrchestrator({');
  checkPattern(tripScreenSource, 'new trip render function exists', /function\s+renderNewTrip\s*\(/, 'function renderNewTrip(...)');
  checkIncludes(tripScreenSource, 'new trip uses entry form renderer', 'const newTripFormHtml = renderTripEntryForm({');
  checkIncludesAny(tripScreenSource, 'new trip header marker present', ['renderPageHeader("new")', "renderPageHeader('new')"]);
  checkIncludes(tripScreenSource, 'trip save button marker present', 'document.getElementById("saveTrip")');
  checkIncludes(tripScreenSource, 'trip save snapshot builder marker present', 'const saveSnapshot = buildNewTripSaveSnapshot({');
  checkIncludes(tripScreenSource, 'trip save submit handler marker present', 'newTripForm.addEventListener("submit"');
}

if (reportsScreenSource) {
  checkIncludes(reportsScreenSource, 'reports screen renderer export exists', 'export function createReportsScreenRenderer(deps){');
  checkIncludes(reportsScreenSource, 'reports header marker present', 'renderPageHeader("reports")');
  checkIncludes(reportsScreenSource, 'reports timeframe filter marker present', 'aria-label="Reports timeframe filter"');
  checkIncludesAny(reportsScreenSource, 'reports chart surface marker present', ['id="reportsCharts"', 'class="chart"']);
}

if (updateStatusSource) {
  checkIncludes(updateStatusSource, 'runtime update seam export exists', 'export function createUpdateRuntimeStatusSeam({');
  checkIncludes(updateStatusSource, 'runtime update ready status marker present', 'Latest version ready • Safe to load now');
  checkIncludes(updateStatusSource, 'runtime current build marker present', 'Version ${displayBuildVersion}');
  checkIncludes(updateStatusSource, 'runtime build badge marker present', 'App ${displayBuildVersion}');
}

let passCount = 0;
let failCount = 0;

for (const item of checks) {
  if (item.ok) {
    passCount += 1;
    console.log(`PASS ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
  } else {
    failCount += 1;
    console.error(`FAIL ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
  }
}

if (failCount > 0) {
  console.error(`\nSmoke failed: ${failCount} failed, ${passCount} passed.`);
  process.exit(1);
}

console.log(`\nSmoke passed: ${passCount} checks.`);
