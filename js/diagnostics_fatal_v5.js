export function createDiagnosticsFatalSeam({
  displayBuildVersion,
  getSchemaVersion,
  getState,
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

  function getDebugInfo(){
    const state = getState();
    const appName = "Bank the Catch";
    const trips = Array.isArray(state?.trips) ? state.trips.length : 0;
    const areas = Array.isArray(state?.areas) ? state.areas.length : 0;
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

    return [
      `${appName} ${displayBuildVersion} (schema ${getSchemaVersion()})`,
      `Build: ${displayBuildVersion}`,
      view ? `View: ${view}` : "",
      locationRef.hash ? `Route: ${locationRef.hash}` : "",
      `DisplayMode: ${dm}`,
      `InstallMode: ${installMode}`,
      `StandaloneFlag: ${isStandalone ? "true" : "false"}`,
      `AppStarted: ${appStarted}`,
      bootStage ? `BootStage: ${bootStage}` : "",
      `ServiceWorker: ${swCtrl}`,
      swScript ? `SWScript: ${swScript}` : "",
      `LocalStorageChars: ${lsChars}`,
      `UserAgent: ${navigatorRef.userAgent}`,
      navigatorRef.platform ? `Platform: ${navigatorRef.platform}` : "",
      `Trips: ${trips}`,
      `Areas: ${areas}`,
      last ? `LastAction: ${last}` : "",
      lb ? `LastBackupAt: ${lb}` : "",
      (lbCount!=="") ? `LastBackupTripCount: ${lbCount}` : "",
      snooze ? `BackupSnoozeUntil: ${snooze}` : "",
      lastErrAt ? `LastErrorAt: ${lastErrAt}` : "",
      lastErr ? `LastError: ${lastErr}` : "",
      `Time: ${new Date().toISOString()}`
    ].filter(Boolean).join("\n");
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

    const isStandalone = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) || (windowRef.navigator && windowRef.navigator.standalone === true);
    const swCtrl = (navigatorRef.serviceWorker && navigatorRef.serviceWorker.controller) ? "yes" : "no";

    const dump = [
      `App: ${displayBuildVersion} (schema ${getSchemaVersion()})`,
      `URL: ${locationRef.href}`,
      `UA: ${navigatorRef.userAgent}`,
      `Standalone: ${isStandalone ? "yes" : "no"}`,
      `SW controller: ${swCtrl}`,
      "",
      errText
    ].join("\n");

    if(!appEl) return;

    appEl.innerHTML = `
      <div class="card">
        <b>App Error</b>
        <div class="sep"></div>
        <div class="muted small" style="white-space:pre-wrap">${escapeHtml(errText)}</div>

        <div class="row mt12 gap10 wrap">
          <button class="btn" id="fatalCopy">Copy diagnostics</button>
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
    if(btnCopy) btnCopy.onclick = ()=> { void copyTextWithFeedback(dump, "Diagnostics copied"); };

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
