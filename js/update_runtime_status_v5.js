import { buildRequiredCoreCachePaths } from "./startup_asset_manifest_v5.js";

export function createUpdateRuntimeStatusSeam({
  displayBuildVersion,
  getIsSettingsView,
  getSchemaVersion,
  documentRef = document,
  windowRef = window,
  navigatorRef = navigator,
  locationRef = location,
  cachesRef = caches
}){
  let swUpdateReady = false;
  let lastSwUpdateSignal = "";
  let lastSwRegistrationSignal = "";
  let lastRuntimeVersionDiagnostics = null;
  let lastReleaseValidationSnapshot = null;

  const UPDATE_SIGNAL_SESSION_KEY = "shellfish-update-signal-v1";
  const UPDATE_SIGNAL_AT_SESSION_KEY = "shellfish-update-signal-at-v1";
  const REGISTRATION_SIGNAL_SESSION_KEY = "shellfish-registration-signal-v1";
  const REGISTRATION_SIGNAL_AT_SESSION_KEY = "shellfish-registration-signal-at-v1";
  const UPDATE_ATTEMPT_SESSION_KEY = "shellfish-update-attempt-v1";
  const LAST_GOOD_RUNTIME_KEY = String(windowRef.__SHELLFISH_LAST_GOOD_RUNTIME_KEY__ || "shellfish-last-good-runtime-v1");
  const PENDING_CONTROL_GRACE_MS = 90 * 1000;

  function getLastGoodRuntimeConfirmation(){
    try{
      const raw = localStorage.getItem(LAST_GOOD_RUNTIME_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== "object") return null;
      const confirmedAt = new Date(parsed.confirmedAt || "");
      const confirmedIso = Number.isNaN(confirmedAt.getTime()) ? "" : confirmedAt.toISOString();
      return {
        buildVersion: String(parsed.buildVersion || ""),
        confirmedAt: confirmedIso,
        mode: parsed.mode === "installed-standalone" ? "installed-standalone" : "browser",
        swControllerPresent: parsed.swControllerPresent === true
      };
    }catch(_){
      return null;
    }
  }

  function getStoredUpdateAttempt(){
    try{
      const raw = sessionStorage.getItem(UPDATE_ATTEMPT_SESSION_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== "object") return null;
      const at = Number(parsed.at || 0);
      if(!Number.isFinite(at) || at <= 0) return null;
      // Keep this short-lived: this is only for immediate "did reload help?" trust messaging.
      if((Date.now() - at) > 10 * 60 * 1000) return null;
      return {
        at,
        mode: String(parsed.mode || ""),
        requestedBuild: String(parsed.requestedBuild || "")
      };
    }catch(_){
      return null;
    }
  }

  function noteUpdateAttempt(mode){
    try{
      const payload = {
        at: Date.now(),
        mode: String(mode || "reload"),
        requestedBuild: String(displayBuildVersion || "")
      };
      sessionStorage.setItem(UPDATE_ATTEMPT_SESSION_KEY, JSON.stringify(payload));
    }catch(_){ }
  }

  function setLastSwUpdateSignal(value){
    lastSwUpdateSignal = String(value || "");
    const at = Date.now();
    try{
      sessionStorage.setItem(UPDATE_SIGNAL_SESSION_KEY, lastSwUpdateSignal);
      sessionStorage.setItem(UPDATE_SIGNAL_AT_SESSION_KEY, String(at));
    }catch(_){ }
  }

  function setLastSwRegistrationSignal(value){
    lastSwRegistrationSignal = String(value || "");
    const at = Date.now();
    try{
      sessionStorage.setItem(REGISTRATION_SIGNAL_SESSION_KEY, lastSwRegistrationSignal);
      sessionStorage.setItem(REGISTRATION_SIGNAL_AT_SESSION_KEY, String(at));
    }catch(_){ }
  }

  function getStoredSignalTimestamp(key){
    try{
      const raw = Number(sessionStorage.getItem(key) || 0);
      return Number.isFinite(raw) && raw > 0 ? raw : 0;
    }catch(_){
      return 0;
    }
  }

  try{
    lastSwUpdateSignal = String(sessionStorage.getItem(UPDATE_SIGNAL_SESSION_KEY) || "");
  }catch(_){ }
  try{
    lastSwRegistrationSignal = String(sessionStorage.getItem(REGISTRATION_SIGNAL_SESSION_KEY) || "");
  }catch(_){ }

  try{
    windowRef.addEventListener("sw-update-state", (ev)=>{
      const state = String(ev?.detail?.state || "");
      if(!state) return;
      setLastSwUpdateSignal(state);
      if(getIsSettingsView()){
        try{ updateUpdateRow(); }catch(_){ }
      }
    });
  }catch(_){ }
  try{
    windowRef.addEventListener("sw-registration-state", (ev)=>{
      const state = String(ev?.detail?.state || "");
      if(!state) return;
      setLastSwRegistrationSignal(state);
      if(getIsSettingsView()){
        try{ updateUpdateRow(); }catch(_){ }
      }
    });
  }catch(_){ }

  function getIsStandalone(){
    return Boolean(
      (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) ||
      (navigatorRef.standalone === true)
    );
  }

  function markSwUpdateReady(){
    swUpdateReady = true;
    try {
      if (getIsSettingsView()) updateUpdateRow();
    } catch (_) {}
  }

  async function swCheckNow(options = {}){
    const { hardReset = false } = options;
    const statusEl = documentRef.getElementById("updateBigStatus");
    const btnCheck = documentRef.getElementById("updatePrimary");
    const btnSummary = documentRef.getElementById("settingsUpdateSummaryAction");
    try{
      if(statusEl) statusEl.textContent = hardReset ? "Resetting cache & reloading…" : (swUpdateReady ? "Reloading latest build…" : "Checking latest build…");
      if(btnCheck) btnCheck.disabled = true;
      if(btnSummary){
        btnSummary.disabled = true;
        btnSummary.textContent = "Checking";
      }
      await forceRefreshApp({ hardReset });
    }catch(_){
      try{
        if(statusEl) statusEl.textContent = hardReset ? "Resetting cache & reloading…" : "Reloading latest build…";
        await forceRefreshApp({ hardReset: true });
      }catch(__){}
    }finally{
      if(btnCheck) btnCheck.disabled = false;
      try{ updateBuildInfo(); }catch(_){ }
    }
  }

  async function forceRefreshApp(options = {}){
    const { hardReset = false } = options;
    noteUpdateAttempt(hardReset ? "hard-reset" : "reload");
    try{
      if("serviceWorker" in navigatorRef){
        const regs = await navigatorRef.serviceWorker.getRegistrations();
        if(swUpdateReady && !hardReset){
          await Promise.all(regs.map(async (reg)=>{
            try{
              await reg.update();
              if(reg.waiting){
                reg.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            }catch(_){ }
          }));
        }else if(hardReset){
          await Promise.all(regs.map(r=>r.unregister()));
        }else{
          await Promise.all(regs.map(r=>r.update?.()));
        }
      }
      if(hardReset && windowRef.caches && cachesRef.keys){
        const keys = await cachesRef.keys();
        await Promise.all(keys.map(k=>cachesRef.delete(k)));
      }
    }catch(_){ }
    locationRef.reload();
  }

  function parseBuildDigits(value){
    const match = String(value || "").match(/(\d+)$/);
    return match ? match[1] : "";
  }

  function formatLedgerStamp(dateValue){
    const d = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
    if(Number.isNaN(d.getTime())) return "";
    const pad = (n)=>String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  }

  async function getRuntimeVersionDiagnostics(){
    const buildDigits = parseBuildDigits(displayBuildVersion);
    const details = {
      buildDigits,
      standalone: getIsStandalone(),
      swController: false,
      swScriptVersion: "",
      swWaitingVersion: "",
      cacheVersions: [],
      startupModuleVersions: [],
      lastBootError: "",
      swRegistrationAttempted: false,
      swRegistrationStarted: false,
      swRegistrationConfirmed: false,
      swRegistrationScope: "",
      swRegistrationError: "",
      requiredCoreCacheExpectedCount: 0,
      requiredCoreCacheFoundCount: 0,
      requiredCoreCacheMissing: [],
      requiredCoreCacheIncomplete: false
    };

    try{
      if("serviceWorker" in navigatorRef){
        const reg = await navigatorRef.serviceWorker.getRegistration();
        details.swController = !!navigatorRef.serviceWorker.controller;
        const swUrl = reg?.active?.scriptURL || reg?.installing?.scriptURL || "";
        const swMatch = swUrl.match(/[?&]v=(\d+)/);
        details.swScriptVersion = swMatch ? swMatch[1] : "";
        const waitingUrl = reg?.waiting?.scriptURL || "";
        const waitingMatch = waitingUrl.match(/[?&]v=(\d+)/);
        details.swWaitingVersion = waitingMatch ? waitingMatch[1] : "";
      }
    }catch(_){ }

    try{
      if(windowRef.caches && cachesRef.keys){
        const keys = await cachesRef.keys();
        details.cacheVersions = keys
          .filter(k=>String(k).startsWith("shellfish-tracker-"))
          .map(k=>{
            const m = String(k).match(/-v(\d+)$/);
            return m ? m[1] : "";
          })
          .filter(Boolean);
      }
    }catch(_){ }

    try{
      if(windowRef.caches && cachesRef.keys && cachesRef.open){
        const requiredCorePaths = buildRequiredCoreCachePaths(buildDigits);
        details.requiredCoreCacheExpectedCount = requiredCorePaths.length;
        const expectedCacheName = buildDigits ? `shellfish-tracker-v${buildDigits}` : "";
        const keys = await cachesRef.keys();
        const cacheName = keys.find((k)=>expectedCacheName && String(k) === expectedCacheName) || "";
        if(cacheName){
          const cache = await cachesRef.open(cacheName);
          const missing = [];
          let found = 0;
          for(const path of requiredCorePaths){
            let hit = await cache.match(path);
            if(!hit){
              try{
                hit = await cache.match(new URL(path, locationRef.href).href);
              }catch(_){ }
            }
            if(hit){
              found += 1;
            }else{
              missing.push(path);
            }
          }
          details.requiredCoreCacheFoundCount = found;
          details.requiredCoreCacheMissing = missing;
          details.requiredCoreCacheIncomplete = missing.length > 0;
        }else if(requiredCorePaths.length){
          details.requiredCoreCacheMissing = [...requiredCorePaths];
          details.requiredCoreCacheIncomplete = true;
        }
      }
    }catch(_){ }

    try{
      const startupModules = Array.isArray(windowRef.__SHELLFISH_STARTUP_IMPORTS__)
        ? windowRef.__SHELLFISH_STARTUP_IMPORTS__
        : [];
      details.startupModuleVersions = startupModules
        .map(url=>{
          const match = String(url || "").match(/[?&]v=(\d+)/);
          return match ? match[1] : "";
        })
        .filter(Boolean);
    }catch(_){ }

    try{
      details.lastBootError = String(windowRef.__BOOT_DIAG__?.lastBootError?.message || "");
    }catch(_){ }
    try{
      const swRegistrationDiag = windowRef.__BOOT_DIAG__?.swRegistration || {};
      details.swRegistrationAttempted = swRegistrationDiag.attempted === true;
      details.swRegistrationConfirmed = swRegistrationDiag.registered === true;
      details.swRegistrationScope = String(swRegistrationDiag.scope || "");
      details.swRegistrationError = String(swRegistrationDiag.lastError || "");
    }catch(_){ }

    details.hasExplicitVersionMismatch = Boolean(
      (details.swScriptVersion && buildDigits && details.swScriptVersion !== buildDigits) ||
      details.cacheVersions.some(v=>buildDigits && v !== buildDigits) ||
      details.startupModuleVersions.some(v=>buildDigits && v !== buildDigits)
    );
    details.hasBootCorruptionSignal = /reset cache|stale required asset|wrong required asset|unexpected js payload|corrupted js response|empty js response|incomplete js response/i.test(details.lastBootError);
    details.requiredCoreCacheIncompleteAfterControl = Boolean(details.requiredCoreCacheIncomplete && details.swController);
    const now = Date.now();
    const recentAttempt = getStoredUpdateAttempt();
    const updateSignalAt = getStoredSignalTimestamp(UPDATE_SIGNAL_AT_SESSION_KEY);
    const registrationSignalAt = getStoredSignalTimestamp(REGISTRATION_SIGNAL_AT_SESSION_KEY);
    const hasTargetWaitingWorker = Boolean(details.swWaitingVersion && details.buildDigits && details.swWaitingVersion === details.buildDigits);
    const hasTargetActiveWorker = Boolean(details.swScriptVersion && details.buildDigits && details.swScriptVersion === details.buildDigits);
    const hasMeaningfulUpdateSignal = ["ready", "applying", "controller-changed"].includes(String(lastSwUpdateSignal || ""));
    const hasMeaningfulRegistrationSignal = ["registered", "attempted", "error"].includes(String(lastSwRegistrationSignal || ""));
    const hasRegistrationStartSignal = ["registered", "attempted", "error"].includes(String(lastSwRegistrationSignal || ""));
    details.swRegistrationStarted = Boolean(
      details.swRegistrationAttempted ||
      details.swRegistrationConfirmed ||
      !!details.swRegistrationError ||
      hasRegistrationStartSignal
    );
    details.swRegistrationUnconfirmed = Boolean(details.swRegistrationStarted && !details.swRegistrationConfirmed);
    details.swControlUnconfirmed = Boolean(details.swRegistrationStarted && !details.swController);
    details.hasVersionSkew = details.hasExplicitVersionMismatch;
    details.installedAppLikelyLagging = Boolean(
      details.standalone && (
        details.swControlUnconfirmed ||
        details.swRegistrationUnconfirmed ||
        (details.swScriptVersion && buildDigits && details.swScriptVersion !== buildDigits) ||
        (details.swWaitingVersion && buildDigits && details.swWaitingVersion !== buildDigits)
      )
    );
    const hasRecentLifecycleSignal = Boolean(
      (hasMeaningfulUpdateSignal && updateSignalAt > 0 && (now - updateSignalAt) <= PENDING_CONTROL_GRACE_MS) ||
      (hasMeaningfulRegistrationSignal && registrationSignalAt > 0 && (now - registrationSignalAt) <= PENDING_CONTROL_GRACE_MS)
    );
    const hasRecentReloadOrUpdateAttempt = Boolean(recentAttempt && (now - recentAttempt.at) <= PENDING_CONTROL_GRACE_MS);
    const hasGroundedPendingProgress = Boolean(
      hasTargetWaitingWorker ||
      hasTargetActiveWorker ||
      hasRecentLifecycleSignal ||
      hasRecentReloadOrUpdateAttempt
    );
    details.requiredCoreCachePendingControl = Boolean(
      details.requiredCoreCacheIncomplete &&
      !details.swController &&
      details.swRegistrationStarted &&
      !details.hasExplicitVersionMismatch &&
      !details.swRegistrationError &&
      !details.hasBootCorruptionSignal &&
      hasGroundedPendingProgress
    );
    details.requiredCoreCachePreRegistration = Boolean(
      details.requiredCoreCacheIncomplete &&
      !details.swController &&
      !details.swRegistrationStarted &&
      !details.hasExplicitVersionMismatch &&
      !details.swRegistrationError &&
      !details.hasBootCorruptionSignal
    );
    details.requiredCoreCachePostRegistrationUnresolved = Boolean(
      details.requiredCoreCacheIncomplete &&
      !details.swController &&
      details.swRegistrationStarted &&
      !details.requiredCoreCachePendingControl &&
      !details.hasExplicitVersionMismatch &&
      !details.swRegistrationError &&
      !details.hasBootCorruptionSignal
    );
    details.needsHardReset = Boolean(
      details.hasExplicitVersionMismatch ||
      details.requiredCoreCacheIncompleteAfterControl ||
      details.requiredCoreCachePostRegistrationUnresolved ||
      details.swRegistrationError ||
      details.hasBootCorruptionSignal
    );

    try{
      lastRuntimeVersionDiagnostics = {
        ...details,
        cacheVersions: Array.isArray(details.cacheVersions) ? [...details.cacheVersions] : [],
        startupModuleVersions: Array.isArray(details.startupModuleVersions) ? [...details.startupModuleVersions] : []
      };
    }catch(_){ }

    return details;
  }

  function getSupportDiagnosticsSnapshot(){
    const runtimeDiag = lastRuntimeVersionDiagnostics
      ? {
        ...lastRuntimeVersionDiagnostics,
        cacheVersions: Array.isArray(lastRuntimeVersionDiagnostics.cacheVersions) ? [...lastRuntimeVersionDiagnostics.cacheVersions] : [],
        startupModuleVersions: Array.isArray(lastRuntimeVersionDiagnostics.startupModuleVersions) ? [...lastRuntimeVersionDiagnostics.startupModuleVersions] : []
      }
      : null;
    const recentAttempt = getStoredUpdateAttempt();
    const releaseSnapshot = lastReleaseValidationSnapshot && typeof lastReleaseValidationSnapshot === "object"
      ? {
        at: String(lastReleaseValidationSnapshot.at || ""),
        buildVersion: String(lastReleaseValidationSnapshot.buildVersion || ""),
        summary: { ...(lastReleaseValidationSnapshot.summary || {}) }
      }
      : null;
    return {
      capturedAt: new Date().toISOString(),
      buildVersion: String(displayBuildVersion || ""),
      schemaVersion: String(getSchemaVersion() || ""),
      swUpdateReady,
      lastSwUpdateSignal: String(lastSwUpdateSignal || ""),
      recentUpdateAttempt: recentAttempt ? { ...recentAttempt } : null,
      lastGoodRuntime: getLastGoodRuntimeConfirmation(),
      runtimeDiag,
      releaseSnapshot
    };
  }

  function formatSupportDiagnosticsSection(snapshot = getSupportDiagnosticsSnapshot()){
    const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
    const runtimeDiag = snap.runtimeDiag && typeof snap.runtimeDiag === "object" ? snap.runtimeDiag : {};
    const releaseSummary = snap.releaseSnapshot?.summary || {};
    const cacheVersions = Array.isArray(runtimeDiag.cacheVersions) ? [...new Set(runtimeDiag.cacheVersions)] : [];
    const startupVersions = Array.isArray(runtimeDiag.startupModuleVersions) ? [...new Set(runtimeDiag.startupModuleVersions)] : [];
    const lines = [];

    lines.push("[Support Bundle: Runtime + Update]");
    lines.push(`BuildTarget: ${String(snap.buildVersion || displayBuildVersion || "(unknown)")}`);
    lines.push(`Schema: ${String(snap.schemaVersion || getSchemaVersion() || "(unknown)")}`);
    lines.push(`SupportSnapshotAt: ${String(snap.capturedAt || new Date().toISOString())}`);
    lines.push(`UpdateReadySignal: ${snap.swUpdateReady ? "yes" : "no"}`);
    lines.push(`LastUpdateSignal: ${String(snap.lastSwUpdateSignal || "(none)")}`);
    if(snap.recentUpdateAttempt){
      lines.push(`RecentUpdateAttempt: ${String(snap.recentUpdateAttempt.mode || "reload")} @ ${formatLedgerStamp(snap.recentUpdateAttempt.at) || "(unknown)"}`);
      if(snap.recentUpdateAttempt.requestedBuild){
        lines.push(`RecentAttemptBuild: ${String(snap.recentUpdateAttempt.requestedBuild)}`);
      }
    }
    if(snap.lastGoodRuntime){
      lines.push(`LastGoodRuntime: ${String(snap.lastGoodRuntime.buildVersion || "(unknown)")} @ ${formatLedgerStamp(snap.lastGoodRuntime.confirmedAt) || "(unknown)"}`);
      lines.push(`LastGoodRuntimeMode: ${snap.lastGoodRuntime.mode === "installed-standalone" ? "installed-standalone" : "browser"}`);
      lines.push(`LastGoodRuntimeSWController: ${snap.lastGoodRuntime.swControllerPresent ? "yes" : "no"}`);
    }else{
      lines.push("LastGoodRuntime: not recorded yet on this device");
    }

    if(runtimeDiag && Object.keys(runtimeDiag).length){
      lines.push(`RuntimeMode: ${runtimeDiag.standalone ? "installed-standalone" : "browser-tab"}`);
      lines.push(`SWController: ${runtimeDiag.swController ? "yes" : "no"}`);
      lines.push(`SWScriptVersion: ${runtimeDiag.swScriptVersion ? `v${runtimeDiag.swScriptVersion}` : "(none)"}`);
      lines.push(`SWWaitingVersion: ${runtimeDiag.swWaitingVersion ? `v${runtimeDiag.swWaitingVersion}` : "(none)"}`);
      lines.push(`CacheVersions: ${cacheVersions.length ? cacheVersions.map(v=>`v${v}`).join(", ") : "(none)"}`);
      lines.push(`StartupModuleVersions: ${startupVersions.length ? startupVersions.map(v=>`v${v}`).join(", ") : "(none)"}`);
      lines.push(`VersionSkewDetected: ${runtimeDiag.hasVersionSkew ? "yes" : "no"}`);
      lines.push(`ExplicitVersionMismatch: ${runtimeDiag.hasExplicitVersionMismatch ? "yes" : "no"}`);
      lines.push(`SWControlUnconfirmed: ${runtimeDiag.swControlUnconfirmed ? "yes" : "no"}`);
      lines.push(`SWRegistrationConfirmed: ${runtimeDiag.swRegistrationConfirmed ? "yes" : "no"}`);
      lines.push(`InstalledAppLikelyLagging: ${runtimeDiag.installedAppLikelyLagging ? "yes" : "no"}`);
      lines.push(`RequiredCoreCacheExpected: ${Number(runtimeDiag.requiredCoreCacheExpectedCount || 0)}`);
      lines.push(`RequiredCoreCacheFound: ${Number(runtimeDiag.requiredCoreCacheFoundCount || 0)}`);
      lines.push(`RequiredCoreCacheIncomplete: ${runtimeDiag.requiredCoreCacheIncomplete ? "yes" : "no"}`);
      lines.push(`RequiredCoreCachePendingControl: ${runtimeDiag.requiredCoreCachePendingControl ? "yes" : "no"}`);
      lines.push(`RequiredCoreCacheAfterControl: ${runtimeDiag.requiredCoreCacheIncompleteAfterControl ? "yes" : "no"}`);
      if(Array.isArray(runtimeDiag.requiredCoreCacheMissing) && runtimeDiag.requiredCoreCacheMissing.length){
        lines.push(`RequiredCoreCacheMissing: ${runtimeDiag.requiredCoreCacheMissing.join(", ")}`);
      }
      lines.push(`HardResetSuggested: ${runtimeDiag.needsHardReset ? "yes" : "no"}`);
      lines.push(`RecoveryReadiness: ${runtimeDiag.needsHardReset || runtimeDiag.lastBootError ? "attention-needed" : (runtimeDiag.requiredCoreCachePendingControl ? "pending-control" : "ready")}`);
      if(runtimeDiag.lastBootError) lines.push(`LastBootWarning: ${String(runtimeDiag.lastBootError)}`);
      if(runtimeDiag.swRegistrationError) lines.push(`SWRegistrationWarning: ${String(runtimeDiag.swRegistrationError)}`);
    }else{
      lines.push("RuntimeDiagnostics: not captured yet in this session");
    }

    if(snap.releaseSnapshot){
      const readySignals = Number(releaseSummary.updateAligned === true) + Number(releaseSummary.reopenReady === true) + Number(releaseSummary.recoveryReady !== true);
      lines.push(`ReleaseSnapshotAt: ${formatLedgerStamp(snap.releaseSnapshot.at) || "(unknown)"}`);
      if(snap.releaseSnapshot.buildVersion){
        lines.push(`ReleaseSnapshotBuild: ${String(snap.releaseSnapshot.buildVersion)}`);
      }
      lines.push(`ReleaseValidationRollup: ${readySignals}/3 ready signals`);
      lines.push(`ReleaseUpdateAligned: ${releaseSummary.updateAligned ? "yes" : "no"}`);
      lines.push(`ReleaseReopenReady: ${releaseSummary.reopenReady ? "yes" : "no"}`);
      lines.push(`ReleaseRecoverySignal: ${releaseSummary.recoveryReady ? "present" : "clear"}`);
    }else{
      lines.push("ReleaseSnapshot: not captured yet in this session");
    }

    return lines.join("\n");
  }

  async function updateBuildInfo(){
    const detailsEl = documentRef.getElementById("buildInfoDetails");
    const versionEl = documentRef.getElementById("updateVersionLine");

    try{
      if(versionEl){
        const standalone = getIsStandalone();
        versionEl.textContent = `Version ${displayBuildVersion}${standalone ? " • Installed app" : " • Browser"}`;
      }
    }catch(_){
      try{ if(versionEl) versionEl.textContent = `Version ${displayBuildVersion}`; }catch(__){}
    }

    if(!detailsEl) return;

    const parts = [];
    parts.push(`App: ${displayBuildVersion} (schema ${getSchemaVersion()})`);

    const standalone = getIsStandalone();
    parts.push(`Standalone: ${standalone ? "yes" : "no"}`);

    const runtimeDiag = await getRuntimeVersionDiagnostics();

    let swLine = "SW: unsupported";
    try{
      if("serviceWorker" in navigatorRef){
        const reg = await navigatorRef.serviceWorker.getRegistration();
        const ctrl = runtimeDiag.swController;
        const url = reg?.active?.scriptURL || reg?.installing?.scriptURL || "";
        swLine = `SW: ${ctrl ? "controller" : "no-controller"}${url ? " | " + url.split("/").slice(-1)[0] : ""}`;
        if(reg?.waiting){
          swLine += ` | waiting ${runtimeDiag.swWaitingVersion ? `v${runtimeDiag.swWaitingVersion}` : "build"}`;
        }
      }
    }catch(_){ }
    parts.push(swLine);

    try{
      if(windowRef.caches && cachesRef.keys){
        const keys = await cachesRef.keys();
        const ours = keys.filter(k=>String(k).startsWith("shellfish-tracker-"));
        const currentCache = ours.find(k=>String(k).endsWith(`-v${runtimeDiag.buildDigits}`)) || "";
        const legacyCaches = ours.filter(k=>k !== currentCache);
        parts.push(`App cache: ${currentCache ? `v${parseBuildDigits(currentCache)}` : (ours.length ? "detected" : "(none)")}`);
        if(legacyCaches.length){
          parts.push(`Legacy caches detected: ${legacyCaches.map(k=>`v${parseBuildDigits(k)}`).filter(Boolean).join(", ")}`);
        }
        if(ours.length){
          parts.push(`Cache keys (internal): ${ours.join(", ")}`);
        }
      }
    }catch(_){ }

    if(runtimeDiag.startupModuleVersions.length){
      const uniqueStartupVersions = [...new Set(runtimeDiag.startupModuleVersions)];
      parts.push(`Startup modules: ${uniqueStartupVersions.map(v=>`v${v}`).join(", ")}`);
    }

    if(runtimeDiag.hasVersionSkew){
      const warningParts = [];
      if(runtimeDiag.swScriptVersion && runtimeDiag.buildDigits && runtimeDiag.swScriptVersion !== runtimeDiag.buildDigits){
        warningParts.push(`SW script v${runtimeDiag.swScriptVersion}`);
      }
      const cacheMismatchVersions = [...new Set(runtimeDiag.cacheVersions.filter(v=>runtimeDiag.buildDigits && v !== runtimeDiag.buildDigits))];
      if(cacheMismatchVersions.length){
        warningParts.push(`app cache ${cacheMismatchVersions.map(v=>`v${v}`).join(", ")}`);
      }
      const startupMismatchVersions = [...new Set(runtimeDiag.startupModuleVersions.filter(v=>runtimeDiag.buildDigits && v !== runtimeDiag.buildDigits))];
      if(startupMismatchVersions.length){
        warningParts.push(`startup modules ${startupMismatchVersions.map(v=>`v${v}`).join(", ")}`);
      }
      parts.push(`Version check: warning${warningParts.length ? " • " + warningParts.join(" • ") : ""}`);
    }else if(runtimeDiag.buildDigits){
      parts.push(`Version check: aligned to v${runtimeDiag.buildDigits}`);
    }

    if(runtimeDiag.requiredCoreCacheExpectedCount){
      parts.push(
        runtimeDiag.requiredCoreCacheIncomplete
          ? `Required core cache: incomplete (${runtimeDiag.requiredCoreCacheFoundCount}/${runtimeDiag.requiredCoreCacheExpectedCount})`
          : `Required core cache: complete (${runtimeDiag.requiredCoreCacheFoundCount}/${runtimeDiag.requiredCoreCacheExpectedCount})`
      );
      if(runtimeDiag.requiredCoreCacheIncomplete && runtimeDiag.requiredCoreCacheMissing.length){
        parts.push(`Missing required assets: ${runtimeDiag.requiredCoreCacheMissing.join(", ")}`);
      }
    }

    if(runtimeDiag.swControlUnconfirmed && !runtimeDiag.hasExplicitVersionMismatch){
      parts.push("Service worker note: registration progress is present, but this tab is not controlled yet.");
    }
    if(runtimeDiag.swRegistrationUnconfirmed && !runtimeDiag.hasExplicitVersionMismatch){
      if(runtimeDiag.swRegistrationStarted){
        parts.push("Service worker note: registration started on this device, but confirmation is still pending.");
      }else{
        parts.push("Service worker note: registration has not started yet in this tab; this can be normal on first open.");
      }
    }
    if(runtimeDiag.requiredCoreCachePreRegistration){
      parts.push("Recovery note: required core cache is incomplete before service worker registration starts; let startup finish, then re-check.");
    }else if(runtimeDiag.requiredCoreCachePostRegistrationUnresolved){
      parts.push("Service worker note: registration is not confirmed yet on this device.");
    }
    if(runtimeDiag.installedAppLikelyLagging){
      parts.push("Installed app note: this Home Screen copy may be behind browser mode. Reopen it after loading the latest build.");
    }
    if(runtimeDiag.needsHardReset){
      parts.push("Recovery note: if Reload latest build does not clear this, use Reset cache & reload for a clean runtime copy.");
    }else if(runtimeDiag.requiredCoreCachePendingControl){
      parts.push("Recovery note: required core cache is briefly pending while service worker lifecycle progress is in flight.");
    }
    if(runtimeDiag.lastBootError){
      parts.push(`Last boot warning: ${runtimeDiag.lastBootError}`);
    }

    try{
      if(navigatorRef.storage && navigatorRef.storage.estimate){
        const est = await navigatorRef.storage.estimate();
        if(est && typeof est.usage==="number" && typeof est.quota==="number"){
          const mb = (n)=>Math.round((n/1024/1024)*10)/10;
          parts.push(`Storage: ${mb(est.usage)}MB / ${mb(est.quota)}MB`);
        }
      }
    }catch(_){ }

    detailsEl.textContent = parts.join("\n");
  }

  async function updateUpdateRow(){
    const statusEl = documentRef.getElementById("updateBigStatus");
    const btnPrimary = documentRef.getElementById("updatePrimary");
    const btnSummary = documentRef.getElementById("settingsUpdateSummaryAction");
    const inlineMsg = documentRef.getElementById("updateInlineMsg");
    const applyUpdateAction = ({ primaryLabel, summaryLabel, disabled = false, action, statusText, inlineText })=>{
      if(statusEl && statusText){
        statusEl.textContent = statusText;
      }
      if(btnPrimary){
        btnPrimary.textContent = primaryLabel;
        btnPrimary.disabled = disabled;
        btnPrimary.onclick = typeof action === "function" ? action : null;
      }
      if(btnSummary){
        btnSummary.textContent = summaryLabel;
        btnSummary.disabled = disabled;
        btnSummary.onclick = typeof action === "function" ? action : null;
        btnSummary.title = primaryLabel;
      }
      if(inlineMsg){
        inlineMsg.textContent = inlineText || "";
      }
    };
    if(!statusEl || (!btnPrimary && !btnSummary)) return;

    if(inlineMsg){
      inlineMsg.style.display = "block";
      inlineMsg.textContent = "";
    }

    if(!btnPrimary && btnSummary){
      // Guardrail: keep closed-row action inert if runtime update action binding is unavailable.
      btnSummary.textContent = "Check";
      btnSummary.disabled = true;
      btnSummary.title = "Update action unavailable";
    }

    let runtimeDiag = null;
    try{
      runtimeDiag = await getRuntimeVersionDiagnostics();
    }catch(_){ }

    if(swUpdateReady){
      applyUpdateAction({
        statusText: "Latest build ready on this device",
        primaryLabel: "Reload latest build",
        summaryLabel: "Apply",
        action: async ()=>{ await swCheckNow(); },
        inlineText: "Latest build is ready to apply on this device."
      });
      return;
    }

    if(runtimeDiag?.needsHardReset){
      applyUpdateAction({
        statusText: "Could not confirm latest build on this device",
        primaryLabel: "Reset cache & reload",
        summaryLabel: "Reset",
        action: async ()=>{ await swCheckNow({ hardReset: true }); },
        inlineText: runtimeDiag.requiredCoreCacheIncomplete
          ? `Required core cache is incomplete (${runtimeDiag.requiredCoreCacheFoundCount}/${runtimeDiag.requiredCoreCacheExpectedCount}). Use Reset cache & reload to recover.`
          : "Use Reset cache & reload for a clean fetch if Reload latest build still looks stale."
      });
      return;
    }

    if(runtimeDiag?.swControlUnconfirmed || runtimeDiag?.swRegistrationUnconfirmed){
      applyUpdateAction({
        statusText: "Latest build check is still pending on this device",
        primaryLabel: "Reload latest build",
        summaryLabel: "Check",
        action: async ()=>{ await swCheckNow(); },
        inlineText: runtimeDiag?.requiredCoreCachePreRegistration
          ? "Service worker registration has not started yet in this tab. This can be normal on first open; wait for load completion, then re-check."
          : runtimeDiag?.requiredCoreCachePendingControl
          ? "Required core cache is briefly settling while service worker lifecycle progress is still active. Reopen or reload after control is confirmed."
          : "Run Reload latest build after service worker control is confirmed."
      });
      return;
    }

    if(runtimeDiag?.installedAppLikelyLagging){
      applyUpdateAction({
        statusText: "Installed app may be on an older build",
        primaryLabel: "Reload latest build",
        summaryLabel: "Reload",
        action: async ()=>{ await swCheckNow(); },
        inlineText: "Reload, then fully close and reopen the Home Screen app."
      });
      return;
    }

    const recentAttempt = getStoredUpdateAttempt();
    const lastGoodRuntime = getLastGoodRuntimeConfirmation();
    const lastGoodMatchesBuild = Boolean(lastGoodRuntime?.buildVersion && lastGoodRuntime.buildVersion === displayBuildVersion);
    let stableInlineText = "Use this after a release if the app still looks old.";
    if(lastGoodMatchesBuild && recentAttempt){
      stableInlineText = `Current build confirmed here (${displayBuildVersion}) after ${recentAttempt.mode === "hard-reset" ? "Reset cache & reload" : "Reload latest build"} at ${formatLedgerStamp(lastGoodRuntime.confirmedAt)}.`;
    }else if(lastGoodMatchesBuild){
      const modeLabel = lastGoodRuntime.mode === "installed-standalone" ? "installed app" : "browser tab";
      stableInlineText = `Current build confirmed here (${displayBuildVersion}) at ${formatLedgerStamp(lastGoodRuntime.confirmedAt)} in ${modeLabel} mode.`;
    }else if(recentAttempt){
      stableInlineText = `Reload was requested after ${recentAttempt.mode === "hard-reset" ? "Reset cache & reload" : "Reload latest build"}. Run Reload latest build again if this still looks old.`;
    }else if(lastSwUpdateSignal === "dismissed"){
      stableInlineText = "You can load the latest build here any time if you chose Not now.";
    }else if(lastSwUpdateSignal === "applying"){
      stableInlineText = "Update was requested. If this still looks old, run Reload latest build once.";
    }
    applyUpdateAction({
      statusText: runtimeDiag?.requiredCoreCacheIncomplete ? "Core cache integrity needs attention" : "Up to date on this device",
      primaryLabel: "Reload latest build",
      summaryLabel: runtimeDiag?.requiredCoreCacheIncomplete ? "Check" : "Reload",
      action: async ()=>{ await swCheckNow(); },
      inlineText: stableInlineText
    });
  }

  async function updateBuildBadge(){
    const el = documentRef.getElementById("buildBadge");
    if(!el) return;

    const schema = getSchemaVersion(true);
    const parts = [`App ${displayBuildVersion}`];
    if(schema !== null) parts.push(`Schema ${schema}`);

    let swCtrl = false;
    try{
      swCtrl = !!(navigatorRef.serviceWorker && navigatorRef.serviceWorker.controller);
    }catch{}

    parts.push(`SW ${swCtrl ? "on" : "off"}`);

    try{
      if(windowRef.caches && cachesRef.keys){
        const keys = await cachesRef.keys();
        const currentKey = keys.find(x=>String(x||"").startsWith(`shellfish-tracker-v${displayBuildVersion.replace(/^v?5\./, "")}`)) || keys.find(x=>String(x||"").startsWith("shellfish-tracker-")) || "";
        if(currentKey){
          const m = String(currentKey).match(/-v(\d+)$/);
          if(m) parts.push(`App cache v${m[1]}`);
        }
      }
    }catch{}

    el.textContent = parts.join(" • ");
  }

  async function getReleaseValidationSnapshot(){
    const runtimeDiag = await getRuntimeVersionDiagnostics();
    const buildDigits = runtimeDiag.buildDigits || parseBuildDigits(displayBuildVersion);
    const updateReady = Boolean(swUpdateReady || runtimeDiag.swWaitingVersion);
    const swControlConfirmed = Boolean(runtimeDiag.swController && runtimeDiag.swRegistrationConfirmed);
    const requiredCoreCacheHealthy = !runtimeDiag.requiredCoreCacheIncomplete;
    const requiredCoreSettled = requiredCoreCacheHealthy || runtimeDiag.requiredCoreCachePendingControl;
    const updateAligned = Boolean(!runtimeDiag.hasExplicitVersionMismatch && requiredCoreCacheHealthy && swControlConfirmed);
    const lastGoodRuntime = getLastGoodRuntimeConfirmation();
    const hasLastGoodForBuild = Boolean(lastGoodRuntime?.buildVersion && lastGoodRuntime.buildVersion === String(displayBuildVersion || ""));
    const reopenReady = Boolean(swControlConfirmed && requiredCoreCacheHealthy && !runtimeDiag.installedAppLikelyLagging && !runtimeDiag.hasExplicitVersionMismatch && hasLastGoodForBuild);
    const recoveryReady = Boolean(runtimeDiag.needsHardReset || runtimeDiag.lastBootError);
    const cacheLine = runtimeDiag.cacheVersions.length
      ? [...new Set(runtimeDiag.cacheVersions)].map(v=>`v${v}`).join(", ")
      : "(none)";
    const startupLine = runtimeDiag.startupModuleVersions.length
      ? [...new Set(runtimeDiag.startupModuleVersions)].map(v=>`v${v}`).join(", ")
      : "(none)";
    const waitingLine = runtimeDiag.swWaitingVersion ? `v${runtimeDiag.swWaitingVersion}` : "none";

    const checks = [
      { key: "browser_mode", label: "Browser mode opens current release", suggested: "not-run" },
      { key: "installed_mode", label: "Installed app opens current release", suggested: runtimeDiag.standalone ? (runtimeDiag.hasExplicitVersionMismatch || runtimeDiag.installedAppLikelyLagging || (!requiredCoreSettled && runtimeDiag.requiredCoreCacheIncomplete) ? "fail" : (swControlConfirmed ? "pass" : "not-run")) : "not-run" },
      { key: "update_pickup", label: "Update pickup after reload", suggested: runtimeDiag.hasExplicitVersionMismatch || (!requiredCoreSettled && runtimeDiag.requiredCoreCacheIncomplete) ? "fail" : (swControlConfirmed ? "pass" : "not-run") },
      { key: "reopen_behavior", label: "Reopen keeps expected build", suggested: runtimeDiag.hasExplicitVersionMismatch || runtimeDiag.installedAppLikelyLagging || (!requiredCoreSettled && runtimeDiag.requiredCoreCacheIncomplete) ? "fail" : (reopenReady ? "pass" : "not-run") },
      { key: "recovery_reset", label: "Recovery/reset trust flow", suggested: recoveryReady ? "not-run" : "pass" }
    ];

    const signalLines = [
      `Build target: ${displayBuildVersion}${buildDigits ? ` (digits ${buildDigits})` : ""}`,
      `Mode: ${runtimeDiag.standalone ? "Installed app (standalone)" : "Browser/tab mode"}`,
      `SW controller: ${runtimeDiag.swController ? "yes" : "no"}`,
      `SW registration confirmed: ${runtimeDiag.swRegistrationConfirmed ? "yes" : "no"}${lastSwRegistrationSignal ? ` (${lastSwRegistrationSignal})` : ""}`,
      `SW waiting update: ${waitingLine}`,
      `Cache versions: ${cacheLine}`,
      `Startup module versions: ${startupLine}`,
      `Required core cache expected: ${runtimeDiag.requiredCoreCacheExpectedCount || 0}`,
      `Required core cache found: ${runtimeDiag.requiredCoreCacheFoundCount || 0}`,
      `Required core cache incomplete: ${runtimeDiag.requiredCoreCacheIncomplete ? "yes" : "no"}`,
      `Required core pending control: ${runtimeDiag.requiredCoreCachePendingControl ? "yes" : "no"}`,
      `Required core cache missing: ${runtimeDiag.requiredCoreCacheMissing?.length ? runtimeDiag.requiredCoreCacheMissing.join(", ") : "none"}`,
      `Version skew detected: ${runtimeDiag.hasVersionSkew ? "yes" : "no"}`,
      `SW control unconfirmed: ${runtimeDiag.swControlUnconfirmed ? "yes" : "no"}`,
      `Installed-app lag likely: ${runtimeDiag.installedAppLikelyLagging ? "yes" : "no"}`,
      `Hard reset suggested: ${runtimeDiag.needsHardReset ? "yes" : "no"}`,
      `Last-good runtime recorded for target build: ${hasLastGoodForBuild ? "yes" : "no"}`,
      `Last-good runtime stamp: ${lastGoodRuntime?.confirmedAt ? formatLedgerStamp(lastGoodRuntime.confirmedAt) : "none"}`
    ];

    const snapshot = {
      at: new Date().toISOString(),
      buildVersion: String(displayBuildVersion || ""),
      runtimeDiag,
      checks,
      signalLines,
      summary: {
        updateReady,
        updateAligned,
        reopenReady,
        recoveryReady
      }
    };
    try{
      lastReleaseValidationSnapshot = {
        ...snapshot,
        checks: Array.isArray(snapshot.checks) ? [...snapshot.checks] : [],
        signalLines: Array.isArray(snapshot.signalLines) ? [...snapshot.signalLines] : [],
        summary: { ...(snapshot.summary || {}) }
      };
      windowRef.__SHELLFISH_LAST_RELEASE_SNAPSHOT__ = {
        at: String(snapshot.at || ""),
        buildVersion: String(snapshot.buildVersion || ""),
        summary: { ...(snapshot.summary || {}) }
      };
    }catch(_){ }
    return snapshot;
  }

  function formatReleaseValidationLedger(snapshot, selectedResults = {}, notes = ""){
    const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
    const checks = Array.isArray(snap.checks) ? snap.checks : [];
    const lines = [];
    lines.push(`Bank the Catch release validation ledger`);
    lines.push(`Build: ${String(snap.buildVersion || displayBuildVersion || "")}`);
    lines.push(`Snapshot: ${formatLedgerStamp(snap.at) || "(unknown)"}`);
    lines.push("");
    lines.push("Signal snapshot:");
    (Array.isArray(snap.signalLines) ? snap.signalLines : []).forEach((line)=>{
      lines.push(`- ${line}`);
    });
    lines.push("");
    lines.push("Pass ledger:");
    checks.forEach((check, idx)=>{
      const raw = String(selectedResults[check.key] || check.suggested || "not-run").toLowerCase();
      const status = raw === "pass" ? "PASS" : (raw === "fail" ? "FAIL" : "NOT RUN");
      lines.push(`${idx + 1}. ${check.label}: ${status}`);
    });
    const extraNotes = String(notes || "").trim();
    if(extraNotes){
      lines.push("");
      lines.push("Notes:");
      lines.push(extraNotes);
    }
    return lines.join("\n");
  }

  function getHomeKpiValidationSnapshot(){
    const runtimeDiag = lastRuntimeVersionDiagnostics && typeof lastRuntimeVersionDiagnostics === "object"
      ? { ...lastRuntimeVersionDiagnostics }
      : {};
    const summaryParts = [];
    const buildDigits = String(runtimeDiag.buildDigits || parseBuildDigits(displayBuildVersion) || "");
    const swScriptVersion = String(runtimeDiag.swScriptVersion || "");
    const cacheVersions = Array.isArray(runtimeDiag.cacheVersions) ? [...new Set(runtimeDiag.cacheVersions)] : [];
    const startupVersions = Array.isArray(runtimeDiag.startupModuleVersions) ? [...new Set(runtimeDiag.startupModuleVersions)] : [];
    const swAligned = Boolean(swScriptVersion && buildDigits && swScriptVersion === buildDigits);
    const cacheAligned = cacheVersions.length > 0 && cacheVersions.every(v=>v === buildDigits);
    const startupAligned = startupVersions.length > 0 && startupVersions.every(v=>v === buildDigits);

    if(buildDigits){
      summaryParts.push(`Build digits v${buildDigits}`);
    }else{
      summaryParts.push("Build digits unknown");
    }
    summaryParts.push(`SW script ${swScriptVersion ? `v${swScriptVersion}` : "unknown"}`);
    if(cacheVersions.length){
      summaryParts.push(`Cache ${cacheAligned ? "aligned" : "mixed"} (${cacheVersions.map(v=>`v${v}`).join(", ")})`);
    }else{
      summaryParts.push("Cache versions unavailable");
    }
    if(startupVersions.length){
      summaryParts.push(`Startup modules ${startupAligned ? "aligned" : "mixed"} (${startupVersions.map(v=>`v${v}`).join(", ")})`);
    }else{
      summaryParts.push("Startup module versions unavailable");
    }

    return {
      at: new Date().toISOString(),
      buildVersion: String(displayBuildVersion || ""),
      runtimeMode: runtimeDiag.standalone ? "installed-standalone" : "browser-tab",
      swController: runtimeDiag.swController === true ? "yes" : "no",
      versionAlignmentSummary: summaryParts.join(" • ")
    };
  }

  function formatHomeKpiValidationLedger(snapshot, selectedResults = {}, notes = ""){
    const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
    const checks = [
      { key: "trips_open", label: "Trips drill-down opens" },
      { key: "pounds_open", label: "Pounds drill-down opens" },
      { key: "amount_open", label: "Amount drill-down opens" },
      { key: "avg_open", label: "Avg $/lb drill-down opens" },
      { key: "hero_all", label: "Hero card present on all four" },
      { key: "support_all", label: "Support card present on all four" },
      { key: "support_two_sentences", label: "Support analysis uses no more than 2 sentences" },
      { key: "compare_rows", label: "Compare rows are structured/readable" },
      { key: "charts_below", label: "Charts render below the cards" },
      { key: "reports_metric_detail", label: "Reports metric detail still works" },
      { key: "back_navigation", label: "Back navigation returns cleanly" }
    ];
    const lines = [];
    lines.push("Bank the Catch Home KPI drill-down validation ledger");
    lines.push(`Build: ${String(snap.buildVersion || displayBuildVersion || "")}`);
    lines.push(`Snapshot: ${formatLedgerStamp(snap.at) || "(unknown)"}`);
    lines.push(`Runtime mode: ${String(snap.runtimeMode || "(unknown)")}`);
    lines.push(`SW controller: ${String(snap.swController || "(unknown)")}`);
    lines.push(`Version alignment summary: ${String(snap.versionAlignmentSummary || "(unknown)")}`);
    lines.push("");
    lines.push("Manual checklist:");
    checks.forEach((check, idx)=>{
      const raw = String(selectedResults[check.key] || "not-run").toLowerCase();
      const status = raw === "pass" ? "PASS" : (raw === "fail" ? "FAIL" : "NOT RUN");
      lines.push(`${idx + 1}. ${check.label}: ${status}`);
    });
    const extraNotes = String(notes || "").trim();
    if(extraNotes){
      lines.push("");
      lines.push("Notes:");
      lines.push(extraNotes);
    }
    return lines.join("\n");
  }

  return {
    markSwUpdateReady,
    swCheckNow,
    forceRefreshApp,
    getRuntimeVersionDiagnostics,
    getSupportDiagnosticsSnapshot,
    formatSupportDiagnosticsSection,
    getReleaseValidationSnapshot,
    formatReleaseValidationLedger,
    getHomeKpiValidationSnapshot,
    formatHomeKpiValidationLedger,
    updateBuildInfo,
    updateUpdateRow,
    updateBuildBadge
  };
}
