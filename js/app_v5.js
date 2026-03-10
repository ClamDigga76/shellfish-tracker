const moduleV = new URL(import.meta.url).searchParams.get("v") || "";
const bootV = String(window.APP_VERSION || "");
if (moduleV && bootV && moduleV !== bootV) {
  const mismatchError = new Error(`Version mismatch: bootstrap=${bootV}, app=${moduleV}. Please refresh to update.`);
  if (window.__showModuleError) window.__showModuleError(mismatchError);
  throw mismatchError;
}

window.__SHELLFISH_APP_STARTED = false;

import { uid, toCSV, downloadText, formatMoney, formatISODateToDisplayDMY as formatDateLegacyDMY, computePPL, parseMDYToISO as parseUsDateToISODate, parseNum, parseMoney, likelyDuplicate, normalizeKey, canonicalDealerGroupKey, escapeHtml, getTripsNewestFirst, openModal, closeModal, lockBodyScroll, unlockBodyScroll, focusFirstFocusable , isValidISODate } from "./utils_v5.js";
import { THEME_MODE_SYSTEM, THEME_MODE_LIGHT, THEME_MODE_DARK, normalizeThemeMode, resolveTheme } from "./settings.js";
import { LS_KEY, migrateLegacyStateIfNeeded, migrateStateIfNeeded, loadStateWithLegacyFallback } from "./migrations_v5.js";
import { ensureNavState, createNavigator } from "./navigation_v5.js";
import { drawReportsCharts } from "./reports_charts_v5.js";
import { buildReportsAggregationState } from "./reports_aggregation_v5.js";
import { createQuickChipHelpers } from "./quick_chips_v5.js";
import { createReportsFilterHelpers } from "./reports_filters_v5.js";
import { createSettingsListManagement } from "./settings_list_management_v5.js";
import { createBackupRestoreSubsystem } from "./backup_restore_v5.js";
import { createTripDataEngine, createTripDraftSaveEngine, computeTripSaveEnabled } from "./trip_shared_engine_v5.js";
import { createTripCardRenderHelpers, normalizeDealerDisplay } from "./trip_cards_v5.js";
import { renderHelpViewHTML, renderAboutViewHTML } from "./help_about_render_v5.js";
import { renderTripEntryForm } from "./trip_form_render_v5.js";
import { createHomeDashboardRenderer } from "./home_dashboard_v5.js";
import { createSettingsScreenOrchestrator } from "./settings_screen_v5.js";
import { createReportsScreenRenderer } from "./reports_screen_v5.js";
import {
  renderPageHeader as renderPageHeaderShell,
  bindHeaderHelpButtons as bindHeaderHelpButtonsShell,
  renderTabBar as renderTabBarShell
} from "./app_shell_v5.js";
const APP_VERSION = (window.APP_BUILD || "v5");
const VERSION = APP_VERSION;
const DISPLAY_BUILD_VERSION = VERSION;
const QUICK_CHIP_LONG_PRESS_MS = 500;
const DEFAULT_TRIP_SPECIES = "Soft-shell Clams";
const QUICK_CHIP_MOVE_CANCEL_PX = 10;
const {
  normalizeTripRow,
  normalizeTrip,
  isValidAreaValue,
  validateTrip
} = createTripDataEngine({ uid, isValidISODate });

// Backup meta (local-only; no user data duplication)
const LS_LAST_BACKUP_META = "btc_last_backup_meta_v1";

// In-app update UI: primary action always refreshes app assets/reload; SW state only changes status text.
let SW_UPDATE_READY = false;
let themeMediaQuery = null;
let onThemeMediaChange = null;
window.addEventListener("sw-update-ready", (ev) => {
  SW_UPDATE_READY = true;
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
    if(statusEl) statusEl.textContent = SW_UPDATE_READY ? "Applying update…" : "Refreshing app…";
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
      versionEl.textContent = `Version: ${DISPLAY_BUILD_VERSION}${standalone ? " • Standalone: yes" : ""}`;
    }
  }catch(_){
    try{ if(versionEl) versionEl.textContent = `Version: ${DISPLAY_BUILD_VERSION}`; }catch(__){}
  }

  if(!detailsEl) return;

  const parts = [];
  // App + schema
  parts.push(`App: ${DISPLAY_BUILD_VERSION} (schema ${typeof SCHEMA_VERSION!=="undefined"?SCHEMA_VERSION:"?"})`);

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
    statusEl.textContent = "Update ready • tap Refresh app";
    btnPrimary.textContent = "Refresh app";
    btnPrimary.onclick = async ()=>{ await swCheckNow(); };
  }else{
    statusEl.textContent = "Up to date";
    btnPrimary.textContent = "Refresh app";
    btnPrimary.onclick = async ()=>{ await swCheckNow(); };
  }
}

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


