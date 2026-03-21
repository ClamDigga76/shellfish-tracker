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

  function markSwUpdateReady(){
    swUpdateReady = true;
    try {
      if (getIsSettingsView()) updateUpdateRow();
    } catch (_) {}
  }

  async function swCheckNow(){
    const statusEl = documentRef.getElementById("updateBigStatus");
    const btnCheck = documentRef.getElementById("updatePrimary");
    try{
      if(statusEl) statusEl.textContent = swUpdateReady ? "Loading update…" : "Loading latest build…";
      if(btnCheck) btnCheck.disabled = true;
      if(statusEl) statusEl.textContent = "Reloading app now…";
      await forceRefreshApp();
    }catch(_){
      try{
        if(statusEl) statusEl.textContent = "Reloading app now…";
        await forceRefreshApp();
      }catch(__){}
    }finally{
      if(btnCheck) btnCheck.disabled = false;
      try{ updateBuildInfo(); }catch(_){ }
    }
  }

  async function forceRefreshApp(){
    try{
      if("serviceWorker" in navigatorRef){
        const regs = await navigatorRef.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister()));
      }
      if(windowRef.caches && cachesRef.keys){
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

  async function getRuntimeVersionDiagnostics(){
    const buildDigits = parseBuildDigits(displayBuildVersion);
    const details = {
      buildDigits,
      swController: false,
      swScriptVersion: "",
      cacheVersions: [],
      startupModuleVersions: []
    };

    try{
      if("serviceWorker" in navigatorRef){
        const reg = await navigatorRef.serviceWorker.getRegistration();
        details.swController = !!navigatorRef.serviceWorker.controller;
        const swUrl = reg?.active?.scriptURL || reg?.waiting?.scriptURL || reg?.installing?.scriptURL || "";
        const swMatch = swUrl.match(/[?&]v=(\d+)/);
        details.swScriptVersion = swMatch ? swMatch[1] : "";
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

    details.hasVersionSkew = Boolean(
      (details.swScriptVersion && buildDigits && details.swScriptVersion !== buildDigits) ||
      details.cacheVersions.some(v=>buildDigits && v !== buildDigits) ||
      details.startupModuleVersions.some(v=>buildDigits && v !== buildDigits) ||
      (buildDigits && details.startupModuleVersions.length > 0 && !details.swController)
    );

    return details;
  }

  async function updateBuildInfo(){
    const detailsEl = documentRef.getElementById("buildInfoDetails");
    const versionEl = documentRef.getElementById("updateVersionLine");

    try{
      if(versionEl){
        const standalone = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) || (navigatorRef.standalone === true);
        versionEl.textContent = `Current build: ${displayBuildVersion}${standalone ? " • Installed app mode" : " • Browser mode"}`;
      }
    }catch(_){
      try{ if(versionEl) versionEl.textContent = `Current build: ${displayBuildVersion}`; }catch(__){}
    }

    if(!detailsEl) return;

    const parts = [];
    parts.push(`App: ${displayBuildVersion} (schema ${getSchemaVersion()})`);

    const standalone = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) || (navigatorRef.standalone === true);
    parts.push(`Standalone: ${standalone ? "yes" : "no"}`);

    const runtimeDiag = await getRuntimeVersionDiagnostics();

    let swLine = "SW: unsupported";
    try{
      if("serviceWorker" in navigatorRef){
        const reg = await navigatorRef.serviceWorker.getRegistration();
        const ctrl = runtimeDiag.swController;
        const url = reg?.active?.scriptURL || reg?.waiting?.scriptURL || reg?.installing?.scriptURL || "";
        swLine = `SW: ${ctrl ? "controller" : "no-controller"}${url ? " | " + url.split("/").slice(-1)[0] : ""}`;
      }
    }catch(_){ }
    parts.push(swLine);

    try{
      if(windowRef.caches && cachesRef.keys){
        const keys = await cachesRef.keys();
        const ours = keys.filter(k=>String(k).startsWith("shellfish-tracker-"));
        parts.push(`Caches: ${ours.length ? ours.join(", ") : "(none)"}`);
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
        warningParts.push(`cache ${cacheMismatchVersions.map(v=>`v${v}`).join(", ")}`);
      }
      const startupMismatchVersions = [...new Set(runtimeDiag.startupModuleVersions.filter(v=>runtimeDiag.buildDigits && v !== runtimeDiag.buildDigits))];
      if(startupMismatchVersions.length){
        warningParts.push(`startup modules ${startupMismatchVersions.map(v=>`v${v}`).join(", ")}`);
      }
      if(runtimeDiag.buildDigits && runtimeDiag.startupModuleVersions.length && !runtimeDiag.swController){
        warningParts.push("installed app has no SW controller");
      }
      parts.push(`Version guardrail: warning${warningParts.length ? " • " + warningParts.join(" • ") : ""}`);
    }else if(runtimeDiag.buildDigits){
      parts.push(`Version guardrail: aligned to v${runtimeDiag.buildDigits}`);
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

  function updateUpdateRow(){
    const statusEl = documentRef.getElementById("updateBigStatus");
    const btnPrimary = documentRef.getElementById("updatePrimary");
    const inlineMsg = documentRef.getElementById("updateInlineMsg");
    if(!statusEl || !btnPrimary) return;

    if(inlineMsg) inlineMsg.style.display = "none";

    if(swUpdateReady){
      statusEl.textContent = "Update ready • Tap Load latest update to switch builds";
      btnPrimary.textContent = "Load latest update";
      btnPrimary.onclick = async ()=>{ await swCheckNow(); };
    }else{
      statusEl.textContent = "Build status: Up to date";
      btnPrimary.textContent = "Load latest update";
      btnPrimary.onclick = async ()=>{ await swCheckNow(); };
    }
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
        const k = keys.find(x=>String(x||"").startsWith("shellfish-tracker-")) || "";
        if(k){
          const m = String(k).match(/-v(\d+)$/);
          if(m) parts.push(`Cache v${m[1]}`);
        }
      }
    }catch{}

    el.textContent = parts.join(" • ");
  }

  return {
    markSwUpdateReady,
    swCheckNow,
    forceRefreshApp,
    updateBuildInfo,
    updateUpdateRow,
    updateBuildBadge
  };
}
