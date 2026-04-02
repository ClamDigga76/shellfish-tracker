import {
  STARTUP_MODULE_PATHS as STARTUP_MODULE_PATHS_MANIFEST,
  STARTUP_APP_OWNED_MODULE_PATHS,
  buildVersionedAssetHref
} from "./startup_asset_manifest_v5.js";

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
const STARTUP_APP_OWNED_MODULE_URLS = STARTUP_APP_OWNED_MODULE_PATHS.map(getVersionedModuleHref);

async function importVersionedModule(relPath){
  return import(getVersionedModuleHref(relPath));
}

try {
  const startupImportUrls = [...STARTUP_MODULE_URLS, ...STARTUP_APP_OWNED_MODULE_URLS];
  window.__SHELLFISH_STARTUP_IMPORTS__ = startupImportUrls;
  window.__BOOT_DIAG__ = window.__BOOT_DIAG__ || {};
  window.__BOOT_DIAG__.startupModuleUrls = startupImportUrls;
} catch (_) {}

const [{ uid, toCSV, formatMoney, formatISODateToDisplayDMY: formatDateLegacyDMY, computePPL, resolveTripPayRate, deriveTripSettlement, parseMDYToISO: parseUsDateToISODate, parseNum, parseMoney, likelyDuplicate, normalizeKey, canonicalDealerGroupKey, escapeHtml, getTripsNewestFirst, isValidISODate },
  { THEME_MODE_DARK, normalizeThemeMode },
  { LS_KEY, migrateLegacyStateIfNeeded, migrateStateIfNeeded, loadStateWithLegacyFallback },
  { ensureNavState, createNavigator },
  { drawReportsCharts },
  { buildReportsAggregationState },
  { buildReportsSeasonalityFoundation },
  { createQuickChipHelpers },
  { createReportsFilterHelpers },
  { createSettingsListManagement },
  { createBackupRestoreSubsystem },
  { createTripDataEngine, createTripDraftSaveEngine, computeTripSaveEnabled, appendTripHistoryEvent, createTripProvenanceSummaryHelpers, AREA_NOT_RECORDED, createTripSharedCollectionsEngine },
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
    createAppShellBindings
  },
  { to2, createFormatDateDMY, iconSvg },
  { createTripsUnifiedFilterBridge },
  { createThemeRuntimeSeam },
  { downloadText, lockBodyScroll, unlockBodyScroll, focusFirstFocusable, openModal, closeModal, createOpenConfirmModal, bindDatePill, attachLongPress }
] = await Promise.all([
  ...STARTUP_MODULE_PATHS.map(importVersionedModule),
  ...STARTUP_APP_OWNED_MODULE_PATHS.map(importVersionedModule)
]);
const APP_VERSION = (window.APP_BUILD || "v5");
const VERSION = APP_VERSION;
const DISPLAY_BUILD_VERSION = VERSION;
const QUICK_CHIP_LONG_PRESS_MS = 500;
const DEFAULT_TRIP_SPECIES = "Soft-shell Clams";
const QUICK_CHIP_MOVE_CANCEL_PX = 10;
const SCHEMA_VERSION = 1;
const DELETED_TRIPS_LIMIT = 25;
const formatDateDMY = createFormatDateDMY(formatDateLegacyDMY);
const {
  normalizeTripRow,
  normalizeTrip,
  isValidAreaValue,
  validateTrip
} = createTripDataEngine({ uid, isValidISODate });
const {
  buildTripProvenanceSummary
} = createTripProvenanceSummaryHelpers({
  normalizeTrip,
  formatDateDMY
});
const {
  resolveAreaValue,
  resolveTripArea,
  canonicalizeTripArea,
  syncAreaState,
  addArea,
  countTripsForArea,
  deleteArea,
  ensureAreas,
  ensureDealers,
  uniqueSorted,
  getFilterOptionsFromTrips,
  getLastUniqueFromTrips,
  findCanonicalFromList,
  getValuesWithLegacyEntry,
  getDealerSelectList,
  buildAreaOptionsHtml,
  buildDealerOptionsHtml
} = createTripSharedCollectionsEngine({
  getState: () => state,
  normalizeKey,
  normalizeTripRow,
  escapeHtml
});

// Backup meta (local-only; no user data duplication)
const LS_LAST_BACKUP_META = "btc_last_backup_meta_v1";
const LS_RESTORE_ROLLBACK_SNAPSHOT = "btc_restore_rollback_snapshot_v1";
let needsBootStateSave = false;

function markNeedsBootStateSave(){
  needsBootStateSave = true;
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

const {
  renderPageHeader,
  bindHeaderHelpButtons,
  renderTabBar
} = createAppShellBindings({
  escapeHtml,
  onHelpClick: (helpKey)=>{
    state.helpJump = helpKey;
    state.view = "help";
    saveState();
    render();
  },
  onTabNavigate: (next)=>{
    navigateTopLevelView(next);
  },
  hasUnsavedDraft: ()=>{
    const d = state?.draft || {};
    return !!(d.date || d.dealer || d.area || d.pounds || d.amount || d.rate);
  },
  confirmUnsavedLeave: ()=>openConfirmModal({
    title: "Leave this screen?",
    message: "Your unsaved trip entry may be lost.",
    confirmLabel: "Leave",
    cancelLabel: "Stay",
    confirmTone: "default"
  })
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

// Home + Reports badge (UI choice #2)


const openConfirmModal = createOpenConfirmModal({
  uid,
  openModal,
  closeModal,
  triggerHaptic
});


migrateLegacyStateIfNeeded(localStorage);
let state = migrateStateIfNeeded(rootStateSaveSeam.loadState(), {
  normalizeTrip,
  normalizeThemeMode,
  themeModeDefault: THEME_MODE_DARK
});
const themeRuntimeSeam = createThemeRuntimeSeam();
const applyThemeMode = ()=> themeRuntimeSeam.applyThemeMode(state);
applyThemeMode();
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

const tripsUnifiedFilterBridge = createTripsUnifiedFilterBridge({
  ensureUnifiedFilters,
  applyUnifiedTripFilter,
  resolveUnifiedRange,
  getTripsNewestFirst,
  resolveAreaValue
});

const { renderAllTrips } = createTripsBrowseScreenRenderer({
  getApp,
  getFilterOptionsFromTrips,
  escapeHtml,
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
  showToast,
  ...tripsUnifiedFilterBridge
});

const { renderHome } = createHomeDashboardRenderer({
  state,
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
  openQuickChipCustomizeModal,
  bindQuickChipLongPress,
  bindAreaChips,
  bindQuickChips,
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
