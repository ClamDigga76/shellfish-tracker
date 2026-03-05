// Shellfish Tracker — V2 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

const moduleV = new URL(import.meta.url).searchParams.get("v") || "";
const bootV = String(window.APP_VERSION || "");
if (moduleV && bootV && moduleV !== bootV) {
  const mismatchError = new Error(`Version mismatch: bootstrap=${bootV}, app=${moduleV}. Please refresh to update.`);
  if (window.__showModuleError) window.__showModuleError(mismatchError);
  throw mismatchError;
}

window.__SHELLFISH_APP_STARTED = false;

import { uid, toCSV, downloadText, formatMoney, formatDateDMY, computePPL, parseMDYToISO, parseNum, parseMoney, likelyDuplicate, normalizeKey, escapeHtml, getTripsNewestFirst, openModal, closeModal, lockBodyScroll, unlockBodyScroll, focusFirstFocusable } from "./utils_v5.js";
const APP_VERSION = (window.APP_BUILD || "v5");
const VERSION = APP_VERSION;
const QUICK_CHIP_LONG_PRESS_MS = 500;
const QUICK_CHIP_MOVE_CANCEL_PX = 10;

// Backup meta (local-only; no user data duplication)
const LS_LAST_BACKUP_META = "btc_last_backup_meta_v1";

// In-app update UI: shows an Update button only when a new Service Worker is ready.
let SW_UPDATE_READY = false;
let SW_UPDATE_VERSION = "";
window.addEventListener("sw-update-ready", (ev) => {
  SW_UPDATE_READY = true;
  SW_UPDATE_VERSION = String(ev?.detail?.version || "");
  try {
    if (state?.view === "settings") updateUpdateRow();
  } catch (_) {}
});

async function swCheckNow(){
  // Settings top-row CTA should mirror "Refresh App" behavior.
  // Keep status messaging, but always force-refresh app assets.
  const statusEl = document.getElementById("updateBigStatus");
  const btnCheck = document.getElementById("updatePrimary");
  try{
    if(statusEl) statusEl.textContent = SW_UPDATE_READY ? "Applying update…" : "Checking for updates…";
    if(btnCheck) btnCheck.disabled = true;
    if(statusEl) statusEl.textContent = "Refreshing…";
    await forceRefreshApp();
  }catch(_){
    try{
      if(statusEl) statusEl.textContent = "Refreshing…";
      await forceRefreshApp();
    }catch(__){}
  }finally{
    if(btnCheck) btnCheck.disabled = false;
    // refresh build info
    try{ updateBuildInfo(); }catch(_){ }
  }
}

async function forceRefreshApp(){
  // Clear SW + caches and reload.
  try{
    if("serviceWorker" in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if(window.caches && caches.keys){
      const keys = await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));
    }
  }catch(_){ }
  location.reload();
}

// Async version/build info for Settings > Updates
async function updateBuildInfo(){
  const detailsEl = document.getElementById("buildInfoDetails");
  const versionEl = document.getElementById("updateVersionLine");

  // Visible, non-techy line (always shown)
  try{
    if(versionEl){
      const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator.standalone === true);
      versionEl.textContent = `Version: ${VERSION}${standalone ? " • Standalone: yes" : ""}`;
    }
  }catch(_){
    try{ if(versionEl) versionEl.textContent = `Version: ${VERSION}`; }catch(__){}
  }

  if(!detailsEl) return;

  const parts = [];
  // App + schema
  parts.push(`App: ${VERSION} (schema ${typeof SCHEMA_VERSION!=="undefined"?SCHEMA_VERSION:"?"})`);

  // Display mode + SW controller
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator.standalone === true);
  parts.push(`Standalone: ${standalone ? "yes" : "no"}`);

  let swLine = "SW: unsupported";
  try{
    if("serviceWorker" in navigator){
      const reg = await navigator.serviceWorker.getRegistration();
      const ctrl = !!navigator.serviceWorker.controller;
      const url = reg?.active?.scriptURL || reg?.waiting?.scriptURL || reg?.installing?.scriptURL || "";
      swLine = `SW: ${ctrl ? "controller" : "no-controller"}${url ? " | " + url.split("/").slice(-1)[0] : ""}`;
    }
  }catch(_){}
  parts.push(swLine);

  // Cache keys
  try{
    if(window.caches && caches.keys){
      const keys = await caches.keys();
      const ours = keys.filter(k=>String(k).startsWith("shellfish-tracker-"));
      parts.push(`Caches: ${ours.length ? ours.join(", ") : "(none)"}`);
    }
  }catch(_){}

  // Storage estimate (optional)
  try{
    if(navigator.storage && navigator.storage.estimate){
      const est = await navigator.storage.estimate();
      if(est && typeof est.usage==="number" && typeof est.quota==="number"){
        const mb = (n)=>Math.round((n/1024/1024)*10)/10;
        parts.push(`Storage: ${mb(est.usage)}MB / ${mb(est.quota)}MB`);
      }
    }
  }catch(_){}

  detailsEl.textContent = parts.join("\n");
}



function updateUpdateRow(){
  const statusEl = document.getElementById("updateBigStatus");
  const btnPrimary = document.getElementById("updatePrimary");
  const inlineMsg = document.getElementById("updateInlineMsg");
  if(!statusEl || !btnPrimary) return;

  // Hide any transient inline message unless someone explicitly sets it.
  if(inlineMsg) inlineMsg.style.display = "none";

  if(SW_UPDATE_READY){
    statusEl.textContent = "Update available";
    btnPrimary.textContent = "Update now";
    btnPrimary.onclick = async ()=>{ await swCheckNow(); };
  }else{
    statusEl.textContent = "Up to date";
    btnPrimary.textContent = "Check for updates";
    btnPrimary.onclick = async ()=>{ await swCheckNow(); };
  }
}


window.__SHELLFISH_BUILD__ = APP_VERSION;
const HOME_TRIPS_LIMIT = 15;
const LAST_ERROR_KEY = "shellfish-last-error";
const LAST_ERROR_AT_KEY = "shellfish-last-error-at";
const LEGACY_LAST_ERROR_KEY = "SHELLFISH_LAST_ERROR";
const LEGACY_LAST_ERROR_AT_KEY = "SHELLFISH_LAST_ERROR_AT";


// Local helper to avoid hard dependency on utils export during SW update races (iOS Safari).
function to2(n){
  const x = Number(n);
  return Number.isFinite(x) ? Math.round((x + Number.EPSILON) * 100) / 100 : x;
}

function sanitizeDecimalInput(raw){
  let s = String(raw || "").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if(dot !== -1){
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
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
    const n = Number(s);
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




async function updateBuildBadge(){
  const el = document.getElementById("buildBadge");
  if(!el) return;

  const schema = (typeof SCHEMA_VERSION !== "undefined" ? SCHEMA_VERSION : null);
  const parts = [`App ${VERSION}`];
  if(schema !== null) parts.push(`Schema ${schema}`);

  // Service Worker info
  let swCtrl = false;
  let swV = null;
  try{
    swCtrl = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    if(navigator.serviceWorker && navigator.serviceWorker.getRegistration){
      const reg = await navigator.serviceWorker.getRegistration();
      const w = (reg && (reg.active || reg.waiting || reg.installing)) || null;
      const scriptURL = w ? (w.scriptURL || "") : "";
      const m = scriptURL.match(/[?&]v=(\d+)/);
      if(m) swV = m[1];
    }
  }catch{}

  parts.push(`SW ${swCtrl ? "on" : "off"}${swV ? " v"+swV : ""}`);

  // Cache name info (best-effort)
  try{
    if(window.caches && caches.keys){
      const keys = await caches.keys();
      const k = keys.find(x=>String(x||"").startsWith("shellfish-tracker-")) || "";
      if(k){
        const m = String(k).match(/-v(\d+)$/);
        if(m) parts.push(`Cache v${m[1]}`);
      }
    }
  }catch{}

  el.textContent = parts.join(" • ");
}

let toastTimer = null;
function showToast(msg){
  try{
    const el = document.getElementById("toast");
    if(!el) return;
    el.textContent = String(msg||"");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.classList.remove("show"); }, 2400);
  }catch{}
}

// ---- Install prompt (PWA growth) ----
// Goal: gently nudge install AFTER first successful save, once per device.
// Android: uses beforeinstallprompt if available.
// iOS: shows Add to Home Screen guidance (no native prompt).
const LS_INSTALL_PROMPTED = "btc-install_prompted_v1";
let deferredInstallPrompt = null;

function isStandaloneMode(){
  try{
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator.standalone === true);
  }catch(_){
    return false;
  }
}
function isIOS(){
  try{
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }catch(_){
    return false;
  }
}
function hasPromptedInstall(){
  try{ return localStorage.getItem(LS_INSTALL_PROMPTED) === "1"; }catch(_){ return false; }
}
function markPromptedInstall(){
  try{ localStorage.setItem(LS_INSTALL_PROMPTED, "1"); }catch(_){ }
}

window.addEventListener("beforeinstallprompt", (e)=>{
  try{
    // Keep the event for later (we'll ask after first save).
    e.preventDefault();
    deferredInstallPrompt = e;
  }catch(_){}
});

window.addEventListener("appinstalled", ()=>{
  markPromptedInstall();
  try{ showToast("Installed ✓"); }catch(_){}
});

function installModal({ title, body, primaryText="Install", onPrimary }){
  return new Promise((resolve)=>{
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = document.createElement("div");
    el.className = "modalOverlay";
    el.innerHTML = `
      <div class="modalCard card" role="dialog" aria-modal="true">
        <b>${escapeHtml(title||"Install")}</b>
        ${body ? `<div class="muted small mt8 lh135 preWrap">${escapeHtml(body)}</div>` : ""}
        <div class="row mt14 gap10 jcEnd wrap">
          <button class="btn" id="im_cancel" type="button">Not now</button>
          <button class="btn primary" id="im_yes" type="button">${escapeHtml(primaryText)}</button>
        </div>
      </div>
    `;

    const cleanup = (v)=>{
      el.removeEventListener("pointerdown", onBackdrop);
      el.removeEventListener("click", onBackdrop);
      unlockBodyScroll(el);
      try{ el.remove(); }catch(_){}
      if(opener && document.contains(opener)){
        try{ opener.focus({ preventScroll: true }); }catch(_){ }
      }
      resolve(v);
    };

    const onBackdrop = (e)=>{
      if(e.target !== el) return;
      e.preventDefault();
      e.stopPropagation();
      cleanup(false);
    };

    el.addEventListener("pointerdown", onBackdrop);
    el.addEventListener("click", onBackdrop);
    document.body.appendChild(el);
    lockBodyScroll(el);
    focusFirstFocusable(el.querySelector(".modalCard"));

    el.querySelector("#im_cancel")?.addEventListener("click", ()=>cleanup(false));
    el.querySelector("#im_yes")?.addEventListener("click", async ()=>{
      try{
        if(onPrimary) await onPrimary();
      }catch(_){}
      cleanup(true);
    });
  });
}

async function maybeOfferInstallAfterFirstSave(){
  try{
    if(isStandaloneMode()) return;
    if(hasPromptedInstall()) return;

    // Show once, after first save. Mark immediately so we don't nag.
    markPromptedInstall();

    const title = "Install Bank the Catch?";
    const benefits = "Installing keeps it on your Home Screen and works better offline at the shore.";

    // Android / Chromium path
    if(deferredInstallPrompt){
      await installModal({
        title,
        body: benefits,
        primaryText: "Install",
        onPrimary: async ()=>{
          try{
            deferredInstallPrompt.prompt();
            const choice = await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            if(choice && choice.outcome === "accepted"){
              try{ showToast("Installing…"); }catch(_){}
            }else{
              try{ showToast("No worries — you can install later"); }catch(_){}
            }
          }catch(_){}
        }
      });
      return;
    }

    // iOS guidance (Safari / Standalone install is Add to Home Screen)
    if(isIOS()){
      const iosBody = benefits + "\n\nOn iPhone/iPad:\n1) Tap Share (square + arrow)\n2) Choose “Add to Home Screen”\n3) Tap Add";
      await installModal({
        title,
        body: iosBody,
        primaryText: "Got it",
        onPrimary: async ()=>{}
      });
    }
  }catch(_){}
}

// v59: simple confirm modal (Yes/Cancel)
function confirmSaveModal({ title="Save this trip?", body="" } = {}){
  return new Promise((resolve)=>{
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = document.createElement("div");
    el.className = "modalOverlay";
    el.innerHTML = `
      <div class="modalCard card" role="dialog" aria-modal="true">
        <b>${escapeHtml(title)}</b>
        ${body ? `<div class="muted small mt8 preWrap">${escapeHtml(body)}</div>` : ""}
        <div class="row mt14 gap10 jcEnd">
          <button class="btn" id="m_cancel" type="button">Cancel</button>
          <button class="btn primary" id="m_yes" type="button">Yes, Save</button>
        </div>
      </div>
    `;

    const cleanup = (v)=>{
      el.removeEventListener("pointerdown", onBackdrop);
      el.removeEventListener("click", onBackdrop);
      unlockBodyScroll(el);
      try{ el.remove(); }catch{}
      if(opener && document.contains(opener)){
        try{ opener.focus({ preventScroll: true }); }catch(_){ }
      }
      resolve(v);
    };

    const onBackdrop = (e)=>{
      if(e.target !== el) return;
      e.preventDefault();
      e.stopPropagation();
      cleanup(false);
    };

    el.addEventListener("pointerdown", onBackdrop);
    el.addEventListener("click", onBackdrop);
    document.body.appendChild(el);
    lockBodyScroll(el);
    focusFirstFocusable(el.querySelector(".modalCard"));

    el.querySelector("#m_cancel")?.addEventListener("click", ()=>cleanup(false));
    el.querySelector("#m_yes")?.addEventListener("click", ()=>cleanup(true));
  });
}


function copyTextToClipboard(txt){
  return navigator.clipboard?.writeText(String(txt||""))
    .then(()=>true).catch(()=>false);
}


// ---- Bottom Tab Bar (Home / Trips / Reports / Settings) ----
const TABS = [
  { key: "home", label: "Home", icon: "home" },
  { key: "all_trips", label: "Trips", icon: "trips" },
  { key: "new", label: "New", icon: "plus", aria: "New Trip", isPlus: true },
  { key: "reports", label: "Reports", icon: "reports" },
  { key: "settings", label: "Settings", icon: "settings" },
];

function iconSvg(name){
  // Inline SVGs (stroke-based, readable at small sizes)
  if(name === "home"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5"/><path d="M5 10.5V21h14V10.5"/>
      <path d="M9 21v-7h6v7"/>
    </svg>`;
  }
  if(name === "trips"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 4h6"/><path d="M9 2h6v2H9z"/>
      <path d="M7 4h10"/><path d="M6 6h12v16H6z"/>
      <path d="M9 10h6"/><path d="M9 14h6"/><path d="M9 18h4"/>
    </svg>`;
  }
  if(name === "reports"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M3 20h18"/>
    </svg>`;
  }
  if(name === "plus"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 5v14"/><path d="M5 12h14"/>
    </svg>`;
  }
  if(name === "calendar"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M8 2v3"/><path d="M16 2v3"/>
      <path d="M3 7h18"/>
      <path d="M5 5h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
      <path d="M7 11h4"/>
    </svg>`;
  }
  if(name === "settings"){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
      <path d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.2-2-3.5-2.3.6a7.2 7.2 0 0 0-1.7-1L15 4h-6l-.5 2.9a7.2 7.2 0 0 0-1.7 1L4.5 7.3 2.5 10.8 4.5 12a7.9 7.9 0 0 0 0 2l-2 1.2 2 3.5 2.3-.6a7.2 7.2 0 0 0 1.7 1L9 20h6l.5-2.9a7.2 7.2 0 0 0 1.7-1l2.3.6 2-3.5-2.1-1.2z"/>
    </svg>`;
  }
  return "";
}

function getActiveTabKey(view){
  // Map sub-views back to a primary tab
  if(view === "new" || view === "edit") return "new";
  if(view === "help" || view === "about") return "settings";
  return view || "home";
}

function hasUnsavedDraft(){
  const d = state?.draft || {};
  return !!(d.date || d.dealer || d.area || d.pounds || d.amount);
}


// ---- Page Header (Option N1: brand title + compact subtitle) ----
const VIEW_META = {
  home:      { title: "Home", icon: "home" },
  all_trips: { title: "Trips", icon: "trips" },
  reports:   { title: "Reports", icon: "reports" },
  settings:  { title: "Settings", icon: "settings" },
  new:       { title: "New Trip", icon: "plus" },
  edit:      { title: "Edit Trip", icon: "trips" },
  help:      { title: "Help", icon: "settings" },
  about:     { title: "About", icon: "settings" },
};

function renderPageHeader(viewKey){
  const m = VIEW_META[viewKey] || { title: String(viewKey||""), icon: "home" };
  // Show header Help button on main sections only
  const helpKey = (viewKey === "all_trips") ? "trips" : viewKey;
  const showHelp = (helpKey === "home" || helpKey === "trips" || helpKey === "reports" || helpKey === "settings");
  const titleMaxWidth = showHelp ? "calc(100% - 44px)" : "100%";
  return `
    <div class="pageHeader">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;max-width:${titleMaxWidth};width:100%">
        <div style="display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;max-width:100%">
          <span class="phIcon" style="width:17px;height:17px;flex:0 0 17px;opacity:.92;filter:drop-shadow(0 1px 3px rgba(0,0,0,.35))">${iconSvg(m.icon)}</span>
          <h2 class="phTitle" style="font-size:clamp(18px,4.6vw,22px);line-height:1.05;letter-spacing:.35px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:Georgia, 'Times New Roman', Times, serif;color:#0A6B6B">Bank the Catch</h2>
        </div>
        <div style="margin-top:4px;font-size:11px;font-weight:800;letter-spacing:.45px;opacity:.95;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14)">${escapeHtml(m.title)}</div>
      </div>
      ${showHelp ? `<button class="phHelpBtn" type="button" aria-label="Help" data-help="${escapeHtml(helpKey)}">?</button>` : ``}
    </div>
  `;
}

function bindHeaderHelpButtons(){
  try{
    document.querySelectorAll('.phHelpBtn[data-help]').forEach(btn=>{
      btn.onclick = ()=>{
        const k = String(btn.getAttribute('data-help')||'').toLowerCase();
        state.helpJump = k || "";
        state.view = "help";
        saveState();
        render();
      };
    });
  }catch(_e){}
}

function renderTabBar(activeView){
  const host = document.getElementById("tabbar");
  if(!host) return;

  const activeKey = getActiveTabKey(activeView);
  host.innerHTML = TABS.map(t => `
    <button class="tabbtn ${t.isPlus ? "plus" : ""} ${t.key===activeKey ? "active" : ""}" type="button" data-tab="${escapeHtml(t.key)}" aria-label="${escapeHtml(t.aria || t.label)}">
      ${iconSvg(t.icon)}
      <span>${escapeHtml(t.label)}</span>
    </button>
  `).join("");

  // Bind handlers
  host.querySelectorAll("[data-tab]").forEach(btn => {
    btn.onclick = () => {
      const next = btn.getAttribute("data-tab") || "home";
      // Guard: if leaving a draft workflow, confirm once.
      if((state.view === "new" || state.view === "edit") && hasUnsavedDraft()){
        if(!confirm("Leave this screen? Your unsaved trip entry may be lost.")) return;
      }
      state.view = next;
      saveState();
      render();
    };
  });
}


