const moduleV = new URL(import.meta.url).searchParams.get("v") || "";
const bootV = String(window.APP_VERSION || "");
if (moduleV && bootV && moduleV !== bootV) {
  const mismatchError = new Error(`Version mismatch: bootstrap=${bootV}, app=${moduleV}. Please reload to apply the latest update.`);
  if (window.__showModuleError) window.__showModuleError(mismatchError);
  throw mismatchError;
}

window.__SHELLFISH_APP_STARTED = false;

const APP_IMPORT_VERSION = String(window.APP_VERSION || moduleV || "");

function getVersionedModuleHref(relPath){
  const url = new URL(relPath, import.meta.url);
  if(APP_IMPORT_VERSION) url.searchParams.set("v", APP_IMPORT_VERSION);
  return url.href;
}

const STARTUP_MODULE_PATHS = [
  "./utils_v5.js",
  "./settings.js",
  "./migrations_v5.js",
  "./navigation_v5.js",
  "./reports_charts_v5.js",
  "./reports_aggregation_v5.js",
  "./quick_chips_v5.js",
  "./reports_filters_v5.js",
  "./settings_list_management_v5.js",
  "./backup_restore_v5.js",
  "./trip_shared_engine_v5.js",
  "./trip_cards_v5.js",
  "./help_about_render_v5.js",
  "./trip_form_render_v5.js",
  "./home_dashboard_v5.js",
  "./settings_screen_v5.js",
  "./reports_screen_v5.js",
  "./feedback_seam_v5.js",
  "./trip_screen_orchestrator_v5.js",
  "./trip_flow_save_seam_v5.js",
  "./root_state_save_seam_v5.js",
  "./update_runtime_status_v5.js",
  "./diagnostics_fatal_v5.js",
  "./runtime_orchestration_seam_v5.js",
  "./app_shell_v5.js"
];
const STARTUP_MODULE_URLS = STARTUP_MODULE_PATHS.map(getVersionedModuleHref);

async function importVersionedModule(relPath){
  return import(getVersionedModuleHref(relPath));
}

try {
  window.__SHELLFISH_STARTUP_IMPORTS__ = [...STARTUP_MODULE_URLS];
  window.__BOOT_DIAG__ = window.__BOOT_DIAG__ || {};
  window.__BOOT_DIAG__.startupModuleUrls = [...STARTUP_MODULE_URLS];
} catch (_) {}

const [{ uid, toCSV, downloadText, formatMoney, formatISODateToDisplayDMY: formatDateLegacyDMY, computePPL, parseMDYToISO: parseUsDateToISODate, parseNum, parseMoney, likelyDuplicate, normalizeKey, canonicalDealerGroupKey, escapeHtml, getTripsNewestFirst, openModal, closeModal, lockBodyScroll, unlockBodyScroll, focusFirstFocusable , isValidISODate },
  { THEME_MODE_SYSTEM, THEME_MODE_LIGHT, THEME_MODE_DARK, normalizeThemeMode, resolveTheme },
  { LS_KEY, migrateLegacyStateIfNeeded, migrateStateIfNeeded, loadStateWithLegacyFallback },
  { ensureNavState, createNavigator },
  { drawReportsCharts },
  { buildReportsAggregationState },
  { createQuickChipHelpers },
  { createReportsFilterHelpers },
  { createSettingsListManagement },
  { createBackupRestoreSubsystem },
  { createTripDataEngine, createTripDraftSaveEngine, computeTripSaveEnabled, appendTripHistoryEvent, ensureTripProvenanceShape },
  { createTripCardRenderHelpers, normalizeDealerDisplay },
  { renderHelpViewHTML, renderAboutViewHTML },
  { renderTripEntryForm },
  { createHomeDashboardRenderer },
  { createSettingsScreenOrchestrator },
  { createReportsScreenRenderer },
  { createFeedbackSeam },
  { createTripScreenOrchestrator },
  { buildTripFormInputs, buildNewTripSaveSnapshot },
  { createRootStateSaveSeam },
  { createUpdateRuntimeStatusSeam },
  { createDiagnosticsFatalSeam },
  { createRuntimeOrchestrationSeam, renderViewDispatch, startRuntimeRender },
  {
    renderPageHeader: renderPageHeaderShell,
    bindHeaderHelpButtons: bindHeaderHelpButtonsShell,
    renderTabBar: renderTabBarShell
  }
] = await Promise.all([
  ...STARTUP_MODULE_PATHS.map(importVersionedModule)
]);
const APP_VERSION = (window.APP_BUILD || "v5");
const VERSION = APP_VERSION;
const DISPLAY_BUILD_VERSION = VERSION;
const QUICK_CHIP_LONG_PRESS_MS = 500;
const DEFAULT_TRIP_SPECIES = "Soft-shell Clams";
const QUICK_CHIP_MOVE_CANCEL_PX = 10;
const SCHEMA_VERSION = 1;
const DELETED_TRIPS_LIMIT = 25;
const {
  normalizeTripRow,
  normalizeTrip,
  isValidAreaValue,
  validateTrip
} = createTripDataEngine({ uid, isValidISODate });

// Backup meta (local-only; no user data duplication)
const LS_LAST_BACKUP_META = "btc_last_backup_meta_v1";
const LS_RESTORE_ROLLBACK_SNAPSHOT = "btc_restore_rollback_snapshot_v1";
const TOP_LEVEL_TRANSITION_VIEWS = new Set(["home", "all_trips", "reports", "settings"]);
const TOP_LEVEL_TRANSITION_OUT_MS = 90;
const TOP_LEVEL_TRANSITION_IN_MS = 170;
let themeMediaQuery = null;
let onThemeMediaChange = null;
let topLevelTransitionToken = 0;
let topLevelTransitionOutTimer = 0;
let topLevelTransitionCleanupTimer = 0;

function getThemeMode(){
  const s = state?.settings || {};
  return normalizeThemeMode(s.themeMode);
}

function updateThemeMeta(resolvedTheme){
  try{
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content", resolvedTheme === THEME_MODE_DARK ? "#0b0f16" : "#dce4f4");
  }catch(_){ }
}

function applyThemeMode(){
  const mode = getThemeMode();
  const prefersDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const resolvedTheme = resolveTheme(mode, prefersDark);
  try{ document.documentElement.dataset.theme = resolvedTheme; }catch(_){ }
  updateThemeMeta(resolvedTheme);
}

function bindThemeMedia(){
  if(!window.matchMedia) return;
  themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if(onThemeMediaChange) return;
  onThemeMediaChange = ()=>{
    if(getThemeMode() === THEME_MODE_SYSTEM){
      applyThemeMode();
    }
  };
  if(themeMediaQuery.addEventListener) themeMediaQuery.addEventListener("change", onThemeMediaChange);
  else if(themeMediaQuery.addListener) themeMediaQuery.addListener(onThemeMediaChange);
}

function bindThemeControls(){
  const input = document.getElementById("themeMode");
  if(!input) return;
  input.value = getThemeMode();
  input.onchange = ()=>{
    state.settings = state.settings || {};
    state.settings.themeMode = normalizeThemeMode(input.value);
    saveState();
    applyThemeMode();
  };
}