window.__SHELLFISH_BUILD__ = APP_VERSION;
const HOME_TRIPS_LIMIT = 15;
const LAST_ERROR_KEY = "shellfish-last-error";
const LAST_ERROR_AT_KEY = "shellfish-last-error-at";
const LEGACY_LAST_ERROR_KEY = "SHELLFISH_LAST_ERROR";
const LEGACY_LAST_ERROR_AT_KEY = "SHELLFISH_LAST_ERROR_AT";
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




async function updateBuildBadge(){
  const el = document.getElementById("buildBadge");
  if(!el) return;

  const schema = (typeof SCHEMA_VERSION !== "undefined" ? SCHEMA_VERSION : null);
  const parts = [`App ${DISPLAY_BUILD_VERSION}`];
  if(schema !== null) parts.push(`Schema ${schema}`);

  // Service Worker info
  let swCtrl = false;
  try{
    swCtrl = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  }catch{}

  parts.push(`SW ${swCtrl ? "on" : "off"}`);

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
let ariaLiveTimer = null;
function announce(msg, mode = "polite"){
  try{
    const el = document.getElementById("ariaLive");
    if(!el) return;
    const nextMode = (mode === "assertive") ? "assertive" : "polite";
    const text = String(msg || "").trim();
    el.setAttribute("aria-live", nextMode);
    el.textContent = "";
    clearTimeout(ariaLiveTimer);
    ariaLiveTimer = setTimeout(()=>{ el.textContent = text; }, 30);
  }catch{}
}
function showToast(msg){
  try{
    const el = document.getElementById("toast");
    if(!el) return;
    const text = String(msg||"");
    el.textContent = text;
    const trimmed = text.trim();
    if(/^Saved$/i.test(trimmed)){
      announce("Saved", "polite");
    }else if(/(error|failed|invalid|missing)/i.test(trimmed)){
      announce(/^Error:/i.test(trimmed) ? trimmed : `Error: ${trimmed}`, "assertive");
    }
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

async function copyTextWithFeedback(txt, successMsg = "Copied"){
  const ok = await copyTextToClipboard(txt);
  showToast(ok ? successMsg : "Copy failed");
  if(ok){
    try{ navigator.vibrate?.(10); }catch(_){ }
  }
  return ok;
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
      state.view = next;
      saveState();
      render();
    }
  });
}