function getDebugInfo(){
  const trips = Array.isArray(state?.trips) ? state.trips.length : 0;
  const areas = Array.isArray(state?.areas) ? state.areas.length : 0;
  const last = state?.lastAction ? String(state.lastAction) : "";
  const settings = state?.settings || {};

  const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (window.navigator && window.navigator.standalone === true);
  const dm = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ? "standalone" : "browser";
  const swCtrl = (navigator.serviceWorker && navigator.serviceWorker.controller) ? "controlled" : "none";
  const swScript = (navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL) ? navigator.serviceWorker.controller.scriptURL : "";

  let lsChars = 0;
  try{
    for(const k of Object.keys(localStorage||{})){
      const v = localStorage.getItem(k)||"";
      lsChars += (k.length + v.length);
    }
  }catch{}

  let lastErr = "";
  let lastErrAt = "";
  try{ lastErr = localStorage.getItem(LAST_ERROR_KEY) || localStorage.getItem(LEGACY_LAST_ERROR_KEY)||""; }catch{}
  try{ lastErrAt = localStorage.getItem(LAST_ERROR_AT_KEY) || localStorage.getItem(LEGACY_LAST_ERROR_AT_KEY)||""; }catch{}

  const lb = settings.lastBackupAt ? new Date(settings.lastBackupAt).toISOString() : "";
  const lbCount = (settings.lastBackupTripCount ?? "");
  const snooze = settings.backupSnoozeUntil ? new Date(settings.backupSnoozeUntil).toISOString() : "";

  return [
    `Bank the Catch ${APP_VERSION} (schema ${SCHEMA_VERSION})`,
    `URL: ${location.href}`,
    `Origin: ${location.origin}`,
    `DisplayMode: ${dm}`,
    `StandaloneFlag: ${isStandalone ? "true" : "false"}`,
    `ServiceWorker: ${swCtrl}`,
    swScript ? `SWScript: ${swScript}` : "",
    `LocalStorageChars: ${lsChars}`,
    `UserAgent: ${navigator.userAgent}`,
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


const SCHEMA_VERSION = 1;



function normalizeDealerDisplay(name){
  let s = String(name||"").trim();
  if(!s) return "";
  // collapse whitespace
  s = s.replace(/\s+/g, " ");
  // remove common trailing business suffixes (display-only)
  s = s.replace(/\b(inc\.?|incorporated|llc|co\.?|company)\b\.?/gi, "").replace(/\s+/g," ").trim();
  // Title-case words (keeps & and numbers)
  return s.split(" ").map(w=>{
    if(!w) return w;
    // keep all-caps short tokens like "USA"
    if(w.length <= 3 && w.toUpperCase() === w) return w;
    const lower = w.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(" ");
}

const bootPill = document.getElementById("bootPill");
function setBootError(msg){
  try{
    if(!bootPill) return;
    bootPill.textContent = "ERROR";
    bootPill.title = String(msg || "Unknown error");
    bootPill.classList.add("err");
  }catch{}
}
window.addEventListener("error", (e)=>{ if(window.__SHELLFISH_APP_STARTED) return; setBootError(e?.message || e?.error || "Script error"); });
window.addEventListener("unhandledrejection", (e)=>{ if(window.__SHELLFISH_APP_STARTED) return; setBootError(e?.reason || "Unhandled rejection"); });

const LS_KEY = "shellfish-state";
const LEGACY_KEYS = ["shellfish-v1.5.0", "shellfish-v1.4.2"];

function parseSemverKey(key) {
  const m = /^shellfish-v(\d+)\.(\d+)\.(\d+)$/.exec(key || "");
  if (!m) return null;
  return { key, v: [Number(m[1]), Number(m[2]), Number(m[3])] };
}

function pickBestLegacyKey() {
  const found = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const pv = parseSemverKey(k);
    if (pv) found.push(pv);
  }
  found.sort((a, b) => (a.v[0] - b.v[0]) || (a.v[1] - b.v[1]) || (a.v[2] - b.v[2]));
  if (found.length) return found[found.length - 1].key;
  for (const k of LEGACY_KEYS) if (localStorage.getItem(k)) return k;
  return null;
}

function migrateLegacyStateIfNeeded() {
  try {
    if (localStorage.getItem(LS_KEY)) return;
    const legacyKey = pickBestLegacyKey();
    if (!legacyKey) return;
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    parsed.settings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
    parsed.settings.migratedFrom = legacyKey;
    parsed.settings.migratedAt = new Date().toISOString();

    localStorage.setItem(LS_KEY, JSON.stringify(parsed));
  } catch {
    // Best-effort: never crash app boot because of migration.
  }
}
// Tier 1: versioned state migration + defaulting (runs every boot, cheap)
function migrateStateIfNeeded(st){
  try{
    st = (st && typeof st === "object") ? st : {};
    const v = Number(st.schemaVersion || 0);

    // ensure trips array is sane
    if(!Array.isArray(st.trips)) st.trips = [];
    st.trips = st.trips.map(normalizeTrip).filter(Boolean);

    // Home scoped filter (v59 style)
    if(!st.homeFilter || typeof st.homeFilter !== "object"){
      st.homeFilter = { mode:"YTD", from:"", to:"" };
    }
    // Legacy key: state.filter like "Month"
    if(st.filter && (!st.homeFilter.mode || st.homeFilter.mode==="")){
      const m = String(st.filter||"YTD").toUpperCase();
      st.homeFilter.mode = (m.includes("MONTH") ? "MONTH" : (m.includes("7") ? "7D" : (m.includes("ALL") ? "ALL" : "YTD")));
    }

    // Reports scoped filter (v59 style)
    if(!st.reportsFilter || typeof st.reportsFilter !== "object"){
      st.reportsFilter = { mode:"YTD", from:"", to:"" };
    }
    if(!st.reportsMode) st.reportsMode = "tables";

    // Trips filters (Trips page only): keep using unified filter object but scoped by usage
    if(!st.filters || typeof st.filters !== "object") st.filters = {};
    if(!st.filters.active || typeof st.filters.active !== "object"){
      st.filters.active = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all", species:"all" };
    } else {
      st.filters.active.range = st.filters.active.range || "ytd";
      if(st.filters.active.dealer == null) st.filters.active.dealer = "all";
      if(st.filters.active.area == null) st.filters.active.area = "all";
      if(st.filters.active.species == null) st.filters.active.species = "all";
      if(st.filters.active.fromISO == null) st.filters.active.fromISO = "";
      if(st.filters.active.toISO == null) st.filters.active.toISO = "";
    }

    // Legacy tripsFilter (older) keep for compatibility but not required
    if(!st.tripsFilter || typeof st.tripsFilter !== "object"){
      st.tripsFilter = { mode:"ALL", from:"", to:"" };
    }

    // bump schema
    if(v < 1) st.schemaVersion = 1;
    return st;
  }catch(e){
    try{ st.schemaVersion = st.schemaVersion || 1; }catch(_){}
    return st;
  }
}


// Signal to the page watchdog that the module loaded
try{ window.__SHELLFISH_STARTED = true; }catch{}
function getApp(){ return document.getElementById("app"); }

const NAV_STACK_LIMIT = 50;

function ensureNavState(state){
  if(!state || typeof state !== "object") state = {};
  if(!Array.isArray(state.navStack)) state.navStack = [];
  return state;
}

function navReset(state){ state.navStack = []; }

function pushView(state, nextView, {resetStack=false} = {}){
  if(resetStack) navReset(state);
  if(state.view !== nextView){
    state.navStack.push(state.view);
    if(state.navStack.length > NAV_STACK_LIMIT){
      state.navStack.splice(0, state.navStack.length - NAV_STACK_LIMIT);
    }
  }
  state.view = nextView;
  saveState();
  render();
}

function goBack(state, {fallback="home"} = {}){
  const stack = Array.isArray(state.navStack) ? state.navStack : [];
  let prev = null;
  while(stack.length){
    const c = stack.pop();
    if(c && c !== state.view){ prev = c; break; }
  }
  state.navStack = stack;
  state.view = prev || fallback;
  saveState();
  render();
}

function bindNavHandlers(state){
  const back = document.getElementById("navBack");
  if(back) back.onclick = () => goBack(state);

  const cancel = document.getElementById("navCancel");
  if(cancel) cancel.onclick = () => goBack(state);

  const home = document.getElementById("navHome");
  if(home) home.onclick = () => pushView(state, "home", {resetStack:true});

  const help = document.getElementById("homeHelp");
  if(help) help.onclick = () => { state.view = "help"; state.lastAction = "nav:help"; saveState(); render(); };
}




function loadState(){
  const fallback = ensureNavState({
    trips: [],
    view: "home",
    filter: "YTD",
    settings: {},
    areas: [],
    dealers: [],
    navStack: [],
    tripsFilter: { mode: "ALL", from: "", to: "" },
    reportsFilter: { mode: "YTD", from: "", to: "" },
  });

  try {
    const tryKeys = [LS_KEY, pickBestLegacyKey(), ...LEGACY_KEYS].filter(Boolean);
    let raw = null;
    for (const k of tryKeys) {
      raw = localStorage.getItem(k);
      if (raw) break;
    }
    if (!raw) return fallback;

    const p = JSON.parse(raw);
    return ensureNavState({
      trips: Array.isArray(p?.trips) ? p.trips : [],
      view: p?.view || "home",
      filter: p?.filter || "YTD",
      settings: p?.settings && typeof p.settings === "object" ? p.settings : {},
      areas: Array.isArray(p?.areas) ? p.areas : [],
      dealers: Array.isArray(p?.dealers) ? p.dealers : [],
      navStack: Array.isArray(p?.navStack) ? p.navStack : [],
      tripsFilter: (p?.tripsFilter && typeof p.tripsFilter === "object") ? p.tripsFilter : { mode: "ALL", from: "", to: "" },
      reportsFilter: (p?.reportsFilter && typeof p.reportsFilter === "object") ? p.reportsFilter : { mode: "YTD", from: "", to: "" },
    });
  } catch {
    return fallback;
  }
}




function exportTrips(trips, label, startISO="", endISO=""){
  // legacy wrapper (v36): keep behavior consistent with Trips screen
  exportTripsWithLabel(trips, String(label||"ALL").toUpperCase(), startISO, endISO);
}

function renderTripCatchCard(t, opts = {}){
  const {
    interactive = false,
    extraClass = "",
    valueOverride = "",
    metaOverride = ""
  } = opts;
  const date = formatDateDMY(t?.dateISO || "");
  const dealerRaw = String(t?.dealer || "").trim();
  const dealer = dealerRaw || "(dealer)";
  const area = String(t?.area || "").trim() || "(area)";
  const lbs = to2(Number(t?.pounds) || 0);
  const amt = to2(Number(t?.amount) || 0);
  const ppl = computePPL(lbs, amt);
  const tag = interactive ? "button" : "div";
  const role = interactive ? "button" : "group";
  const tab = interactive ? "0" : "-1";
  const idAttr = interactive ? ` data-id="${escapeHtml(String(t?.id || ""))}"` : "";
  const valueText = valueOverride || `${formatMoney(ppl)}/lb`;
  const dateText = metaOverride || date || "";

  return `
    <${tag} class="trip triprow catchCard ${escapeHtml(extraClass)}"${idAttr} role="${role}" tabindex="${tab}"${interactive ? ' type="button"' : ""}>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start">
        <div>
          <div class="catchHead" style="font-size:18px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(dateText)}</div>
          <div class="catchMain" style="font-size:18px;color:#fff">${escapeHtml(area)}</div>
          <div class="catchHead" style="margin-top:2px;font-size:18px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(dealer)}</div>
        </div>
        <div class="catchFoot" style="margin-top:0;display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-wrap:nowrap">
          <span class="catchMetric lbsBlue" style="font-size:14px;padding:6px 10px"><b class="lbsBlue">${lbs}</b> lbs</span>
          <span class="catchMetric money" style="font-size:14px;padding:6px 10px"><b class="money">${formatMoney(amt)}</b></span>
          <span class="catchMetric" style="font-size:14px;padding:6px 10px"><b class="rate ppl">${escapeHtml(valueText)}</b></span>
        </div>
      </div>
    </${tag}>
  `;
}

function buildBackupPayloadFromState(st, exportedAtISO){
  const safeState = (st && typeof st === "object") ? st : {};
  return {
    app: "Bank the Catch",
    schema: SCHEMA_VERSION, // legacy
    schemaVersion: SCHEMA_VERSION,
    version: APP_VERSION, // legacy
    appVersion: APP_VERSION,
    exportedAt: exportedAtISO || new Date().toISOString(),
    data: {
      trips: Array.isArray(safeState.trips) ? safeState.trips : [],
      areas: Array.isArray(safeState.areas) ? safeState.areas : [],
      dealers: Array.isArray(safeState.dealers) ? safeState.dealers : [],
      settings: (safeState.settings && typeof safeState.settings === "object") ? safeState.settings : {}
    }
  };
}

function __ymdLocal(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function __buildNum(){
  const m = /v5\.(\d+)/.exec(String(VERSION||""));
  return m ? m[1] : "0";
}

function __backupFilename(){
  return `bank-the-catch_backup_${__ymdLocal()}_build${__buildNum()}.json`;
}

function __setLastBackupMeta(meta){
  try{
    localStorage.setItem(LS_LAST_BACKUP_META, JSON.stringify(meta));
  }catch(_){ }
}

function __getLastBackupMeta(){
  // Prefer localStorage meta; fall back to state.settings for older backups.
  try{
    const raw = localStorage.getItem(LS_LAST_BACKUP_META);
    if(raw){
      const obj = JSON.parse(raw);
      if(obj && typeof obj === "object") return obj;
    }
  }catch(_){ }

  try{
    const s = state?.settings;
    const at = Number(s?.lastBackupAt || 0);
    const tc = Number(s?.lastBackupTripCount ?? (Array.isArray(state?.trips) ? state.trips.length : 0));
    if(at > 0){
      return { iso: new Date(at).toISOString(), tripCount: tc, build: __buildNum() };
    }
  }catch(_){ }

  return null;
}

function __updateLastBackupLine(){
  const el = document.getElementById("lastBackupLine");
  if(!el) return;
  const meta = __getLastBackupMeta();
  if(!meta){
    el.textContent = "Last backup: none yet";
    return;
  }
  const d = new Date(String(meta.iso || ""));
  const ok = !isNaN(d.getTime());
  const dateStr = ok ? (formatDateDMY(d) || "unknown date") : "unknown date";
  const n = Number(meta.tripCount);
  const tripsStr = Number.isFinite(n) ? `${n} trip${n===1?"":"s"}` : "unknown trips";
  el.textContent = `Last backup: ${dateStr} — ${tripsStr}`;
}

function downloadBackupPayload(payload, prefixOrFilename="shellfish_backup"){
  // Back-compat: if caller passes a full filename ending in .json, use it.
  const s = String(prefixOrFilename||"shellfish_backup");
  if(/\.json$/i.test(s)){
    downloadText(s, JSON.stringify(payload, null, 2));
    return;
  }
  const y = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  const fname = `${s}_${y.getFullYear()}-${pad(y.getMonth()+1)}-${pad(y.getDate())}_${pad(y.getHours())}${pad(y.getMinutes())}.json`;
  downloadText(fname, JSON.stringify(payload, null, 2));
}

async function exportBackup(){
  const exportedAtISO = new Date().toISOString();
  const payload = buildBackupPayloadFromState(state, exportedAtISO);
  const tripCount = Array.isArray(payload?.data?.trips) ? payload.data.trips.length : (Array.isArray(state.trips) ? state.trips.length : 0);
  const fname = __backupFilename();

  // Track last backup (for reminder + Settings line)
  try{
    state.settings = state.settings || {};
    state.settings.lastBackupAt = Date.now();
    state.settings.lastBackupTripCount = tripCount;
    saveState();
  }catch(_){ }
  __setLastBackupMeta({ iso: exportedAtISO, tripCount, build: __buildNum(), filename: fname });

  // iOS Standalone-friendly: try Share Sheet first if available.
  try{
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const file = new File([blob], fname, { type: "application/json" });
    const canShareFiles = !!(navigator?.canShare && navigator.canShare({ files: [file] }));
    if(canShareFiles && navigator?.share){
      await navigator.share({ files: [file], title: "Bank the Catch backup" });
      try{ __updateLastBackupLine(); }catch(_){ }
      return { ok:true, method:"share", filename: fname, tripCount };
    }
  }catch(_){ }

  // Fallback: standard download
  try{
    downloadBackupPayload(payload, fname);
    try{ __updateLastBackupLine(); }catch(_){ }
    return { ok:true, method:"download", filename: fname, tripCount };
  }catch(e){
    return { ok:false, error: e };
  }
}

function normalizeBackupPayload(raw){
  const obj = (raw && typeof raw === "object") ? raw : null;
  if(!obj) return { ok:false, errors:["Backup file is not valid JSON object"], warnings:[], normalized:null };

  const schemaVersion = Number(obj.schemaVersion ?? obj.schema ?? 0) || 0;
  const appVersion = String(obj.appVersion ?? obj.version ?? "");
  const exportedAt = String(obj.exportedAt || "");

  const data = (obj.data && typeof obj.data === "object") ? obj.data : obj;

  const trips = Array.isArray(data.trips) ? data.trips : [];
  const areas = Array.isArray(data.areas) ? data.areas : [];
  const dealers = Array.isArray(data.dealers) ? data.dealers : [];
  const settings = (data.settings && typeof data.settings === "object") ? data.settings : {};

  const normalized = { schemaVersion, appVersion, exportedAt, data:{ trips, areas, dealers, settings } };

  const { errors, warnings } = validateNormalizedBackupPayload(normalized);
  return { ok: errors.length === 0, errors, warnings, normalized };
}

function validateNormalizedBackupPayload(normalized){
  const errors = [];
  const warnings = [];

  if(!normalized || typeof normalized !== "object"){
    errors.push("Backup validation failed");
    return { errors, warnings };
  }

  const data = normalized.data;
  if(!data || typeof data !== "object"){
    errors.push("Backup is missing data section");
    return { errors, warnings };
  }

  if(!Array.isArray(data.trips)) errors.push("Backup trips must be an array");
  if(!Array.isArray(data.areas)) errors.push("Backup areas must be an array");
  if(data.settings && typeof data.settings !== "object") errors.push("Backup settings must be an object");
  if(!Array.isArray(data.dealers)) errors.push("Backup dealers must be an array");

  if(Array.isArray(data.trips)){
    const tooMany = data.trips.length > 20000;
    if(tooMany) warnings.push(`Large backup (${data.trips.length} trips) may be slow to import on mobile`);
  }

  if(Array.isArray(data.areas)){
    for(const a of data.areas){
      if(typeof a !== "string") { warnings.push("Some areas were not strings and will be skipped"); break; }
    }
  }

  if(Array.isArray(data.dealers)){
    for(const d of data.dealers){
      if(typeof d !== "string") { warnings.push("Some dealers were not strings and will be skipped"); break; }
    }
  }

  return { errors, warnings };
}


function normalizeTripForImport(t){
  const o = (t && typeof t === "object") ? t : {};
  const id = String(o.id || "").trim() || uid("t");
  const dateISO = String(o.dateISO || o.date || "").trim();
  const dealer = String(o.dealer || "").trim();
  const area = String(o.area || "").trim();
  const pounds = Number(o.pounds);
  const amount = Number(o.amount);
  return {
    ...o,
    id,
    dateISO,
    dealer,
    area,
    pounds: Number.isFinite(pounds) ? pounds : 0,
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

function importBackupFromFile(file, opts={}){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error("Failed to read file"));
    reader.onload = ()=>{
      try{
        const txt = String(reader.result || "");
        const raw = JSON.parse(txt);

        const normalizedResult = normalizeBackupPayload(raw);
        if(!normalizedResult.ok){
          const msg = normalizedResult.errors.join("\n");
          reject(new Error(msg));
          return;
        }

        const normalized = normalizedResult.normalized;
        const tripsIn = normalized.data.trips;
        const areasIn = normalized.data.areas;
        const dealersIn = normalized.data.dealers;
        const settingsIn = normalized.data.settings;

        const importedTrips = tripsIn.map(normalizeTripForImport).filter(t=>t.dateISO || t.dealer || t.amount || t.pounds);
        const importedAreas = areasIn.map(a=>String(a||"").trim()).filter(Boolean);
        const importedDealers = dealersIn.map(d=>String(d||"").trim()).filter(Boolean);

        const forceOverwrite = !!opts?.forceOverwrite;
        let replace = false;
        if(forceOverwrite){
          const msg = String(opts?.confirmMessage || "This will overwrite trips/lists on this device. Continue?");
          if(!confirm(msg)){
            resolve({ canceled:true, mode:"canceled", tripsInFile: importedTrips.length, tripsAdded: 0, areasInFile: importedAreas.length, dealersInFile: importedDealers.length, warnings: normalizedResult.warnings || [] });
            return;
          }
          replace = true;
        }else{
          replace = confirm(
            "Restore backup?\n\n" +
            "OK = Replace current trips/areas/dealers on this device\n" +
            "Cancel = Merge (skip likely duplicates)"
          );
        }

        const hasExisting = (Array.isArray(state.trips) && state.trips.length) || (Array.isArray(state.areas) && state.areas.length) || (Array.isArray(state.dealers) && state.dealers.length);
        if(replace && hasExisting && !forceOverwrite){
          const makeSafety = confirm(
            "Before replacing, create a safety backup of your current data?\n\n" +
            "OK = Download safety backup\n" +
            "Cancel = Continue without safety backup"
          );
          if(makeSafety){
            const safetyPayload = buildBackupPayloadFromState(state);
            downloadBackupPayload(safetyPayload, "shellfish_safety_before_restore");
          }
        }

        const nextTrips = replace ? [] : (Array.isArray(state.trips) ? [...state.trips] : []);
        const seen = new Set(nextTrips.map(t=> normalizeKey(`${t?.dateISO||""}|${t?.dealer||""}|${t?.area||""}|${to2(Number(t?.pounds)||0)}|${to2(Number(t?.amount)||0)}`)));

        let added = 0;
        for(const t of importedTrips){
          const key = normalizeKey(`${t.dateISO}|${t.dealer}|${t.area}|${to2(t.pounds)}|${to2(t.amount)}`);
          if(!replace){
            const isDupKey = seen.has(key);
            const isLikelyDup = nextTrips.some(x => likelyDuplicate(x, t));
            if(isDupKey || isLikelyDup) continue;
          }
          if(nextTrips.some(x=>x.id === t.id)) t.id = uid("t");
          nextTrips.push(t);
          seen.add(key);
          added++;
        }

        const nextAreas = replace ? [] : (Array.isArray(state.areas) ? [...state.areas] : []);
        for(const a of importedAreas){
          if(!nextAreas.includes(a)) nextAreas.push(a);
        }

        const nextDealers = replace ? [] : (Array.isArray(state.dealers) ? [...state.dealers] : []);
        for(const d of importedDealers){
          if(!nextDealers.includes(d)) nextDealers.push(d);
        }

        state.trips = nextTrips;
        state.areas = nextAreas;
        state.dealers = nextDealers;

        // Settings restore rules:
        // - Replace: use imported settings (if any)
        // - Merge: keep existing settings; only fill missing keys from imported
        const existingSettings = (state.settings && typeof state.settings === "object") ? state.settings : {};
        if(replace){
          state.settings = (settingsIn && typeof settingsIn === "object") ? settingsIn : {};
        }else{
          const merged = { ...existingSettings };
          if(settingsIn && typeof settingsIn === "object"){
            for(const k of Object.keys(settingsIn)){
              if(merged[k] === undefined) merged[k] = settingsIn[k];
            }
          }
          state.settings = merged;
        }

        // Normalize areas/dealers after import
        ensureAreas();
        ensureDealers();

        saveState();
        resolve({
          mode: replace ? "replace" : "merge",
          tripsInFile: importedTrips.length,
          tripsAdded: replace ? importedTrips.length : added,
          areasInFile: importedAreas.length,
          dealersInFile: importedDealers.length,
          warnings: normalizedResult.warnings || []
        });
      }catch(e){
        reject(e);
      }
    };
    reader.readAsText(file);
  });
}


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
    else if(legacyMode === "MONTH") range = "30d";
    else if(legacyMode === "7D") range = "7d";
    else if(legacyMode === "RANGE") {
      range = "custom";
      fromISO = parseMDYToISO(String(pick?.from||"")) || "";
      toISO = parseMDYToISO(String(pick?.to||"")) || "";
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

// Add-on E: normalize trip shape so filtering is reliable
function normalizeTripRow(t){
  if(!t) return null;

  let dateISO = String(t?.dateISO || t?.date || t?.when || t?.tripDate || "").slice(0,10);

  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) && t?.createdAt){
    const d = new Date(t.createdAt);
    if(!isNaN(d)) dateISO = d.toISOString().slice(0,10);
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)){
    // quarantine weird records out of normal ranges but keep app stable
    dateISO = "1900-01-01";
  }

  const pounds = Number(t?.pounds ?? t?.lbs ?? 0);
  const amount = Number(t?.amount ?? t?.total ?? 0);

  return {
    ...t,
    dateISO,
    pounds: Number.isFinite(pounds) ? pounds : 0,
    amount: Number.isFinite(amount) ? amount : 0,
    dealer: String(t?.dealer || "").trim(),
    area: String(t?.area || "").trim(),
    species: String(t?.species || "").trim(),
    notes: String(t?.notes || "")
  };
}
// Tier 1: canonical trip schema normalizer
function normalizeTrip(t){
  const n = normalizeTripRow(t);
  if(!n) return null;
  const id = String(n.id || n._id || "");
  // Ensure stable id and createdAt
  if(!id){
    n.id = uid();
  } else {
    n.id = id;
  }
  if(!n.createdAt){
    // best-effort: derive from dateISO at noon local to avoid TZ edge
    try{
      const d = new Date(String(n.dateISO||"") + "T12:00:00");
      n.createdAt = isNaN(d) ? new Date().toISOString() : d.toISOString();
    }catch(e){
      n.createdAt = new Date().toISOString();
    }
  }
  if(n.species == null) n.species = String(t?.species||"").trim();
  if(n.notes == null) n.notes = String(t?.notes||"");
  return n;
}

// Tier 1: trip validator (used on save)
function validateTrip(t){
  const errs = [];
  if(!t) errs.push("Trip");
  else{
    if(!t.dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.dateISO))) errs.push("Date");
    if(!String(t.dealer||"").trim()) errs.push("Dealer");
    const lbs = Number(t.pounds);
    const amt = Number(t.amount);
    if(!(Number.isFinite(lbs) && lbs > 0)) errs.push("Pounds");
    if(!(Number.isFinite(amt) && amt > 0)) errs.push("Amount");
  }
  return errs;
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

  if(filter.range === "all") return { fromISO:"1900-01-01", toISO:now, label:"All time" };
  if(filter.range === "ytd") return { fromISO:`${y}-01-01`, toISO:now, label:"YTD" };
  if(filter.range === "mtd") return { fromISO:`${y}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`, toISO:now, label:"Month" };
  if(filter.range === "7d") return { fromISO:backDays(7), toISO:now, label:"7 Days" };
  if(filter.range === "12m"){
    const d = new Date();
    d.setFullYear(d.getFullYear()-1);
    return { fromISO:d.toISOString().slice(0,10), toISO:now, label:"Last 12 months" };
  }
  if(filter.range === "90d") return { fromISO:backDays(90), toISO:now, label:"Last 90 days" };
  if(filter.range === "30d") return { fromISO:backDays(30), toISO:now, label:"Last 30 days" };
  if(filter.range === "7d") return { fromISO:backDays(7), toISO:now, label:"Last 7 days" };

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

