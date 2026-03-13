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

  async function updateBuildInfo(){
    const detailsEl = documentRef.getElementById("buildInfoDetails");
    const versionEl = documentRef.getElementById("updateVersionLine");

    try{
      if(versionEl){
        const standalone = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) || (navigatorRef.standalone === true);
        versionEl.textContent = `Current build: ${displayBuildVersion}${standalone ? " • Standalone: yes" : ""}`;
      }
    }catch(_){
      try{ if(versionEl) versionEl.textContent = `Current build: ${displayBuildVersion}`; }catch(__){}
    }

    if(!detailsEl) return;

    const parts = [];
    parts.push(`App: ${displayBuildVersion} (schema ${getSchemaVersion()})`);

    const standalone = (windowRef.matchMedia && windowRef.matchMedia("(display-mode: standalone)").matches) || (navigatorRef.standalone === true);
    parts.push(`Standalone: ${standalone ? "yes" : "no"}`);

    let swLine = "SW: unsupported";
    try{
      if("serviceWorker" in navigatorRef){
        const reg = await navigatorRef.serviceWorker.getRegistration();
        const ctrl = !!navigatorRef.serviceWorker.controller;
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
      statusEl.textContent = "Update ready • tap Load latest update";
      btnPrimary.textContent = "Load latest update";
      btnPrimary.onclick = async ()=>{ await swCheckNow(); };
    }else{
      statusEl.textContent = "You're already on the latest build";
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
