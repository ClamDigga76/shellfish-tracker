import { STARTUP_MODULE_PATHS as STARTUP_MODULE_PATHS_MANIFEST, buildVersionedAssetHref } from "./startup_asset_manifest_v5.js";

const moduleV = new URL(import.meta.url).searchParams.get("v") || "";
const bootV = String(window.APP_VERSION || "");
if (moduleV && bootV && moduleV !== bootV) {
  const mismatchError = new Error(`Version mismatch: bootstrap=${bootV}, app=${moduleV}. Please reload to apply the latest update.`);
  if (window.__showModuleError) window.__showModuleError(mismatchError);
  throw mismatchError;
}

window.__SHELLFISH_APP_STARTED = false;

const APP_IMPORT_VERSION = String(window.APP_VERSION || moduleV || "");

const STARTUP_MODULE_PATHS = [
  ...STARTUP_MODULE_PATHS_MANIFEST
  // Preflight sentinel token (module ownership remains in startup_asset_manifest_v5.js): "./utils_v5.js"
];

function getVersionedModuleHref(relPath){
  return buildVersionedAssetHref(relPath, APP_IMPORT_VERSION, import.meta.url);
}

const STARTUP_MODULE_URLS = STARTUP_MODULE_PATHS.map(getVersionedModuleHref);

async function importVersionedModule(relPath){
  return import(getVersionedModuleHref(relPath));
}

try {
  window.__SHELLFISH_STARTUP_IMPORTS__ = [...STARTUP_MODULE_URLS];
  window.__BOOT_DIAG__ = window.__BOOT_DIAG__ || {};
  window.__BOOT_DIAG__.startupModuleUrls = [...STARTUP_MODULE_URLS];
} catch (_) {}