function supportsTopLevelTransition(){
  if(typeof window === "undefined" || !window.matchMedia) return true;
  try{ return !window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(_){ return true; }
}

function isTopLevelTransitionView(viewKey){
  return TOP_LEVEL_TRANSITION_VIEWS.has(String(viewKey || "home"));
}

function clearTopLevelTransitionTimers(){
  if(topLevelTransitionOutTimer){
    window.clearTimeout(topLevelTransitionOutTimer);
    topLevelTransitionOutTimer = 0;
  }
  if(topLevelTransitionCleanupTimer){
    window.clearTimeout(topLevelTransitionCleanupTimer);
    topLevelTransitionCleanupTimer = 0;
  }
}

function cleanupTopLevelTransition(app){
  if(!app) return;
  app.classList.remove("screenTransitionActive", "screenTransitionOut", "screenTransitionIn");
}

function shouldAnimateTopLevelScreenChange(fromView, toView){
  const fromKey = String(fromView || "home");
  const toKey = String(toView || "home");
  return fromKey !== toKey && isTopLevelTransitionView(fromKey) && isTopLevelTransitionView(toKey) && supportsTopLevelTransition();
}

function navigateTopLevelView(nextView){
  const currentView = String(state.view || "home");
  const nextKey = String(nextView || "home");
  if(!shouldAnimateTopLevelScreenChange(currentView, nextKey)){
    state.view = nextKey;
    saveState();
    render();
    return;
  }

  const app = getApp();
  if(!app){
    state.view = nextKey;
    saveState();
    render();
    return;
  }

  const transitionToken = ++topLevelTransitionToken;
  clearTopLevelTransitionTimers();
  cleanupTopLevelTransition(app);
  app.classList.add("screenTransitionActive", "screenTransitionOut");

  topLevelTransitionOutTimer = window.setTimeout(()=>{
    if(transitionToken !== topLevelTransitionToken) return;
    state.view = nextKey;
    saveState();
    render();

    const nextApp = getApp();
    if(!nextApp){
      clearTopLevelTransitionTimers();
      return;
    }

    cleanupTopLevelTransition(nextApp);
    nextApp.classList.add("screenTransitionActive", "screenTransitionIn");
    topLevelTransitionCleanupTimer = window.setTimeout(()=>{
      if(transitionToken !== topLevelTransitionToken) return;
      cleanupTopLevelTransition(nextApp);
      clearTopLevelTransitionTimers();
    }, TOP_LEVEL_TRANSITION_IN_MS);
  }, TOP_LEVEL_TRANSITION_OUT_MS);
}

window.__SHELLFISH_BUILD__ = APP_VERSION;
const { pushView, goBack, bindNavHandlers } = createNavigator({
  saveState: () => saveState(),
  render: () => render()
});


// Local helper to avoid hard dependency on utils export during SW update races (iOS Safari).
function to2(n){
  const x = Number(n);
  return Number.isFinite(x) ? Math.round((x + Number.EPSILON) * 100) / 100 : x;
}

const {
  isoToday,
  parseReportDateToISO,
  formatReportDateValue,
  tripsFilename,
  exportTripsWithLabel
} = createReportsFilterHelpers({
  parseUsDateToISODate,
  formatDateDMY,
  round2: to2,
  downloadText
});

function formatDateDMY(input){
  if(input == null || input === "") return "";

  if(typeof input === "string"){
    const s = input.trim();
    if(!s) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(m){
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if(!(y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return "";
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if(dt.getUTCFullYear() !== y || (dt.getUTCMonth() + 1) !== mo || dt.getUTCDate() !== d) return "";
      return `${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${String(dt.getUTCDate()).padStart(2, "0")}/${dt.getUTCFullYear()}`;
    }
  }

  const dt = (input instanceof Date) ? input : new Date(input);
  if(Number.isNaN(dt.getTime())) return formatDateLegacyDMY(input);
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
}

function formatTripAuditTimestamp(value){
  const iso = String(value || "").trim();
  if(!iso) return "";
  const date = new Date(iso);
  if(Number.isNaN(date.getTime())) return "";
  const day = formatDateDMY(date);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

function buildTripProvenanceSummary(trip){
  const normalizedTrip = normalizeTrip(trip);
  const provenance = ensureTripProvenanceShape(normalizedTrip, normalizedTrip?.createdAt);
  const history = Array.isArray(provenance.history) ? [...provenance.history].sort((a,b)=>String(b.at).localeCompare(String(a.at))) : [];
  const summaryLines = [];
  const eventLabels = { created: "Created", edited: "Edited", imported: "Imported" };
  const sourceLabels = { manual: "in app", import: "from backup", restore: "from backup", legacy: "on this device", system: "in app" };
  const createdLine = formatTripAuditTimestamp(provenance.createdAt);
  if(createdLine){
    const createdSource = sourceLabels[String(provenance.createdSource || "").trim().toLowerCase()] || "on this device";
    summaryLines.push(`Created ${createdLine} • ${createdSource}`);
  }
  if(provenance.updatedAt){
    const updatedLine = formatTripAuditTimestamp(provenance.updatedAt);
    if(updatedLine) summaryLines.push(`Last edited ${updatedLine}`);
  }
  if(provenance.importedAt){
    const importedLine = formatTripAuditTimestamp(provenance.importedAt);
    if(importedLine) summaryLines.push(`Imported ${importedLine}`);
  }
  const historyItems = history.slice(0, 4).map((event)=>{
    const label = eventLabels[String(event.type || "").toLowerCase()] || "Updated";
    const stamp = formatTripAuditTimestamp(event.at) || "Unknown time";
    const source = sourceLabels[String(event.source || "").trim().toLowerCase()] || "in app";
    return `${label} ${stamp} • ${source}`;
  });
  return { summaryLines, historyItems };
}

function sanitizeDecimalInput(raw){
  let s = String(raw || "").replace(/[^\d.,]/g, "");
  const decimalIdx = s.search(/[.,]/);
  if(decimalIdx !== -1){
    const intPart = s.slice(0, decimalIdx).replace(/[.,]/g, "");
    const fracPart = s.slice(decimalIdx + 1).replace(/[.,]/g, "");
    s = `${intPart}.${fracPart}`;
  }else{
    s = s.replace(/[.,]/g, "");
  }
  return s;
}

function primeNumericField(el, zeroValues){
  try{
    const v = String(el.value || "").trim();
    if(!v || (zeroValues || []).includes(v)){
      el.value = "";
    }else{
      requestAnimationFrame(()=>{ try{ el.select(); }catch(_){} });
    }
  }catch(_){ }
}

function normalizeAmountOnBlur(el){
  try{
    const s = String(el.value || "").trim();
    if(!s){ el.value = "0.00"; return; }
    const n = parseMoney(s);
    el.value = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }catch(_){ }
}

// ---- Toasts ----

function getDisplayMode(){
  try{
    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const navStandalone = (navigator.standalone === true);
    return (isStandalone || navStandalone) ? "standalone" : "browser";
  }catch{
    return "unknown";
  }
}




const feedback = createFeedbackSeam({
  escapeHtml,
  lockBodyScroll,
  unlockBodyScroll,
  focusFirstFocusable
});
const {
  announce,
  showToast,
  showMilestoneToast,
  maybeOfferInstallAfterFirstSave,
  confirmSaveModal,
  copyTextWithFeedback,
  triggerHaptic
} = feedback;

const {
  updateRuntimeStatus,
  getDebugInfo,
  showFatal,
  bindRuntimeBootHandlers
} = createRuntimeOrchestrationSeam({
  createUpdateRuntimeStatusSeam,
  createDiagnosticsFatalSeam,
  displayBuildVersion: DISPLAY_BUILD_VERSION,
  getState: () => state,
  getSchemaVersion: (asNullable = false) => {
    try{ return SCHEMA_VERSION; }catch(_){ return asNullable ? null : "?"; }
  },
  copyTextWithFeedback,
  escapeHtml
});

let pendingTripUndo = null;

function cloneUndoValue(v){
  if(typeof structuredClone === "function"){
    try{ return structuredClone(v); }catch(_){ }
  }
  try{ return JSON.parse(JSON.stringify(v)); }catch(_){ return v; }
}

function applyUndoSnapshot(snapshot){
  const snap = snapshot || {};
  state.trips = Array.isArray(snap.trips) ? cloneUndoValue(snap.trips) : [];
  state.deletedTrips = Array.isArray(snap.deletedTrips) ? cloneUndoValue(snap.deletedTrips) : [];
  if(Object.prototype.hasOwnProperty.call(snap, "editId")) state.editId = snap.editId;
  else delete state.editId;
  if(Object.prototype.hasOwnProperty.call(snap, "draft")) state.draft = cloneUndoValue(snap.draft);
  else delete state.draft;
  if(Object.prototype.hasOwnProperty.call(snap, "reviewDraft")) state.reviewDraft = cloneUndoValue(snap.reviewDraft);
  else delete state.reviewDraft;
  state.view = String(snap.view || state.view || "home");
  saveState();
  render();
}

function clearPendingTripUndo(){
  if(!pendingTripUndo) return;
  try{ clearTimeout(pendingTripUndo.timer); }catch(_){ }
  pendingTripUndo = null;
}

function showUndoToast({ message, snapshot, durationMs = 3200 }){
  clearPendingTripUndo();
  const token = Date.now();
  const undoSnapshot = cloneUndoValue(snapshot);
  const onUndo = ()=>{
    if(!pendingTripUndo || pendingTripUndo.token !== token) return;
    clearPendingTripUndo();
    applyUndoSnapshot(undoSnapshot);
    showToast("Undone");
  };
  const timer = setTimeout(()=>{
    if(pendingTripUndo && pendingTripUndo.token === token){
      pendingTripUndo = null;
    }
  }, durationMs);
  pendingTripUndo = { token, timer };
  showToast(message, { actionLabel: "Undo", onAction: onUndo, durationMs });
}


function iconSvg(name){
  if(name === "calendar"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 2v3"/><path d="M16 2v3"/>
      <path d="M3 7h18"/>
      <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
      <path d="M7 11h4"/>
    </svg>`;
  }
  return "";
}

function hasUnsavedDraft(){
  const d = state?.draft || {};
  return !!(d.date || d.dealer || d.area || d.pounds || d.amount);
}


function renderPageHeader(viewKey){
  return renderPageHeaderShell(viewKey, { escapeHtml });
}

function bindHeaderHelpButtons(){
  return bindHeaderHelpButtonsShell({
    onHelpClick: (helpKey)=>{
      state.helpJump = helpKey;
      state.view = "help";
      saveState();
      render();
    }
  });
}

function renderTabBar(activeView){
  return renderTabBarShell({
    activeView,
    escapeHtml,
    hasUnsavedDraft,
    onNavigate: (next)=>{
      navigateTopLevelView(next);
    }
  });
}



// Signal to the page watchdog that the module loaded
try{ window.__SHELLFISH_STARTED = true; }catch{}
function getApp(){ return document.getElementById("app"); }

const rootStateSaveSeam = createRootStateSaveSeam({
  localStorage,
  sessionStorage,
  history,
  locationHref: ()=> location.href,
  ensureNavState,
  loadStateWithLegacyFallback,
  LS_KEY,
  createTripDraftSaveEngine,
  showToast
});

function loadState(){
  return rootStateSaveSeam.loadState();
}



function exportTrips(trips, label, startISO="", endISO=""){
  // legacy wrapper (v36): keep behavior consistent with Trips screen
  exportTripsWithLabel(trips, String(label||"ALL").toUpperCase(), startISO, endISO);
}

const { renderTripCatchCard } = createTripCardRenderHelpers({
  formatDateDMY,
  to2,
  computePPL,
  formatMoney,
  escapeHtml
});

const {
  buildBackupPayloadFromState,
  updateBackupHealthWarning,
  updateLastBackupLine,
  getRestoreRollbackSnapshotMeta,
  updateRestoreRollbackLine,
  downloadBackupPayload,
  exportBackup,
  parseBackupFileForRestore,
  openRestorePreviewModal,
  openReplaceSafetyBackupModal,
  openRestoreErrorModal,
  openRestoreResultModal,
  importBackupFromFile,
  restoreFromRollbackSnapshot
} = createBackupRestoreSubsystem({
  getState: ()=> state,
  saveState: ()=> saveState(),
  normalizeTrip,
  appendTripHistoryEvent,
  ensureAreas: ()=> ensureAreas(),
  ensureDealers: ()=> ensureDealers(),
  SCHEMA_VERSION,
  APP_VERSION,
  VERSION,
  LS_LAST_BACKUP_META,
  LS_RESTORE_ROLLBACK_SNAPSHOT,
  formatDateDMY,
  downloadText,
  uid,
  normalizeKey,
  likelyDuplicate,
  to2,
  openModal,
  closeModal,
  escapeHtml,
  announce
});

function ensureAreas(){
  if(!Array.isArray(state.areas)) state.areas = [];
  // normalize + de-dupe (case-insensitive)
  const seen = new Set();
  const out = [];
  for(const a of state.areas){
    const v = String(a||"").trim();
    if(!v) continue;
    const k = normalizeKey(v);
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  state.areas = out;
}

function ensureDealers(){
  if(!Array.isArray(state.dealers)) state.dealers = [];
  // normalize + de-dupe (case-insensitive)
  const seen = new Set();
  const out = [];
  for(const d of state.dealers){
    const v = String(d||"").trim();
    if(!v) continue;
    const k = normalizeKey(v);
    if(seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  state.dealers = out;
}


// ===========================
// Patch 2B (v60): Unified Filters Engine (single source of truth)
// Default: YTD. UI: filters live in Trips; Home/Reports show a badge.
// Add-ons: C (Custom Range), E (Date normalization), F (Rounding rules)
// ===========================
function ensureUnifiedFilters(){
  // Migrate legacy filters (homeFilter / tripsFilter / reportsFilter) into a single canonical filter object.
  if(!state.filters || typeof state.filters !== "object") state.filters = {};
  if(!state.filters.active || typeof state.filters.active !== "object"){
    // Prefer legacy reports filter, then home, then trips.
    const pick = state.reportsFilter || state.homeFilter || state.tripsFilter || (state.filter ? { mode: String(state.filter).toUpperCase(), from:"", to:"" } : { mode:"YTD", from:"", to:"" });
    const legacyMode = String(pick?.mode || "YTD").toUpperCase();

    let range = "ytd";
    let fromISO = "";
    let toISO = "";

    if(legacyMode === "ALL") range = "all";
    else if(legacyMode === "YTD") range = "ytd";
    else if(legacyMode === "MONTH") range = "mtd";
    else if(legacyMode === "7D") range = "7d";
    else if(legacyMode === "RANGE") {
      range = "custom";
      fromISO = parseUsDateToISODate(String(pick?.from||"")) || "";
      toISO = parseUsDateToISODate(String(pick?.to||"")) || "";
    }

    state.filters.active = {
      range,
      fromISO,
      toISO,
      dealer: "all",
      area: "all",
      species: "all",
      text: ""
    };
  }

  const f = state.filters.active;

  if(!f.range) f.range = "ytd"; // locked default
  if(f.dealer == null) f.dealer = "all";
  if(f.area == null) f.area = "all";
  if(f.species == null) f.species = "all";
  if(f.text == null) f.text = "";
  if(f.fromISO == null) f.fromISO = "";
  if(f.toISO == null) f.toISO = "";

  // Guardrails for custom range
  if(f.range === "custom"){
    const now = isoToday();
    const y = now.slice(0,4);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(f.fromISO||""))) f.fromISO = `${y}-01-01`;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(f.toISO||""))) f.toISO = now;
    if(f.fromISO > f.toISO){
      const tmp = f.fromISO; f.fromISO = f.toISO; f.toISO = tmp;
    }
  }
}

// Add-on C: resolve range (includes custom + guardrails)
function resolveUnifiedRange(filter){
  const now = isoToday();
  const y = now.slice(0,4);

  const backDays = (n)=>{
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0,10);
  };

  if(filter.range === "all") return { fromISO:"1900-01-01", toISO:now, label:"All Time" };
  if(filter.range === "ytd") return { fromISO:`${y}-01-01`, toISO:now, label:"YTD" };
  if(filter.range === "mtd") return { fromISO:`${y}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`, toISO:now, label:"This Month" };
  if(filter.range === "last_month"){
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth()-1);
    const fromISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
    const toISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()).padStart(2,"0")}`;
    return { fromISO, toISO, label:"Last Month" };
  }
  if(filter.range === "7d") return { fromISO:backDays(7), toISO:now, label:"Last 7 Days" };
  if(filter.range === "12m"){
    const d = new Date();
    d.setFullYear(d.getFullYear()-1);
    return { fromISO:d.toISOString().slice(0,10), toISO:now, label:"Last 12 months" };
  }
  if(filter.range === "90d") return { fromISO:backDays(90), toISO:now, label:"Last 90 days" };
  if(filter.range === "30d") return { fromISO:backDays(30), toISO:now, label:"Last 30 days" };
  if(filter.range === "7d") return { fromISO:backDays(7), toISO:now, label:"Last 7 Days" };

  // custom
  let fromISO = String(filter.fromISO||"").slice(0,10);
  let toISO = String(filter.toISO||"").slice(0,10);

  if(!/^\d{4}-\d{2}-\d{2}$/.test(fromISO)) fromISO = `${y}-01-01`;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(toISO)) toISO = now;

  if(fromISO > toISO){
    const tmp = fromISO; fromISO = toISO; toISO = tmp;
  }
  return { fromISO, toISO, label: `${fromISO} → ${toISO}` };
}

// Add-on F: formatting rules (single source of truth)


function buildUnifiedFilterLabel(filter, rangeLabel){
  const parts = [rangeLabel];
  if(filter.dealer && filter.dealer !== "all") parts.push(`Dealer: ${filter.dealer}`);
  if(filter.area && filter.area !== "all") parts.push(`Area: ${filter.area}`);
  if(filter.species && filter.species !== "all") parts.push(`Species: ${filter.species}`);
  if(filter.text && String(filter.text).trim()) parts.push(`Search: "${String(filter.text).trim()}"`);
  return parts.join(" • ");
}

function legacyModeToUnifiedRange(mode){
  const m = String(mode || "").toUpperCase();
  if(m === "ALL") return "all";
  if(m === "YTD") return "ytd";
  if(m === "MONTH" || m === "THIS_MONTH") return "mtd";
  if(m === "LAST_MONTH") return "last_month";
  if(m === "7D") return "7d";
  if(m === "12M") return "12m";
  if(m === "90D") return "90d";
  if(m === "30D") return "30d";
  if(m === "RANGE" || m === "CUSTOM") return "custom";
  return "ytd";
}

function makeUnifiedFilter(partial){
  const f = {
    range: partial?.range || "ytd",
    fromISO: partial?.fromISO || "",
    toISO: partial?.toISO || "",
    dealer: partial?.dealer || "all",
    area: partial?.area || "all",
    species: partial?.species || "all",
    text: partial?.text || ""
  };
  const resolved = resolveUnifiedRange(f);
  return { ...f, fromISO: resolved.fromISO, toISO: resolved.toISO };
}

function buildUnifiedFilterFromHomeFilter(hf){
  return makeUnifiedFilter({
    range: legacyModeToUnifiedRange(hf?.mode || "YTD"),
    fromISO: parseReportDateToISO(hf?.from || "") || "",
    toISO: parseReportDateToISO(hf?.to || "") || "",
    dealer: "all",
    area: "all"
  });
}

function buildUnifiedFilterFromReportsFilter(rf){
  return makeUnifiedFilter({
    range: legacyModeToUnifiedRange(rf?.mode || "YTD"),
    fromISO: parseReportDateToISO(rf?.from || "") || "",
    toISO: parseReportDateToISO(rf?.to || "") || "",
    dealer: rf?.dealer ? String(rf.dealer) : "all",
    area: rf?.area ? String(rf.area) : "all"
  });
}

function applyUnifiedTripFilter(rawTrips, filter){
  const trips = (rawTrips || []).map(normalizeTripRow).filter(Boolean);
  const r = resolveUnifiedRange(filter);

  let rows = trips.filter(t => isValidISODate(t.dateISO) && t.dateISO >= r.fromISO && t.dateISO <= r.toISO);

  if(filter.dealer && filter.dealer !== "all") rows = rows.filter(t => t.dealer === filter.dealer);
  if(filter.area && filter.area !== "all") rows = rows.filter(t => t.area === filter.area);
  if(filter.species && filter.species !== "all") rows = rows.filter(t => t.species === filter.species);

  if(filter.text && String(filter.text).trim()){
    const q = String(filter.text).trim().toLowerCase();
    rows = rows.filter(t =>
      (t.dealer||"").toLowerCase().includes(q) ||
      (t.area||"").toLowerCase().includes(q) ||
      (t.species||"").toLowerCase().includes(q) ||
      (t.notes||"").toLowerCase().includes(q)
    );
  }

  const totalLbs = rows.reduce((a,t)=> a + (Number(t.pounds)||0), 0);
  const totalAmount = rows.reduce((a,t)=> a + (Number(t.amount)||0), 0);

  return {
    rows,
    stats: {
      count: rows.length,
      totalLbs,
      totalAmount,
      avgPPL: (totalLbs > 0 ? (totalAmount/totalLbs) : 0)
    },
    range: { fromISO:r.fromISO, toISO:r.toISO },
    label: buildUnifiedFilterLabel(filter, r.label)
  };
}

function getFilteredTrips(){
  ensureUnifiedFilters();
  const tripsAll = Array.isArray(state.trips) ? state.trips : [];
  return applyUnifiedTripFilter(tripsAll, state.filters.active);
}

function uniqueSorted(arr){
  return [...new Set((arr||[]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
}
function getFilterOptionsFromTrips(){
  const trips = Array.isArray(state.trips) ? state.trips.map(normalizeTripRow).filter(Boolean) : [];
  return {
    dealers: uniqueSorted(trips.map(t=>t.dealer)),
    areas: uniqueSorted(trips.map(t=>t.area)),
    species: uniqueSorted(trips.map(t=>t.species)),
  };
}

// Home + Reports badge (UI choice #2)


function getLastUniqueFromTrips(field, maxN){
  const out = [];
  const seen = new Set();
  const trips = Array.isArray(state.trips) ? state.trips : [];
  for(let i = trips.length - 1; i >= 0; i--){
    const t = trips[i];
    const raw = String(t?.[field] || "").trim();
    if(!raw) continue;
    const key = raw.toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if(out.length >= maxN) break;
  }
  return out;
}

function findCanonicalFromList(value, list){
  const v = String(value||"").trim();
  if(!v) return "";
  const key = v.toLowerCase();
  for(const item of (Array.isArray(list)?list:[])){
    const s = String(item||"").trim();
    if(!s) continue;
    if(s.toLowerCase() === key) return s;
  }
  return "";
}


function renderSuggestions(list, current, dataAttr){
  const cur = String(current||"").trim().toLowerCase();
  if(!cur) return "";
  const matches = [];
  for(const item of (Array.isArray(list)?list:[])){
    const s = String(item||"").trim();
    if(!s) continue;
    const key = s.toLowerCase();
    if(key === cur) continue;
    if(key.includes(cur)) matches.push(s);
    if(matches.length >= 8) break;
  }
  if(!matches.length) return "";
  return `<div class="muted small" style="margin-top:8px">Suggestions</div>
    <div class="chips" style="margin-top:8px">
      ${matches.map(s=>`<button class="chip" ${dataAttr}="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
    </div>`;
}





function scoreDuplicateTripMatch(existingTrip, candidate){
  if(!likelyDuplicate(existingTrip, candidate)) return -1;

  let score = 0;
  const sameDate = String(existingTrip?.dateISO || "") === String(candidate?.dateISO || "");
  const sameDealer = normalizeKey(existingTrip?.dealer) === normalizeKey(candidate?.dealer);
  const samePounds = Math.abs((Number(existingTrip?.pounds) || 0) - (Number(candidate?.pounds) || 0)) <= 0.01;
  const sameAmount = Math.abs((Number(existingTrip?.amount) || 0) - (Number(candidate?.amount) || 0)) <= 0.01;
  const existingArea = normalizeKey(existingTrip?.area);
  const candidateArea = normalizeKey(candidate?.area);
  const sameArea = existingArea && candidateArea && existingArea === candidateArea;

  if(sameDate) score += 4;
  if(sameDealer) score += 4;
  if(samePounds) score += 3;
  if(sameAmount) score += 3;
  if(sameArea) score += 1;

  return score;
}

function findDuplicateTrip(candidate, excludeId=""){
  const trips = getTripsNewestFirst(Array.isArray(state.trips) ? state.trips : []);
  const excludedId = String(excludeId || "");
  let best = null;
  let bestScore = -1;
  let bestIndex = Number.POSITIVE_INFINITY;

  for(let i = 0; i < trips.length; i++){
    const t = trips[i];
    if(excludedId && String(t?.id || "") === excludedId) continue;
    const score = scoreDuplicateTripMatch(t, candidate);
    if(score < 0) continue;
    if(score > bestScore || (score === bestScore && i < bestIndex)){
      best = t;
      bestScore = score;
      bestIndex = i;
    }
  }

  return best;
}


function getAllTimeMetricSnapshot(trips){
  const rows = Array.isArray(trips) ? trips : [];
  const validRows = rows.filter(Boolean);
  if(!validRows.length) return null;

  const poundsRows = validRows.filter((t)=> Number(t?.pounds) > 0);
  const amountRows = validRows.filter((t)=> Number(t?.amount) > 0);
  const pplRows = validRows.filter((t)=> Number(t?.pounds) > 0 && Number(t?.amount) > 0);

  const pickExtreme = (sourceRows, valueOf, mode)=>{
    if(!sourceRows.length) return null;
    let pick = sourceRows[0];
    let value = valueOf(sourceRows[0]);
    for(let i = 1; i < sourceRows.length; i++){
      const v = valueOf(sourceRows[i]);
      if(mode === "high"){
        if(v > value){
          value = v;
          pick = sourceRows[i];
        }
      }else if(v < value){
        value = v;
        pick = sourceRows[i];
      }
    }
    return { id: String(pick?.id || ""), value: Number(value) || 0 };
  };

  return {
    pounds: {
      high: pickExtreme(poundsRows, (t)=> Number(t?.pounds) || 0, "high"),
      low: pickExtreme(poundsRows, (t)=> Number(t?.pounds) || 0, "low")
    },
    amount: {
      high: pickExtreme(amountRows, (t)=> Number(t?.amount) || 0, "high"),
      low: pickExtreme(amountRows, (t)=> Number(t?.amount) || 0, "low")
    },
    pricePerPound: {
      high: pickExtreme(pplRows, (t)=> computePPL(Number(t?.pounds) || 0, Number(t?.amount) || 0), "high"),
      low: pickExtreme(pplRows, (t)=> computePPL(Number(t?.pounds) || 0, Number(t?.amount) || 0), "low")
    }
  };
}

function buildAllTimeMilestoneToast(beforeSnap, afterSnap){
  const metricOrder = [
    { key: "pounds", label: "pounds", format: (v)=> `${to2(v)} lbs` },
    { key: "amount", label: "amount", format: (v)=> formatMoney(v) },
    { key: "pricePerPound", label: "price per pound", format: (v)=> `${formatMoney(v)}/lb` }
  ];

  const buildDetail = ({ delta, priorValue, format })=>{
    const signed = `${delta >= 0 ? "+" : "-"}${format(Math.abs(delta))}`;
    if(!(Number(priorValue) > 0)) return signed;
    const pct = (Math.abs(delta) / Number(priorValue)) * 100;
    if(!Number.isFinite(pct)) return signed;
    return `${signed} (${delta >= 0 ? "+" : "-"}${to2(pct)}%)`;
  };

  for(const metric of metricOrder){
    for(const direction of ["high", "low"]){
      const prev = beforeSnap?.[metric.key]?.[direction] || null;
      const next = afterSnap?.[metric.key]?.[direction] || null;
      if(!next || !next.id) continue;
      if(prev && prev.id === next.id && Math.abs((Number(prev.value) || 0) - (Number(next.value) || 0)) <= 0.0001) continue;

      const delta = Number(next.value) - (Number(prev?.value) || 0);
      const headline = `New all-time ${direction} ${metric.label}`;
      return {
        headline,
        detail: buildDetail({ delta, priorValue: Number(prev?.value) || 0, format: metric.format })
      };
    }
  }
  return null;
}

function openConfirmModal({
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Yes",
  cancelLabel = "Cancel"
} = {}){
  return new Promise((resolve)=>{
    const confirmId = `confirmModalYes_${uid()}`;
    const cancelId = `confirmModalNo_${uid()}`;
    let settled = false;
    const settle = (result)=>{
      if(settled) return;
      settled = true;
      closeModal();
      resolve(Boolean(result));
    };

    openModal({
      title,
      backdropClose: false,
      escClose: false,
      showCloseButton: false,
      position: "center",
      html: `
        <div class="muted" style="white-space:pre-wrap;line-height:1.4">${escapeHtml(String(message||""))}</div>
        <div class="modalActions" style="margin-top:14px">
          <button class="btn" id="${cancelId}" type="button">${escapeHtml(String(cancelLabel||"Cancel"))}</button>
          <button class="btn danger" id="${confirmId}" type="button">${escapeHtml(String(confirmLabel||"Yes"))}</button>
        </div>
      `,
      onOpen: ()=>{
        document.getElementById(cancelId)?.addEventListener("click", ()=>settle(false));
        document.getElementById(confirmId)?.addEventListener("click", ()=>{
          triggerHaptic("light");
          settle(true);
        });
      }
    });
  });
}


async function commitTripFromDraft({ mode, editId="", inputs, nextView="home" }){
  clearPendingTripUndo();
  const dateISO = parseUsDateToISODate(String(inputs?.date||""));
  const dealer = normalizeDealerDisplay(String(inputs?.dealer||"").trim());
  const poundsNum = parseNum(inputs?.pounds);
  const amountNum = parseMoney(inputs?.amount);
  const area = String(inputs?.area||"").trim();
  const species = String(inputs?.species || DEFAULT_TRIP_SPECIES).trim() || DEFAULT_TRIP_SPECIES;
  const notes = String(inputs?.notes || "").trim();

  const errs = [];
  if(!dateISO) errs.push("Date");
  if(!dealer) errs.push("Dealer");
  if(!isValidAreaValue(area)) errs.push("Area");
  if(!(poundsNum > 0)) errs.push("Pounds");
  if(!(amountNum > 0)) errs.push("Amount");
  if(errs.length){
    announce(`Error: Missing/invalid: ${errs.join(", ")}`, "assertive");
    alert("Missing/invalid: " + errs.join(", "));
    return false;
  }

  const trips = Array.isArray(state.trips) ? state.trips : [];
  const isEdit = String(mode||"") === "edit";

  let existing = null;
  let id = "";
  if(isEdit){
    id = String(editId||"");
    existing = trips.find(t => String(t?.id||"") === id) || null;
    if(!existing){
      announce("Error: Trip not found. Returning home.", "assertive");
      alert("Trip not found. Returning home.");
      state.view = nextView;
      saveState();
      render();
      return false;
    }
  } else {
    id = uid();
  }

  const candidate = { dateISO, dealer, pounds: to2(poundsNum), amount: to2(amountNum), area };
  const dup = findDuplicateTrip(candidate, isEdit ? id : "");
  if(dup){
    const recentLabel = dup === getTripsNewestFirst(Array.isArray(state.trips) ? state.trips : [])[0]
      ? "A very recent similar trip was found."
      : "This may be a duplicate trip.";
    const msg = isEdit
      ? `${recentLabel}\n\nThis edit matches another trip:\n\nDate: ${formatDateDMY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave these changes anyway?`
      : `${recentLabel}\n\nDate: ${formatDateDMY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave this trip anyway?`;
    const ok = await openConfirmModal({
      title: "Possible Duplicate",
      message: msg,
      confirmLabel: isEdit ? "Save Changes" : "Save Anyway",
      cancelLabel: "Cancel"
    });
    if(!ok) return false;
  }

  const eventAt = new Date().toISOString();
  const tripWithAudit = appendTripHistoryEvent({
    ...(existing || {}),
    id,
    dateISO,
    dealer,
    pounds: to2(poundsNum),
    amount: to2(amountNum),
    area,
    species,
    notes
  }, {
    type: isEdit ? "edited" : "created",
    at: eventAt,
    source: "manual"
  });
  const trip = !isEdit
    ? { ...tripWithAudit, createdAt: eventAt }
    : tripWithAudit;

  // Tier 1: normalize + validate before saving
  const tripNorm = normalizeTrip(trip);
  const vErrs = validateTrip(tripNorm);
  if(vErrs.length){
    announce(`Error: Missing/invalid: ${vErrs.join(", ")}`, "assertive");
    alert("Missing/invalid: " + vErrs.join(", "));
    return false;
  }


  const beforeRecords = getAllTimeMetricSnapshot(trips);
  const nextTrips = isEdit
    ? trips.map(t => (String(t?.id||"") === id ? tripNorm : t))
    : trips.concat([tripNorm]);
  const afterRecords = getAllTimeMetricSnapshot(nextTrips);
  const milestoneToast = buildAllTimeMilestoneToast(beforeRecords, afterRecords);

  const undoSnapshot = {
    trips,
    view: state.view
  };
  if(Object.prototype.hasOwnProperty.call(state, "editId")) undoSnapshot.editId = state.editId;
  if(Object.prototype.hasOwnProperty.call(state, "draft")) undoSnapshot.draft = state.draft;
  if(Object.prototype.hasOwnProperty.call(state, "reviewDraft")) undoSnapshot.reviewDraft = state.reviewDraft;

  state.trips = nextTrips;

  // clear transient state
  if(isEdit){
    delete state.editId;
  } else {
    delete state.draft;
    delete state.reviewDraft;
  }

  state.view = nextView;
  saveState();
  triggerHaptic("light");
  render();
  showUndoToast({ message: "Trip saved", snapshot: undoSnapshot });
  if(milestoneToast){
    showMilestoneToast({
      headline: milestoneToast.headline,
      detail: milestoneToast.detail
    });
  }
  // After first successful save, offer install (once per device).
  if(!isEdit){ try{ setTimeout(()=>{ maybeOfferInstallAfterFirstSave(); }, 350); }catch(_){} }
  return true;
}


function ensureDeletedTripsState(){
  if(!Array.isArray(state.deletedTrips)) state.deletedTrips = [];
  state.deletedTrips = state.deletedTrips.filter((entry)=> entry && typeof entry === "object" && entry.trip && typeof entry.trip === "object");
  return state.deletedTrips;
}

function buildDeletedTripRecord(trip){
  const normalized = normalizeTrip(trip);
  if(!normalized) return null;
  return {
    id: uid("deleted_trip"),
    trip: normalized,
    tripId: String(normalized.id || ""),
    deletedAt: new Date().toISOString()
  };
}

function addTripToDeletedBin(trip){
  const record = buildDeletedTripRecord(trip);
  if(!record) return null;
  const deletedTrips = ensureDeletedTripsState();
  deletedTrips.unshift(record);
  if(deletedTrips.length > DELETED_TRIPS_LIMIT) deletedTrips.length = DELETED_TRIPS_LIMIT;
  return record;
}

function restoreDeletedTrip(deletedEntryId){
  const deletedTrips = ensureDeletedTripsState();
  const entryId = String(deletedEntryId || "");
  const entryIndex = deletedTrips.findIndex((entry)=> String(entry?.id || "") === entryId);
  if(entryIndex < 0) return { ok:false, reason:"missing" };
  const entry = deletedTrips[entryIndex];
  const restoredTrip = normalizeTrip(entry.trip);
  if(!restoredTrip) return { ok:false, reason:"invalid" };
  const trips = Array.isArray(state.trips) ? state.trips : [];
  if(trips.some((trip)=> String(trip?.id || "") === String(restoredTrip.id || ""))){
    restoredTrip.id = uid("t");
  }
  state.trips = [restoredTrip, ...trips];
  state.deletedTrips = deletedTrips.filter((entry)=> String(entry?.id || "") !== entryId);
  return { ok:true, trip: restoredTrip, idChanged: String(entry?.tripId || "") !== String(restoredTrip.id || "") };
}

function permanentlyDeleteDeletedTrip(deletedEntryId){
  const deletedTrips = ensureDeletedTripsState();
  const entryId = String(deletedEntryId || "");
  const startLen = deletedTrips.length;
  state.deletedTrips = deletedTrips.filter((entry)=> String(entry?.id || "") !== entryId);
  return startLen !== state.deletedTrips.length;
}

function clearDeletedTripsBin(){
  const count = ensureDeletedTripsState().length;
  state.deletedTrips = [];
  return count;
}

migrateLegacyStateIfNeeded(localStorage);
let state = migrateStateIfNeeded(loadState(), {
  normalizeTrip,
  normalizeThemeMode,
  themeModeSystem: THEME_MODE_SYSTEM
});
bindThemeMedia();
applyThemeMode();
ensureTripsFilter();
ensureReportsFilter();
ensureHomeFilter();
ensureAreas();
ensureDealers();
const SAFE_MODE_ACTIVE = Boolean(state?.__safeMode);
if(SAFE_MODE_ACTIVE){
  rootStateSaveSeam.clearSafeModeFlag();
  state.view = "settings";
}
if(Array.isArray(state.trips)) {
  let changed = false;
  state.trips = state.trips.map((trip)=>{
    const n = normalizeTrip(trip);
    if(!n) return trip;
    if(String(trip?.species || "").trim() !== n.species) changed = true;
    return n;
  }).filter(Boolean);
  if(changed) saveState();
}
if(rootStateSaveSeam.wasEmergencyDraftRecoveredOnBoot()){
  try{ showToast("Recovered your unsaved trip draft"); }catch(_){ }
}
if(SAFE_MODE_ACTIVE){
  try{ showToast("Safe Mode is on. Loaded a temporary clean state."); }catch(_){ }
}
bindRuntimeBootHandlers();
const {
  scheduleStateSave,
  saveDraft,
  bindLifecycleSaveFlush,
  saveState
} = rootStateSaveSeam.createStateSaveFlow({ getState: ()=> state });


const {
  renderTopAreaChips,
  renderTopDealerChips,
  resolveQuickChipItems,
  openQuickChipCustomizeModal,
  bindQuickChips,
  bindAreaChips,
  bindQuickChipLongPress
} = createQuickChipHelpers({
  getState: () => state,
  saveState: () => saveState(),
  getLastUniqueFromTrips: (kind, maxN) => getLastUniqueFromTrips(kind, maxN),
  normalizeKey,
  escapeHtml,
  openModal,
  closeModal,
  longPressMs: QUICK_CHIP_LONG_PRESS_MS,
  moveCancelPx: QUICK_CHIP_MOVE_CANCEL_PX
});





bindLifecycleSaveFlush();

function ensureTripsFilter(){
  // Trips now uses the unified filter object as its source of truth.
  ensureUnifiedFilters();
  state.tripsFilter = state.filters.active;

  // Guardrails for Trips-visible selectors.
  if(state.tripsFilter.dealer == null) state.tripsFilter.dealer = "all";
  if(state.tripsFilter.area == null) state.tripsFilter.area = "all";
}

function getTripsFilteredRows(){
  ensureTripsFilter();
  const tf = state.tripsFilter;
  const tripsAll = Array.isArray(state.trips) ? state.trips : [];
  const filtered = applyUnifiedTripFilter(tripsAll, tf);

  const rangeMap = {
    "All Time": "All Time",
    "YTD": "YTD",
    "Last 12 months": "Last 12 Months",
    "Last 90 days": "Last 90 Days",
    "Last 30 days": "Last 30 Days",
    "Last 7 Days": "Last 7 Days"
  };
  const r = {
    startISO: filtered.range.fromISO,
    endISO: filtered.range.toISO,
    label: (tf.range === "custom") ? "CUSTOM" : (rangeMap[resolveUnifiedRange(tf).label] || "YTD")
  };

  let rows = filtered.rows;

  // Stable sort: newest first (shared with Home and other trip views)
  rows = getTripsNewestFirst(rows);

  return { rows, range:r, tf };
}

function tripsActiveLabel(tf, rangeLabel){
  const parts = [];
  parts.push(rangeLabel || "YTD");
  if(tf?.dealer && tf.dealer !== "all") parts.push(`Dealer: ${tf.dealer}`);
  if(tf?.area && tf.area !== "all") parts.push(`Area: ${tf.area}`);
  return parts.join(" • ");
}

function ensureReportsFilter(){
  if(!state.reportsFilter || typeof state.reportsFilter !== "object"){
    state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
  }
  if(!state.reportsFilter.mode) state.reportsFilter.mode = "YTD";
  if(state.reportsFilter.from == null) state.reportsFilter.from = "";
  if(state.reportsFilter.to == null) state.reportsFilter.to = "";
  if(state.reportsFilter.dealer == null) state.reportsFilter.dealer = "";
  if(state.reportsFilter.area == null) state.reportsFilter.area = "";
  if(state.reportsFilter.adv == null) state.reportsFilter.adv = false;
}


function ensureHomeFilter(){
  if(!state.homeFilter || typeof state.homeFilter !== "object") state.homeFilter = { mode:"YTD", from:"", to:"" };
  if(!state.homeFilter.mode) state.homeFilter.mode = "YTD";
  if(state.homeFilter.from == null) state.homeFilter.from = "";
  if(state.homeFilter.to == null) state.homeFilter.to = "";
}



function bindDatePill(inputId, placeholder="Select date"){
  const el = document.getElementById(inputId);
  if(!el || String(el.type||"").toLowerCase() !== "date") return;
  let wrap = el.parentElement;
  if(!wrap || !wrap.classList.contains("datePillWrap")){
    wrap = document.createElement("div");
    wrap.className = "datePillWrap";
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
  }
  let ph = wrap.querySelector(".datePillPlaceholder");
  if(!ph){
    ph = document.createElement("span");
    ph.className = "datePillPlaceholder";
    ph.setAttribute("aria-hidden", "true");
    ph.textContent = placeholder;
    wrap.appendChild(ph);
  }
  const sync = ()=>{
    wrap.classList.toggle("is-empty", !String(el.value||"").trim());
  };
  if(!el.__datePillBound){
    el.__datePillBound = true;
    el.addEventListener("input", sync);
    el.addEventListener("change", sync);
    el.addEventListener("blur", sync);
  }
  sync();
}

function renderAllTrips(){
  ensureTripsFilter();
  const root = getApp();

  const { rows:sorted, range:r, tf } = getTripsFilteredRows();
  const opt = getFilterOptionsFromTrips();

  const rangeOptions = [
    ["all","All Time"],
    ["ytd","YTD"],
    ["12m","Last 12 Months"],
    ["90d","Last 90 Days"],
    ["30d","Last 30 Days"],
    ["custom","Custom Range"]
  ];

  const filtersCard = `
    <div class="card tripsFiltersCard tripsBrowseFiltersCard">
      <div class="tripsFiltersTopRow">
        <div>
          <div class="tripsFiltersEyebrow">Trip history</div>
          <div class="tripsFiltersTitle">Browse saved trips</div>
        </div>
      </div>
      <div class="tripsFiltersGrid">
        <div class="tripsFilterField">
          <div class="muted small">Range</div>
          <select id="flt_range" class="select">
            ${rangeOptions.map(([k,l])=>`<option value="${k}" ${tf.range===k?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>

        <div class="tripsFilterField">
          <div class="muted small">Dealer</div>
          <select id="flt_dealer" class="select">
            <option value="all" ${tf.dealer==="all"?"selected":""}>All</option>
            ${opt.dealers.map(d=>`<option value="${escapeHtml(d)}" ${tf.dealer===d?"selected":""}>${escapeHtml(d)}</option>`).join("")}
          </select>
        </div>

        <div class="tripsFilterField">
          <div class="muted small">Area</div>
          <select id="flt_area" class="select">
            <option value="all" ${tf.area==="all"?"selected":""}>All</option>
            ${opt.areas.map(a=>`<option value="${escapeHtml(a)}" ${tf.area===a?"selected":""}>${escapeHtml(a)}</option>`).join("")}
          </select>
        </div>

        <div class="tripsFilterField tripsFilterField--disabled">
          <div class="muted small">Species (Coming soon)</div>
          <select id="flt_species" class="select" disabled aria-disabled="true">
            <option>Coming soon</option>
          </select>
        </div>

      </div>

      <div class="tripsFilterActions">
        <div class="tripsFilterActionExport">
          <button class="btn" id="exportTrips" type="button">Export CSV</button>
        </div>
        <button class="btn btn-ghost" id="flt_reset" type="button">Reset</button>
      </div>

      <div id="flt_custom_wrap" class="tripsCustomRangeWrap" style="display:${tf.range==="custom"?"block":"none"}">
        <div class="row tripsCustomRangeRow">
          <div class="tripsFilterField">
            <div class="muted small">From</div>
            <input id="flt_from" type="date" class="input" value="${escapeHtml(String(tf.fromISO||"").slice(0,10))}" />
          </div>
          <div class="tripsFilterField">
            <div class="muted small">To</div>
            <input id="flt_to" type="date" class="input" value="${escapeHtml(String(tf.toISO||"").slice(0,10))}" />
          </div>
        </div>
      </div>

      <div class="muted small mt10 tripsFilterSummary">
        Showing: <b>${escapeHtml(tripsActiveLabel(tf, r.label))}</b>
      </div>
    </div>
  `;

  const rows = sorted.length
    ? sorted.map(t=> renderTripCatchCard(t, { interactive:true, extraClass:"tripsBrowseCard" })).join("")
    : `
      <div class="emptyState tripsEmptyState">
        <div class="emptyStateTitle">No trips in this Trips view</div>
        <div class="emptyStateBody">Try a wider range, clear dealer/area filters, or add a trip to get this list moving again.</div>
        <div class="emptyStateAction">
          <button class="btn good" id="tripsEmptyAdd" type="button">＋ Add Trip</button>
          <button class="btn" id="tripsEmptyReset" type="button">Clear filters</button>
        </div>
      </div>`;

  root.innerHTML = `
    ${renderPageHeader("all_trips")}

    ${filtersCard}

    <div style="height:10px"></div>

    <div class="triplist tripsBrowseList">
      ${rows}
    </div>
  `;

  bindNavHandlers(state);
  // Open trip row
  root.querySelectorAll(".triprow").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-id") || "";
      if(!id) return;
      state.editId = id;
      state.view = "edit";
      saveState();
      render();
    });
  });

  const rerender = ()=>{ scheduleStateSave(); renderAllTrips(); };

  const rangeEl = document.getElementById("flt_range");
  rangeEl?.addEventListener("change", ()=>{
    tf.range = rangeEl.value;
    if(tf.range === "custom"){
      const now = isoToday();
      const y = now.slice(0,4);
      if(!tf.fromISO) tf.fromISO = `${y}-01-01`;
      if(!tf.toISO) tf.toISO = now;
      if(tf.fromISO > tf.toISO){ const tmp = tf.fromISO; tf.fromISO = tf.toISO; tf.toISO = tmp; }
    }
    rerender();
  });

  document.getElementById("flt_dealer")?.addEventListener("change", (ev)=>{ tf.dealer = ev.target.value; rerender(); });
  document.getElementById("flt_area")?.addEventListener("change", (ev)=>{ tf.area = ev.target.value; rerender(); });

  const fromEl = document.getElementById("flt_from");
  const toEl = document.getElementById("flt_to");
  fromEl?.addEventListener("change", ()=>{ tf.fromISO = fromEl.value; tf.range="custom"; rerender(); });
  toEl?.addEventListener("change", ()=>{ tf.toISO = toEl.value; tf.range="custom"; rerender(); });
  bindDatePill("flt_from");
  bindDatePill("flt_to");

  document.getElementById("flt_reset")?.addEventListener("click", ()=>{
    state.filters = state.filters || {};
    state.filters.active = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all", species:"all", text:"" };
    state.tripsFilter = state.filters.active;
    saveState();
    renderAllTrips();
  });

  // Export CSV button (Trips-only export)
  const exportBtn = document.getElementById("exportTrips");
  if(exportBtn){
    exportBtn.onclick = ()=>{
      const { rows, range } = getTripsFilteredRows();
      exportTripsWithLabel(rows, range.label, range.startISO, range.endISO);
      showToast("CSV exported");
    };
  }

  const tripsEmptyAdd = document.getElementById("tripsEmptyAdd");
  if (tripsEmptyAdd) {
    tripsEmptyAdd.onclick = () => {
      state.view = "new";
      saveState();
      render();
    };
  }

  const tripsEmptyReset = document.getElementById("tripsEmptyReset");
  if (tripsEmptyReset) {
    tripsEmptyReset.onclick = () => {
      state.filters = state.filters || {};
      state.filters.active = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all", species:"all", text:"" };
      state.tripsFilter = state.filters.active;
      saveState();
      showToast("Filters cleared");
      renderAllTrips();
    };
  }
}

const { renderHome } = createHomeDashboardRenderer({
  state,
  ensureHomeFilter,
  buildUnifiedFilterFromHomeFilter,
  applyUnifiedTripFilter,
  computePPL,
  round2: to2,
  getTripsNewestFirst,
  renderPageHeader,
  escapeHtml,
  parseReportDateToISO,
  formatMoney,
  getApp,
  saveState,
  render,
  bindDatePill,
  showToast,
  tipMsg: typeof tipMsg !== "undefined" ? tipMsg : undefined,
  exportBackup,
  renderHomeMetricDetail: () => renderHomeMetricDetail()
});

const { renderNewTrip, renderReviewTrip, renderEditTrip } = createTripScreenOrchestrator({
  state,
  ensureAreas,
  ensureDealers,
  DEFAULT_TRIP_SPECIES,
  isoToday,
  resolveQuickChipItems,
  getLastUniqueFromTrips,
  getDealerSelectList,
  buildDealerOptionsHtml,
  buildAreaOptionsHtml,
  renderTripEntryForm,
  escapeHtml,
  renderTopDealerChips,
  renderTopAreaChips,
  iconSvg,
  getApp,
  renderPageHeader,
  bindNavHandlers,
  bindDatePill,
  parseNum,
  parseMoney,
  formatMoney,
  computePPL,
  openModal,
  closeModal,
  normalizeKey,
  saveState,
  scheduleStateSave,
  computeTripSaveEnabled,
  isValidAreaValue,
  sanitizeDecimalInput,
  primeNumericField,
  normalizeAmountOnBlur,
  commitTripFromDraft,
  render,
  saveDraft,
  parseUsDateToISODate,
  formatDateDMY,
  normalizeDealerDisplay,
  announce,
  showToast,
  showFatal,
  DISPLAY_BUILD_VERSION,
  pushView,
  findCanonicalFromList,
  parseReportDateToISO,
  findDuplicateTrip,
  to2,
  displayAmount,
  openQuickChipCustomizeModal,
  bindQuickChipLongPress,
  bindAreaChips,
  bindQuickChips,
  renderSuggestions,
  clearPendingTripUndo,
  openConfirmModal,
  goBack,
  showUndoToast,
  renderHome,
  buildTripFormInputs,
  buildNewTripSaveSnapshot,
  buildTripProvenanceSummary,
  addTripToDeletedBin
});









const { renderReports, renderHomeMetricDetail } = createReportsScreenRenderer({
  ensureReportsFilter: () => ensureReportsFilter(),
  getState: () => state,
  buildUnifiedFilterFromReportsFilter,
  applyUnifiedTripFilter,
  parseReportDateToISO,
  formatReportDateValue,
  escapeHtml,
  resolveUnifiedRange,
  formatDateDMY,
  getApp: () => getApp(),
  renderPageHeader,
  saveState: () => saveState(),
  bindDatePill,
  showToast: feedback.showToast,
  buildReportsAggregationState,
  canonicalDealerGroupKey,
  normalizeDealerDisplay,
  formatMoney,
  to2,
  drawReportsCharts,
  computePPL,
  renderApp: () => render()
});


const settingsListManagement = createSettingsListManagement({
  getState: () => state,
  setState: (nextState) => { state = nextState; },
  saveState: () => saveState(),
  getApp: () => getApp(),
  ensureAreas: () => ensureAreas(),
  ensureDealers: () => ensureDealers(),
  normalizeKey,
  escapeHtml,
  showToast: feedback.showToast,
  copyTextWithFeedback: feedback.copyTextWithFeedback,
  getDebugInfo: () => getDebugInfo(),
  forceRefreshApp: () => updateRuntimeStatus.forceRefreshApp(),
  render: () => render()
});

const { renderSettings } = createSettingsScreenOrchestrator({
  getState: () => state,
  getApp: () => getApp(),
  ensureAreas: () => ensureAreas(),
  ensureDealers: () => ensureDealers(),
  renderPageHeader,
  themeModeSystem: THEME_MODE_SYSTEM,
  themeModeLight: THEME_MODE_LIGHT,
  themeModeDark: THEME_MODE_DARK,
  settingsListManagement,
  displayBuildVersion: DISPLAY_BUILD_VERSION,
  updateBuildBadge: () => updateRuntimeStatus.updateBuildBadge(),
  bindThemeControls: () => bindThemeControls(),
  bindNavHandlers,
  pushView,
  updateUpdateRow: () => updateRuntimeStatus.updateUpdateRow(),
  updateBuildInfo: () => updateRuntimeStatus.updateBuildInfo(),
  updateBackupHealthWarning: () => updateBackupHealthWarning(),
  updateLastBackupLine: () => updateLastBackupLine(),
  updateRestoreRollbackLine: () => updateRestoreRollbackLine(),
  exportBackup: () => exportBackup(),
  parseBackupFileForRestore: (file) => parseBackupFileForRestore(file),
  openRestorePreviewModal: (preview) => openRestorePreviewModal(preview),
  openReplaceSafetyBackupModal: () => openReplaceSafetyBackupModal(),
  importBackupFromFile: (file, options) => importBackupFromFile(file, options),
  restoreFromRollbackSnapshot: () => restoreFromRollbackSnapshot(),
  saveState: () => saveState(),
  openConfirmModal: (options) => openConfirmModal(options),
  restoreDeletedTrip: (deletedEntryId) => restoreDeletedTrip(deletedEntryId),
  permanentlyDeleteDeletedTrip: (deletedEntryId) => permanentlyDeleteDeletedTrip(deletedEntryId),
  clearDeletedTripsBin: () => clearDeletedTripsBin(),
  applyThemeMode: () => applyThemeMode(),
  render: () => render(),
  openRestoreErrorModal: (error) => openRestoreErrorModal(error),
  openRestoreResultModal: (result) => openRestoreResultModal(result),
  showToast: (msg) => showToast(msg)
});


function renderHelp(){
  getApp().innerHTML = renderHelpViewHTML({
    renderPageHeader,
    escapeHtml,
    displayBuildVersion: DISPLAY_BUILD_VERSION,
    schemaVersion: state.schemaVersion || state.schema || "",
    isStandalone: window.matchMedia("(display-mode: standalone)").matches,
    hasSWController: !!(navigator.serviceWorker && navigator.serviceWorker.controller)
  });

  getApp().scrollTop = 0;

  // Quick links inside Help
  try{
    document.querySelectorAll('[data-helpjump]').forEach(btn=>{
      btn.onclick = ()=>{
        const k = String(btn.getAttribute('data-helpjump')||'').toLowerCase();
        const el = document.getElementById(`help_jump_${k}`);
        if(el && el.scrollIntoView) el.scrollIntoView({ block:"start", behavior:"smooth" });
      };
    });
  }catch(_e){}

  // If a section Help button opened this screen, jump to that section
  try{
    const k = String(state.helpJump||"").toLowerCase();
    if(k){
      const el = document.getElementById(`help_jump_${k}`);
      if(el && el.scrollIntoView){
        el.scrollIntoView({ block: "start", behavior: "instant" });
      }
    }
  }catch(_e){}

  if (typeof bindNavHandlers === "function") bindNavHandlers(state);
}


function renderAbout(){
  getApp().innerHTML = renderAboutViewHTML({
    renderPageHeader,
    displayBuildVersion: DISPLAY_BUILD_VERSION
  });
  getApp().scrollTop = 0;

  document.getElementById("backSettings").onclick = ()=>{ state.view="settings"; state.lastAction="nav:settings"; saveState(); render(); };

  document.getElementById("copyDebug").onclick = async ()=>{
    await copyTextWithFeedback(getDebugInfo(), "Debug info copied");
  };

  document.getElementById("feedback").onclick = ()=>{
    const body = encodeURIComponent(getDebugInfo() + "\n\nWhat happened?\n");
    const subj = encodeURIComponent("Bank the Catch Feedback ("+DISPLAY_BUILD_VERSION+")");
    location.href = `mailto:?subject=${subj}&body=${body}`;
  };
}

function render(){
  renderViewDispatch({
    state,
    renderers: {
      renderSettings,
      renderNewTrip,
      renderEditTrip,
      renderReports,
      renderHelp,
      renderAllTrips,
      renderAbout,
      renderHome
    },
    onRedirectToNew: ()=>{ state.view = "new"; saveState(); renderNewTrip(); },
    renderTabBar,
    bindHeaderHelpButtons
  });
}

startRuntimeRender({
  render,
  getBootPill: () => document.getElementById("bootPill"),
  displayBuildVersion: DISPLAY_BUILD_VERSION,
  showFatal
});

// ---- Display helpers (no state) ----
function display2(val){
  if(val === "" || val == null) return "";
  const n = Number(val);
  if(!Number.isFinite(n)) return String(val);
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2);
}
function displayAmount(val){
  return display2(val);
}


function buildAreaOptionsHtml(selectedArea, addSentinel){
  return ["", ...getValuesWithLegacyEntry("area", selectedArea, Array.isArray(state.areas) ? state.areas : [])].map((area)=>{
    const label = area ? area : "—";
    const sel = (String(selectedArea || "") === String(area || "")) ? "selected" : "";
    return `<option value="${escapeHtml(String(area || ""))}" ${sel}>${label}</option>`;
  }).concat(`<option value="${addSentinel}">+ Add new Area</option>`).join("");
}

function getDealerSelectList(topDealers, selectedDealer=""){
  const out = [];
  const seenDealerKeys = new Set();
  for(const dealer of getValuesWithLegacyEntry("dealer", selectedDealer, [...(Array.isArray(topDealers) ? topDealers : []), ...(Array.isArray(state.dealers) ? state.dealers : [])])){
    const val = String(dealer || "").trim();
    if(!val) continue;
    const key = normalizeKey(val);
    if(seenDealerKeys.has(key)) continue;
    seenDealerKeys.add(key);
    out.push(val);
  }
  return out;
}

function getValuesWithLegacyEntry(kind, legacyValue, values){
  const list = Array.isArray(values) ? values.slice() : [];
  const legacy = String(legacyValue || "").trim();
  if(!legacy) return list;
  const legacyKey = normalizeKey(legacy);
  const hasLegacy = list.some((item)=>normalizeKey(String(item || "").trim()) === legacyKey);
  if(!hasLegacy) list.unshift(legacy);
  return list;
}

function buildDealerOptionsHtml(selectedDealer, dealerList, addSentinel){
  return ["", ...(Array.isArray(dealerList) ? dealerList : [])].map((dealer)=>{
    const label = dealer ? dealer : "—";
    const sel = (normalizeKey(String(selectedDealer || "")) === normalizeKey(String(dealer || ""))) ? "selected" : "";
    const value = String(dealer || "").replaceAll('"', "&quot;");
    return `<option value="${value}" ${sel}>${escapeHtml(label)}</option>`;
  }).concat(`<option value="${addSentinel}">+ Add new Dealer</option>`).join("");
}