function getDebugInfo(){
  const appName = "Bank the Catch";
  const trips = Array.isArray(state?.trips) ? state.trips.length : 0;
  const areas = Array.isArray(state?.areas) ? state.areas.length : 0;
  const view = state?.view ? String(state.view) : "";
  const last = state?.lastAction ? String(state.lastAction) : "";
  const settings = state?.settings || {};

  const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (window.navigator && window.navigator.standalone === true);
  const dm = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ? "standalone" : "browser";
  const swCtrl = (navigator.serviceWorker && navigator.serviceWorker.controller) ? "controlled" : "none";
  const swScript = (navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL) ? navigator.serviceWorker.controller.scriptURL : "";
  const installMode = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    ? "standalone"
    : (window.navigator && window.navigator.standalone === true ? "ios-standalone" : "browser-tab");
  const bootStage = window.__BOOT_DIAG__?.stage ? String(window.__BOOT_DIAG__.stage) : "";
  const appStarted = window.__SHELLFISH_APP_STARTED ? "true" : "false";

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
    `${appName} ${DISPLAY_BUILD_VERSION} (schema ${SCHEMA_VERSION})`,
    `Build: ${DISPLAY_BUILD_VERSION}`,
    view ? `View: ${view}` : "",
    location.hash ? `Route: ${location.hash}` : "",
    `DisplayMode: ${dm}`,
    `InstallMode: ${installMode}`,
    `StandaloneFlag: ${isStandalone ? "true" : "false"}`,
    `AppStarted: ${appStarted}`,
    bootStage ? `BootStage: ${bootStage}` : "",
    `ServiceWorker: ${swCtrl}`,
    swScript ? `SWScript: ${swScript}` : "",
    `LocalStorageChars: ${lsChars}`,
    `UserAgent: ${navigator.userAgent}`,
    navigator.platform ? `Platform: ${navigator.platform}` : "",
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

// Signal to the page watchdog that the module loaded
try{ window.__SHELLFISH_STARTED = true; }catch{}
function getApp(){ return document.getElementById("app"); }

function loadState(){
  return loadStateWithLegacyFallback(localStorage, ensureNavState);
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
  updateLastBackupLine,
  downloadBackupPayload,
  exportBackup,
  parseBackupFileForRestore,
  openRestorePreviewModal,
  openReplaceSafetyBackupModal,
  openRestoreErrorModal,
  importBackupFromFile
} = createBackupRestoreSubsystem({
  getState: ()=> state,
  saveState: ()=> saveState(),
  ensureAreas: ()=> ensureAreas(),
  ensureDealers: ()=> ensureDealers(),
  SCHEMA_VERSION,
  APP_VERSION,
  VERSION,
  LS_LAST_BACKUP_META,
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

  if(filter.range === "all") return { fromISO:"1900-01-01", toISO:now, label:"All time" };
  if(filter.range === "ytd") return { fromISO:`${y}-01-01`, toISO:now, label:"YTD" };
  if(filter.range === "mtd") return { fromISO:`${y}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`, toISO:now, label:"Month" };
  if(filter.range === "last_month"){
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth()-1);
    const fromISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
    const toISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()).padStart(2,"0")}`;
    return { fromISO, toISO, label:"Last Month" };
  }
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
    area,
    species,
    notes
  };

  // Tier 1: normalize + validate before saving
  const tripNorm = normalizeTrip(trip);
  const vErrs = validateTrip(tripNorm);
  if(vErrs.length){
    announce(`Error: Missing/invalid: ${vErrs.join(", ")}`, "assertive");
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
  showToast("Saved");
  // After first successful save, offer install (once per device).
  if(!isEdit){ try{ setTimeout(()=>{ maybeOfferInstallAfterFirstSave(); }, 350); }catch(_){} }
  return true;
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
    `App: ${DISPLAY_BUILD_VERSION} (schema ${SCHEMA_VERSION})`,
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

  const btnCopy = document.getElementById("fatalCopy");
  if(btnCopy) btnCopy.onclick = ()=> { void copyTextWithFeedback(dump, "Debug copied"); };

  const btnReload = document.getElementById("fatalReload");
  if(btnReload) btnReload.onclick = ()=> location.reload();

  const btnResetCache = document.getElementById("fatalResetCache");
  if(btnResetCache) btnResetCache.onclick = ()=> safeAsync(()=> resetCache());
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

function baseSaveState(){
  safeSetItem(LS_KEY, JSON.stringify(state));
}

const {
  saveStateNow,
  flushPendingStateSave,
  scheduleStateSave,
  saveDraft,
  bindLifecycleSaveFlush
} = createTripDraftSaveEngine({ saveState: baseSaveState });

function saveState(){
  saveStateNow();
}

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
    "All time": "ALL",
    "YTD": "YTD",
    "Last 12 months": "Last 12m",
    "Last 90 days": "Last 90d",
    "Last 30 days": "Last 30d",
    "7 Days": "Last 7d"
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
}

const { renderHome } = createHomeDashboardRenderer({
  state,
  ensureHomeFilter,
  buildUnifiedFilterFromHomeFilter,
  applyUnifiedTripFilter,
  computePPL,
  round2: to2,
  getTripsNewestFirst,
  homeTripsLimit: HOME_TRIPS_LIMIT,
  renderTripCatchCard,
  renderPageHeader,
  escapeHtml,
  parseReportDateToISO,
  formatMoney,
  getApp,
  pushView,
  saveState,
  render,
  bindDatePill,
  showToast,
  tipMsg: typeof tipMsg !== "undefined" ? tipMsg : undefined,
  exportBackup
});

function renderNewTrip(){
  ensureAreas();
  ensureDealers();
  const dealerAddSentinel = "__add_new_dealer__";
  const areaAddSentinel = "__add_new_area__";
  // Defaults
  const todayISO = new Date().toISOString().slice(0,10);
  const draft = state.draft || { dateISO: todayISO, dealer:"", pounds:"", amount:"", area:"", species: DEFAULT_TRIP_SPECIES, notes:"" };
  const amountVal = String(draft.amount ?? "");
  draft.species = String(draft.species || DEFAULT_TRIP_SPECIES).trim() || DEFAULT_TRIP_SPECIES;
  draft.notes = String(draft.notes || "");


  // Recent (last 3) unique values from saved trips (ignores filters)
  // NOTE: Chips are always shown; if none exist yet we show a muted "No recent …" line.
  const topAreas = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 3), 3);
  const topDealers = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 3), 3);

  const dealerListForSelect = getDealerSelectList(topDealers, draft.dealer);
  const dealerOptions = buildDealerOptionsHtml(draft.dealer, dealerListForSelect, dealerAddSentinel);
  const areaOptions = buildAreaOptionsHtml(draft.area, areaAddSentinel);

const getBarSelectChoices = (kind)=>{
  if(kind === "dealer") return [...dealerListForSelect];
  return Array.isArray(state.areas) ? [...state.areas] : [];
};

const newTripFormHtml = renderTripEntryForm({
      mode: "new",
      formId: "newTripForm",
      dateId: "t_date",
      dealerId: "t_dealer",
      poundsId: "t_pounds",
      amountId: "t_amount",
      areaId: "t_area",
      speciesId: "t_species",
      notesId: "t_notes",
      rateId: "rateValue",
      todayBtnId: "todayBtn",
      dateValue: String(draft.dateISO || isoToday()),
      dealerOptions,
      areaOptions,
      speciesOptions: `<option value="${escapeHtml(DEFAULT_TRIP_SPECIES)}" selected>${escapeHtml(DEFAULT_TRIP_SPECIES)}</option>`,
      topDealerChipsHtml: renderTopDealerChips(topDealers, draft.dealer, "topDealers"),
      topAreaChipsHtml: renderTopAreaChips(topAreas, draft.area, "topAreas"),
      poundsValue: draft.pounds,
      amountValue: amountVal,
      notesValue: draft.notes,
      primaryActionLabel: "Save Trip",
      secondaryActionLabel: "Clear",
      secondaryActionId: "clearDraft",
      dateIconHtml: iconSvg("calendar")
    }).replace("card formCard", "formCard");

;getApp().innerHTML = `
    ${renderPageHeader("new")}
    ${newTripFormHtml}
  `;
  bindNavHandlers(state);

  const elDate = document.getElementById("t_date");
  const elDealer = document.getElementById("t_dealer");
  const elPounds = document.getElementById("t_pounds");
  const elAmount = document.getElementById("t_amount");

  const elArea = document.getElementById("t_area");
  const elSpecies = document.getElementById("t_species");
  const elNotes = document.getElementById("t_notes");
  const elRate = document.getElementById("rateValue");
  bindDatePill("t_date");
  const updateRateLine = ()=>{
    if(!elRate) return;
    const p = parseNum(elPounds?.value);
    const a = parseMoney(elAmount?.value);
    const next = formatMoney(computePPL(p, a));
    if("value" in elRate) elRate.value = next;
    else elRate.textContent = next;
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


  const elToday = document.getElementById("todayBtn");

  // Quick-pick chip containers
  const topAreaWrap = document.getElementById("topAreas");
  const topDealerWrap = document.getElementById("topDealers");

  // Enable Save only when required fields are valid, and keep lbs/$ coloring consistent.
  const updateSaveEnabled = ()=>{
    const ready = computeTripSaveEnabled({
      dealer: elDealer?.value,
      area: elArea?.value,
      poundsInput: elPounds?.value,
      amountInput: elAmount?.value,
      parseNum,
      parseMoney,
      isValidAreaValue
    });

    if(elPounds) elPounds.classList.toggle("lbsBlue", ready.poundsOk);
    if(elAmount) elAmount.classList.toggle("money", ready.amountOk);

    const btn = document.getElementById("saveTrip");
    if(btn){
      const enabled = ready.enabled;
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
const iso = rawDate.includes("-") ? rawDate.slice(0,10) : (parseUsDateToISODate(rawDate) || "");
const mdy = rawDate.includes("-") ? formatDateDMY(iso) : rawDate;
state.draft.dateISO = iso || state.draft.dateISO || "";
state.draft.dealer = normalizeDealerDisplay(String(elDealer?.value||"").trim());
      state.draft.pounds = parseNum(elPounds?.value);
      state.draft.amount = parseMoney(elAmount?.value);
      state.draft.area = String(elArea?.value||"").trim();
      state.draft.species = String(elSpecies?.value || DEFAULT_TRIP_SPECIES).trim() || DEFAULT_TRIP_SPECIES;
      state.draft.notes = String(elNotes?.value || "").trim();

      // basic guard: if nothing entered, do nothing (prevents "dead tap" feel)
      const anyEntered = Boolean(mdy || state.draft.dealer || (state.draft.pounds>0) || (state.draft.amount>0) || state.draft.area || state.draft.notes);
      if(!anyEntered){
        announce("Error: Enter trip details first", "assertive");
        showToast("Enter trip details first");
        state._savingTrip = false; saveState();
        return;
      }

commitTripFromDraft({
  mode: "new",
  inputs: {
    date: mdy,
    dealer: state.draft.dealer,
    pounds: state.draft.pounds,
    amount: state.draft.amount,
    area: state.draft.area,
    species: state.draft.species,
    notes: state.draft.notes
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
  const persistDraftInput = ()=>{ try{ scheduleStateSave(); }catch{}; try{ updateSaveEnabled(); }catch{} };
  [elDate, elDealer, elPounds, elAmount, elSpecies, elNotes].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", persistDraftInput);
    el.addEventListener("change", persistDraft);
  });
  if(elArea){
    elArea.addEventListener("input", persistDraftInput);
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
        <span class="muted small">v ${DISPLAY_BUILD_VERSION}</span>
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

  const updateReviewDerived = (immediateSave = false)=>{
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
        if(!isValidAreaValue(document.getElementById("r_area")?.value || "")) missing.push("Area");
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
    if(immediateSave) saveState();
    else scheduleStateSave();
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
    el.addEventListener("input", ()=>updateReviewDerived(false));
    el.addEventListener("change", ()=>updateReviewDerived(true));
    el.addEventListener("blur", ()=>updateReviewDerived(true));
  });
  if(elAreaLive){
    elAreaLive.addEventListener("input", ()=>updateReviewDerived(false));
    elAreaLive.addEventListener("change", ()=>updateReviewDerived(true));
  }


  [elDateLive, elDealerLive].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", ()=>updateReviewDerived(false));
    el.addEventListener("change", ()=>updateReviewDerived(true));
    el.addEventListener("blur", ()=>updateReviewDerived(true));
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
      scheduleStateSave();
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
    bindQuickChips("topAreasR", "area", (area)=>{
      elAreaLive.value = area;
      updateReviewDerived();
    });
  }

  if(topDealerWrapR && elDealerLive){
    bindQuickChips("topDealersR", "dealer", (dealer)=>{
      elDealerLive.value = dealer;
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
        area: elArea.value,
        species: DEFAULT_TRIP_SPECIES
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
    area: t.area || "",
    species: t.species || DEFAULT_TRIP_SPECIES,
    notes: String(t.notes || "")
  };

  const dealerAddSentinel = "__add_new_dealer__";
  const areaAddSentinel = "__add_new_area__";
  const amountDispE = displayAmount(t.amount);

  const topAreasE = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 2), 2);
  const topDealersE = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 2), 2);

  const dealerListForSelect = getDealerSelectList(topDealersE, draft.dealer);
  const dealerOptions = buildDealerOptionsHtml(draft.dealer, dealerListForSelect, dealerAddSentinel);
  const areaOptions = buildAreaOptionsHtml(draft.area, areaAddSentinel);


  const editTripFormHtml = renderTripEntryForm({
      mode: "edit",
      formId: "editTripForm",
      dateId: "e_date",
      dealerId: "e_dealer",
      poundsId: "e_pounds",
      amountId: "e_amount",
      areaId: "e_area",
      speciesId: "e_species",
      notesId: "e_notes",
      rateId: "rateValueEdit",
      todayBtnId: "todayBtnEdit",
      dateValue: draft.dateISO,
      dealerOptions,
      areaOptions,
      speciesOptions: `<option value="${escapeHtml(DEFAULT_TRIP_SPECIES)}" selected>${escapeHtml(DEFAULT_TRIP_SPECIES)}</option>`,
      topDealerChipsHtml: renderTopDealerChips(topDealersE, draft.dealer, "topDealersE"),
      topAreaChipsHtml: renderTopAreaChips(topAreasE, draft.area, "topAreasE"),
      poundsValue: draft.pounds,
      amountValue: amountDispE,
      notesValue: draft.notes,
      primaryActionLabel: "Save Changes",
      secondaryActionLabel: "Cancel",
      secondaryActionId: "navCancel",
      tertiaryActionLabel: "Delete",
      tertiaryActionId: "deleteTrip",
      extraCardClass: "edit-mode",
      dateIconHtml: iconSvg("calendar")
    }).replace("card formCard", "formCard");

  getApp().innerHTML = `
    ${renderPageHeader("edit")}
    ${editTripFormHtml}
  `;

  // ensure top on iPhone
  getApp().scrollTop = 0;

  const elDate = document.getElementById("e_date");
  const elDealer = document.getElementById("e_dealer");
  const elPounds = document.getElementById("e_pounds");
  const elAmount = document.getElementById("e_amount");
  const elArea = document.getElementById("e_area");
  const elSpecies = document.getElementById("e_species");
  const elNotes = document.getElementById("e_notes");
  const elRate = document.getElementById("rateValueEdit");
  const elToday = document.getElementById("todayBtnEdit");
  const topDealerWrapE = document.getElementById("topDealersE");
  const topAreaWrapE = document.getElementById("topAreasE");

  const updateRateLine = ()=>{
    if(!elRate) return;
    const p = Number(String(elPounds?.value || "").trim() || 0);
    const a = Number(String(elAmount?.value || "").trim() || 0);
    const next = formatMoney(computePPL(p, a));
    if("value" in elRate) elRate.value = next;
    else elRate.textContent = next;
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
      const ready = computeTripSaveEnabled({
        dealer: (String(elDealer?.value || "") === dealerAddSentinel) ? "" : elDealer?.value,
        area: elArea?.value,
        poundsInput: elPounds?.value,
        amountInput: elAmount?.value,
        parseNum,
        parseMoney,
        isValidAreaValue
      });
      if(elPounds) elPounds.classList.toggle("lbsBlue", ready.poundsOk);
      if(elAmount) elAmount.classList.toggle("money", ready.amountOk);
      const btn = document.getElementById("saveEdit");
      if(btn){
        const enabled = ready.enabled;
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

  [elDate, elDealer, elPounds, elAmount, elArea, elSpecies, elNotes].forEach(el=>{
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
        area: elArea.value,
        species: elSpecies?.value || DEFAULT_TRIP_SPECIES,
        notes: elNotes?.value || ""
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









const { renderReports } = createReportsScreenRenderer({
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
  showToast: (msg) => showToast(msg),
  buildReportsAggregationState,
  canonicalDealerGroupKey,
  normalizeDealerDisplay,
  formatMoney,
  to2,
  drawReportsCharts,
  computePPL
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
  showToast: (msg) => showToast(msg),
  copyTextWithFeedback: (text, successMsg) => copyTextWithFeedback(text, successMsg),
  getDebugInfo: () => getDebugInfo(),
  forceRefreshApp: () => forceRefreshApp(),
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
  updateBuildBadge: () => updateBuildBadge(),
  bindThemeControls: () => bindThemeControls(),
  bindNavHandlers,
  pushView,
  updateUpdateRow: () => updateUpdateRow(),
  updateBuildInfo: () => updateBuildInfo(),
  updateLastBackupLine: () => updateLastBackupLine(),
  exportBackup: () => exportBackup(),
  parseBackupFileForRestore: (file) => parseBackupFileForRestore(file),
  openRestorePreviewModal: (preview) => openRestorePreviewModal(preview),
  openReplaceSafetyBackupModal: () => openReplaceSafetyBackupModal(),
  importBackupFromFile: (file, options) => importBackupFromFile(file, options),
  applyThemeMode: () => applyThemeMode(),
  render: () => render(),
  openRestoreErrorModal: (error) => openRestoreErrorModal(error),
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
  if(bp && !bp.classList.contains("err")){ bp.textContent = "OK"; bp.title = `v ${DISPLAY_BUILD_VERSION}`; }
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