const [{ uid, toCSV, formatMoney, formatISODateToDisplayDMY: formatDateLegacyDMY, computePPL, resolveTripPayRate, deriveTripSettlement, parseMDYToISO: parseUsDateToISODate, parseNum, parseMoney, likelyDuplicate, normalizeKey, canonicalDealerGroupKey, escapeHtml, getTripsNewestFirst, isValidISODate },
  { THEME_MODE_DARK, normalizeThemeMode, resolveTheme },
  { LS_KEY, migrateLegacyStateIfNeeded, migrateStateIfNeeded, loadStateWithLegacyFallback },
  { ensureNavState, createNavigator },
  { drawReportsCharts },
  { buildReportsAggregationState },
  { buildReportsSeasonalityFoundation },
  { createQuickChipHelpers },
  { createReportsFilterHelpers },
  { createSettingsListManagement },
  { createBackupRestoreSubsystem },
  { createTripDataEngine, createTripDraftSaveEngine, computeTripSaveEnabled, appendTripHistoryEvent, ensureTripProvenanceShape, AREA_NOT_RECORDED },
  { createTripCardRenderHelpers, normalizeDealerDisplay },
  { renderHelpViewHTML, renderAboutViewHTML },
  { renderTripEntryForm },
  { createHomeDashboardRenderer },
  { createSettingsScreenOrchestrator },
  { createReportsScreenRenderer },
  { createFeedbackSeam },
  { createTripScreenOrchestrator },
  { createTripsBrowseScreenRenderer },
  { buildTripFormInputs, buildNewTripSaveSnapshot },
  { createTripMutationLifecycleSeam },
  { createUnifiedFiltersSeam },
  { createRootStateSaveSeam },
  { createUpdateRuntimeStatusSeam },
  { createDiagnosticsFatalSeam },
  { createRuntimeOrchestrationSeam, renderViewDispatch, startRuntimeRender },
  { createTopLevelNavigationTransitionSeam },
  {
    renderPageHeader: renderPageHeaderShell,
    bindHeaderHelpButtons: bindHeaderHelpButtonsShell,
    renderTabBar: renderTabBarShell
  },
  { downloadText, lockBodyScroll, unlockBodyScroll, focusFirstFocusable, openModal, closeModal, attachLongPress }
] = await Promise.all([
  ...STARTUP_MODULE_PATHS.map(importVersionedModule),
  importVersionedModule("./ui_browser_helpers_v5.js")
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
function resolveAreaValue(value){
  const rawValue = String(value || "").trim();
  return { areaId: "", canonicalName: rawValue, rawValue, key: normalizeKey(rawValue), matchedBy: rawValue ? "raw" : "empty", record: null };
}

function resolveTripArea(trip){
  return resolveAreaValue(trip?.area || "");
}

function canonicalizeTripArea(trip){
  if(!trip || typeof trip !== "object") return trip;
  const area = String(trip.area || "").trim();
  const nextTrip = { ...trip, area };
  if(Object.prototype.hasOwnProperty.call(nextTrip, "areaId")) delete nextTrip.areaId;
  return nextTrip;
}

function syncAreaState(nextState = state){
  const source = (nextState && typeof nextState === "object") ? nextState : state;
  if(!Array.isArray(source.areas)) source.areas = [];
  const tripAreas = Array.isArray(source.trips) ? source.trips.map((trip)=> String(trip?.area || "").trim()) : [];
  source.areas = uniqueSorted([...source.areas, ...tripAreas, AREA_NOT_RECORDED]);
  if(source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, "areaRegistry")) delete source.areaRegistry;
  return source.areas;
}

function addArea(rawName){
  const name = String(rawName || "").trim();
  if(!name) return { created: false, value: "" };
  ensureAreas();
  const key = normalizeKey(name);
  const existing = (Array.isArray(state.areas) ? state.areas : []).find((area)=> normalizeKey(area) === key) || "";
  if(existing) return { created: false, value: existing };
  state.areas.push(name);
  state.areas = uniqueSorted(state.areas);
  return { created: true, value: name };
}

function countTripsForArea(areaName){
  const key = normalizeKey(areaName);
  if(!key) return 0;
  return (Array.isArray(state.trips) ? state.trips : []).reduce((count, trip)=> count + (normalizeKey(trip?.area || "") === key ? 1 : 0), 0);
}

function deleteArea(areaName){
  const key = normalizeKey(areaName);
  if(!key) return { ok: false, reason: "invalid-area" };
  if(key === normalizeKey(AREA_NOT_RECORDED)) return { ok: false, reason: "protected" };
  if(countTripsForArea(areaName) > 0) return { ok: false, reason: "in-use" };
  const nextAreas = (Array.isArray(state.areas) ? state.areas : []).filter((area)=> normalizeKey(area) !== key);
  if(nextAreas.length === (Array.isArray(state.areas) ? state.areas : []).length) return { ok: false, reason: "missing" };
  state.areas = nextAreas;
  return { ok: true };
}

// Backup meta (local-only; no user data duplication)
const LS_LAST_BACKUP_META = "btc_last_backup_meta_v1";
const LS_RESTORE_ROLLBACK_SNAPSHOT = "btc_restore_rollback_snapshot_v1";
let needsBootStateSave = false;

function markNeedsBootStateSave(){
  needsBootStateSave = true;
}

function getThemeMode(){
  return normalizeThemeMode(state?.settings?.themeMode);
}

function updateThemeMeta(){
  try{
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content", "#0b0f16");
  }catch(_){ }
}

function applyThemeMode(){
  const resolvedTheme = resolveTheme(getThemeMode());
  try{ document.documentElement.dataset.theme = resolvedTheme; }catch(_){ }
  updateThemeMeta();
}

function clearHomeMetricDetailState(){
  state.homeMetricDetail = "";
  state.homeMetricDetailContext = null;
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
  clearMilestoneCelebration,
  maybeOfferInstallAfterFirstSave,
  confirmSaveModal,
  copyTextWithFeedback,
  triggerHaptic
} = feedback;

const {
  updateRuntimeStatus,
  getDebugInfo,
  showFatal,
  bindRuntimeBootHandlers,
  getInstallSurfaceModel,
  runInstallAction
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
  return !!(d.date || d.dealer || d.area || d.pounds || d.amount || d.rate);
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
    confirmUnsavedLeave: ()=>openConfirmModal({
      title: "Leave this screen?",
      message: "Your unsaved trip entry may be lost.",
      confirmLabel: "Leave",
      cancelLabel: "Stay",
      confirmTone: "default"
    }),
    onNavigate: (next)=>{
      navigateTopLevelView(next);
    }
  });
}



// Signal to the page watchdog that the module loaded
try{ window.__SHELLFISH_STARTED = true; }catch{}
function getApp(){ return document.getElementById("app"); }