function applyUnifiedTripFilter(rawTrips, filter){
  const trips = (rawTrips || []).map(normalizeTripRow).filter(Boolean);
  const r = resolveUnifiedRange(filter);

  let rows = trips.filter(t => t.dateISO >= r.fromISO && t.dateISO <= r.toISO);

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





function findDuplicateTrip(candidate, excludeId=""){
  const trips = Array.isArray(state.trips) ? state.trips : [];
  for(const t of trips){
    if(excludeId && String(t?.id||"") === String(excludeId)) continue;
    if(likelyDuplicate(t, candidate)) return t;
  }
  return null;
}


function commitTripFromDraft({ mode, editId="", inputs, nextView="home" }){
  const dateISO = parseMDYToISO(String(inputs?.date||""));
  const dealer = normalizeDealerDisplay(String(inputs?.dealer||"").trim());
  const poundsNum = parseNum(inputs?.pounds);
  const amountNum = parseMoney(inputs?.amount);
  const area = String(inputs?.area||"").trim();

  const errs = [];
  if(!dateISO) errs.push("Date");
  if(!dealer) errs.push("Dealer");
  if(!(poundsNum > 0)) errs.push("Pounds");
  if(!(amountNum > 0)) errs.push("Amount");
  if(errs.length){
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
      alert("Trip not found. Returning home.");
      state.view = nextView;
      saveState();
      render();
      return false;
    }
  } else {
    id = uid();
  }

  const candidate = { dateISO, dealer, pounds: to2(poundsNum), amount: to2(amountNum) };
  const dup = findDuplicateTrip(candidate, isEdit ? id : "");
  if(dup){
    const msg = isEdit
      ? `This edit matches another trip:\n\nDate: ${formatDateDMY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave changes anyway?`
      : `This looks like a duplicate trip:\n\nDate: ${formatDateDMY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave anyway?`;
    if(!confirm(msg)) return false;
  }

  const trip = {
    ...(existing || {}),
    id,
    dateISO,
    dealer,
    pounds: to2(poundsNum),
    amount: to2(amountNum),
    area
  };

  // Tier 1: normalize + validate before saving
  const tripNorm = normalizeTrip(trip);
  const vErrs = validateTrip(tripNorm);
  if(vErrs.length){
    alert("Missing/invalid: " + vErrs.join(", "));
    return false;
  }


  const nextTrips = isEdit
    ? trips.map(t => (String(t?.id||"") === id ? tripNorm : t))
    : trips.concat([tripNorm]);

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
  render();
  // After first successful save, offer install (once per device).
  if(!isEdit){ try{ setTimeout(()=>{ maybeOfferInstallAfterFirstSave(); }, 350); }catch(_){} }
  return true;
}


migrateLegacyStateIfNeeded();
let state = migrateStateIfNeeded(loadState());
ensureTripsFilter();
ensureReportsFilter();
ensureHomeFilter();
ensureAreas();
ensureDealers();
ensureUnifiedFilters();
function showFatal(err){
  if(window.__SHELLFISH_FATAL_SHOWN) return;
  window.__SHELLFISH_FATAL_SHOWN = true;
  // Persist last error so index.html can show a recovery UI even if modules fail next time.
  try{
    const msg = (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err || "Fatal error");
    localStorage.setItem(LAST_ERROR_KEY, msg);
    localStorage.setItem(LAST_ERROR_AT_KEY, new Date().toISOString());
    // legacy
    localStorage.setItem(LEGACY_LAST_ERROR_KEY, msg);
    localStorage.setItem(LEGACY_LAST_ERROR_AT_KEY, new Date().toISOString());
  }catch(_){ }

  const appEl = document.getElementById("app");
  const pill = document.getElementById("bootPill");

  const errText = String(err && (err.stack || err.message || err) || "Unknown error");

  if(pill){
    pill.textContent = "ERROR";
    pill.classList.add("err");
    pill.title = errText;
  }

  const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (window.navigator && window.navigator.standalone === true);
  const swCtrl = (navigator.serviceWorker && navigator.serviceWorker.controller) ? "yes" : "no";

  const dump = [
    `App: ${APP_VERSION} (schema ${SCHEMA_VERSION})`,
    `URL: ${location.href}`,
    `UA: ${navigator.userAgent}`,
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
        <button class="btn" id="fatalCopy">Copy debug</button>
        <button class="btn good" id="fatalReload">Reload</button>
        <button class="btn" id="fatalResetCache">Reset cache</button>
        <button class="btn danger" id="fatalResetData">Reset app data</button>
      </div>

      <div class="muted small" style="margin-top:10px;line-height:1.35">
        If this keeps happening on iPhone/iPad: try <b>Reset cache</b>, then reload. Installed PWA updates can be delayed by cached files.
      </div>
    </div>
  `;

  const safeAsync = (fn)=>{ try{ fn(); }catch(_){} };

  const resetCache = async ()=>{
    try{
      if("serviceWorker" in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r=>r.unregister()));
      }
      if("caches" in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }
    }catch(_){}
    location.reload();
  };

  const resetAppData = async ()=>{
    try{
      const keys = [];
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k) keys.push(k);
      }
      keys
        .filter(k => k.startsWith("shellfish-") || k === LS_KEY)
        .forEach(k => { try{ localStorage.removeItem(k); }catch(_){} });
      // legacy one-off keys
      try{ localStorage.removeItem(LEGACY_LAST_ERROR_KEY); }catch(_){ }
      try{ localStorage.removeItem(LEGACY_LAST_ERROR_AT_KEY); }catch(_){ }
      try{ localStorage.removeItem("ST_LAST_ERROR"); }catch(_){ }
      try{ localStorage.removeItem("ST_LAST_ERROR_AT"); }catch(_){ }

    }catch(_){}
    location.reload();
  };

  const btnCopy = document.getElementById("fatalCopy");
  if(btnCopy) btnCopy.onclick = ()=> navigator.clipboard?.writeText(dump).catch(()=>{});

  const btnReload = document.getElementById("fatalReload");
  if(btnReload) btnReload.onclick = ()=> location.reload();

  const btnResetCache = document.getElementById("fatalResetCache");
  if(btnResetCache) btnResetCache.onclick = ()=> safeAsync(()=> resetCache());

  const btnResetData = document.getElementById("fatalResetData");
  if(btnResetData) btnResetData.onclick = ()=> {
    if(confirm("This clears all local app data (trips, areas, settings). Continue?")){
      safeAsync(()=> resetAppData());
    }
  };
}
window.addEventListener("error", (e)=> showFatal(e?.error || e?.message || e));
window.addEventListener("unhandledrejection", (e)=> showFatal(e?.reason || e));

function safeSetItem(key, value){
  try{
    localStorage.setItem(key, value);
    return true;
  }catch(e){
    // Quota exceeded / private mode / storage blocked
    try{ console.warn("localStorage write failed", e); }catch(_){}
    try{ showToast("Storage full — export CSV and clear old trips"); }catch(_){}
    return false;
  }
}

function saveState(){
  safeSetItem(LS_KEY, JSON.stringify(state));
}

// Draft persistence is just state persistence (draft lives under state.draft)
function saveDraft(){
  try{ saveState(); }catch(e){ /* ignore storage failures */ }
}





function ensureTripsFilter(){
  // v65: Trips filter is dropdown-based and page-scoped.
  // Shape:
  //   { range:"ytd|all|12m|90d|30d|custom", fromISO:"YYYY-MM-DD", toISO:"YYYY-MM-DD", dealer:"all|<name>", area:"all|<name>" }
  if(!state.tripsFilter || typeof state.tripsFilter !== "object"){
    state.tripsFilter = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all" };
    return;
  }

  // Migrate legacy shape { mode:"ALL|YTD|MONTH|7D|RANGE", from:"MM/DD/YYYY", to:"MM/DD/YYYY" }
  if("mode" in state.tripsFilter){
    const mode = String(state.tripsFilter.mode || "ALL").toUpperCase();
    const range =
      (mode === "YTD") ? "ytd" :
      (mode === "RANGE") ? "custom" :
      (mode === "7D") ? "30d" :
      (mode === "MONTH") ? "30d" :
      "all";
    const fromISO = parseMDYToISO(state.tripsFilter.from || "") || "";
    const toISO = parseMDYToISO(state.tripsFilter.to || "") || "";
    state.tripsFilter = { range, fromISO, toISO, dealer:"all", area:"all" };
  }

  if(!state.tripsFilter.range) state.tripsFilter.range = "ytd";
  if(state.tripsFilter.fromISO == null) state.tripsFilter.fromISO = "";
  if(state.tripsFilter.toISO == null) state.tripsFilter.toISO = "";
  if(!("dealer" in state.tripsFilter)) state.tripsFilter.dealer = "all";
  if(!("area" in state.tripsFilter)) state.tripsFilter.area = "all";

  // Guardrails: if custom is selected, ensure usable defaults.
  if(state.tripsFilter.range === "custom"){
    const now = isoToday();
    const y = now.slice(0,4);
    if(!state.tripsFilter.fromISO) state.tripsFilter.fromISO = `${y}-01-01`;
    if(!state.tripsFilter.toISO) state.tripsFilter.toISO = now;
    if(state.tripsFilter.fromISO > state.tripsFilter.toISO){
      const tmp = state.tripsFilter.fromISO; state.tripsFilter.fromISO = state.tripsFilter.toISO; state.tripsFilter.toISO = tmp;
    }
  }
}

function getTripsRangeWindow(tf){
  const range = String(tf?.range || "ytd");
  const todayISO = isoToday();
  const now = new Date();
  const pad = (n)=>String(n).padStart(2,"0");
  const y = now.getFullYear();

  if(range === "all"){
    return { startISO:"", endISO:"", label:"ALL" };
  }
  if(range === "ytd"){
    return { startISO:`${y}-01-01`, endISO:todayISO, label:"YTD" };
  }
  if(range === "12m" || range === "90d" || range === "30d"){
    const d = new Date(now);
    const days = (range==="12m") ? 364 : (range==="90d" ? 89 : 29);
    d.setDate(d.getDate() - days);
    const startISO = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const label = (range==="12m") ? "12M" : (range==="90d" ? "90D" : "30D");
    return { startISO, endISO:todayISO, label };
  }
  // custom
  const s = String(tf?.fromISO || "").slice(0,10);
  const e = String(tf?.toISO || "").slice(0,10);
  if(s && e){
    const a = s <= e ? {startISO:s,endISO:e} : {startISO:e,endISO:s};
    return { ...a, label:"RANGE" };
  }
  return { startISO:"", endISO:"", label:"RANGE" };
}

function getTripsFilteredRows(){
  ensureTripsFilter();
  const tf = state.tripsFilter;
  const tripsAll = Array.isArray(state.trips) ? state.trips.map(normalizeTripRow).filter(Boolean) : [];

  const r = getTripsRangeWindow(tf);
  let rows = (r.label === "ALL") ? tripsAll.slice() : filterByISOInclusive(tripsAll, r.startISO, r.endISO);

  // Dealer / Area filters (Trips-only)
  if(tf.dealer && tf.dealer !== "all"){
    rows = rows.filter(t => String(t?.dealer||"") === String(tf.dealer));
  }
  if(tf.area && tf.area !== "all"){
    rows = rows.filter(t => String(t?.area||"") === String(tf.area));
  }

  // Stable sort: newest first
  rows.sort((a,b)=>{
    const ad = String(a?.dateISO||"");
    const bd = String(b?.dateISO||"");
    if(ad !== bd) return bd.localeCompare(ad);
    const ac = String(a?.createdAt||"");
    const bc = String(b?.createdAt||"");
    return bc.localeCompare(ac);
  });

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


function isoToday(){
  const d = new Date();
  const pad = (n)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function parseReportDateToISO(value){
  const raw = String(value || "").trim();
  if(!raw) return "";
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return parseMDYToISO(raw) || "";
}

function formatReportDateValue(value){
  const iso = parseReportDateToISO(value);
  if(!iso) return String(value || "");
  return iso;
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

function modeRange(mode, fromMDY="", toMDY=""){
  const todayISO = isoToday();
  const now = new Date();
  const pad = (n)=>String(n).padStart(2,"0");
  const m = String(mode||"").toUpperCase();

  // Back-compat: old keys
  if(m === "MONTH") mode = "THIS_MONTH";
  if(m === "7D") mode = "RANGE_7D";

  const M = String(mode||"").toUpperCase();

  if(M === "YTD"){
    const start = `${now.getFullYear()}-01-01`;
    return { startISO:start, endISO:todayISO, label:"YTD" };
  }
  if(M === "THIS_MONTH"){
    const start = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
    return { startISO:start, endISO:todayISO, label:"THIS_MONTH" };
  }
  if(M === "LAST_MONTH"){
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setMonth(d.getMonth() - 1);
    const start = `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`;
    const endD = new Date(d.getFullYear(), d.getMonth()+1, 0); // last day of last month
    const end = `${endD.getFullYear()}-${pad(endD.getMonth()+1)}-${pad(endD.getDate())}`;
    return { startISO:start, endISO:end, label:"LAST_MONTH" };
  }
  if(M === "RANGE_7D"){
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    const start = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return { startISO:start, endISO:todayISO, label:"7D" };
  }
  if(M === "RANGE"){
    const s = parseReportDateToISO(fromMDY);
    const e = parseReportDateToISO(toMDY);
    if(s && e){
      const a = s <= e ? {startISO:s,endISO:e} : {startISO:e,endISO:s};
      return { ...a, label:"RANGE" };
    }
    return { startISO:"", endISO:"", label:"RANGE" };
  }
  // ALL / ALL_TIME
  return { startISO:"", endISO:"", label:"ALL" };
}



function filterByISOInclusive(trips, startISO, endISO){
  if(!startISO || !endISO) return trips.slice();
  const s = String(startISO);
  const e = String(endISO);
  return trips.filter(t=>{
    const d = String(t?.dateISO||"");
    if(!d) return true;
    return d >= s && d <= e;
  });
}

function formatISOForFile(iso){
  return String(iso||"").slice(0,10);
}

function tripsFilename(label, startISO="", endISO=""){
  const base = "shellfish_trips";
  const L = String(label||"").toUpperCase();
  if(L === "ALL") return `${base}_ALL.csv`;
  if(L === "YTD" || L === "12M" || L === "90D" || L === "30D"){
    if(startISO && endISO) return `${base}_${L}_${formatISOForFile(startISO)}_to_${formatISOForFile(endISO)}.csv`;
    return `${base}_${L}.csv`;
  }
  if(L === "RANGE" && startISO && endISO){
    return `${base}_RANGE_${formatISOForFile(startISO)}_to_${formatISOForFile(endISO)}.csv`;
  }
  return `${base}.csv`;
}

function exportTripsWithLabel(trips, label, startISO="", endISO=""){
  const rows = Array.isArray(trips) ? trips : [];
  const csvEscape = (v)=>{
    const s = String(v ?? "");
    if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"' ;
    return s;
  };
  const header = ["Date","Dealer","Area","Pounds","Amount","$/Lb"].join(",");
  const lines = [header];
  for(const t of rows){
    const date = formatDateDMY(String(t?.dateISO||""));
    const dealer = String(t?.dealer||"");
    const area = String(t?.area||"");
    const lbs = Number(t?.pounds)||0;
    const amt = Number(t?.amount)||0;
    const ppl = (lbs>0 && amt>0) ? (amt/lbs) : 0;
    lines.push([
      csvEscape(date),
      csvEscape(dealer),
      csvEscape(area),
      csvEscape(to2(lbs)),
      csvEscape(to2(amt)),
      csvEscape(to2(ppl))
    ].join(","));
  }
  const csv = lines.join("\n");
  const filename = tripsFilename(label, startISO, endISO);

  // Prefer download, but fall back for Android/PWA if needed.
  try{
    downloadText(filename, csv);
    return;
  }catch(e){}

  try{
    const blob = new Blob([csv], {type:"text/csv"});
    const file = new File([blob], filename, {type:"text/csv"});
    // Share if available (Android/Chrome PWA)
    if(navigator?.canShare && navigator.canShare({ files:[file] }) && navigator?.share){
      navigator.share({ files:[file], title:"Trips CSV" });
      return;
    }
  }catch(e){}

  try{
    // Last resort: open CSV in a new tab
    const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    window.open(url, "_blank");
  }catch(e){}
}

function renderAllTrips(){
  ensureTripsFilter();
  const root = getApp();

  const { rows:sorted, range:r, tf } = getTripsFilteredRows();
  const opt = getFilterOptionsFromTrips();

  const rangeOptions = [
    ["all","All"],
    ["ytd","YTD"],
    ["12m","Last 12m"],
    ["90d","Last 90d"],
    ["30d","Last 30d"],
    ["custom","Custom"]
  ];

  const filtersCard = `
    <div class="card">
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="min-width:140px;flex:1">
          <div class="muted small">Range</div>
          <select id="flt_range" class="select">
            ${rangeOptions.map(([k,l])=>`<option value="${k}" ${tf.range===k?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>

        <div style="min-width:140px;flex:1">
          <div class="muted small">Dealer</div>
          <select id="flt_dealer" class="select">
            <option value="all" ${tf.dealer==="all"?"selected":""}>All</option>
            ${opt.dealers.map(d=>`<option value="${escapeHtml(d)}" ${tf.dealer===d?"selected":""}>${escapeHtml(d)}</option>`).join("")}
          </select>
        </div>

        <div style="min-width:140px;flex:1">
          <div class="muted small">Area</div>
          <select id="flt_area" class="select">
            <option value="all" ${tf.area==="all"?"selected":""}>All</option>
            ${opt.areas.map(a=>`<option value="${escapeHtml(a)}" ${tf.area===a?"selected":""}>${escapeHtml(a)}</option>`).join("")}
          </select>
        </div>

        <div style="min-width:160px;flex:1;opacity:.75">
          <div class="muted small">Species (Coming soon)</div>
          <select id="flt_species" class="select" disabled aria-disabled="true">
            <option>Coming soon</option>
          </select>
        </div>

        <div style="min-width:160px;flex:2;display:flex;align-items:flex-end">
          <button class="btn" id="exportTrips" type="button" style="width:100%">Export CSV</button>
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn" id="flt_reset" type="button">Reset</button>
        </div>
      </div>

      <div id="flt_custom_wrap" style="margin-top:10px;display:${tf.range==="custom"?"block":"none"}">
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <div style="min-width:140px;flex:1">
            <div class="muted small">From</div>
            <input id="flt_from" type="date" class="input" value="${escapeHtml(String(tf.fromISO||"").slice(0,10))}" />
          </div>
          <div style="min-width:140px;flex:1">
            <div class="muted small">To</div>
            <input id="flt_to" type="date" class="input" value="${escapeHtml(String(tf.toISO||"").slice(0,10))}" />
          </div>
        </div>
      </div>

      <div class="muted small mt10">
        Showing: <b>${escapeHtml(tripsActiveLabel(tf, r.label))}</b>
      </div>
    </div>
  `;

  const rows = sorted.length
    ? sorted.map(t=> renderTripCatchCard(t, { interactive:true })).join("")
    : `<div class="muted small">No trips in this filter yet.</div>`;

  root.innerHTML = `
    ${renderPageHeader("all_trips")}

    ${filtersCard}

    <div style="height:10px"></div>

    ${rows}
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

  const rerender = ()=>{ saveState(); renderAllTrips(); };

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
    state.tripsFilter = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all" };
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
}

function renderHome(
){
  const tripsAll = Array.isArray(state.trips) ? state.trips : [];
  ensureHomeFilter();
  const hf = state.homeFilter || { mode:"YTD", from:"", to:"" };
  const hMode = String(hf.mode || "YTD").toUpperCase();
  const hr = modeRange(hMode, hf.from, hf.to);
  const trips = (hr.label === "ALL") ? tripsAll.slice() : (hr.startISO && hr.endISO ? filterByISOInclusive(tripsAll, hr.startISO, hr.endISO) : tripsAll.slice());
  const totalAmount = trips.reduce((s,t)=> s + (Number(t?.amount)||0), 0);
  const totalLbs = trips.reduce((s,t)=> s + (Number(t?.pounds)||0), 0);

  const lbsVal = to2(totalLbs);
  const lbsStr = (Number.isFinite(lbsVal) && Math.abs(lbsVal % 1) < 1e-9) ? String(Math.trunc(lbsVal)) : String(lbsVal);
  const moneyRounded = (()=>{
    const v = Math.round(Number(totalAmount)||0);
    try{ return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v); }
    catch{ return "$" + v.toLocaleString("en-US"); }
  })();


  // Backup reminder (browser-only): encourages manual "Create Backup" periodically
  const s = state.settings || (state.settings = {});

  // PWA storage note (iOS/Android): Safari vs installed app may keep separate on-device storage
  const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (window.navigator && window.navigator.standalone === true);
  const pwaNoteDismissed = !!s.pwaStorageNoteDismissed;
  const showPwaStorageNote = isStandalone && !pwaNoteDismissed;
  const pwaStorageNoteHTML = showPwaStorageNote ? `
    <div class="card">
      <b>Using the installed app?</b>
      <div class="muted small" style="margin-top:6px;line-height:1.45">
        On iPhone/iPad (and sometimes Android), the installed Home Screen app can store data separately from Safari.
        If you logged trips in Safari, create a backup there and restore it here.
      </div>
      <div class="row mt10">
        <button class="btn" id="pwaNoteHelp">How to move trips</button>
        <button class="btn" id="pwaNoteDismiss">Got it</button>
      </div>
    </div>
  ` : "";

  const now = Date.now();
  const lastAt = Number(s.lastBackupAt || 0);
  const lastCount = Number(s.lastBackupTripCount || 0);
  const snoozeUntil = Number(s.backupSnoozeUntil || 0);
  const newCount = tripsAll.length - lastCount;
  const daysSince = lastAt ? ((now - lastAt) / (1000*60*60*24)) : 999;
  const shouldRemind = tripsAll.length > 0
    && now > snoozeUntil
    && (
      (!lastAt && tripsAll.length >= 5) ||           // never backed up, 5+ trips
      (newCount > 0 && daysSince >= 7)               // new trips since last backup & a week passed
    );

  const backupReminderHTML = shouldRemind ? `
    <div class="card">
      <b>Backup reminder</b>
      <div class="muted small" style="margin-top:6px">
        You have ${newCount > 0 ? newCount : tripsAll.length} trip${(newCount > 1 || (!lastAt && tripsAll.length !== 1)) ? "s" : ""} not included in your most recent backup.
      </div>
      <div class="row mt10">
        <button class="btn" id="backupNow">💾 Create Backup</button>
        <button class="btn" id="backupLater">Not now</button>
      </div>
    </div>
  ` : "";

  const f = String((state.homeFilter && state.homeFilter.mode) || "YTD").toUpperCase();
  const chip = (key,label) => `<button class="chip segBtn ${f===key?'on is-selected':''}" data-hf="${key}" type="button">${label}</button>`;

  const tripsSorted = getTripsNewestFirst(trips);
  const rows = tripsSorted.length
    ? tripsSorted.slice(0, HOME_TRIPS_LIMIT).map(t=> renderTripCatchCard(t, { interactive:true })).join("")
    : `<div class="muted small">No trips in this range yet. Tap <b>＋ New Trip</b> to log your first one.</div>`;

  getApp().innerHTML = `
    ${renderPageHeader("home")}

    <div class="card dashCard">
      <div class="segWrap">
        ${chip("YTD","YTD")}
        ${chip("MONTH","Month")}
        ${chip("7D","7 Days")}
        ${chip("RANGE","Range")}
      </div>
      ${f==="RANGE" ? `
        <div class="row mt10 gap10 wrap dateRangeRow">
          <div class="homeRangeInputs">
            <input class="input" id="homeRangeFrom" type="date" value="${escapeHtml(parseReportDateToISO(hf.from))}" />
            <input class="input" id="homeRangeTo" type="date" value="${escapeHtml(parseReportDateToISO(hf.to))}" />
          </div>
          <button class="btn" id="homeRangeApply">Apply</button>
        </div>
      ` : ``}

      <div class="kpiRow">
        <div class="kpiCard">
          <div class="kpiValue">${trips.length}</div>
          <div class="kpiLabel">Trips</div>
        </div>
        <div class="kpiCard">
          <div class="kpiValue lbsBlue">${lbsStr} lbs</div>
          <div class="kpiLabel">Harvested</div>
        </div>
        <div class="kpiCard">
          <div class="kpiValue money">${moneyRounded}</div>
          <div class="kpiLabel">Total</div>
        </div>
      </div>
    </div>

    ${pwaStorageNoteHTML}

    ${backupReminderHTML}

    <div id="reviewWarnings"></div>

    <div class="card">
      <b>Trips</b>
      <div class="sep"></div>
      <div class="triplist">${rows}</div>
      ${trips.length > HOME_TRIPS_LIMIT ? `<div style="margin-top:10px"><button class="btn" id="viewAllTrips">View all trips</button></div>` : ``}
    </div>
  `;

  // ensure top of view on iPhone
  try{ const _app = getApp(); if(_app) _app.scrollTop = 0; }catch(_e){}


  const vbtn = document.getElementById("viewAllTrips");
  if(vbtn){ vbtn.onclick = ()=>{ pushView(state, "all_trips"); }; }


// Open trip to edit
  getApp().querySelectorAll(".trip[data-id]").forEach(card=>{
    const open = ()=>{
      const id = card.getAttribute("data-id");
      if(!id) return;
      state.view = "edit";
      state.editId = id;
      saveState();
      render();
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); }
    });
  });

  // Home Filters
  getApp().querySelectorAll("button.chip[data-hf]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      ensureHomeFilter();
      state.homeFilter.mode = String(btn.getAttribute("data-hf")||"YTD").toUpperCase();
      saveState();
      renderHome();
    });
  });
  const homeApply = document.getElementById("homeRangeApply");
  if(homeApply){
    homeApply.onclick = ()=>{
      ensureHomeFilter();
      const from = parseReportDateToISO(document.getElementById("homeRangeFrom")?.value || "");
      const to = parseReportDateToISO(document.getElementById("homeRangeTo")?.value || "");
      state.homeFilter.from = from;
      state.homeFilter.to = to;
      saveState();
      renderHome();
    };
  }
  bindDatePill("homeRangeFrom");
  bindDatePill("homeRangeTo");

const toggleToast = (e)=>{
  try{
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const t = document.getElementById("toast");
    if(t?.classList?.contains?.("show")){      t.classList.remove("show");
      return;
    }
    showToast(tipMsg);
  }catch{
    showToast(tipMsg);
  }
};

const btnPaste = document.getElementById("paste");
const warn = document.getElementById("warn");

if(btnPaste){
  btnPaste.onclick = toggleToast;
  btnPaste.onkeydown = (e)=>{ if(e.key==="Enter"||e.key===" ") toggleToast(e); };
}
if(warn){
  warn.onclick = toggleToast;
}


  // PWA storage note buttons (may not exist if note not shown)
  const btnPwaDismiss = document.getElementById("pwaNoteDismiss");
  if(btnPwaDismiss){
    btnPwaDismiss.onclick = ()=>{
      const s = state.settings || (state.settings = {});
      s.pwaStorageNoteDismissed = true;
      state.lastAction = "pwaNote:dismiss";
      saveState();
      render();
    };
  }
  const btnPwaHelp = document.getElementById("pwaNoteHelp");
  if(btnPwaHelp){
    btnPwaHelp.onclick = ()=>{
      state.view = "help";
      state.lastAction = "nav:help";
      saveState();
      render();
      // optional: could scroll to section via hash later
    };
  }

  // Backup reminder buttons (may not exist if reminder not shown)
  const btnBackupNow = document.getElementById("backupNow");
  if(btnBackupNow){
    btnBackupNow.onclick = async ()=>{
      try{
        const r = await exportBackup();
        state.settings = state.settings || {};
        state.settings.lastBackupAt = Date.now();
        state.settings.lastBackupTripCount = Array.isArray(state.trips) ? state.trips.length : 0;
        state.settings.backupSnoozeUntil = 0;
        saveState();
        showToast(r?.method === "share" ? "Share opened" : "Backup created");
      }catch(e){
        showToast("Backup failed");
      }finally{
        renderHome();
      }
    };
  }
  const btnBackupLater = document.getElementById("backupLater");
  if(btnBackupLater){
    btnBackupLater.onclick = ()=>{
      state.settings = state.settings || {};
      // Snooze for 24 hours
      state.settings.backupSnoozeUntil = Date.now() + (24*60*60*1000);
      saveState();
      renderHome();
    };
  }
}

function renderNewTrip(){
  ensureAreas();
  ensureDealers();
  const dealerAddSentinel = "__add_new_dealer__";
  const areaAddSentinel = "__add_new_area__";
  // Defaults
  const todayISO = new Date().toISOString().slice(0,10);
  const draft = state.draft || { dateISO: todayISO, dealer:"", pounds:"", amount:"", area:"" };
  const amountVal = String(draft.amount ?? "");


  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${escapeHtml(String(a||""))}" ${sel}>${label}</option>`;
  }).concat(`<option value="${areaAddSentinel}">+ Add new Area</option>`).join("");



// Recent (last 2) unique values from saved trips (ignores filters)
// NOTE: Chips are always shown; if none exist yet we show a muted "No recent …" line.
const topAreas = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 2), 2);
const topDealers = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 2), 2);

