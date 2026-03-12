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
const homeSource = readSource('js/home_dashboard_v5.js');
const shellSource = readSource('js/app_shell_v5.js');
const settingsScreenSource = readSource('js/settings_screen_v5.js');
const tripFormSource = readSource('js/trip_form_render_v5.js');

if (appSource) {
  checkIncludes(appSource, 'boot startup marker initialized', 'window.__SHELLFISH_APP_STARTED = false;');
  checkIncludes(appSource, 'boot startup marker finalized', 'window.__SHELLFISH_APP_STARTED = true;');
  checkIncludes(appSource, 'boot dispatcher present', 'function render(){');
  checkIncludes(appSource, 'boot home default render', 'if(!state.view) state.view = "home";');
  checkIncludes(appSource, 'boot all_trips route wired', 'else if(state.view === "all_trips") renderAllTrips();');
}

if (homeSource) {
  checkIncludes(homeSource, 'home renderer factory exists', 'export function createHomeDashboardRenderer({');
  checkIncludes(homeSource, 'home render function exists', 'function renderHome() {');
  checkIncludesAny(homeSource, 'home view marker present', ['renderPageHeader("home")', 'renderPageHeader(\'home\')']);
}

if (appSource) {
  checkIncludesAny(appSource, 'home renderer import wired', ['from "./home_dashboard_v5.js"', "from './home_dashboard_v5.js'"]);
  checkIncludes(appSource, 'home renderer created', 'const { renderHome } = createHomeDashboardRenderer({');
  checkIncludes(appSource, 'home route reachable from dispatcher', 'else renderHome();');
  checkIncludes(appSource, 'trips screen render function exists', 'function renderAllTrips(){');
  checkIncludesAny(appSource, 'settings renderer import wired', ['from "./settings_screen_v5.js"', "from './settings_screen_v5.js'"]);
  checkIncludes(appSource, 'settings renderer created', 'const { renderSettings } = createSettingsScreenOrchestrator({');
  checkIncludes(appSource, 'settings route reachable from dispatcher', 'if(state.view === "settings") renderSettings();');
  checkIncludes(appSource, 'new trip render function exists', 'function renderNewTrip(){');
  checkIncludes(appSource, 'new trip route reachable from dispatcher', 'else if(state.view === "new") renderNewTrip();');
  checkIncludes(appSource, 'new trip uses entry form renderer', 'const newTripFormHtml = renderTripEntryForm({');
  checkIncludesAny(appSource, 'new trip header marker present', ['renderPageHeader("new")', "renderPageHeader('new')"]);
}

if (shellSource) {
  checkIncludesAny(shellSource, 'trips tab present', ['{ key: "all_trips", label: "Trips"', "{ key: 'all_trips', label: 'Trips'"]);
  checkIncludesAny(shellSource, 'new trip title marker present', ['new: "New Trip"', "new: 'New Trip'"]);
}

if (settingsScreenSource) {
  checkIncludes(settingsScreenSource, 'settings screen orchestrator export exists', 'export function createSettingsScreenOrchestrator({');
  checkIncludesAny(settingsScreenSource, 'settings page header marker present', ['renderPageHeader("settings")', "renderPageHeader('settings')"]);
  checkIncludesAny(settingsScreenSource, 'settings updates section marker present', ['<b class="settingsMiniTitle">Updates</b>', "<b class='settingsMiniTitle'>Updates</b>"]);
}

if (tripFormSource) {
  checkIncludes(tripFormSource, 'new trip form renderer export exists', 'export function renderTripEntryForm({');
  checkIncludesAny(tripFormSource, 'new trip primary action marker present', ['"saveTrip"', "'saveTrip'"]);
  checkIncludesAny(tripFormSource, 'new trip form foundation marker present', ['tripFormFoundation', 'trip-section']);
  checkIncludes(tripFormSource, 'new/edit form mode support marker present', 'const isEdit = mode === "edit";');
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
