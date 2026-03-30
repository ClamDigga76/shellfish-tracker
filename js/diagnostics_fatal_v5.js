export function createDiagnosticsFatalSeam({
  displayBuildVersion,
  getSchemaVersion,
  getState,
  getRuntimeSupportDiagnosticsText = null,
  copyTextWithFeedback,
  escapeHtml,
  documentRef = document,
  windowRef = window,
  navigatorRef = navigator,
  locationRef = location,
  localStorageRef = localStorage,
  cachesRef = caches
}){
  const LAST_ERROR_KEY = "shellfish-last-error";
  const LAST_ERROR_AT_KEY = "shellfish-last-error-at";
  const LEGACY_LAST_ERROR_KEY = "SHELLFISH_LAST_ERROR";
  const LEGACY_LAST_ERROR_AT_KEY = "SHELLFISH_LAST_ERROR_AT";

  function buildSupportBundle({ heading = "Bank the Catch Support Bundle", fatalErrorText = "" } = {}){
    const state = getState();
    const appName = "Bank the Catch";
    const trips = Array.isArray(state?.trips) ? state.trips.length : 0;
    const areas = Array.isArray(state?.areas) ? state.areas.length : 0;
    const deletedTrips = Array.isArray(state?.deletedTrips) ? state.deletedTrips.length : 0;
    const view = state?.view ? String(state.view) : "";
    const last = state?.lastAction ? String(state.lastAction) : "";
    const settings = state?.settings || {};

    const isStandalone = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) || (windowRef.navigator && windowRef.navigator.standalone === true);
    const dm = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) ? "standalone" : "browser";
    const swCtrl = (navigatorRef.serviceWorker && navigatorRef.serviceWorker.controller) ? "controlled" : "none";
    const swScript = (navigatorRef.serviceWorker && navigatorRef.serviceWorker.controller && navigatorRef.serviceWorker.controller.scriptURL) ? navigatorRef.serviceWorker.controller.scriptURL : "";
    const installMode = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches)
      ? "standalone"
      : (windowRef.navigator && windowRef.navigator.standalone === true ? "ios-standalone" : "browser-tab");
    const bootStage = windowRef.__BOOT_DIAG__?.stage ? String(windowRef.__BOOT_DIAG__.stage) : "";
    const appStarted = windowRef.__SHELLFISH_APP_STARTED ? "true" : "false";
    const route = `${locationRef.pathname || "/"}${locationRef.hash || ""}`;

    let lsChars = 0;
    try{
      for(const k of Object.keys(localStorageRef||{})){
        const v = localStorageRef.getItem(k)||"";
        lsChars += (k.length + v.length);
      }
    }catch{}

    let lastErr = "";
    let lastErrAt = "";
    try{ lastErr = localStorageRef.getItem(LAST_ERROR_KEY) || localStorageRef.getItem(LEGACY_LAST_ERROR_KEY)||""; }catch{}
    try{ lastErrAt = localStorageRef.getItem(LAST_ERROR_AT_KEY) || localStorageRef.getItem(LEGACY_LAST_ERROR_AT_KEY)||""; }catch{}

    const lb = settings.lastBackupAt ? new Date(settings.lastBackupAt).toISOString() : "";
    const lbCount = (settings.lastBackupTripCount ?? "");
    const snooze = settings.backupSnoozeUntil ? new Date(settings.backupSnoozeUntil).toISOString() : "";
    const generatedAt = new Date().toISOString();

    let rollbackSnapshotReady = false;
    let rollbackSnapshotMeta = null;
    try{
      const raw = localStorageRef.getItem("btc_restore_rollback_snapshot_v1") || "";
      if(raw){
        const parsed = JSON.parse(raw);
        const meta = parsed && typeof parsed === "object" ? (parsed.meta || {}) : {};
        rollbackSnapshotReady = true;
        rollbackSnapshotMeta = meta && typeof meta === "object" ? meta : null;
      }
    }catch{}

    const releaseSnapshot = windowRef.__SHELLFISH_LAST_RELEASE_SNAPSHOT__ && typeof windowRef.__SHELLFISH_LAST_RELEASE_SNAPSHOT__ === "object"
      ? windowRef.__SHELLFISH_LAST_RELEASE_SNAPSHOT__
      : null;
    const releaseSummary = releaseSnapshot?.summary && typeof releaseSnapshot.summary === "object" ? releaseSnapshot.summary : null;

    const lines = [];
    lines.push(heading);
    lines.push(`Generated: ${generatedAt}`);
    lines.push("Privacy: counts and runtime metadata only. No trip rows, names, notes, or location details.");
    lines.push("");
    lines.push("[App]");
    lines.push(`Name: ${appName}`);
    lines.push(`Build: ${displayBuildVersion}`);
    lines.push(`Schema: ${getSchemaVersion()}`);
    lines.push("");
    lines.push("[Startup]");
    lines.push(`AppStarted: ${appStarted}`);
    lines.push(`BootStage: ${bootStage || "(unknown)"}`);
    lines.push(`DisplayMode: ${dm}`);
    lines.push(`InstallMode: ${installMode}`);
    lines.push(`StandaloneFlag: ${isStandalone ? "true" : "false"}`);
    lines.push("");
    lines.push("[Runtime]");
    lines.push(`View: ${view || "(none)"}`);
    lines.push(`Route: ${route}`);
    lines.push(`LastAction: ${last || "(none)"}`);
    lines.push(`Time: ${generatedAt}`);
    lines.push("");
    lines.push("[Service Worker / Cache]");
    lines.push(`ServiceWorkerController: ${swCtrl}`);
    lines.push(`ServiceWorkerScript: ${swScript || "(none)"}`);
    lines.push("");
    lines.push("[Storage + Recovery]");
    lines.push(`TripsCount: ${trips}`);
    lines.push(`DeletedTripsCount: ${deletedTrips}`);
    lines.push(`AreasCount: ${areas}`);
    lines.push(`LocalStorageChars: ${lsChars}`);
    if(lb) lines.push(`LastBackupAt: ${lb}`);
    if(lbCount !== "") lines.push(`LastBackupTripCount: ${lbCount}`);
    if(snooze) lines.push(`BackupSnoozeUntil: ${snooze}`);
    if(lastErrAt) lines.push(`LastErrorAt: ${lastErrAt}`);
    if(lastErr) lines.push(`LastErrorSummary: ${lastErr}`);
    lines.push(`RollbackSnapshotReady: ${rollbackSnapshotReady ? "yes" : "no"}`);
    if(rollbackSnapshotMeta){
      const mode = String(rollbackSnapshotMeta.mode || "").toLowerCase() === "replace" ? "replace" : "merge";
      lines.push(`RollbackSnapshotMode: ${mode}`);
      if(Number.isFinite(Number(rollbackSnapshotMeta.tripCount))) lines.push(`RollbackSnapshotTripCount: ${Number(rollbackSnapshotMeta.tripCount)}`);
      if(Number.isFinite(Number(rollbackSnapshotMeta.areaCount))) lines.push(`RollbackSnapshotAreaCount: ${Number(rollbackSnapshotMeta.areaCount)}`);
      if(Number.isFinite(Number(rollbackSnapshotMeta.dealerCount))) lines.push(`RollbackSnapshotDealerCount: ${Number(rollbackSnapshotMeta.dealerCount)}`);
      if(rollbackSnapshotMeta.createdAt){
        const rollbackAt = new Date(rollbackSnapshotMeta.createdAt);
        if(!Number.isNaN(rollbackAt.getTime())) lines.push(`RollbackSnapshotAt: ${rollbackAt.toISOString()}`);
      }
    }

    if(releaseSummary){
      const passCount = Number(releaseSummary.updateAligned === true) + Number(releaseSummary.reopenReady === true) + Number(releaseSummary.recoveryReady !== true);
      lines.push(`ReleaseValidationRollup: ${passCount}/3 ready signals`);
      lines.push(`ReleaseValidationUpdateAligned: ${releaseSummary.updateAligned ? "yes" : "no"}`);
      lines.push(`ReleaseValidationReopenReady: ${releaseSummary.reopenReady ? "yes" : "no"}`);
      lines.push(`ReleaseValidationRecoverySignal: ${releaseSummary.recoveryReady ? "present" : "clear"}`);
    }
    lines.push("");
    lines.push("[Device]");
    lines.push(`UserAgent: ${navigatorRef.userAgent}`);
    if(navigatorRef.platform) lines.push(`Platform: ${navigatorRef.platform}`);

    if(fatalErrorText){
      lines.push("");
      lines.push("[Fatal Error]");
      lines.push(fatalErrorText);
    }

    try{
      const runtimeSupportBlock = (typeof getRuntimeSupportDiagnosticsText === "function")
        ? String(getRuntimeSupportDiagnosticsText() || "").trim()
        : "";
      if(runtimeSupportBlock){
        lines.push("");
        lines.push(...runtimeSupportBlock.split("\n"));
      }
    }catch(_){ }

    return lines.filter(Boolean).join("\n");
  }

  function getDebugInfo(){
    return buildSupportBundle();
  }

  function setBootError(msg){
    try{
      const bootPill = documentRef.getElementById("bootPill");
      if(!bootPill) return;
      bootPill.textContent = "ERROR";
      bootPill.title = String(msg || "Unknown error");
      bootPill.classList.add("err");
    }catch{}
  }

  function bindBootErrorHandlers(){
    windowRef.addEventListener("error", (e)=>{ if(windowRef.__SHELLFISH_APP_STARTED) return; setBootError(e?.message || e?.error || "Script error"); });
    windowRef.addEventListener("unhandledrejection", (e)=>{ if(windowRef.__SHELLFISH_APP_STARTED) return; setBootError(e?.reason || "Unhandled rejection"); });
  }

  function showFatal(err){
    if(windowRef.__SHELLFISH_FATAL_SHOWN) return;
    windowRef.__SHELLFISH_FATAL_SHOWN = true;
    try{
      const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err || "Fatal error");
      localStorageRef.setItem(LAST_ERROR_KEY, msg);
      localStorageRef.setItem(LAST_ERROR_AT_KEY, new Date().toISOString());
      localStorageRef.setItem(LEGACY_LAST_ERROR_KEY, msg);
      localStorageRef.setItem(LEGACY_LAST_ERROR_AT_KEY, new Date().toISOString());
    }catch(_){ }

    const appEl = documentRef.getElementById("app");
    const pill = documentRef.getElementById("bootPill");

    const errText = String(err && (err.stack || err.message || err) || "Unknown error");

    if(pill){
      pill.textContent = "ERROR";
      pill.classList.add("err");
      pill.title = errText;
    }

    const dump = buildSupportBundle({
      heading: "Bank the Catch Fatal Support Bundle",
      fatalErrorText: errText
    });

    if(!appEl) return;

    appEl.innerHTML = `
      <div class="card">
        <b>App Error</b>
        <div class="sep"></div>
        <div class="muted small" style="white-space:pre-wrap">${escapeHtml(errText)}</div>

        <div class="row mt12 gap10 wrap">
          <button class="btn" id="fatalCopy">Copy support bundle</button>
          <button class="btn good" id="fatalReload">Reload</button>
          <button class="btn" id="fatalResetCache">Reset cache</button>
        </div>

        <div class="muted small" style="margin-top:10px;line-height:1.35">
          If this keeps happening on iPhone/iPad: try <b>Reset cache</b>, then reload. Installed PWA updates can be delayed by cached files.
        </div>
      </div>
    `;

    const safeAsync = (fn)=>{ try{ fn(); }catch(_){} };

    const resetCache = async ()=>{
      try{
        if("serviceWorker" in navigatorRef){
          const regs = await navigatorRef.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r=>r.unregister()));
        }
        if("caches" in windowRef){
          const keys = await cachesRef.keys();
          await Promise.all(keys.map(k=>cachesRef.delete(k)));
        }
      }catch(_){ }
      locationRef.reload();
    };

    const btnCopy = documentRef.getElementById("fatalCopy");
    if(btnCopy) btnCopy.onclick = ()=> { void copyTextWithFeedback(dump, "Support bundle copied"); };

    const btnReload = documentRef.getElementById("fatalReload");
    if(btnReload) btnReload.onclick = ()=> locationRef.reload();

    const btnResetCache = documentRef.getElementById("fatalResetCache");
    if(btnResetCache) btnResetCache.onclick = ()=> safeAsync(()=> resetCache());
  }

  function bindFatalHandlers(){
    windowRef.addEventListener("error", (e)=> showFatal(e?.error || e?.message || e));
    windowRef.addEventListener("unhandledrejection", (e)=> showFatal(e?.reason || e));
  }

  return {
    getDebugInfo,
    setBootError,
    showFatal,
    bindBootErrorHandlers,
    bindFatalHandlers
  };
}