const dealerListForSelect = [];
const seenDealerKeys = new Set();
for(const d of [...topDealers, ...(Array.isArray(state.dealers)?state.dealers:[])]){
  const v = String(d||"").trim();
  if(!v) continue;
  const k = normalizeKey(v);
  if(seenDealerKeys.has(k)) continue;
  seenDealerKeys.add(k);
  dealerListForSelect.push(v);
}
const dealerOptions = ["", ...dealerListForSelect].map(d=>{
  const label = d ? d : "—";
  const sel = (normalizeKey(String(draft.dealer||"")) === normalizeKey(String(d||""))) ? "selected" : "";
  const v = String(d||"").replaceAll('"',"&quot;");
  return `<option value="${v}" ${sel}>${escapeHtml(label)}</option>`;
}).concat(`<option value="${dealerAddSentinel}">+ Add new Dealer</option>`).join("");

const getBarSelectChoices = (kind)=>{
  if(kind === "dealer") return [...dealerListForSelect];
  return Array.isArray(state.areas) ? [...state.areas] : [];
};

;getApp().innerHTML = `
    ${renderPageHeader("new")}

    <div class="card formCard">
      <form id="newTripForm">

      <section class="trip-section">
      <div class="field">
        <label class="fieldLabel overline center" for="t_date">HARVEST DATE</label>
        <div class="dateRow">
          <span class="dateIcon">${iconSvg("calendar")}</span>
          <input class="input datePill" id="t_date" type="date" enterkeyhint="next" value="${escapeHtml(String(draft.dateISO||isoToday()).slice(0,10))}" />
          <button class="todayBtn" id="todayBtn" type="button">Today</button>
        </div>
      </div>

      </section>

      <section class="trip-section">
      <div class="field">
        <label class="fieldLabel overline center" for="t_dealer">DEALERS</label>
        ${renderTopDealerChips(topDealers, draft.dealer, "topDealers")}
        <div class="selectWithBtn">
          <div class="selectRowWrap">
            <select class="input" id="t_dealer" autocomplete="organization" enterkeyhint="next">
              ${dealerOptions}
            </select>
            <span class="chev">›</span>
          </div>
          <button class="btn btnInlineAdd" id="addDealerInline" type="button">+ Add</button>
        </div>
        <div id="dealerPrompt"></div>
      </div>

      </section>

      <section class="trip-section">
      <div class="grid2">
        <div class="field">
          <label class="fieldLabel overline" for="t_pounds">POUNDS</label>
          <div class="inputWrap">
            <input class="input inputWithSuffix" id="t_pounds" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.0" value="${escapeHtml(String(draft.pounds??""))}" required min="0" step="0.1" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocapitalize="none" spellcheck="false"/>
            <span class="unitSuffix lbsBlue">lbs</span>
          </div>
        </div>
        <div class="field">
          <label class="fieldLabel overline" for="t_amount">AMOUNT</label>
          <div class="inputWrap">
            <span class="moneyPrefix moneyGreen">$</span>
            <input class="input inputWithPrefix" id="t_amount" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.00" value="${escapeHtml(String(amountVal))}" required min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocapitalize="none" spellcheck="false"/>
          </div>
        </div>
      </div>
      <div class="rateLine muted small">$/lb: <b class="rate ppl" id="rateValue">${formatMoney(computePPL(Number(draft.pounds||0), Number(draft.amount||0)))}</b></div>

      </section>

      <section class="trip-section">
      <div class="field">
        <label class="fieldLabel overline center" for="t_area">AREA</label>
        ${renderTopAreaChips(topAreas, draft.area, "topAreas")}
        <div class="selectWithBtn">
          <div class="selectRowWrap">
            <select class="input" id="t_area" enterkeyhint="done">
              ${areaOptions}
            </select>
            <span class="chev">›</span>
          </div>
          <button class="btn btnInlineAdd" id="addAreaInline" type="button">+ Add</button>
        </div>
        <div id="areaPrompt"></div>
      </div>

      </section>

      <section class="trip-section trip-actions">
      <div class="tripActionBar">
  <div class="tripActionRow">
    <button class="btn primary" id="saveTrip" type="submit" disabled>Save Trip</button>
    <button class="btn danger" id="clearDraft" type="button">Clear</button>
  </div>
</div>
</section>

      </form>

    </div>
  `;
  bindNavHandlers(state);

  const elDate = document.getElementById("t_date");
  const elDealer = document.getElementById("t_dealer");
  const elPounds = document.getElementById("t_pounds");
  const elAmount = document.getElementById("t_amount");

  const elArea = document.getElementById("t_area");
  const elRate = document.getElementById("rateValue");
  bindDatePill("t_date");
  const elDealerPrompt = document.getElementById("dealerPrompt");
  const elAreaPrompt = document.getElementById("areaPrompt");
  const btnAddDealer = document.getElementById("addDealerInline");
  const btnAddArea = document.getElementById("addAreaInline");

  const updateRateLine = ()=>{
    if(!elRate) return;
    const p = Number(String(elPounds?.value||"").trim() || 0);
    const a = Number(String(elAmount?.value||"").trim() || 0);
    elRate.textContent = formatMoney(computePPL(p, a));
  };
  const openQuickAdd = (kind, opts = {})=>{
    const isDealer = (kind==="dealer");
    const label = isDealer ? "Dealer" : "Area";
    const placeholder = isDealer ? "New dealer name" : "New area (ex: 19/626)";
    const errId = "modalQuickAddErr";
    const inputId = "modalQuickAddInput";
    const addId = "modalQuickAddDoAdd";
    const cancelId = "modalQuickAddCancel";
    const onAdded = (typeof opts.onAdded === "function") ? opts.onAdded : null;

    openModal({
      title: `Add ${label}`,
      backdropClose: false,
      escClose: false,
      showCloseButton: false,
      position: "center",
      html: `
        <div class="field">
          <label class="srOnly" for="${inputId}">${escapeHtml(label)} name</label>
          <input class="input" id="${inputId}" placeholder="${escapeHtml(placeholder)}" autocomplete="${isDealer ? "organization" : "off"}" enterkeyhint="done" />
          <div class="modalErr" id="${errId}" style="display:none"></div>
        </div>
        <div class="modalActions">
          <button class="btn" id="${cancelId}" type="button">Cancel</button>
          <button class="btn primary" id="${addId}" type="button">Add</button>
        </div>
      `,
      onOpen: ()=>{
        const elIn = document.getElementById(inputId);
        const elErr = document.getElementById(errId);
        const showErr = (msg)=>{
          if(!elErr) return;
          elErr.textContent = msg;
          elErr.style.display = "block";
        };
        const clearErr = ()=>{
          if(!elErr) return;
          elErr.textContent = "";
          elErr.style.display = "none";
        };

        const commit = ()=>{
          clearErr();
          const raw = String(elIn?.value||"").trim();
          if(!raw){
            showErr("Enter a value first.");
            elIn?.focus();
            return;
          }
          if(raw.length > 40){
            showErr("Keep it under 40 characters.");
            elIn?.focus();
            return;
          }

          let addedValue = raw;
          if(isDealer){
            if(!Array.isArray(state.dealers)) state.dealers = [];
            const key = normalizeKey(raw);
            const exists = state.dealers.some(d => normalizeKey(String(d||"")) === key);
            if(exists){
              showErr("That dealer already exists.");
              return;
            }
            state.dealers.push(raw);
            ensureDealers();
            addedValue = state.dealers.find(d => normalizeKey(String(d||"")) === key) || raw;
            state.draft = { ...(state.draft||draft), dealer: addedValue };
          }else{
            if(!Array.isArray(state.areas)) state.areas = [];
            const key = normalizeKey(raw);
            const exists = state.areas.some(a => normalizeKey(String(a||"")) === key);
            if(exists){
              showErr("That area already exists.");
              return;
            }
            state.areas.push(raw);
            ensureAreas();
            addedValue = state.areas.find(a => normalizeKey(String(a||"")) === key) || raw;
            state.draft = { ...(state.draft||draft), area: addedValue };
          }

          saveState();
          closeModal();
          if(onAdded){
            onAdded(addedValue);
            return;
          }
          render();
        };

        document.getElementById(cancelId)?.addEventListener("click", ()=>{
          closeModal();
        });
        document.getElementById(addId)?.addEventListener("click", commit);
        elIn?.addEventListener("keydown", (e)=>{
          if(e.key === "Enter"){
            e.preventDefault();
            commit();
          }
        });

        setTimeout(()=>elIn?.focus(), 50);
      }
    });
  };


  btnAddDealer?.addEventListener("click", ()=>openQuickAdd("dealer"));
  btnAddArea?.addEventListener("click", ()=>openQuickAdd("area"));

  const elToday = document.getElementById("todayBtn");

  // Quick-pick chip containers
  const topAreaWrap = document.getElementById("topAreas");
  const topDealerWrap = document.getElementById("topDealers");

  // Enable Save only when required fields are valid, and keep lbs/$ coloring consistent.
  const updateSaveEnabled = ()=>{
    const dealerOk = !!String(elDealer?.value||"").trim();
    const areaOk = !!String(elArea?.value||"").trim();
    const pounds = parseNum(elPounds?.value);
    const amount = parseMoney(elAmount?.value);
    const poundsOk = isFinite(pounds) && pounds > 0;
    const amountOk = isFinite(amount) && amount > 0;

    if(elPounds) elPounds.classList.toggle("lbsBlue", poundsOk);
    if(elAmount) elAmount.classList.toggle("money", amountOk);

    const btn = document.getElementById("saveTrip");
    if(btn){
      const enabled = (dealerOk && areaOk && poundsOk && amountOk);
      btn.disabled = !enabled;
      btn.setAttribute("aria-disabled", enabled ? "false" : "true");
      // Prevent accidental taps while scrolling (iOS/Android)
      btn.style.pointerEvents = enabled ? "auto" : "none";
      btn.style.opacity = enabled ? "1" : "0.55";
    }
  };

  // Bind numeric field UX ONCE per render (never inside updateSaveEnabled)
  if(elPounds && !elPounds.__boundNumeric){
    elPounds.__boundNumeric = true;
    const prime = ()=>primeNumericField(elPounds, ["0","0.0","0.00"]);
    elPounds.addEventListener("pointerdown", prime);
    elPounds.addEventListener("focus", prime);
    elPounds.addEventListener("input", ()=>{
      const s = sanitizeDecimalInput(elPounds.value);
      if(s !== elPounds.value) elPounds.value = s;
      updateSaveEnabled();
      updateRateLine();
    });
    elPounds.addEventListener("blur", ()=>{
      if(String(elPounds.value||"").endsWith(".")) elPounds.value = String(elPounds.value).slice(0, -1);
      updateSaveEnabled();
      updateRateLine();
    });
  }

  if(elAmount && !elAmount.__boundNumeric){
    elAmount.__boundNumeric = true;
    const prime = ()=>primeNumericField(elAmount, ["0","0.0","0.00"]);
    elAmount.addEventListener("pointerdown", prime);
    elAmount.addEventListener("focus", prime);
    elAmount.addEventListener("input", ()=>{
      const s = sanitizeDecimalInput(elAmount.value);
      if(s !== elAmount.value) elAmount.value = s;
      updateSaveEnabled();
      updateRateLine();
    });
    elAmount.addEventListener("blur", ()=>{
      normalizeAmountOnBlur(elAmount);
      updateSaveEnabled();
      updateRateLine();
    });
  }

  if(elToday && elDate){
    elToday.onclick = ()=>{
      const today = isoToday();
      elDate.value = today;
      state.draft = state.draft || {};
      state.draft.dateISO = today;
      saveDraft();
      updateSaveEnabled();
      updateRateLine();
    };
  }

  // NEW TRIP: wire up buttons (Save / Clear) — v22
  const btnSave = document.getElementById("saveTrip");
  const onSaveTrip = async ()=>{
    try{
      // Hard guard: if button is disabled, do nothing (prevents scroll-tap accidents).
      if(btnSave?.disabled) return;
      // Double-save latch (iOS/Android fast taps)
      if(state._savingTrip) return;
      state._savingTrip = true;
      saveState();

      // snapshot current inputs into draft
      state.draft = state.draft || {};
      const rawDate = String(elDate?.value||"").trim();
// v71: t_date is type="date" (YYYY-MM-DD). Accept both ISO and legacy MM/DD/YYYY.
const iso = rawDate.includes("-") ? rawDate.slice(0,10) : (parseMDYToISO(rawDate) || "");
const mdy = rawDate.includes("-") ? formatDateDMY(iso) : rawDate;
state.draft.dateISO = iso || state.draft.dateISO || "";
state.draft.dealer = normalizeDealerDisplay(String(elDealer?.value||"").trim());
      state.draft.pounds = parseNum(elPounds?.value);
      state.draft.amount = parseMoney(elAmount?.value);
      state.draft.area = String(elArea?.value||"").trim();

      // basic guard: if nothing entered, do nothing (prevents "dead tap" feel)
      const anyEntered = Boolean(mdy || state.draft.dealer || (state.draft.pounds>0) || (state.draft.amount>0) || state.draft.area);
      if(!anyEntered){
        showToast("Enter trip details first");
        state._savingTrip = false; saveState();
        return;
      }


// v59: confirm + save now (no review screen)
const summary =
  `Dealer: ${String(state.draft.dealer||"").trim() || "—"}
` +
  `Area: ${String(state.draft.area||"").trim() || "—"}
` +
  `Pounds: ${String(state.draft.pounds||"").trim() || "—"}
` +
  `Amount: ${String(state.draft.amount||"").trim() || "—"}`;
const ok = await confirmSaveModal({ title: "Save this trip?", body: summary });
if(!ok){ state._savingTrip = false; saveState(); return; }

commitTripFromDraft({
  mode: "new",
  inputs: {
    date: mdy,
    dealer: state.draft.dealer,
    pounds: state.draft.pounds,
    amount: state.draft.amount,
    area: state.draft.area
  },
  nextView: "all_trips"
});
      state._savingTrip = false; saveState();

    }catch(err){
      try{ showFatal(err, "saveTrip"); }catch{}
      state._savingTrip = false; saveState();
    }
  };
  const newTripForm = document.getElementById("newTripForm");
  if(newTripForm){
    newTripForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      onSaveTrip();
    });
  }
  if(elAmount && elArea){
    elAmount.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      elArea.focus();
    });
  }
  if(elArea){
    elArea.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      onSaveTrip();
    });
  }
  if(btnSave){
    // iOS standalone can occasionally miss 'click'—bind both.
    btnSave.addEventListener("touchend", (e)=>{ if(btnSave.disabled) return; e.preventDefault(); onSaveTrip(); }, {passive:false});
  }
const btnClear = document.getElementById("clearDraft");
  if(btnClear){
    btnClear.onclick = ()=>{
      if(confirm("Clear this draft?")){
        delete state.draft;
        saveState();
        renderNewTrip();
      }
    };
  }
// Persist draft as the user edits fields (fixes iOS select + prevents resets)
  const persistDraft = ()=>{ try{ saveDraft(); }catch{}; try{ updateSaveEnabled(); }catch{} };
  [elDate, elDealer, elPounds, elAmount].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", persistDraft);
    el.addEventListener("change", persistDraft);
  });
  if(elArea){
    elArea.addEventListener("input", persistDraft);
    elArea.addEventListener("change", persistDraft);
  }

  const handleSelectAddNew = (kind, selectEl)=>{
    const sentinel = kind === "dealer" ? dealerAddSentinel : areaAddSentinel;
    const current = String(selectEl?.value || "");
    if(current !== sentinel) return false;
    openQuickAdd(kind, {
      onAdded: (addedValue)=>{
        const value = String(addedValue || "").trim();
        if(!value || !selectEl) return;
        selectEl.value = value;
        saveDraft();
        updateSaveEnabled();
        updateRateLine();
        renderNewTrip();
      }
    });
    return true;
  };

  elDealer?.addEventListener("change", ()=>{
    handleSelectAddNew("dealer", elDealer);
  });
  elArea?.addEventListener("change", ()=>{
    handleSelectAddNew("area", elArea);
  });