const { navigateTopLevelView } = createTopLevelNavigationTransitionSeam({
  getState: ()=> state,
  saveState: ()=> saveState(),
  render: ()=> render(),
  getApp: ()=> getApp(),
  clearHomeMetricDetailState: ()=> clearHomeMetricDetailState()
});

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

const {
  renderStandardReadOnlyTripCard,
  renderStandardInteractiveTripCard,
  renderTripsBrowseInteractiveTripCard
} = createTripCardRenderHelpers({
  formatDateDMY,
  to2,
  computePPL,
  resolveTripPayRate,
  deriveTripSettlement,
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
  syncAreaState: ()=> syncAreaState(state),
  canonicalizeTripArea: (trip)=> canonicalizeTripArea(trip),
  resolveAreaValue: (value)=> resolveAreaValue(value),
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
  syncAreaState(state);
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


const unifiedFiltersSeam = createUnifiedFiltersSeam({
  getState: ()=> state,
  parseUsDateToISODate,
  parseReportDateToISO: (...args)=> parseReportDateToISO(...args),
  isoToday,
  ensureAreas: ()=> ensureAreas(),
  resolveAreaValue: (value)=> resolveAreaValue(value),
  resolveTripArea: (trip)=> resolveTripArea(trip),
  normalizeTripRow: (trip)=> normalizeTripRow(trip),
  canonicalizeTripArea: (trip)=> canonicalizeTripArea(trip),
  isValidISODate
});

const {
  ensureUnifiedFilters,
  resolveUnifiedRange,
  buildUnifiedFilterFromHomeFilter,
  buildUnifiedFilterFromReportsFilter,
  applyUnifiedTripFilter,
  getFilteredTrips,
  normalizeCustomRangeWithFeedback
} = unifiedFiltersSeam;

function uniqueSorted(arr){
  return [...new Set((arr||[]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
}
function getFilterOptionsFromTrips(){
  ensureAreas();
  const trips = Array.isArray(state.trips) ? state.trips.map((trip)=> canonicalizeTripArea(normalizeTripRow(trip))).filter(Boolean) : [];
  return {
    dealers: uniqueSorted(trips.map(t=>t.dealer)),
    areas: uniqueSorted([...(Array.isArray(state.areas) ? state.areas : []), ...trips.map((t)=>resolveTripArea(t).canonicalName || t.area)]),
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
    const raw = field === "area"
      ? (resolveTripArea(t).canonicalName || String(t?.area || "").trim())
      : String(t?.[field] || "").trim();
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





function openConfirmModal({
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  confirmTone = "destructive"
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

    const normalizedTone = String(confirmTone || "destructive").toLowerCase();
    const confirmToneClass = normalizedTone === "destructive"
      ? "danger"
      : normalizedTone === "warning"
        ? "warn"
        : "";

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
          <button class="btn ${confirmToneClass}" id="${confirmId}" type="button">${escapeHtml(String(confirmLabel||"Yes"))}</button>
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


migrateLegacyStateIfNeeded(localStorage);
let state = migrateStateIfNeeded(loadState(), {
  normalizeTrip,
  normalizeThemeMode,
  themeModeDefault: THEME_MODE_DARK
});
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
    const n = normalizeTrip(canonicalizeTripArea(trip));
    if(!n) return trip;
    if(String(trip?.species || "").trim() !== n.species) changed = true;
    if(String(trip?.area || "").trim() !== String(n.area || "").trim() || String(trip?.areaId || "") !== String(n.areaId || "")) changed = true;
    return n;
  }).filter(Boolean);
  if(changed) markNeedsBootStateSave();
}
if(rootStateSaveSeam.wasEmergencyDraftRecoveredOnBoot()){
  try{ showToast("Recovered your unsaved trip draft"); }catch(_){ }
}
if(SAFE_MODE_ACTIVE){
  try{ showToast("Recovery Mode is on. Loaded a temporary clean session."); }catch(_){ }
}
bindRuntimeBootHandlers();
const {
  scheduleStateSave,
  saveDraft,
  bindLifecycleSaveFlush,
  saveState
} = rootStateSaveSeam.createStateSaveFlow({ getState: ()=> state });

const {
  commitTripFromDraft,
  findDuplicateTrip,
  clearPendingTripUndo,
  showUndoToast,
  addTripToDeletedBin,
  restoreDeletedTrip,
  permanentlyDeleteDeletedTrip,
  clearDeletedTripsBin
} = createTripMutationLifecycleSeam({
  getState: ()=> state,
  setState: (nextState)=> { state = nextState; },
  saveState: ()=> saveState(),
  render: ()=> render(),
  showToast,
  showMilestoneToast,
  triggerHaptic,
  maybeOfferInstallAfterFirstSave,
  openConfirmModal,
  announce,
  uid,
  parseUsDateToISODate,
  normalizeDealerDisplay,
  parseNum,
  parseMoney,
  deriveTripSettlement,
  to2,
  ensureAreas: ()=> ensureAreas(),
  addArea: (rawArea)=> addArea(rawArea),
  DEFAULT_TRIP_SPECIES,
  isValidAreaValue,
  getTripsNewestFirst,
  formatDateDMY,
  formatMoney,
  appendTripHistoryEvent,
  normalizeTrip,
  canonicalizeTripArea,
  validateTrip,
  likelyDuplicate,
  normalizeKey,
  computePPL,
  DELETED_TRIPS_LIMIT
});

if(needsBootStateSave) saveState();

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
    label: (tf.range === "custom")
      ? `${filtered.range.fromISO} → ${filtered.range.toISO}`
      : (rangeMap[resolveUnifiedRange(tf).label] || "YTD")
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
  if(tf?.area && tf.area !== "all") parts.push(`Area: ${resolveAreaValue(tf.area).canonicalName || tf.area}`);
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
  if(!Array.isArray(state.reportsFilter.customRangeCorrectionMessages)) state.reportsFilter.customRangeCorrectionMessages = [];
}


function ensureHomeFilter(){
  if(!state.homeFilter || typeof state.homeFilter !== "object") state.homeFilter = { mode:"YTD", from:"", to:"" };
  if(!state.homeFilter.mode) state.homeFilter.mode = "YTD";
  if(state.homeFilter.from == null) state.homeFilter.from = "";
  if(state.homeFilter.to == null) state.homeFilter.to = "";
  if(!Array.isArray(state.homeFilter.customRangeCorrectionMessages)) state.homeFilter.customRangeCorrectionMessages = [];
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

const { renderAllTrips } = createTripsBrowseScreenRenderer({
  ensureTripsFilter,
  getApp,
  getTripsFilteredRows,
  getFilterOptionsFromTrips,
  escapeHtml,
  tripsActiveLabel,
  renderTripsBrowseInteractiveTripCard,
  renderPageHeader,
  bindNavHandlers,
  getState: () => state,
  saveState: () => saveState(),
  scheduleStateSave: () => scheduleStateSave(),
  renderApp: () => render(),
  normalizeCustomRangeWithFeedback,
  bindDatePill,
  exportTripsWithLabel,
  showToast
});

const { renderHome } = createHomeDashboardRenderer({
  state,
  ensureHomeFilter,
  buildUnifiedFilterFromHomeFilter,
  applyUnifiedTripFilter,
  computePPL,
  resolveTripPayRate,
  round2: to2,
  getTripsNewestFirst,
  renderPageHeader,
  escapeHtml,
  parseReportDateToISO,
  formatMoney,
  getApp,
  saveState: () => saveState(),
  render,
  bindDatePill,
  normalizeCustomRangeWithFeedback,
  showToast,
  tipMsg: typeof tipMsg !== "undefined" ? tipMsg : undefined,
  exportBackup,
  renderHomeMetricDetail: () => renderHomeMetricDetail(),
  getInstallSurfaceModel: () => getInstallSurfaceModel(),
  runInstallAction: () => runInstallAction(),
  renderStandardReadOnlyTripCard
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
  deriveTripSettlement,
  computePPL,
  openModal,
  closeModal,
  normalizeKey,
  saveState: () => saveState(),
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
  normalizeCustomRangeWithFeedback,
  getApp: () => getApp(),
  renderPageHeader,
  saveState: () => saveState(),
  bindDatePill,
  showToast: feedback.showToast,
  buildReportsAggregationState,
  resolveAreaValue,
  resolveTripArea,
  buildReportsSeasonalityFoundation,
  canonicalDealerGroupKey,
  normalizeDealerDisplay,
  resolveTripPayRate,
  formatMoney,
  to2,
  drawReportsCharts,
  computePPL,
  renderStandardReadOnlyTripCard,
  renderApp: () => render()
});


const settingsListManagement = createSettingsListManagement({
  getState: () => state,
  setState: (nextState) => { state = nextState; },
  saveState: () => saveState(),
  getApp: () => getApp(),
  ensureAreas: () => ensureAreas(),
  ensureDealers: () => ensureDealers(),
  syncAreaState: () => syncAreaState(state),
  addArea: (rawName) => addArea(rawName),
  countTripsForArea: (areaName) => countTripsForArea(areaName),
  deleteArea: (areaName) => deleteArea(areaName),
  protectedAreaName: AREA_NOT_RECORDED,
  normalizeKey,
  escapeHtml,
  showToast: feedback.showToast,
  openModal: (options) => openModal(options),
  closeModal: (options) => closeModal(options),
  openConfirmModal: (options) => openConfirmModal(options),
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
  settingsListManagement,
  displayBuildVersion: DISPLAY_BUILD_VERSION,
  updateBuildBadge: () => updateRuntimeStatus.updateBuildBadge(),
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
  showToast: (msg) => showToast(msg),
  getInstallSurfaceModel: () => getInstallSurfaceModel(),
  runInstallAction: () => runInstallAction(),
  getReleaseValidationSnapshot: () => updateRuntimeStatus.getReleaseValidationSnapshot(),
  formatReleaseValidationLedger: (snapshot, selectedResults, notes) => updateRuntimeStatus.formatReleaseValidationLedger(snapshot, selectedResults, notes),
  copyTextWithFeedback: (text) => copyTextWithFeedback(text)
});


function renderHelp(){
  getApp().innerHTML = renderHelpViewHTML({
    renderPageHeader,
    escapeHtml,
    displayBuildVersion: DISPLAY_BUILD_VERSION,
    schemaVersion: state.schemaVersion || state.schema || "",
    isStandalone: window.matchMedia("(display-mode: standalone)").matches,
    hasSWController: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    installModel: getInstallSurfaceModel()
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
    await copyTextWithFeedback(getDebugInfo(), "Support bundle copied");
  };

  document.getElementById("feedback").onclick = ()=>{
    const body = encodeURIComponent(getDebugInfo() + "\n\nWhat happened?\n");
    const subj = encodeURIComponent("Bank the Catch Feedback ("+DISPLAY_BUILD_VERSION+")");
    location.href = `mailto:?subject=${subj}&body=${body}`;
  };
}

function render(){
  const focusTopLevelLanding = ()=>{
    const appRoot = getApp();
    if(!appRoot) return;
    const landingTarget = appRoot.querySelector("[data-top-level-landing='true'], .phTitle");
    if(landingTarget instanceof HTMLElement){
      try{
        landingTarget.focus({ preventScroll: true });
        return;
      }catch(_){ }
    }
    const fallback = appRoot.querySelector("main h1, h1, h2, [role='heading']");
    if(fallback instanceof HTMLElement && typeof fallback.focus === "function"){
      const hadTabIndex = fallback.hasAttribute("tabindex");
      if(!hadTabIndex) fallback.setAttribute("tabindex", "-1");
      try{
        fallback.focus({ preventScroll: true });
        if(!hadTabIndex){
          const removeTempTabIndex = ()=> fallback.removeAttribute("tabindex");
          setTimeout(removeTempTabIndex, 0);
        }
        return;
      }catch(_){ }
    }
    try{ focusFirstFocusable(appRoot); }catch(_){ }
  };

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
    bindHeaderHelpButtons,
    onBeforeTopLevelViewChange: ()=>{ clearMilestoneCelebration(); },
    onAfterTopLevelViewChange: ()=>{ focusTopLevelLanding(); }
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
  ensureAreas();
  const selectedCanonical = resolveAreaValue(selectedArea).canonicalName || selectedArea;
  return ["", ...getValuesWithLegacyEntry("area", selectedCanonical, Array.isArray(state.areas) ? state.areas : [])].map((area)=>{
    const label = area ? area : "—";
    const sel = (String(selectedCanonical || "") === String(area || "")) ? "selected" : "";
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
