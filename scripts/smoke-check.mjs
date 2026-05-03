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

function sliceSourceBetweenFunctionMarkers(source, startFunctionMarker, endFunctionMarker) {
  const startIndex = source.indexOf(startFunctionMarker);
  if (startIndex === -1) return '';

  const endIndex = source.indexOf(endFunctionMarker, startIndex);
  if (endIndex === -1) return '';

  return source.slice(startIndex, endIndex);
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

function checkPatterns(source, checkName, patterns, detail = 'required structural patterns') {
  const missing = patterns.filter((pattern) => !pattern.test(source));
  if (missing.length === 0) {
    pass(checkName);
  } else {
    fail(checkName, `missing ${detail}`);
  }
}

function checkRouteDispatch(source, checkName, { view, renderer }) {
  const routePattern = new RegExp(
    `nextView\\s*===\\s*["']${view}["'][\\s\\S]{0,140}?renderers\\.${renderer}\\s*\\(`,
    'm'
  );
  checkPattern(source, checkName, routePattern, `route ${view} -> ${renderer}(...)`);
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
const backupRestoreSource = readSource('js/backup_restore_v5.js');
const startupAssetManifestSource = readSource('js/startup_asset_manifest_v5.js');
const runtimeOrchestrationSource = readSource('js/runtime_orchestration_seam_v5.js');
const homeSource = readSource('js/home_dashboard_v5.js');
const shellSource = readSource('js/app_shell_v5.js');
const settingsScreenSource = readSource('js/settings_screen_v5.js');
const tripFormSource = readSource('js/trip_form_render_v5.js');
const tripScreenSource = readSource('js/trip_screen_orchestrator_v5.js');
const tripsBrowseScreenSource = readSource('js/trips_browse_screen_v5.js');
const reportsScreenSource = readSource('js/reports_screen_v5.js');
const reportsShellControlsSource = readSource('js/reports_shell_controls_v5.js');
const reportsOverviewSectionsSource = readSource('js/reports_overview_sections_v5.js');
const reportsMetricDetailSource = readSource('js/reports_metric_detail_v5.js');
const updateStatusSource = readSource('js/update_runtime_status_v5.js');

if (appSource) {
  checkPatterns(
    appSource,
    'boot startup state and render entrypoint present',
    [/window\.__SHELLFISH_APP_STARTED\s*=\s*false\s*;/, /function\s+render\s*\(/],
    'startup marker init and render() entrypoint'
  );
}

if (runtimeOrchestrationSource) {
  checkPatterns(
    runtimeOrchestrationSource,
    'boot runtime startup finalization present',
    [/function\s+startRuntimeRender\s*\(/, /window\.__SHELLFISH_APP_STARTED\s*=\s*true\s*;/],
    'startRuntimeRender(...) and startup finalization marker'
  );
  checkPatterns(
    runtimeOrchestrationSource,
    'top-level dispatcher structure present',
    [/function\s+renderViewDispatch\s*\(/, /if\s*\(\s*!state\.view\s*\)\s*state\.view\s*=\s*["']home["']/, /const\s+nextView\s*=\s*String\(/],
    'renderViewDispatch shape and home default'
  );
  checkRouteDispatch(runtimeOrchestrationSource, 'all trips route reachable from dispatcher', {
    view: 'all_trips',
    renderer: 'renderAllTrips',
  });
  checkRouteDispatch(runtimeOrchestrationSource, 'settings route reachable from dispatcher', {
    view: 'settings',
    renderer: 'renderSettings',
  });
  checkRouteDispatch(runtimeOrchestrationSource, 'new trip route reachable from dispatcher', {
    view: 'new',
    renderer: 'renderNewTrip',
  });
  checkRouteDispatch(runtimeOrchestrationSource, 'reports route reachable from dispatcher', {
    view: 'reports',
    renderer: 'renderReports',
  });
  checkPattern(
    runtimeOrchestrationSource,
    'home route reachable from dispatcher fallback',
    /else\s+renderers\.renderHome\s*\(/,
    'fallback dispatch to renderHome(...)'
  );
}

if (homeSource) {
  checkPattern(homeSource, 'home renderer factory exists', /export\s+function\s+createHomeDashboardRenderer\s*\(/, 'createHomeDashboardRenderer export');
  checkPattern(homeSource, 'home render function exists', /function\s+renderHome\s*\(/, 'function renderHome(...)');
  checkPattern(homeSource, 'home header wiring present', /renderPageHeader\s*\(\s*["']home["']\s*\)/, 'renderPageHeader("home")');
}

const rendererWiringSource = `${appSource || ''}\n${startupAssetManifestSource || ''}`;

if (rendererWiringSource) {
  checkIncludesAny(rendererWiringSource, 'home renderer import wired', [
    '"./home_dashboard_v5.js"',
    "'./home_dashboard_v5.js'",
  ]);
  checkIncludesAny(rendererWiringSource, 'settings renderer import wired', [
    '"./settings_screen_v5.js"',
    "'./settings_screen_v5.js'",
  ]);
}

if (appSource) {
  checkPatterns(
    appSource,
    'top-level renderers instantiated in app boot',
    [
      /({\s*[^}]*\brenderHome\b[^}]*}\s*=\s*createHomeDashboardRenderer\s*\()|(function\s+renderHome\s*\()/,
      /({\s*[^}]*\brenderSettings\b[^}]*}\s*=\s*createSettingsScreenOrchestrator\s*\()|(function\s+renderSettings\s*\()/,
      /{\s*[^}]*\brenderAllTrips\b[^}]*}\s*=\s*createTripsBrowseScreenRenderer\s*\(/,
      /({\s*[^}]*\brenderReports\b[^}]*}\s*=\s*createReportsScreenRenderer\s*\()|(function\s+renderReports\s*\()/,
    ],
    'renderer factory wiring for home/settings/trips/reports'
  );
  checkPattern(
    appSource,
    'startup module list versioned loader present',
    /STARTUP_MODULE_URLS\s*=\s*STARTUP_MODULE_PATHS\.map\s*\(\s*getVersionedModuleHref\s*\)/,
    'STARTUP_MODULE_URLS built from getVersionedModuleHref'
  );
  checkPattern(
    appSource,
    'settings orchestrator backup metadata clear seam wired',
    /clearBackupRecoveryMetadata:\s*\(\)\s*=>\s*clearBackupRecoveryMetadata\(\)/,
    'clearBackupRecoveryMetadata: () => clearBackupRecoveryMetadata()'
  );
}

if (backupRestoreSource) {
  const clearBackupRecoveryMetadataSource = sliceSourceBetweenFunctionMarkers(
    backupRestoreSource,
    'function clearBackupRecoveryMetadata(',
    'function capturePreRestoreRollbackSnapshot('
  );
  checkIncludes(
    clearBackupRecoveryMetadataSource,
    'backup recovery metadata clear seam function marker present',
    'function clearBackupRecoveryMetadata('
  );
  checkIncludes(
    clearBackupRecoveryMetadataSource,
    'backup recovery metadata clear seam removes backup metadata',
    'localStorage.removeItem(LS_LAST_BACKUP_META)'
  );
  checkIncludes(
    clearBackupRecoveryMetadataSource,
    'backup recovery metadata clear seam clears rollback snapshot',
    'clearRestoreRollbackSnapshot()'
  );
}

if (tripsBrowseScreenSource) {
  checkIncludes(tripsBrowseScreenSource, 'trips browse renderer export exists', 'export function createTripsBrowseScreenRenderer(deps){');
  checkPattern(tripsBrowseScreenSource, 'trips screen render function exists', /function\s+renderAllTrips\s*\(/, 'function renderAllTrips(...)');
}

if (shellSource) {
  checkPattern(shellSource, 'trips tab present', /key:\s*["']all_trips["']\s*,\s*label:\s*["']Trips["']/, 'all_trips tab label');
  checkPattern(shellSource, 'new trip tab present', /key:\s*["']new["']\s*,\s*label:\s*["']New["']/, 'new tab label');
  checkPattern(shellSource, 'new trip title mapping present', /new:\s*["']New Trip["']/, 'header title map for new trip');
  checkPattern(shellSource, 'reports tab present', /key:\s*["']reports["']\s*,\s*label:\s*["']Insights["']/, 'reports tab label');
  checkPattern(shellSource, 'settings tab present', /key:\s*["']settings["']\s*,\s*label:\s*["']Settings["']/, 'settings tab label');
}

if (settingsScreenSource) {
  checkPattern(settingsScreenSource, 'settings screen orchestrator export exists', /export\s+function\s+createSettingsScreenOrchestrator\s*\(/, 'createSettingsScreenOrchestrator export');
  checkPattern(settingsScreenSource, 'settings page header marker present', /renderPageHeader\s*\(\s*["']settings["']\s*\)/, 'renderPageHeader("settings")');
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
  checkPattern(reportsScreenSource, 'reports screen renderer export exists', /export\s+function\s+createReportsScreenRenderer\s*\(/, 'createReportsScreenRenderer export');
  checkPattern(reportsScreenSource, 'reports header marker present', /renderPageHeader\s*\(\s*["']reports["']\s*\)/, 'renderPageHeader("reports")');
}

if (reportsShellControlsSource) {

  checkPattern(reportsShellControlsSource, 'reports overview tab label present', /key:\s*["']insights["']\s*,\s*label:\s*["']Overview["']/, 'reports insights key labeled Overview');
  checkIncludesAny(reportsShellControlsSource, 'reports timeframe filter marker present', [
    'aria-label="Insights timeframe controls"',
    'aria-label="Insights quick range filters"',
    'aria-label="Reports timeframe filter"',
  ]);
}

const reportsChartSurfaceSource = [
  reportsScreenSource,
  reportsOverviewSectionsSource,
  reportsMetricDetailSource,
].join('\n');

if (reportsChartSurfaceSource.trim()) {
  checkIncludesAny(reportsChartSurfaceSource, 'reports chart surface marker present', [
    'id="reportsCharts"',
    'class="chart"',
    '<canvas class="chart"',
    'reportsChartsStack',
  ]);
}

if (updateStatusSource) {
  checkIncludes(updateStatusSource, 'runtime update seam export exists', 'export function createUpdateRuntimeStatusSeam({');
  checkIncludesAny(updateStatusSource, 'runtime update ready status marker present', [
    'Latest build ready on this device',
    'Latest version ready • Safe to load now',
  ]);
  checkIncludes(updateStatusSource, 'runtime current build marker present', 'Version ${displayBuildVersion}');
  checkIncludes(updateStatusSource, 'runtime build badge marker present', 'App ${displayBuildVersion}');
}

const rootStateSaveSource = readSource('js/root_state_save_seam_v5.js');
const bootstrapSource = readSource('js/bootstrap_v5.js');

if (appSource) {
  if (!appSource.includes('Recovery Mode is on. Loaded a temporary clean session.')) pass('legacy recovery temporary session toast removed');
  else fail('legacy recovery temporary session toast removed', 'legacy toast still present');
}

if (bootstrapSource) {
  if (!bootstrapSource.includes('Recovery Mode starts with a temporary clean session')) pass('legacy bootstrap temporary clean session copy removed');
  else fail('legacy bootstrap temporary clean session copy removed', 'legacy copy still present');
}

if (rootStateSaveSource) {
  checkIncludes(rootStateSaveSource, 'recovery save guard blocks __safeMode persistence', 'if(runtimeState?.__safeMode === true)');
  checkIncludes(rootStateSaveSource, 'durable save strips __safeMode marker', 'delete snapshot.__safeMode;');
  checkIncludes(rootStateSaveSource, 'durable save strips __recoveryMode marker', 'delete snapshot.__recoveryMode;');
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