if(topAreaWrap && elArea){
  topAreaWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-area]");
    if(!btn) return;
    if(btn.__suppressNextClick){
      btn.__suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      return;
    }
    const a = String(btn.getAttribute("data-area") || "").trim();
    if(!a) return;
    elArea.value = a;
    state.draft = state.draft || {};
    state.draft.area = a;
    saveDraft();
    updateSaveEnabled();
      updateRateLine();
  });
}


if(topDealerWrap && elDealer){
  topDealerWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-dealer]");
    if(!btn) return;
    if(btn.__suppressNextClick){
      btn.__suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      return;
    }
    const d = String(btn.getAttribute("data-dealer") || "").trim();
    if(!d) return;
    elDealer.value = d;
    state.draft = state.draft || {};
    state.draft.dealer = d;
    saveDraft();
    updateSaveEnabled();
      updateRateLine();
  });
}

  bindQuickChipLongPress(topAreaWrap, (btn)=>{
    const slot = Number(btn?.getAttribute("data-chip-index") || -1);
    if(slot < 0) return;
    openQuickChipCustomizeModal({
      kind: "area",
      chipIndex: slot,
      currentValue: String(btn?.getAttribute("data-area") || ""),
      choices: getBarSelectChoices("area"),
      onSaved: ()=>renderNewTrip()
    });
  });

  bindQuickChipLongPress(topDealerWrap, (btn)=>{
    const slot = Number(btn?.getAttribute("data-chip-index") || -1);
    if(slot < 0) return;
    openQuickChipCustomizeModal({
      kind: "dealer",
      chipIndex: slot,
      currentValue: String(btn?.getAttribute("data-dealer") || ""),
      choices: getBarSelectChoices("dealer"),
      onSaved: ()=>renderNewTrip()
    });
  });

  // Initial state
  updateSaveEnabled();
      updateRateLine();
}

function renderReviewTrip(){
  ensureAreas();
  ensureDealers();
  const d = state.reviewDraft;
  if(!d){
    state.view = "new";
    saveState();
    return renderNewTrip();
  }

  const ppl = computePPL(Number(d.pounds||0), Number(d.amount||0));
  const amountDispR = displayAmount(d.amount);

  // Build area options + top areas (same logic as New Trip)
  const areaOptionsR = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(d.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${String(a||"").replaceAll('"','&quot;')}" ${sel}>${label}</option>`;
  }).join("");

  const dealerOptionsR = [""].concat(Array.isArray(state.dealers)?state.dealers:[]).map(dv=>{
    const label = dv ? dv : "—";
    const sel = (String(d.dealer||"").trim().toLowerCase() === String(dv||"").trim().toLowerCase()) ? "selected" : "";
    const v = String(dv||"").replaceAll('"',"&quot;");
    return `<option value="${v}" ${sel}>${escapeHtml(label)}</option>`;
  }).join("");

  const topAreasR = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 3), 3);

// Top 3 most-used Dealers (from saved trips) for quick selection
  // Last 3 unique Dealers (based on entry order; ignores filters)
  const topDealersR = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 3), 3);
getApp().innerHTML = `
    ${renderPageHeader("review")}

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="navBack">← Back</button>
        <b>Review & Confirm</b>
        <span class="muted small">v ${APP_VERSION}</span>
      </div>
      <div class="hint">Nothing saves until you press <b>Confirm &amp; Save Trip</b>. Edit any field if needed.</div>
    </div>

    <div class="card">
      <form class="form" id="reviewTripForm">
        <div class="field">
          <label class="label" for="r_date">Harvest date</label>
          <input class="input" id="r_date" type="date" enterkeyhint="next" value="${escapeHtml(String(d.dateISO||"").slice(0,10))}" />
        </div>

        <div class="field">
          <label class="label" for="r_dealer">Dealer</label>
          ${renderTopDealerChips(topDealersR, d.dealer, "topDealersR")}<input class="input" id="r_dealer" placeholder="Machias Bay Seafood" autocomplete="organization" enterkeyhint="next" value="${escapeHtml(String(d.dealer||""))}" />
          <div id="r_dealerSugg"></div>
          <div id="r_dealerPrompt"></div>
        </div>

        <div class="field">
          <label class="label" for="r_pounds">Pounds</label>
          <input class="input" id="r_pounds" type="text" inputmode="decimal" enterkeyhint="next" required min="0" step="0.1" pattern="[0-9]*[.,]?[0-9]*" value="${escapeHtml(String(d.pounds??""))}" />
        </div>

        <div class="field">
          <label class="label" for="r_amount">Amount</label>
          <input class="input" id="r_amount" type="text" inputmode="decimal" enterkeyhint="next" required min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" value="${escapeHtml(String(amountDispR))}" />
        </div>

        <div class="field">
          <label class="label" for="r_area">Area</label>
          ${renderTopAreaChips(topAreasR, d.area, "topAreasR")}
          <select class="select" id="r_area" enterkeyhint="done">
            ${areaOptionsR}
          </select>
        </div>

        <div class="pillbar">
          <span class="pill" id="pplPill">Price/Lb: <b class="rate ppl">${formatMoney(ppl)}</b></span>
        </div>

        ${d.raw ? `
          <div class="sep"></div>
          <div class="muted small" style="white-space:pre-wrap">${escapeHtml(d.raw)}</div>
        ` : ``}

        <div class="actions">
          <button class="btn good" id="confirmSave" type="submit">Confirm & Save Trip</button>
          <button class="btn ghost" id="cancelReview" type="button">Cancel</button>
        </div>
      </form>
    </div>
  `;

  getApp().scrollTop = 0;

  const goBack = ()=>{
    pushView(state, "new");
  };
  const __navBack = document.getElementById("navBack");
  if(__navBack) __navBack.onclick = ()=> goBack(state);
  const __cancelReview = document.getElementById("cancelReview");
  if(__cancelReview) __cancelReview.onclick = ()=>{
    if(confirm("Discard this review draft?")){
      delete state.reviewDraft;
      pushView(state, "new");
    }
  };

  // Persist draft + live-update Price/Lb + Area selection
  const pplPill = document.getElementById("pplPill");
  const elPoundsLive = document.getElementById("r_pounds");
  const elAmountLive = document.getElementById("r_amount");
  const elAreaLive = document.getElementById("r_area");
  const elDateLive = document.getElementById("r_date");
  const elDealerLive = document.getElementById("r_dealer");

  const updateReviewDerived = ()=>{
    if(!state.reviewDraft) return;
    const p = parseNum(elPoundsLive ? elPoundsLive.value : "");
    const a = parseMoney(elAmountLive ? elAmountLive.value : "");
    const area = String(elAreaLive ? elAreaLive.value : "").trim();
    const dateMDY = String(elDateLive ? elDateLive.value : "").trim();
    const dealer = normalizeDealerDisplay(String(elDealerLive ? elDealerLive.value : "").trim());
    state.reviewDraft.pounds = p;
    state.reviewDraft.amount = a;
    state.reviewDraft.area = area;
    state.reviewDraft.dateMDY = dateMDY;
    state.reviewDraft.dealer = dealer;

    // Color consistency: lbs blue, $ green
    try{
      const poundsOk = Number.isFinite(p) && p > 0;
      const amountOk = Number.isFinite(a) && a > 0;
      if(elPoundsLive) elPoundsLive.classList.toggle("lbsBlue", poundsOk);
      if(elAmountLive) elAmountLive.classList.toggle("money", amountOk);
    }catch(_){ }

    if(pplPill){
      const v = computePPL(Number(p||0), Number(a||0));
      pplPill.innerHTML = `Price/Lb: <b class="rate ppl">${formatMoney(v)}</b>`;
    }
    // Live warnings (missing fields + possible duplicate)
    try{
      const warnEl = document.getElementById("reviewWarnings");
      if(warnEl){
        const dateISO = parseReportDateToISO(document.getElementById("r_date")?.value || "");
        const dealer = normalizeDealerDisplay(String(document.getElementById("r_dealer")?.value || "").trim());
        const pounds = p;
        const amount = a;

        const missing = [];
        if(!dateISO) missing.push("Date");
        if(!dealer) missing.push("Dealer");
        if(!(pounds > 0)) missing.push("Pounds");
        if(!(amount > 0)) missing.push("Amount");

        const candidate = { dateISO, dealer, pounds, amount };
        const dup = (dateISO && dealer && pounds > 0 && amount > 0) ? findDuplicateTrip(candidate, null) : null;

        let html = "";
        if(missing.length){
          html += `
            <div class="card" style="border-color:rgba(255,184,77,.55);background:rgba(255,184,77,.10)">
              <b>Needs attention</b>
              <div class="muted small" style="margin-top:6px;line-height:1.35">
                Missing/invalid: <b>${missing.join(", ")}</b>
              </div>
            </div>
          `;
        }
        if(dup){
          html += `
            <div class="card" style="border-color:rgba(255,184,77,.55);background:rgba(255,184,77,.10)">
              <b>Possible duplicate</b>
              <div class="muted small" style="margin-top:6px;line-height:1.35">
                Similar trip found: <b>${escapeHtml(formatDateDMY(dup.dateISO||""))}</b> — ${escapeHtml(String(dup.dealer||""))} (<span class="money">${formatMoney(dup.amount||0)}</span> / <span class="lbsBlue">${to2(Number(dup.pounds||0))} lbs</span>)
              </div>
            </div>
          `;
        }
        warnEl.innerHTML = html;
      }
    }catch(_){}
    saveState();
  };

  function updateReviewDealerPrompt(){
    const box = document.getElementById("r_dealerPrompt");
    if(!box) return;
    const current = String(document.getElementById("r_dealer")?.value||"").trim();
    const canonical = findCanonicalFromList(current, state.dealers);
    if(!current || canonical){
      box.innerHTML = "";
      return;
    }
    const rd = state.reviewDraft || {};
    const armed = String(rd._dealerPromptValue||"").trim();
    const suppressed = String(rd._dealerPromptSuppressed||"").trim();
    if(!armed || armed.toLowerCase() !== current.toLowerCase()){
      box.innerHTML = "";
      return;
    }
    if(suppressed && suppressed.toLowerCase() === current.toLowerCase()){
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">
      <div class="muted small">Save <b>${escapeHtml(current)}</b> to Dealers?</div>
      <button class="smallbtn" id="r_saveDealer">Save</button>
      <button class="smallbtn" id="r_noSaveDealer">Not now</button>
    </div>`;

    document.getElementById("r_saveDealer")?.addEventListener("click", ()=>{
      state.dealers = Array.isArray(state.dealers) ? state.dealers : [];
      state.dealers.push(current);
      ensureDealers();
      saveState();

      const canon = findCanonicalFromList(current, state.dealers) || current;
      const el = document.getElementById("r_dealer");
      if(el) el.value = canon;
      
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft.dealer = canon;
      state.reviewDraft._dealerPromptValue = null;
      state.reviewDraft._dealerPromptSuppressed = null;
      saveState();
      renderReviewTrip();
    });

    document.getElementById("r_noSaveDealer")?.addEventListener("click", ()=>{
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft._dealerPromptSuppressed = current;
      state.reviewDraft._dealerPromptValue = null;
      saveState();
      updateReviewDealerPrompt();
    });
  }



  // iOS sometimes fires change more reliably than input for certain keyboards/pickers.
  [elPoundsLive, elAmountLive].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", updateReviewDerived);
    el.addEventListener("change", updateReviewDerived);
    el.addEventListener("blur", updateReviewDerived);
  });
  if(elAreaLive){
    elAreaLive.addEventListener("input", updateReviewDerived);
    elAreaLive.addEventListener("change", updateReviewDerived);
  }


  [elDateLive, elDealerLive].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", updateReviewDerived);
    el.addEventListener("change", updateReviewDerived);
    el.addEventListener("blur", updateReviewDerived);
  });

  if(elDealerLive){
    elDealerLive.addEventListener("blur", ()=>{
      const raw = String(elDealerLive.value||"").trim();
      const canonical = findCanonicalFromList(raw, state.dealers);
      if(canonical){
        elDealerLive.value = canonical;
        state.reviewDraft = state.reviewDraft || {};
        state.reviewDraft.dealer = canonical;
        state.reviewDraft._dealerPromptValue = null;
        state.reviewDraft._dealerPromptSuppressed = null;
        saveState();
        updateReviewDealerPrompt();
        updateReviewDerived();
        return;
      }
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft.dealer = raw;
      state.reviewDraft._dealerPromptValue = raw ? raw : null;
      saveState();
      updateReviewDealerPrompt();
      updateReviewDerived();
    });
    elDealerLive.addEventListener("input", ()=>{
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft._dealerPromptValue = null;
      saveState();
      updateReviewDealerPrompt();
    });
  }

  bindDatePill("r_date");
  
  
function updateReviewDealerSuggestions(){
  const wrap = document.getElementById("r_dealerSugg");
  const el = document.getElementById("r_dealer");
  if(!wrap || !el) return;
  wrap.innerHTML = renderSuggestions(state.dealers, el.value, "data-dealer-sugg-r");
}
const topAreaWrapR = document.getElementById("topAreasR");
const topDealerWrapR = document.getElementById("topDealersR");

const dealerSuggWrapR = document.getElementById("r_dealerSugg");
if(dealerSuggWrapR && elDealerLive){
  dealerSuggWrapR.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-dealer-sugg-r]");
    if(!btn) return;
    const d = btn.getAttribute("data-dealer-sugg-r") || "";
    elDealerLive.value = d;
    state.reviewDraft = state.reviewDraft || {};
    state.reviewDraft.dealer = d;
    state.reviewDraft._dealerPromptValue = null;
    state.reviewDraft._dealerPromptSuppressed = null;
    saveState();
    updateReviewDealerPrompt();
    updateReviewDerived();
    updateReviewDealerSuggestions();
  });
}

if(elDealerLive){
  elDealerLive.addEventListener("input", ()=>{
    updateReviewDealerSuggestions();
  });
}
  if(topAreaWrapR && elAreaLive){
    topAreaWrapR.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-area]");
      if(!btn) return;
      if(btn.__suppressNextClick){
        btn.__suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        return;
      }
      const a = String(btn.getAttribute("data-area") || "").trim();
      if(!a) return;
      elAreaLive.value = a;
      updateReviewDerived();
    });
  }

  if(topDealerWrapR && elDealerLive){
    topDealerWrapR.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-dealer]");
      if(!btn) return;
      if(btn.__suppressNextClick){
        btn.__suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        return;
      }
      const d = String(btn.getAttribute("data-dealer") || "").trim();
      if(!d) return;
      elDealerLive.value = d;
      updateReviewDerived();
    });
  }

  bindQuickChipLongPress(topAreaWrapR, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "area",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-area") || ""),
      onSaved: ()=>renderReviewTrip()
    });
  });

  bindQuickChipLongPress(topDealerWrapR, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "dealer",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-dealer") || ""),
      onSaved: ()=>renderReviewTrip()
    });
  });

  // Ensure pill reflects whatever is currently in the inputs.
  updateReviewDerived();
  const reviewTripForm = document.getElementById("reviewTripForm");
  if(reviewTripForm) reviewTripForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const elDate = document.getElementById("r_date");
    const elDealer = document.getElementById("r_dealer");
    const elPounds = document.getElementById("r_pounds");
    const elAmount = document.getElementById("r_amount");
    const elArea = document.getElementById("r_area");
    commitTripFromDraft({
      mode: "new",
      inputs: {
        date: elDate.value,
        dealer: elDealer.value,
        pounds: elPounds.value,
        amount: elAmount.value,
        area: elArea.value
      }
    });
  });
  if(elAmountLive && elAreaLive){
    elAmountLive.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      elAreaLive.focus();
    });
  }
  if(elAreaLive && reviewTripForm){
    elAreaLive.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      reviewTripForm.requestSubmit();
    });
  }
}

function renderEditTrip(){
  ensureAreas();
  ensureDealers();
  const id = String(state.editId || "");
  const trips = Array.isArray(state.trips) ? state.trips : [];
  const t = trips.find(x => String(x?.id||"") === id);
  if(!t){
    // If the trip no longer exists (deleted, reset, or bad deep-link), fail safe.
    state.editId = null;
    state.view = "all_trips";
    saveState();
    return renderHome();
  }

  const trip = t;

  const draft = {
    dateISO: t.dateISO || "",
    dealer: t.dealer || "",
    pounds: String(t.pounds ?? ""),
    amount: String(t.amount ?? ""),
    area: t.area || ""
  };

  const dealerAddSentinel = "__add_new_dealer__";
  const areaAddSentinel = "__add_new_area__";
  const amountDispE = displayAmount(t.amount);

  const topAreasE = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 2), 2);
  const topDealersE = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 2), 2);

  const dealerListForSelect = [];
  const seenDealerKeys = new Set();
  for(const d of [...topDealersE, ...(Array.isArray(state.dealers) ? state.dealers : [])]){
    const v = String(d || "").trim();
    if(!v) continue;
    const key = normalizeKey(v);
    if(seenDealerKeys.has(key)) continue;
    seenDealerKeys.add(key);
    dealerListForSelect.push(v);
  }

  const dealerOptions = ["", ...dealerListForSelect].map(dv=>{
    const label = dv ? dv : "—";
    const sel = (normalizeKey(String(draft.dealer || "")) === normalizeKey(String(dv || ""))) ? "selected" : "";
    const v = String(dv || "").replaceAll('"', "&quot;");
    return `<option value="${v}" ${sel}>${escapeHtml(label)}</option>`;
  }).concat(`<option value="${dealerAddSentinel}">+ Add new Dealer</option>`).join("");

  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${escapeHtml(String(a||""))}" ${sel}>${label}</option>`;
  }).concat(`<option value="${areaAddSentinel}">+ Add new Area</option>`).join("");


  getApp().innerHTML = `
    ${renderPageHeader("edit")}

    <div class="card formCard">
      <form id="editTripForm">
        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="e_date">HARVEST DATE</label>
            <div class="dateRow">
              <span class="dateIcon">${iconSvg("calendar")}</span>
              <input class="input datePill" id="e_date" type="date" enterkeyhint="next" value="${escapeHtml(String(draft.dateISO||"").slice(0,10))}" />
              <button class="todayBtn" id="todayBtnEdit" type="button">Today</button>
            </div>
          </div>
        </section>

        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="e_dealer">DEALERS</label>
            ${renderTopDealerChips(topDealersE, draft.dealer, "topDealersE")}
            <div class="selectWithBtn">
              <div class="selectRowWrap">
                <select class="input" id="e_dealer" autocomplete="organization" enterkeyhint="next">
                  ${dealerOptions}
                </select>
                <span class="chev">›</span>
              </div>
              <button class="btn btnInlineAdd" id="addDealerInlineEdit" type="button">+ Add</button>
            </div>
          </div>
        </section>

        <section class="trip-section">
          <div class="grid2">
            <div class="field">
              <label class="fieldLabel overline" for="e_pounds">POUNDS</label>
              <div class="inputWrap">
                <input class="input inputWithSuffix" id="e_pounds" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.0" value="${escapeHtml(String(draft.pounds??""))}" required min="0" step="0.1" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocapitalize="none" spellcheck="false"/>
                <span class="unitSuffix lbsBlue">lbs</span>
              </div>
            </div>
            <div class="field">
              <label class="fieldLabel overline" for="e_amount">AMOUNT</label>
              <div class="inputWrap">
                <span class="moneyPrefix moneyGreen">$</span>
                <input class="input inputWithPrefix" id="e_amount" type="text" inputmode="decimal" enterkeyhint="next" placeholder="0.00" value="${escapeHtml(String(amountDispE))}" required min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" autocapitalize="none" spellcheck="false"/>
              </div>
            </div>
          </div>
          <div class="rateLine muted small">$/lb: <b class="rate ppl" id="rateValueEdit">${formatMoney(computePPL(Number(draft.pounds||0), Number(draft.amount||0)))}</b></div>
        </section>

        <section class="trip-section">
          <div class="field">
            <label class="fieldLabel overline center" for="e_area">AREA</label>
            ${renderTopAreaChips(topAreasE, draft.area, "topAreasE")}
            <div class="selectWithBtn">
              <div class="selectRowWrap">
                <select class="input" id="e_area" enterkeyhint="done">
                  ${areaOptions}
                </select>
                <span class="chev">›</span>
              </div>
              <button class="btn btnInlineAdd" id="addAreaInlineEdit" type="button">+ Add</button>
            </div>
          </div>
        </section>

        <section class="trip-section trip-actions">
          <div class="tripActionBar">
            <div class="tripActionRow">
              <button class="btn primary" id="saveEdit" type="submit">Save Changes</button>
              <button class="btn" id="navCancel" type="button">Cancel</button>
              <button class="btn danger" id="deleteTrip" type="button">Delete</button>
            </div>
          </div>
        </section>
      </form>
    </div>
  `;

  // ensure top on iPhone
  getApp().scrollTop = 0;

  const elDate = document.getElementById("e_date");
  const elDealer = document.getElementById("e_dealer");
  const elPounds = document.getElementById("e_pounds");
  const elAmount = document.getElementById("e_amount");
  const elArea = document.getElementById("e_area");
  const elRate = document.getElementById("rateValueEdit");
  const elToday = document.getElementById("todayBtnEdit");
  const btnAddDealer = document.getElementById("addDealerInlineEdit");
  const btnAddArea = document.getElementById("addAreaInlineEdit");
  const topDealerWrapE = document.getElementById("topDealersE");
  const topAreaWrapE = document.getElementById("topAreasE");

  const updateRateLine = ()=>{
    if(!elRate) return;
    const p = Number(String(elPounds?.value || "").trim() || 0);
    const a = Number(String(elAmount?.value || "").trim() || 0);
    elRate.textContent = formatMoney(computePPL(p, a));
  };

  const openQuickAdd = (kind, opts = {})=>{
    const isDealer = (kind === "dealer");
    const label = isDealer ? "Dealer" : "Area";
    const placeholder = isDealer ? "New dealer name" : "New area (ex: 19/626)";
    const errId = "modalQuickAddErr";
    const inputId = "modalQuickAddInput";
    const addId = "modalQuickAddDoAdd";
    const cancelId = "modalQuickAddCancel";
    const onAdded = (typeof opts.onAdded === "function") ? opts.onAdded : null;

    openModal({
      title: `Add ${label}`,
      backdropClose: false,
      escClose: false,
      showCloseButton: false,
      position: "center",
      html: `
        <div class="field">
          <label class="srOnly" for="${inputId}">${escapeHtml(label)} name</label>
          <input class="input" id="${inputId}" placeholder="${escapeHtml(placeholder)}" autocomplete="${isDealer ? "organization" : "off"}" enterkeyhint="done" maxlength="40" />
          <div class="modalErr" id="${errId}" style="display:none"></div>
        </div>
        <div class="modalActions">
          <button class="btn" id="${cancelId}" type="button">Cancel</button>
          <button class="btn primary" id="${addId}" type="button">Add</button>
        </div>
      `,
      onOpen: ()=>{
        const elIn = document.getElementById(inputId);
        const elErr = document.getElementById(errId);
        const showErr = (msg)=>{
          if(!elErr) return;
          elErr.textContent = msg;
          elErr.style.display = "block";
        };
        const clearErr = ()=>{
          if(!elErr) return;
          elErr.textContent = "";
          elErr.style.display = "none";
        };

        const commit = ()=>{
          clearErr();
          const raw = String(elIn?.value || "").trim();
          if(!raw){
            showErr("Enter a value first.");
            elIn?.focus();
            return;
          }
          if(raw.length > 40){
            showErr("Keep it under 40 characters.");
            elIn?.focus();
            return;
          }

          let addedValue = raw;
          if(isDealer){
            if(!Array.isArray(state.dealers)) state.dealers = [];
            const key = normalizeKey(raw);
            const exists = state.dealers.some(d => normalizeKey(String(d || "")) === key);
            if(exists){ showErr("That dealer already exists."); return; }
            state.dealers.push(raw);
            ensureDealers();
            addedValue = state.dealers.find(d => normalizeKey(String(d || "")) === key) || raw;
          }else{
            if(!Array.isArray(state.areas)) state.areas = [];
            const key = normalizeKey(raw);
            const exists = state.areas.some(a => normalizeKey(String(a || "")) === key);
            if(exists){ showErr("That area already exists."); return; }
            state.areas.push(raw);
            ensureAreas();
            addedValue = state.areas.find(a => normalizeKey(String(a || "")) === key) || raw;
          }

          saveState();
          closeModal();
          if(onAdded) onAdded(addedValue);
        };

        document.getElementById(cancelId)?.addEventListener("click", ()=>closeModal());
        document.getElementById(addId)?.addEventListener("click", commit);
        elIn?.addEventListener("keydown", (e)=>{
          if(e.key !== "Enter") return;
          e.preventDefault();
          commit();
        });

        setTimeout(()=>elIn?.focus(), 50);
      }
    });
  };

  btnAddDealer?.addEventListener("click", ()=>openQuickAdd("dealer", { onAdded: (val)=>{ elDealer.value = val; updateSaveEnabled(); } }));
  btnAddArea?.addEventListener("click", ()=>openQuickAdd("area", { onAdded: (val)=>{ elArea.value = val; updateSaveEnabled(); } }));

  bindAreaChips("topAreasE", (a)=>{
    const nextArea = String(a||"").trim();
    if(!nextArea) return;
    elArea.value = nextArea;
    updateSaveEnabled();
  });
  if(topDealerWrapE && elDealer){
    topDealerWrapE.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-dealer]");
      if(!btn) return;
      if(btn.__suppressNextClick){
        btn.__suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        return;
      }
      const nextDealer = String(btn.getAttribute("data-dealer") || "").trim();
      if(!nextDealer) return;
      elDealer.value = nextDealer;
      updateSaveEnabled();
    });
  }

  const handleSelectAddNew = (kind, selectEl)=>{
    const sentinel = kind === "dealer" ? dealerAddSentinel : areaAddSentinel;
    if(String(selectEl?.value || "") !== sentinel) return;
    openQuickAdd(kind, {
      onAdded: (addedValue)=>{
        if(!selectEl) return;
        selectEl.value = String(addedValue || "").trim();
        updateSaveEnabled();
      }
    });
  };
  elDealer?.addEventListener("change", ()=>handleSelectAddNew("dealer", elDealer));
  elArea?.addEventListener("change", ()=>handleSelectAddNew("area", elArea));

  if(elToday && elDate){
    elToday.onclick = ()=>{ elDate.value = isoToday(); };
  }

  bindQuickChipLongPress(topDealerWrapE, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "dealer",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-dealer") || ""),
      choices: [...dealerListForSelect],
      onSaved: ()=>renderEditTrip()
    });
  });
  bindQuickChipLongPress(topAreaWrapE, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "area",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-area") || ""),
      onSaved: ()=>renderEditTrip()
    });
  });
  bindDatePill("e_date");

  bindNavHandlers(state);

  // Color consistency: lbs blue, $ green
  const updateSaveEnabled = ()=>{
    try{
      const p = parseNum(elPounds ? elPounds.value : "");
      const a = parseMoney(elAmount ? elAmount.value : "");
      const dealerOk = !!String(elDealer?.value || "").trim() && String(elDealer?.value || "") !== dealerAddSentinel;
      const areaOk = !!String(elArea?.value || "").trim() && String(elArea?.value || "") !== areaAddSentinel;
      const poundsOk = Number.isFinite(p) && p > 0;
      const amountOk = Number.isFinite(a) && a > 0;
      if(elPounds) elPounds.classList.toggle("lbsBlue", poundsOk);
      if(elAmount) elAmount.classList.toggle("money", amountOk);
      const btn = document.getElementById("saveEdit");
      if(btn){
        const enabled = dealerOk && areaOk && poundsOk && amountOk;
        btn.disabled = !enabled;
        btn.setAttribute("aria-disabled", enabled ? "false" : "true");
        btn.style.pointerEvents = enabled ? "auto" : "none";
        btn.style.opacity = enabled ? "1" : "0.55";
      }
    }catch(_){ }
  };
  updateSaveEnabled();
  updateRateLine();

  // Big-number keypad + better formatting (match New Trip)
  if(elPounds && !elPounds.__boundNumeric){
    elPounds.__boundNumeric = true;
    const prime = ()=>primeNumericField(elPounds, ["0","0.","0.0"]);
    elPounds.addEventListener("pointerdown", prime);
    elPounds.addEventListener("focus", prime);
    elPounds.addEventListener("input", ()=>{
      const s = sanitizeDecimalInput(elPounds.value);
      if(s !== elPounds.value) elPounds.value = s;
      updateSaveEnabled();
      updateRateLine();
    });
    elPounds.addEventListener("blur", ()=>{
      if(String(elPounds.value||"").endsWith(".")) elPounds.value = String(elPounds.value).slice(0, -1);
      updateSaveEnabled();
      updateRateLine();
    });
  }

  if(elAmount && !elAmount.__boundNumeric){
    elAmount.__boundNumeric = true;
    const prime = ()=>primeNumericField(elAmount, ["0","0.","0.0","0.00"]);
    elAmount.addEventListener("pointerdown", prime);
    elAmount.addEventListener("focus", prime);
    elAmount.addEventListener("input", ()=>{
      const s = sanitizeDecimalInput(elAmount.value);
      if(s !== elAmount.value) elAmount.value = s;
      updateSaveEnabled();
      updateRateLine();
    });
    elAmount.addEventListener("blur", ()=>{
      normalizeAmountOnBlur(elAmount);
      updateSaveEnabled();
      updateRateLine();
    });
  }

  [elDate, elDealer, elPounds, elAmount, elArea].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", ()=>{ updateSaveEnabled(); updateRateLine(); });
    el.addEventListener("change", ()=>{ updateSaveEnabled(); updateRateLine(); });
  });

  const editTripForm = document.getElementById("editTripForm");
  if(editTripForm) editTripForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    commitTripFromDraft({
      mode: "edit",
      editId: id,
      inputs: {
        date: elDate.value,
        dealer: elDealer.value,
        pounds: elPounds.value,
        amount: elAmount.value,
        area: elArea.value
      }
    });
  });
  if(elAmount && elArea){
    elAmount.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      elArea.focus();
    });
  }
  if(elArea && editTripForm){
    elArea.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      editTripForm.requestSubmit();
    });
  }

  document.getElementById("deleteTrip").onclick = ()=>{
    if(!confirm("Delete this trip?")) return;
    state.trips = trips.filter(x => String(x?.id||"") !== id);
    delete state.editId;
    saveState();
    goBack(state);
  };
}









function renderReports(){
  ensureReportsFilter();

  const tripsAll = Array.isArray(state.trips) ? state.trips.slice() : [];
  const rf = state.reportsFilter || { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
  const fMode = String(rf.mode || "YTD").toUpperCase();
  const mode = state.reportsMode || "tables"; // "charts" | "tables"

  const r = modeRange(fMode, rf.from, rf.to);
  const hasValidRange = (r.label !== "RANGE") || (r.startISO && r.endISO);
  let trips = (r.label === "ALL") ? tripsAll : (hasValidRange ? filterByISOInclusive(tripsAll, r.startISO, r.endISO) : tripsAll);

  const dealerF = String(rf.dealer || "");
  const areaF = String(rf.area || "");
  if(dealerF) trips = trips.filter(t=>String(t?.dealer||"") === dealerF);
  if(areaF) trips = trips.filter(t=>String(t?.area||"") === areaF);

  const chip = (key,label) => `<button class="chip ${fMode===key?'on':''}" data-rf="${key}">${label}</button>`;
  const seg = (key,label) => `<button class="chip ${mode===key?'on':''}" data-m="${key}">${label}</button>`;

  const advOpen = !!rf.adv;
  const advFromValue = formatReportDateValue(rf.from);
  const advToValue = formatReportDateValue(rf.to);

  const dealerOpts = ['<option value="">Any Dealer</option>'].concat(
    (Array.isArray(state.dealers)?state.dealers:[]).map(d=>{
      const v = String(d||"");
      return `<option value="${escapeHtml(v)}" ${v===String(rf.dealer||"")?'selected':''}>${escapeHtml(v)}</option>`;
    })
  ).join("");

  const areaOpts = ['<option value="">Any Area</option>'].concat(
    (Array.isArray(state.areas)?state.areas:[]).map(a=>{
      const v = String(a||"");
      return `<option value="${escapeHtml(v)}" ${v===String(rf.area||"")?'selected':''}>${escapeHtml(v)}</option>`;
    })
  ).join("");

  const advPanel = advOpen ? `
    <div class="sep"></div>
    <div class="grid2">
      <div class="field">
        <div class="label">From</div>
        <input class="input" id="repAdvFrom" type="date" value="${escapeHtml(advFromValue)}">
      </div>
      <div class="field">
        <div class="label">To</div>
        <input class="input" id="repAdvTo" type="date" value="${escapeHtml(advToValue)}">
      </div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div class="field">
        <div class="label">Dealer</div>
        <select class="input" id="repAdvDealer">${dealerOpts}</select>
      </div>
      <div class="field">
        <div class="label">Area</div>
        <select class="input" id="repAdvArea">${areaOpts}</select>
      </div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:10px;margin-top:10px">
      <button class="btn" id="repAdvReset" type="button">Reset</button>
      <button class="btn primary" id="repAdvApply" type="button">Apply</button>
    </div>
  ` : "";

  const rangeLabel = (fMode === "RANGE")
    ? (hasValidRange ? `${formatDateDMY(r.startISO)} → ${formatDateDMY(r.endISO)}` : "Set dates")
    : (fMode === "THIS_MONTH" ? "This Month"
      : (fMode === "LAST_MONTH" ? "Last Month"
        : (fMode === "ALL" ? "All Time"
          : "YTD")));


  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:0">
          <b>Reports</b>
          <span class="pill">Range: <b>${escapeHtml(rangeLabel)}</b></span>
        </div>

        <div class="chipGrid cols-4" style="margin-top:10px">
          ${chip("YTD","YTD")}
          ${chip("THIS_MONTH","This Month")}
          ${chip("LAST_MONTH","Last Month")}
          ${chip("ALL","All Time")}
        </div>

        <div class="row" style="justify-content:flex-end;margin-top:10px">
          <button class="btn repAdvToggle" type="button">${advOpen ? "Hide" : "Advanced"}</button>
        </div>

        ${advPanel}

        
        <div class="hint">${fMode==="RANGE" && !hasValidRange ? "Set a valid date range to see tables and charts." : "No trips in this range yet."}</div>
      </div>
    `;
    getApp().scrollTop = 0;

    // quick range buttons
    getApp().querySelectorAll(".chip[data-rf]").forEach(btn=>{
      btn.onclick = ()=>{
        const key = String(btn.getAttribute("data-rf")||"YTD").toUpperCase();
        state.reportsFilter.mode = key;
        if(key !== "RANGE"){
          state.reportsFilter.from = "";
          state.reportsFilter.to = "";
        }
        saveState();
        renderReports();
      };
    });

    document.querySelectorAll(".repAdvToggle").forEach(btn=>{
      btn.onclick = ()=>{
        state.reportsFilter.adv = !state.reportsFilter.adv;
        saveState();
        renderReports();
      };
    });

    const advFrom = document.getElementById("repAdvFrom");
    const advTo = document.getElementById("repAdvTo");
    bindDatePill("repAdvFrom");
    bindDatePill("repAdvTo");

    const advApply = document.getElementById("repAdvApply");
    if(advApply){
      advApply.onclick = ()=>{
        let from = String(advFrom?.value || "").trim();
        let to = String(advTo?.value || "").trim();
        const dealer = String(document.getElementById("repAdvDealer")?.value || "");
        const area = String(document.getElementById("repAdvArea")?.value || "");

        state.reportsFilter.dealer = dealer;
        state.reportsFilter.area = area;

        if(from && !to) to = from;
        if(!from && to) from = to;

        if(from || to){
          const sISO = parseReportDateToISO(from);
          const eISO = parseReportDateToISO(to);
          if(!sISO || !eISO){ showToast("Invalid dates"); return; }
          state.reportsFilter.mode = "RANGE";
        }

        from = parseReportDateToISO(from);
        to = parseReportDateToISO(to);

        state.reportsFilter.from = from;
        state.reportsFilter.to = to;

        saveState();
        renderReports();
      };
    }

    const advReset = document.getElementById("repAdvReset");
    if(advReset){
      advReset.onclick = ()=>{
        state.reportsFilter.mode = "YTD";
        state.reportsFilter.from = "";
        state.reportsFilter.to = "";
        state.reportsFilter.dealer = "";
        state.reportsFilter.area = "";
        saveState();
        renderReports();
      };
    }

    return;
  }

  // Aggregations
  const byDealer = new Map();
  const byArea = new Map();
  const byMonth = new Map(); // 1-12
  for(let m=1;m<=12;m++) byMonth.set(m, { trips:0, lbs:0, amt:0 });

  trips.forEach(t=>{
    const dealerRaw = (t?.dealer||"").toString();
    const dealer = normalizeDealerDisplay(dealerRaw) || "(Unspecified)";
    const dealerKey = dealer.toLowerCase();
    const area = ((t?.area||"").toString().trim()) || "(Unspecified)";
    const areaKey = area.toLowerCase();

    const lbs = Number(t?.pounds)||0;
    const amt = Number(t?.amount)||0;

    const d = byDealer.get(dealerKey) || { name: dealer, trips:0, lbs:0, amt:0 };
    d.trips += 1; d.lbs += lbs; d.amt += amt;
    byDealer.set(dealerKey, d);

    const a = byArea.get(areaKey) || { name: area, trips:0, lbs:0, amt:0 };
    a.trips += 1; a.lbs += lbs; a.amt += amt;
    byArea.set(areaKey, a);

    const iso = String(t?.dateISO||"");
    const mm = parseInt(iso.slice(5,7), 10);
    if(mm>=1 && mm<=12){
      const mo = byMonth.get(mm);
      mo.trips += 1; mo.lbs += lbs; mo.amt += amt;
    }
  });

  const dealerRows = Array.from(byDealer.values()).map(x=>{
    const avg = x.lbs>0 ? x.amt/x.lbs : 0;
    return { ...x, avg };
  }).sort((a,b)=> b.amt - a.amt);

  const areaRows = Array.from(byArea.values()).map(x=>{
    const avg = x.lbs>0 ? x.amt/x.lbs : 0;
    return { ...x, avg };
  }).sort((a,b)=> b.amt - a.amt);

  const monthRows = Array.from(byMonth.entries()).map(([m,x])=>{
    const label = new Date(2000, m-1, 1).toLocaleString(undefined,{month:"short"});
    const avg = x.lbs>0 ? x.amt/x.lbs : 0;
    return { month:m, label, ...x, avg };
  });

  const renderAggList = (rows, emptyMsg)=>{
    if(!rows.length) return `<div class="muted small">${escapeHtml(emptyMsg||"No data")}</div>`;
    return rows.map(r=>{
      return `
        <div class="trow">
          <div>
            <div class="tname">${escapeHtml(r.name)}</div>
            <div class="tsub">${r.trips} trips • <span class="lbsBlue">${to2(r.lbs)} lbs</span></div>
          </div>
          <div class="tright">
            <div><b class="money">${formatMoney(r.amt)}</b></div>
            <div>$/lb <b class="rate ppl">${formatMoney(r.avg)}</b></div>
          </div>
        </div>
      `;
    }).join("");
  };

  const renderMonthList = ()=>{
    return monthRows.map(r=>{
      return `
        <div class="trow">
          <div>
            <div class="tname">${escapeHtml(r.label)}</div>
            <div class="tsub">${r.trips} trips • <span class="lbsBlue">${to2(r.lbs)} lbs</span></div>
          </div>
          <div class="tright">
            <div><b class="money">${formatMoney(r.amt)}</b></div>
            <div>$/lb <b class="rate ppl">${formatMoney(r.avg)}</b></div>
          </div>
        </div>
      `;
    }).join("");
  };

  // High/Low items
  const maxLbs = trips.reduce((best,t)=> (Number(t?.pounds)||0) > (Number(best?.pounds)||0) ? t : best, trips[0]);
  const minLbs = trips.reduce((best,t)=> (Number(t?.pounds)||0) < (Number(best?.pounds)||0) ? t : best, trips[0]);
  const maxAmt = trips.reduce((best,t)=> (Number(t?.amount)||0) > (Number(best?.amount)||0) ? t : best, trips[0]);
  const minAmt = trips.reduce((best,t)=> (Number(t?.amount)||0) < (Number(best?.amount)||0) ? t : best, trips[0]);

  const pplRows = trips.filter(t => (Number(t?.pounds)||0) > 0 && (Number(t?.amount)||0) > 0);
  const maxPpl = pplRows.reduce((best,t)=> (Number(t?.amount)||0)/(Number(t?.pounds)||1) > (Number(best?.amount)||0)/(Number(best?.pounds)||1) ? t : best, pplRows[0]);
  const minPpl = pplRows.reduce((best,t)=> (Number(t?.amount)||0)/(Number(t?.pounds)||1) < (Number(best?.amount)||0)/(Number(best?.pounds)||1) ? t : best, pplRows[0]);

  const renderHLItem = (label, t, metric)=>{
    if(!t) return `<div class="muted small">—</div>`;
    const lbsNum = Number(t?.pounds)||0;
    const amtNum = Number(t?.amount)||0;
    const ppl = (lbsNum>0 && amtNum>0) ? (amtNum/lbsNum) : 0;
    let metricText = "—";
    let metricClass = "";
    if(metric === "lbs"){
      metricText = `${to2(lbsNum)} lbs`;
      metricClass = "lbsBlue";
    }else if(metric === "amount"){
      metricText = formatMoney(to2(amtNum));
      metricClass = "money";
    }else if(metric === "ppl"){
      metricText = ppl>0 ? `${formatMoney(to2(ppl))}/lb` : "—";
      metricClass = "rate ppl";
    }
    return `
      <div class="hlStatCard">
        <div class="hlHdr" style="text-align:center">${escapeHtml(label)}</div>
        <div class="hlValue ${metricClass}" style="text-align:center">${escapeHtml(metricText)}</div>
        <div style="margin-top:8px">
          ${renderTripCatchCard(t, {
            valueOverride: ppl>0 ? `${formatMoney(to2(ppl))}/lb` : "—"
          })}
        </div>
      </div>
    `;
  };

  function buildTripsTimeline(rows){
    const byKey = new Map();
    rows.forEach((t)=>{
      const iso = String(t?.dateISO || "");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      const key = iso.slice(0,7);
      byKey.set(key, (byKey.get(key) || 0) + 1);
    });
    return Array.from(byKey.entries())
      .sort((a,b)=> a[0].localeCompare(b[0]))
      .map(([key, count])=>{
        const year = Number(key.slice(0,4));
        const month = Number(key.slice(5,7));
        const dt = new Date(year, month - 1, 1);
        return {
          key,
          count,
          label: dt.toLocaleString(undefined, { month:"short" }),
          shortLabel: `${dt.toLocaleString(undefined, { month:"short" })} ${String(year).slice(-2)}`
        };
      });
  }

  const renderChartsSection = ()=>{
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const pplPeak = monthRows.reduce((best,r)=> (Number(r?.avg)||0) > (Number(best?.avg)||0) ? r : best, monthRows[0] || null);
    const dealerPeak = dealerRows[0] || null;
    const lbsPeak = monthRows.reduce((best,r)=> (Number(r?.lbs)||0) > (Number(best?.lbs)||0) ? r : best, monthRows[0] || null);
    const tripsTimeline = buildTripsTimeline(trips);
    const tripsLatest = tripsTimeline[tripsTimeline.length - 1] || null;
    const tripsPeak = tripsTimeline.reduce((best,r)=> (Number(r?.count)||0) > (Number(best?.count)||0) ? r : best, tripsTimeline[0] || null);
    const tripsTotal = tripsTimeline.reduce((sum,r)=> sum + (Number(r?.count)||0), 0);

    return `
      <div class="card">
        <b>Avg $/lb by Month</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Latest: <b>${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</b> • Peak: <b>${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</b></div>
        <div class="sep"></div>
        <canvas class="chart" id="c_ppl" height="210"></canvas>
      </div>
      <div class="card">
        <b>Dealer Amount (Top)</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Top: <b>${dealerPeak ? escapeHtml(String(dealerPeak.name || "—")) : "—"}</b> • ${dealerPeak ? formatMoney(to2(dealerPeak.amt)) : "—"}</div>
        <div class="sep"></div>
        <canvas class="chart" id="c_dealer" height="220"></canvas>
      </div>
      <div class="card">
        <b>Monthly Pounds</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Latest: <b>${latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"}</b> • Peak: <b>${lbsPeak ? `${to2(lbsPeak.lbs)} lbs` : "—"}</b></div>
        <div class="sep"></div>
        <canvas class="chart" id="c_lbs" height="210"></canvas>
      </div>
      <div class="card">
        <b>Trips over time</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Latest: <b>${tripsLatest ? tripsLatest.count : "—"}</b> • Peak: <b>${tripsPeak ? tripsPeak.count : "—"}</b> • Total: <b>${tripsTotal}</b></div>
        <div class="sep"></div>
        <canvas class="chart" id="c_trips" height="210"></canvas>
      </div>
    `;
  };

  const renderTablesSection = ()=>{
    return `
      <div class="card">
        <b>Dealer Summary</b>
        <div class="sep"></div>
        ${renderAggList(dealerRows, "No trips in this range yet.")}
      </div>

      <div class="card">
        <b>Area Summary</b>
        <div class="sep"></div>
        ${renderAggList(areaRows, "No trips in this range yet.")}
      </div>

      <div class="card">
        <b>Monthly Totals</b>
        <div class="sep"></div>
        ${renderMonthList()}
      </div>

      <div class="card">
        <b>High / Low Summary</b>
        <div class="sep"></div>

        ${renderHLItem("Most Pounds", maxLbs, "lbs")}
        <div class="sep"></div>

        ${renderHLItem("Least Pounds", minLbs, "lbs")}
        <div class="sep"></div>

        ${renderHLItem("Highest Amount", maxAmt, "amount")}
        <div class="sep"></div>

        ${renderHLItem("Lowest Amount", minAmt, "amount")}
        <div class="sep"></div>

        ${pplRows.length ? `
          ${renderHLItem("Highest $/lb", maxPpl, "ppl")}
          <div class="sep"></div>

          ${renderHLItem("Lowest $/lb", minPpl, "ppl")}
        ` : `<div class="muted small">No trips with valid pounds + amount in this range.</div>`}
      </div>
    `;
  };

  getApp().innerHTML = `
    ${renderPageHeader("reports")}

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;margin-top:0">
        <b>Reports</b>
        <span class="pill">Range: <b>${escapeHtml(rangeLabel)}</b></span>
      </div>

      <div class="chipGrid cols-4" style="margin-top:10px">
          ${chip("YTD","YTD")}
          ${chip("THIS_MONTH","This Month")}
          ${chip("LAST_MONTH","Last Month")}
          ${chip("ALL","All Time")}
        </div>

        <div class="row repCtlRow" style="justify-content:space-between;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
          <button class="btn repAdvToggle" type="button">${advOpen ? "Hide" : "Advanced"}</button>
          <div class="row" style="gap:8px;margin-top:0">
            ${seg("charts","Charts")}
            ${seg("tables","Tables")}
          </div>
        </div>

        ${advPanel}
      <div class="hint"></div>
    </div>

    ${mode === "charts" ? renderChartsSection() : renderTablesSection()}
  `;

  getApp().scrollTop = 0;

  // range chips
  getApp().querySelectorAll(".chip[data-rf]").forEach(btn=>{
    btn.onclick = ()=>{
      state.reportsFilter.mode = String(btn.getAttribute("data-rf")||"YTD");
      saveState();
      renderReports();
    };
  });

  // mode chips
  getApp().querySelectorAll(".chip[data-m]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.getAttribute("data-m");
      state.reportsMode = key;
      saveState();
      renderReports();
    };
  });

  // advanced toggle
  getApp().querySelectorAll(".repAdvToggle").forEach(btn=>{
    btn.onclick = ()=>{
      state.reportsFilter.adv = !state.reportsFilter.adv;
      saveState();
      renderReports();
    };
  });

  // advanced apply/reset (only present when panel open)
  bindDatePill("repAdvFrom");
  bindDatePill("repAdvTo");
  const advApply = getApp().querySelector("#repAdvApply");
  if(advApply){
    advApply.onclick = ()=>{
      const from = String(getApp().querySelector("#repAdvFrom")?.value||"").trim();
      const to   = String(getApp().querySelector("#repAdvTo")?.value||"").trim();
      const dealer = String(getApp().querySelector("#repAdvDealer")?.value||"");
      const area   = String(getApp().querySelector("#repAdvArea")?.value||"");
      const fromISO = parseReportDateToISO(from);
      const toISO = parseReportDateToISO(to);
      if((from && !fromISO) || (to && !toISO)){
        showToast("Invalid dates");
        return;
      }
      state.reportsFilter.from = fromISO;
      state.reportsFilter.to = toISO;
      state.reportsFilter.dealer = dealer;
      state.reportsFilter.area = area;
      if(fromISO || toISO){
        state.reportsFilter.mode = "RANGE";
      }
      saveState();
      renderReports();
    };
  }

  const advReset = getApp().querySelector("#repAdvReset");
  if(advReset){
    advReset.onclick = ()=>{
      state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
      saveState();
      renderReports();
    };
  }


  if(mode === "charts"){
    setTimeout(()=>{ drawReportsCharts(monthRows, dealerRows, trips); }, 0);
  }
}


function drawReportsCharts(monthRows, dealerRows, trips){
  function setupCanvas(canvas){
    if(!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(280, rect.width || canvas.parentElement?.clientWidth || 320);
    const h = canvas.height || 180;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return { ctx, w, h };
  }

  function clear(ctx, w, h){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0,0,w,h);
  }

  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback)=> (css.getPropertyValue(name) || "").trim() || fallback;
  const palette = {
    money: color("--money", "rgba(76,191,117,0.9)"),
    ppl: color("--ppl", "rgba(255,196,77,0.92)"),
    lbs: color("--lbs", "rgba(77,155,255,0.9)"),
    trips: color("--accent", "rgba(180,161,255,0.78)"),
    grid: "rgba(255,255,255,0.10)",
    label: "rgba(255,255,255,0.72)",
    plotBg: "rgba(255,255,255,0.035)"
  };

  function chartFrame(w,h){
    const compact = w < 360;
    return {
      compact,
      left: compact ? 36 : 44,
      right: compact ? 8 : 12,
      top: compact ? 10 : 12,
      bottom: compact ? 26 : 30,
      tickFont: compact ? "9px system-ui, -apple-system, Segoe UI, Arial" : "10px system-ui, -apple-system, Segoe UI, Arial"
    };
  }

  function drawAxes(ctx, w, h, frame){
    const x0 = frame.left;
    const y0 = h - frame.bottom;
    const yTop = frame.top;
    const xRight = w - frame.right;

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;

    const gridLines = 4;
    for(let i=0;i<=gridLines;i++){
      const y = y0 - ((y0 - yTop) * (i / gridLines));
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(xRight, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(x0, yTop);
    ctx.lineTo(x0, y0);
    ctx.lineTo(xRight, y0);
    ctx.stroke();
    return { x0, y0, yTop, xRight, plotW: xRight - x0, plotH: y0 - yTop };
  }

  function drawYLabel(ctx, text, frame){
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    ctx.fillText(text, frame.left + 4, frame.top + 10);
  }

  function drawBottomTicks(ctx, labels, geom, y, frame){
    const maxTicks = frame.compact ? 4 : 6;
    const step = Math.max(1, Math.ceil(labels.length / maxTicks));
    ctx.fillStyle = palette.label;
    ctx.font = frame.tickFont;
    let lastRight = -Infinity;
    labels.forEach((lab,i)=>{
      if(i % step !== 0 && i !== labels.length - 1) return;
      const x = geom.x0 + ((geom.plotW * i) / (Math.max(1, labels.length - 1)));
      const text = String(lab || "");
      const m = ctx.measureText(text);
      let tx = x - (m.width / 2);
      tx = Math.max(2, Math.min(geom.xRight - m.width, tx));
      if(tx <= lastRight + 4) return;
      ctx.fillText(text, tx, y);
      lastRight = tx + m.width;
    });
  }

  function fitLabel(ctx, text, maxW){
    const src = String(text || "");
    if(!src) return "";
    if(ctx.measureText(src).width <= maxW) return src;
    const parts = src.split(/\s+/).filter(Boolean);
    if(parts.length > 1){
      const initials = parts.map(p=>p[0]).join("").slice(0,4);
      if(initials && ctx.measureText(initials).width <= maxW) return initials;
    }
    if(maxW < 12) return "";
    let out = src;
    while(out.length > 2 && ctx.measureText(out + "…").width > maxW){
      out = out.slice(0,-1);
    }
    return out.length < src.length ? (out + "…") : out;
  }


  function formatShortMoney(v){
    const n = Number(v)||0;
    return "$" + (Math.round(n*100)/100).toFixed(2);
  }

  function makeTripsTimeline(rows){
    const byKey = new Map();
    rows.forEach((t)=>{
      const iso = String(t?.dateISO || "");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      const key = iso.slice(0,7);
      byKey.set(key, (byKey.get(key) || 0) + 1);
    });
    return Array.from(byKey.entries())
      .sort((a,b)=> a[0].localeCompare(b[0]))
      .map(([key, count])=>{
        const year = Number(key.slice(0,4));
        const month = Number(key.slice(5,7));
        const dt = new Date(year, month - 1, 1);
        return {
          key,
          count,
          label: dt.toLocaleString(undefined, { month:"short" }),
          shortLabel: `${dt.toLocaleString(undefined, { month:"short" })} ${String(year).slice(-2)}`
        };
      });
  }

  // Line: Avg $/lb by month
  {
      const c = setupCanvas(document.getElementById("c_ppl"));
      if(c){
        const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const vals = monthRows.map(r=> Number(r.avg)||0);
      const maxV = Math.max(1e-6, ...vals);
      const minV = Math.min(...vals);
      const span = (maxV - minV) || maxV || 1;

      ctx.strokeStyle = palette.ppl;
      ctx.lineWidth = 2;
      ctx.beginPath();
      vals.forEach((v,i)=>{
        const x = geom.x0 + (i/(vals.length-1 || 1))*geom.plotW;
        const y = geom.y0 - ((v - minV)/span)*geom.plotH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();

      ctx.fillStyle = palette.ppl;
      vals.forEach((v,i)=>{
        const x = geom.x0 + (i/(vals.length-1 || 1))*geom.plotW;
        const y = geom.y0 - ((v - minV)/span)*geom.plotH;
        ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
      });

      drawBottomTicks(ctx, monthRows.map(r=>r.label), geom, h-10, frame);
      drawYLabel(ctx, formatShortMoney(maxV), frame);
    }
  }

  // Bar: Total $ by dealer (top 8)
  {
      const c = setupCanvas(document.getElementById("c_dealer"));
      if(c){
      const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const top = dealerRows.slice(0,8);
      const vals = top.map(r=> Number(r.amt)||0);
      const maxV = Math.max(1e-6, ...vals);
      const barW = geom.plotW / (top.length || 1);

      top.forEach((r,i)=>{
        const v = Number(r.amt)||0;
        const bh = (v/maxV)*geom.plotH;
        const x = geom.x0 + i*barW + 4;
        const y = geom.y0 - bh;
        ctx.fillStyle = palette.money;
        ctx.fillRect(x, y, Math.max(6, barW-8), bh);
      });

      ctx.fillStyle = palette.label;
      ctx.font = frame.tickFont;
      const labelStep = Math.max(1, Math.ceil(top.length / (frame.compact ? 3 : 5)));
      top.forEach((r,i)=>{
        if(i % labelStep !== 0 && i !== top.length - 1) return;
        const maxLabelW = Math.max(10, barW - 4);
        const lab = fitLabel(ctx, r.name || "", maxLabelW);
        const tx = geom.x0 + i*barW + ((barW - ctx.measureText(lab).width) / 2);
        const x = Math.max(2, tx);
        ctx.fillText(lab, x, h-8);
      });

      drawYLabel(ctx, formatShortMoney(maxV), frame);
    }
  }

  // Bar: Total Lbs by month
  {
      const c = setupCanvas(document.getElementById("c_lbs"));
      if(c){
      const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const vals = monthRows.map(r=> Number(r.lbs)||0);
      const maxV = Math.max(1e-6, ...vals);
      const barW = geom.plotW / (vals.length || 1);

      vals.forEach((v,i)=>{
        const bh = (v/maxV)*geom.plotH;
        const x = geom.x0 + i*barW + 1;
        const y = geom.y0 - bh;
        ctx.fillStyle = palette.lbs;
        ctx.fillRect(x, y, Math.max(2, barW-2), bh);
      });

      drawBottomTicks(ctx, monthRows.map(r=>r.label), geom, h-10, frame);
      drawYLabel(ctx, String(Math.round(maxV)), frame);
    }
  }

  // Bar: Trips over time (by month in range)
  {
    const c = setupCanvas(document.getElementById("c_trips"));
    if(c){
      const {ctx,w,h} = c;
      const frame = chartFrame(w,h);
      clear(ctx,w,h);
      ctx.fillStyle = palette.plotBg;
      ctx.fillRect(frame.left, frame.top, w - frame.left - frame.right, h - frame.top - frame.bottom);
      const geom = drawAxes(ctx,w,h,frame);

      const timeline = makeTripsTimeline(trips);
      const vals = timeline.map(r=> Number(r.count)||0);
      const maxV = Math.max(1, ...vals);
      const barW = geom.plotW / (vals.length || 1);

      vals.forEach((v,i)=>{
        const bh = (v/maxV)*geom.plotH;
        const x = geom.x0 + i*barW + 1;
        const y = geom.y0 - bh;
        ctx.fillStyle = palette.trips;
        ctx.fillRect(x, y, Math.max(2, barW-2), bh);
      });

      drawBottomTicks(ctx, timeline.map(r=>r.shortLabel), geom, h-10, frame);
      drawYLabel(ctx, String(Math.round(maxV)), frame);
    }
  }
}


function renderSettings(opts={}){

  ensureAreas();
  ensureDealers();

  const s = state.settings || (state.settings = {});
  const listMode = String(s.listMode || "areas").toLowerCase();

  const areaRows = state.areas.length ? state.areas.map((a, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(a)}</b></div>
      <button class="smallbtn danger" data-del-area="${i}">Delete</button>
    </div>
  `).join("") : `<div class="muted small mt10">No areas yet. Add one below.</div>`;

  const dealerRows = state.dealers.length ? state.dealers.map((d, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(d)}</b></div>
      <button class="smallbtn danger" data-del-dealer="${i}">Delete</button>
    </div>
  `).join("") : `<div class="muted small mt10">No dealers yet. Add one below.</div>`;


function __renderListMgmtPanel(mode){
  const m = String(mode||"areas").toLowerCase();
  // Normalize list arrays (defensive)
  if(!Array.isArray(state.areas)) state.areas = [];
  if(!Array.isArray(state.dealers)) state.dealers = [];
  const areaRows2 = state.areas.length ? state.areas.map((a, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(a)}</b></div>
      <button class="smallbtn danger" data-del-area="${i}" type="button">Delete</button>
    </div>
  `).join("") : `<div class="muted small mt10">No areas yet. Add one below.</div>`;

  const dealerRows2 = state.dealers.length ? state.dealers.map((d, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(d)}</b></div>
      <button class="smallbtn danger" data-del-dealer="${i}" type="button">Delete</button>
    </div>
  `).join("") : `<div class="muted small mt10">No dealers yet. Add one below.</div>`;

  return (m==="dealers") ? `
    <div style="margin-top:12px">
      <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
        <input class="input" id="newDealer" placeholder="Add dealer (ex: Machias Bay Seafood)" autocomplete="organization" enterkeyhint="done" style="flex:1;min-width:180px" />
        <button class="btn primary" id="addDealer" type="button">Add</button>
      </div>
      ${dealerRows2}
    </div>
  ` : `
    <div style="margin-top:12px">
      <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
        <input class="input" id="newArea" placeholder="Add area (ex: 19/626)" autocomplete="off" enterkeyhint="done" style="flex:1;min-width:180px" />
        <button class="btn primary" id="addArea" type="button">Add</button>
      </div>
      ${areaRows2}
    </div>
  `;
}

  getApp().innerHTML = `
    ${renderPageHeader("settings")}

    <div class="row" style="gap:10px;align-items:stretch;flex-wrap:nowrap">
      <div class="card" style="flex:1;min-width:0;padding:10px">
        <b style="font-size:.95rem">Updates</b>
        <div class="sep" style="margin:8px 0"></div>

        <div id="updateBigStatus" style="font-size:15px;font-weight:800;line-height:1.2">Up to date</div>
        <div class="muted" id="updateVersionLine" style="margin-top:4px;font-size:11px;line-height:1.25"></div>

        <div class="row" style="margin-top:8px;gap:8px;align-items:center;min-width:0">
          <button class="btn" id="updatePrimary" style="font-size:12px;padding:7px 10px;min-width:0;white-space:nowrap">Check for updates</button>
          <div class="muted" id="updateInlineMsg" style="display:none;font-size:11px"></div>
        </div>

        <details style="margin-top:8px">
          <summary class="muted" style="font-size:11px">Details</summary>
          <div class="muted" id="buildInfoDetails" style="white-space:pre-wrap;margin-top:6px;font-size:11px;line-height:1.25"></div>
        </details>
      </div>

      <div class="card" style="flex:1;min-width:0;padding:10px">
        <b style="font-size:.95rem">Help</b>
        <div class="sep" style="margin:8px 0"></div>
        <div class="muted" style="margin-top:4px;font-size:11px;line-height:1.25">Short instructions for manual entry, clipboard paste, backups, and install.</div>
        <div class="row" style="margin-top:8px;min-width:0">
          <button class="btn" id="openHelp" style="font-size:12px;padding:7px 10px;min-width:0;white-space:nowrap">Open Help</button>
        </div>
      </div>
    </div>

    <div class="card">
      <b>List Management</b>
      <div class="sep"></div>

      <div class="segWrap" style="margin-top:10px">
        <button class="chip segBtn ${listMode==="areas"?"on is-selected":""}" data-listmode="areas" type="button">Areas</button>
        <button class="chip segBtn ${listMode==="dealers"?"on is-selected":""}" data-listmode="dealers" type="button">Dealers</button>
        <button class="chip segBtn" type="button" disabled aria-disabled="true" title="Coming soon" style="display:flex;flex-direction:column;align-items:center;line-height:1.05">
          <div>Species</div>
          <div class="muted tiny" style="margin-top:2px;opacity:.85">Coming soon</div>
        </button>
      </div>
      <div class="muted small mt10">Manage the dropdown lists used in New Trip and Edit Trip.</div>

      <div id="listMgmtPanel">${__renderListMgmtPanel(listMode)}</div>
    </div>

    <div class="card">
      <b>Data</b>
      <div class="sep"></div>
      <div class="muted small mt10">Create a backup file you can store in Files/Drive. Restore brings it back later.</div>
      <div class="muted small" id="lastBackupLine" style="margin-top:10px"></div>
      <div class="hint mt10"><b>Backup recommended</b> before major updates.</div>
      <div class="row" style="margin-top:12px;gap:10px;align-items:center;flex-wrap:nowrap">
        <button class="btn" id="downloadBackup" style="flex:1">💾 Create Backup</button>
        <button class="btn" id="restoreBackup" style="flex:1">📥 Restore Backup</button>
        <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" style="display:none" />
      </div>
      <div class="muted small mt10">Tip: after you download a backup, move it into <b>iCloud Drive</b> (iPhone Files app) or <b>Google Drive</b> (Android) so it gets included in your regular phone/cloud backups.</div>
    </div>

    <div class="card">
      <b>About</b>
      <div class="sep"></div>
      <div class="muted small mt10">Created by <b>Jeremy Wood</b> — <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a></div>
      <div class="muted small" style="margin-top:8px">Version: <b>${VERSION}</b></div>
      <div id="buildBadge" class="muted small" style="margin-top:8px"></div>

      <div class="muted small" style="margin-top:8px">© 2026 Jeremy Wood. All rights reserved.</div>
      <div class="sep" style="margin-top:10px"></div>
      <div class="muted small mt10"><b>Legal</b></div>
      <div class="row mt10 gap10 wrap">
        <button class="btn" id="openTerms">Terms</button>
        <button class="btn" id="openPrivacy">Privacy</button>
        <button class="btn" id="openLicense">License</button>
      </div>
    </div>

    <details class="card" id="advancedBox">
      <summary style="cursor:pointer;"><b>Advanced</b></summary>
      <div class="sep" style="margin-top:10px"></div>

      <div class="row mt12 gap10 wrap">
        <button class="btn" id="copyDebug">Copy Details</button>
        <button class="btn" id="refreshApp">Refresh App</button>
      </div>

      <div class="muted small mt10">Erase removes all trips and lists on this device. Use a backup first.</div>
      <div class="row mt12">
        <button class="btn danger" id="resetData">Erase All Data</button>
      </div>
    </details>
  `;
  updateBuildBadge();

  bindNavHandlers(state);

  document.getElementById("openHelp").onclick = ()=>{ pushView(state, "help"); };

  updateUpdateRow();
  try{ updateBuildInfo(); }catch(_){ }

  // List Management handlers (Areas/Dealers tabs + add/delete)
  try{ __bindListMgmtHandlers(); }catch(_){ }

  // Backup/Restore handlers
  try{
    __updateLastBackupLine();
    const btnDl = document.getElementById("downloadBackup");
    const btnRs = document.getElementById("restoreBackup");
    const inp = document.getElementById("backupFile");

    if(btnDl){
      btnDl.onclick = async ()=>{
        try{
          const r = await exportBackup();
          if(r?.ok){
            showToast(r.method === "share" ? "Share opened" : "Backup created");
          }else{
            showToast("Backup failed");
          }
        }catch(_){
          showToast("Backup failed");
        }
      };
    }

    if(btnRs && inp){
      btnRs.onclick = ()=>{
        try{ inp.value = ""; }catch(_){ }
        try{ inp.click(); }catch(_){ }
      };
      inp.onchange = async ()=>{
        const file = inp.files && inp.files[0];
        try{ inp.value = ""; }catch(_){ }
        if(!file) return;
        try{
          const result = await importBackupFromFile(file, { forceOverwrite:true, confirmMessage: "This will overwrite trips/lists on this device. Continue?" });
          if(result?.canceled){
            showToast("Restore canceled");
            return;
          }
          const n = Number(result?.tripsAdded);
          showToast(Number.isFinite(n) ? `Restore complete (${n} trips)` : "Restore complete");
          renderSettings();
        }catch(e){
          showToast("Restore failed");
        }
      };
    }
  }catch(_){ }


  document.getElementById("openTerms").onclick = ()=>{ window.location.href = "legal/terms.html"; };
  document.getElementById("openPrivacy").onclick = ()=>{ window.location.href = "legal/privacy.html"; };
  document.getElementById("openLicense").onclick = ()=>{ window.location.href = "legal/license.html"; };

  

}

// v102: List Management panel renderer must be available at module scope (used by __refreshListMgmt)
function __renderListMgmtPanel(mode){
  const m = String(mode||"areas").toLowerCase();
  // Normalize list arrays (defensive)
  if(!Array.isArray(state.areas)) state.areas = [];
  if(!Array.isArray(state.dealers)) state.dealers = [];
  const areaRows2 = state.areas.length ? state.areas.map((a, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(a)}</b></div>
      <button class="smallbtn danger" data-del-area="${i}" type="button">Delete</button>
    </div>
  `).join("") : `<div class="muted small mt10">No areas yet. Add one below.</div>`;

  const dealerRows2 = state.dealers.length ? state.dealers.map((d, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(d)}</b></div>
      <button class="smallbtn danger" data-del-dealer="${i}" type="button">Delete</button>
    </div>
  `).join("") : `<div class="muted small mt10">No dealers yet. Add one below.</div>`;

  return (m==="dealers") ? `
    <div style="margin-top:12px">
      <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
        <input class="input" id="newDealer" placeholder="Add dealer (ex: Machias Bay Seafood)" autocomplete="organization" enterkeyhint="done" style="flex:1;min-width:180px" />
        <button class="btn primary" id="addDealer" type="button">Add</button>
      </div>
      ${dealerRows2}
    </div>
  ` : `
    <div style="margin-top:12px">
      <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
        <input class="input" id="newArea" placeholder="Add area (ex: 19/626)" autocomplete="off" enterkeyhint="done" style="flex:1;min-width:180px" />
        <button class="btn primary" id="addArea" type="button">Add</button>
      </div>
      ${areaRows2}
    </div>
  `;
}

function __getScroller(){
  return document.scrollingElement || document.documentElement || document.body;
}

function __refreshListMgmt(mode, preserveScroll){
  const sc = __getScroller();
  const prev = preserveScroll ? (sc ? sc.scrollTop : 0) : 0;
  const m = String(mode||"areas").toLowerCase();
  state.settings = state.settings || {};
  // Normalize list arrays to avoid crashes if state was corrupted
  if(!Array.isArray(state.areas)) state.areas = [];
  if(!Array.isArray(state.dealers)) state.dealers = [];
  state.settings.listMode = (m==="dealers") ? "dealers" : "areas";
  saveState();

  // update selected state on buttons
  getApp().querySelectorAll("button.chip[data-listmode]").forEach(b=>{
    const bm = String(b.getAttribute("data-listmode")||"").toLowerCase();
    const on = (bm === state.settings.listMode);
    b.classList.toggle("on", on);
    b.classList.toggle("is-selected", on);
  });

  const panel = document.getElementById("listMgmtPanel");
if(panel){
  try{
    panel.innerHTML = __renderListMgmtPanel(state.settings.listMode);
  }catch(err){
    // Defensive: if saved state is corrupted or a renderer throws, keep Settings usable.
    try{ console.error("ListMgmt render failed", err); }catch(_){}
      try{ state.settings = state.settings || {}; state.settings.listMgmtLastError = String(err?.message || err); saveState(); }catch(_){ }
    try{ state.areas = Array.isArray(state.areas) ? state.areas : []; }catch(_){}
    try{ state.dealers = Array.isArray(state.dealers) ? state.dealers : []; }catch(_){}
    try{
      panel.innerHTML =
        '<div class="muted small mt10">' +
        '<b>List Management error</b><br/>' +
        'Tap <b>Copy Details</b> and send the error so we can fix it.<br/>' +
        '<span class="muted tiny">' + escapeHtml(err?.message || String(err)) + '</span>' +
        '</div>';
    }catch(_){}
  }
}
  __bindListMgmtHandlers();

  // avoid iOS focus auto-scroll flick
  try{ document.activeElement && document.activeElement.blur && document.activeElement.blur(); }catch(_){}
  if(preserveScroll && sc){
    requestAnimationFrame(()=>{ sc.scrollTop = prev; });
  }
}

function __bindListMgmtHandlers(){

  // List Management: tab switching + add/delete handlers
  try{
    const root = getApp();
    if(root){
      root.querySelectorAll('button.chip[data-listmode]').forEach(btn=>{
        btn.onclick = (e)=>{
          try{ e.preventDefault(); }catch(_){}
          const mode = btn.getAttribute("data-listmode") || "areas";
          __refreshListMgmt(mode, true);
        };
      });
    }

    const bindPanel = ()=>{
      const mode = String(state?.settings?.listMode || "areas").toLowerCase();

      const elNewArea = document.getElementById("newArea");
      const elNewDealer = document.getElementById("newDealer");
      const btnAddArea = document.getElementById("addArea");
      const btnAddDealer = document.getElementById("addDealer");

      if(btnAddArea){
        btnAddArea.onclick = ()=>{
          const raw = String(elNewArea?.value || "").trim();
          if(!raw){ showToast("Enter an area first"); elNewArea?.focus(); return; }
          if(raw.length > 40){ showToast("Keep it under 40 chars"); elNewArea?.focus(); return; }
          ensureAreas();
          const key = normalizeKey(raw);
          const exists = state.areas.some(a => normalizeKey(String(a||"")) === key);
          if(exists){ showToast("That area already exists"); return; }
          state.areas.push(raw);
          ensureAreas();
          saveState();
          __refreshListMgmt("areas", true);
        };
      }

      if(btnAddDealer){
        btnAddDealer.onclick = ()=>{
          const raw = String(elNewDealer?.value || "").trim();
          if(!raw){ showToast("Enter a dealer first"); elNewDealer?.focus(); return; }
          if(raw.length > 40){ showToast("Keep it under 40 chars"); elNewDealer?.focus(); return; }
          ensureDealers();
          const key = normalizeKey(raw);
          const exists = state.dealers.some(d => normalizeKey(String(d||"")) === key);
          if(exists){ showToast("That dealer already exists"); return; }
          state.dealers.push(raw);
          ensureDealers();
          saveState();
          __refreshListMgmt("dealers", true);
        };
      }

      // Delete buttons
      (getApp()?.querySelectorAll("button[data-del-area]") || []).forEach(btn=>{
        btn.onclick = ()=>{
          const i = Number(btn.getAttribute("data-del-area"));
          if(!Number.isFinite(i) || i<0) return;
          const name = String(state.areas?.[i] || "");
          if(!confirm(`Delete area "${name}"?`)) return;
          state.areas.splice(i, 1);
          ensureAreas();
          saveState();
          __refreshListMgmt("areas", true);
        };
      });
      (getApp()?.querySelectorAll("button[data-del-dealer]") || []).forEach(btn=>{
        btn.onclick = ()=>{
          const i = Number(btn.getAttribute("data-del-dealer"));
          if(!Number.isFinite(i) || i<0) return;
          const name = String(state.dealers?.[i] || "");
          if(!confirm(`Delete dealer "${name}"?`)) return;
          state.dealers.splice(i, 1);
          ensureDealers();
          saveState();
          __refreshListMgmt("dealers", true);
        };
      });

      // Enter key support for Add inputs
      if(elNewArea){
        elNewArea.onkeydown = (e)=>{ if(e.key==="Enter"){ e.preventDefault(); btnAddArea?.click(); } };
      }
      if(elNewDealer){
        elNewDealer.onkeydown = (e)=>{ if(e.key==="Enter"){ e.preventDefault(); btnAddDealer?.click(); } };
      }
    };

    bindPanel();
  }catch(_){}

  document.getElementById("copyDebug").onclick = async ()=>{
    const ok = await copyTextToClipboard(getDebugInfo());
    showToast(ok ? "Details copied" : "Copy failed");
  };

  document.getElementById("refreshApp").onclick = async ()=>{
    await forceRefreshApp();
  };

  document.getElementById("resetData").onclick = ()=>{
    const typed = prompt('Type DELETE to permanently erase ALL trips and lists on this device.');
    if(typed !== "DELETE") return;
    state = { trips: [], areas: [], dealers: [], filter: "YTD", view: "home", settings: {} };
    saveState();
    render();
  };
}




function renderHelp(){
  getApp().innerHTML = `
    ${renderPageHeader("help")}

    <div class="card">
      <b style="font-size:1.05rem">Quick Help Links</b>
      <div class="sep"></div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="chip" type="button" data-helpjump="home">Home</button>
        <button class="chip" type="button" data-helpjump="trips">Trips</button>
        <button class="chip" type="button" data-helpjump="newtrip">New Trip</button>
        <button class="chip" type="button" data-helpjump="reports">Reports</button>
        <button class="chip" type="button" data-helpjump="settings">Settings</button>
        <button class="chip" type="button" data-helpjump="backups">Backups</button>
      </div>
    </div>


    <div class="card">
      <b style="font-size:1.05rem">Install / Offline</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <div><b>iPhone/iPad:</b> Safari → Share → <b>Add to Home Screen</b>.</div>
        <div style="margin-top:6px"><b>Android:</b> Chrome menu → <b>Install app</b> (or Add to Home screen).</div>
        <div style="margin-top:6px">Installed PWAs can lag behind updates due to cached files—use <b>Refresh App</b> if something looks wrong.</div>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_home" style="font-size:1.05rem">Home</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li><b>Totals</b> and the recent list follow your current filter (YTD / Month / Last 7 days).</li>
          <li>Use Home when you just want a quick “how am I doing?” snapshot.</li>
          <li>If you install the app, Home works offline too.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_trips" style="font-size:1.05rem">Trips</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li>Browse your trips. Tap a trip to view/edit (if available).</li>
          <li>Duplicate warning may appear when saving a trip that looks similar—use “Save anyway” only when it’s truly a different trip.</li>
          <li>Use <b>New Trip</b> to add a fresh harvest entry.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_newtrip" style="font-size:1.05rem">New Trip</b>
      <div class="sep"></div>
      <ol class="muted helpText" style="margin:8px 0 0 18px;line-height:1.62;font-size:.97rem">
        <li>Enter <b>Date</b>.</li>
        <li>Pick or type a <b>Dealer</b>.</li>
        <li>Enter <b>Pounds</b> and <b>Amount</b>.</li>
        <li>Pick an <b>Area</b>.</li>
        <li>Tap <b>Save Trip</b>.</li>
      </ol>
      <div class="hint">Tip: chips are quick-picks—tap to fill faster.</div>
    </div>

    <div class="card">
      <b id="help_jump_reports" style="font-size:1.05rem">Reports</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li>Reports uses the same date filter idea as Home, plus optional advanced range controls.</li>
          <li>Switch between <b>Charts</b> and <b>Tables</b> to see the same data different ways.</li>
          <li>If something looks off, double-check your filter/range first.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_settings" style="font-size:1.05rem">Settings</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li><b>Updates</b>: check for updates and see build details.</li>
          <li><b>List Management</b>: edit Areas and Dealers used by New Trip.</li>
          <li><b>Data</b>: create/restore backup files (see Backups below).</li>
          <li><b>Advanced</b>: Copy Details, Refresh App, Erase All Data.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b id="help_jump_backups" style="font-size:1.05rem">Backups & Restore</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.62;font-size:.97rem">
        <ul style="margin:8px 0 0 18px">
          <li><b>Create Backup</b> makes a file containing your trips and lists. Keep it somewhere safe.</li>
          <li><b>Where to store it:</b> move the file into a cloud-synced folder so it’s included in your normal phone backups (iPhone: Files → iCloud Drive; Android: Files → Google Drive or Drive-synced folder).</li>
          <li><b>Restore Backup</b> replaces trips/lists on this device with the file’s contents. Best practice: create a backup first.</li>
          <li>If an update seems “stuck”, use <b>Refresh App</b> in Settings → Advanced (it clears cached files and reloads).</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b>Build info</b>
      <div class="sep"></div>
      <div class="muted small" style="line-height:1.6">
        <div>App: <b>${escapeHtml(String(VERSION))}</b> (schema ${escapeHtml(String(state.schemaVersion||state.schema||""))})</div>
        <div>Standalone: <b>${window.matchMedia("(display-mode: standalone)").matches ? "yes" : "no"}</b></div>
        <div>SW controller: <b>${navigator.serviceWorker && navigator.serviceWorker.controller ? "yes" : "no"}</b></div>
      </div>
    </div>
  `;

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
  getApp().innerHTML = `
    ${renderPageHeader("about")}

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backSettings">← Back</button>
        <b>About</b>
        <span class="muted small"></span>
      </div>
      <div class="hint">Version & diagnostics.</div>
    </div>

    <div class="card">
      <b>App details</b>
      <div class="sep"></div>
      <div class="muted small">Version: <b>${VERSION}</b></div>
      <div class="muted small" style="margin-top:8px">All data stays on this device unless you export/backup.</div>
      <div class="row mt12">
        <button class="btn" id="copyDebug">Copy Debug Info</button>
        <button class="btn" id="feedback">Send Feedback</button>
      </div>
    </div>
  `;
  getApp().scrollTop = 0;

  document.getElementById("backSettings").onclick = ()=>{ state.view="settings"; state.lastAction="nav:settings"; saveState(); render(); };

  document.getElementById("copyDebug").onclick = async ()=>{
    const ok = await copyTextToClipboard(getDebugInfo());
    showToast(ok ? "Debug info copied" : "Copy failed");
  };

  document.getElementById("feedback").onclick = ()=>{
    const body = encodeURIComponent(getDebugInfo() + "\n\nWhat happened?\n");
    const subj = encodeURIComponent("Bank the Catch Feedback ("+VERSION+")");
    location.href = `mailto:?subject=${subj}&body=${body}`;
  };
}

function render(){
  if(!state.view) state.view = "home";

  // Expose current view to CSS (used for view-specific layout tweaks)
  try{ document.body.dataset.view = String(state.view||""); }catch(_){ }

  // Render main view
  if(state.view === "settings") renderSettings();
  else if(state.view === "new") renderNewTrip();
  else if(state.view === "review") { state.view = "new"; saveState(); renderNewTrip(); }
  else if(state.view === "edit") renderEditTrip();
  else if(state.view === "reports") renderReports();
  else if(state.view === "help") renderHelp();
  else if(state.view === "all_trips") renderAllTrips();
  else if(state.view === "about") renderAbout();
  else renderHome();

  // Render persistent tab bar
  renderTabBar(state.view);

  // Header Help buttons (Home/Trips/Reports/Settings)
  bindHeaderHelpButtons();
}

try{
  window.__SHELLFISH_APP_STARTED = true;
  render();
  const bp = document.getElementById("bootPill");
  if(bp && !bp.classList.contains("err")){ bp.textContent = "OK"; bp.title = `v ${VERSION}`; }
}catch(err){ showFatal(err); }

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

function renderTopAreaChips(topAreas, currentArea, containerId){
  const items = Array.isArray(topAreas) ? topAreas.map(x=>String(x||"")) : [];
  if(!items.length){
    return `<div class="recentEmpty muted small">No recent areas yet</div>`;
  }
  return `
    <div class="areachips" id="${containerId}">
      ${items.map((a, idx)=>{
        const val = String(a||"").trim();
        const on = !!val && (String(currentArea||"").trim() === val);
        const label = val || "Select";
        return `<button class="areachip chip-selector${on ? " on" : ""}" type="button" data-area="${escapeHtml(val)}" data-chip-index="${idx}">${escapeHtml(label)}</button>`;
      }).join("")}
    </div>
  `;
}

function renderTopDealerChips(topDealers, currentDealer, containerId){
  const items = Array.isArray(topDealers) ? topDealers.map(x=>String(x||"")) : [];
  if(!items.length){
    return `
      <div class="recentEmpty muted small">No recent dealers yet</div>
    `;
  }
  return `
    <div class="areachips" id="${containerId}">
      ${items.map((d, idx)=>{
        const val = String(d||"").trim();
        const on = !!val && (String(currentDealer||"").trim().toLowerCase() === val.toLowerCase());
        const label = val || "Select";
        return `<button class="areachip chip-selector${on ? " on" : ""}" type="button" data-dealer="${escapeHtml(val)}" data-chip-index="${idx}">${escapeHtml(label)}</button>`;
      }).join("")}
    </div>
  `;
}

function getQuickChipSettings(){
  const settings = state.settings || (state.settings = {});
  const quickChips = (settings.quickChips && typeof settings.quickChips === "object") ? settings.quickChips : (settings.quickChips = {});
  return quickChips;
}

function getPinnedQuickChipKey(kind){
  return kind === "dealer" ? "dealerPinned" : "areaPinned";
}

function getPinnedQuickChipValues(kind, { seedItems = [], limit = 0 } = {}){
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 0;
  const settings = getQuickChipSettings();
  const key = getPinnedQuickChipKey(kind);
  const existing = settings[key];
  if(Array.isArray(existing)) return existing;

  // One-time seed from the old recents-driven source.
  const seedFromTrips = getLastUniqueFromTrips(kind, Math.max(3, max || 0));
  const fromSource = Array.isArray(seedItems) ? seedItems : [];
  const seeded = [];
  const seen = new Set();
  for(const raw of [...fromSource, ...seedFromTrips]){
    const value = String(raw || "").trim();
    if(!value) continue;
    const dedupeKey = kind === "dealer" ? normalizeKey(value) : value;
    if(seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    seeded.push(value);
    if(max > 0 && seeded.length >= max) break;
  }

  settings[key] = seeded;
  saveState();
  return settings[key];
}

function setQuickChipMapping(kind, chipIndex, nextValue){
  const idx = Number(chipIndex);
  if(idx < 0) return;
  const value = String(nextValue || "").trim();
  if(!value) return;
  const quickChips = getQuickChipSettings();
  const key = getPinnedQuickChipKey(kind);
  const arr = Array.isArray(quickChips[key]) ? [...quickChips[key]] : [];
  arr[idx] = value;
  quickChips[key] = arr;
  saveState();
}

function getQuickChipChoices(kind){
  const fromTrips = getLastUniqueFromTrips(kind, 30);
  const fromState = (kind === "dealer") ? (Array.isArray(state.dealers) ? state.dealers : []) : (Array.isArray(state.areas) ? state.areas : []);
  const seen = new Set();
  const out = [];
  for(const raw of [...fromTrips, ...fromState]){
    const v = String(raw || "").trim();
    if(!v) continue;
    const key = (kind === "dealer") ? normalizeKey(v) : v;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function resolveQuickChipItems(kind, sourceItems, limit){
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 0;
  const choices = getQuickChipChoices(kind);
  const pinned = getPinnedQuickChipValues(kind, { seedItems: sourceItems, limit: max });
  const len = max || pinned.length;
  const out = [];
  for(let i=0;i<len;i++){
    const candidate = String(pinned[i] || "").trim();
    if(!candidate){
      out.push("");
      continue;
    }
    const candidateKey = (kind === "dealer") ? normalizeKey(candidate) : candidate;
    const canonical = choices.find(v=>((kind === "dealer") ? normalizeKey(v) : v) === candidateKey) || "";
    if(!canonical){
      out.push("");
      continue;
    }
    out.push(canonical);
  }
  return out;
}

function openQuickChipCustomizeModal({ kind, chipIndex, currentValue, onSaved, choices: providedChoices }){
  const nice = (kind === "dealer") ? "Dealer" : "Area";
  const title = `Set ${nice} chip`;
  const rawChoices = Array.isArray(providedChoices) ? providedChoices : getQuickChipChoices(kind);
  const choices = [];
  const seen = new Set();
  for(const raw of rawChoices){
    const v = String(raw || "").trim();
    if(!v) continue;
    const key = (kind === "dealer") ? normalizeKey(v) : v;
    if(seen.has(key)) continue;
    seen.add(key);
    choices.push(v);
  }

  const uid = `${kind}_${Date.now()}`;
  const selectId = `quickChipSelect_${uid}`;
  const cancelId = `quickChipCancel_${uid}`;
  const saveId = `quickChipSave_${uid}`;
  const currentTrimmed = String(currentValue || "").trim();
  const currentNorm = (kind === "dealer") ? normalizeKey(currentTrimmed) : currentTrimmed;
  const hasCurrent = choices.some(v=>((kind === "dealer") ? normalizeKey(v) : v) === currentNorm);
  const options = [`<option value="">Select</option>`].concat(choices.map(v=>{
    const key = (kind === "dealer") ? normalizeKey(v) : v;
    const sel = (hasCurrent && key === currentNorm) ? "selected" : "";
    return `<option value="${escapeHtml(v)}" ${sel}>${escapeHtml(v)}</option>`;
  })).join("");

  openModal({
    title,
    backdropClose: false,
    escClose: true,
    showCloseButton: false,
    position: "center",
    html: `
      <div class="field">
        <label class="srOnly" for="${selectId}">${nice}</label>
        <select class="input" id="${selectId}">${options}</select>
      </div>
      <div class="modalActions">
        <button class="btn" id="${cancelId}" type="button">Cancel</button>
        <button class="btn primary" id="${saveId}" type="button" disabled>Save</button>
      </div>
    `,
    onOpen: ()=>{
      const elSelect = document.getElementById(selectId);
      const saveBtn = document.getElementById(saveId);

      if(elSelect) elSelect.value = hasCurrent ? currentTrimmed : "";

      const refreshSaveState = ()=>{
        if(!saveBtn || !elSelect) return;
        saveBtn.disabled = !String(elSelect.value || "").trim();
      };

      elSelect?.addEventListener("change", refreshSaveState);
      document.getElementById(cancelId)?.addEventListener("click", ()=>closeModal());
      document.getElementById(saveId)?.addEventListener("click", ()=>{
        const next = String(elSelect?.value || "").trim();
        if(!next) return;
        setQuickChipMapping(kind, chipIndex, next);
        closeModal();
        if(typeof onSaved === "function") onSaved(next);
      });

      refreshSaveState();
      setTimeout(()=>elSelect?.focus(), 50);
    }
  });
}


function bindAreaChips(containerId, onPick){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest && e.target.closest("button[data-area]");
    if(!btn) return;
    if(btn.__suppressNextClick){
      btn.__suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      return;
    }
    const a = String(btn.getAttribute("data-area") || "").trim();
    if(!a) return;
    onPick(a);
  });
}

function bindQuickChipLongPress(containerEl, onLongPressRelease){
  if(!containerEl || typeof onLongPressRelease !== "function") return;
  if(containerEl.__quickChipLongPressBound) return;
  containerEl.__quickChipLongPressBound = true;

  let pointerId = null;
  let timerId = null;
  let downX = 0;
  let downY = 0;
  let longPressArmed = false;
  let activeChip = null;

  const clearTimer = ()=>{
    if(timerId){
      clearTimeout(timerId);
      timerId = null;
    }
  };

  const cancelActive = ()=>{
    clearTimer();
    pointerId = null;
    longPressArmed = false;
    activeChip = null;
  };

  containerEl.addEventListener("pointerdown", (e)=>{
    const chip = e.target?.closest?.(".chip-selector");
    if(!chip || !containerEl.contains(chip)) return;
    if(typeof e.button === "number" && e.button !== 0) return;

    cancelActive();
    pointerId = e.pointerId;
    activeChip = chip;
    downX = Number(e.clientX || 0);
    downY = Number(e.clientY || 0);
    timerId = setTimeout(()=>{
      longPressArmed = true;
    }, QUICK_CHIP_LONG_PRESS_MS);
  });

  containerEl.addEventListener("pointermove", (e)=>{
    if(pointerId == null || e.pointerId !== pointerId || !activeChip) return;
    const dx = Math.abs(Number(e.clientX || 0) - downX);
    const dy = Math.abs(Number(e.clientY || 0) - downY);
    if(Math.max(dx, dy) > QUICK_CHIP_MOVE_CANCEL_PX){
      cancelActive();
    }
  });

  containerEl.addEventListener("pointerup", (e)=>{
    if(pointerId == null || e.pointerId !== pointerId) return;
    const chip = activeChip;
    const shouldTrigger = !!(chip && longPressArmed);
    cancelActive();
    if(!shouldTrigger) return;

    chip.__suppressNextClick = true;
    e.preventDefault();
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    onLongPressRelease(chip, e);
  });

  containerEl.addEventListener("pointercancel", (e)=>{
    if(pointerId == null || e.pointerId !== pointerId) return;
    cancelActive();
  });

  containerEl.addEventListener("contextmenu", (e)=>{
    const chip = e.target?.closest?.(".chip-selector");
    if(!chip || !containerEl.contains(chip)) return;
    e.preventDefault();
  });
}
