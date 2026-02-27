// Shellfish Tracker — V2 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

window.__SHELLFISH_APP_STARTED = false;

import { uid, toCSV, downloadText, formatMoney, formatDateMDY, computePPL, parseMDYToISO, parseNum, parseMoney, likelyDuplicate, normalizeKey, escapeHtml, getTripsNewestFirst } from "./utils_v5.js?v=65";
const APP_VERSION = "v5.65";
const VERSION = APP_VERSION;

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
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg) await reg.update();
  }catch(_){}
}

async function swApplyNow(){
  try{
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg?.waiting){
      try{ reg.waiting.postMessage({ type: "SKIP_WAITING" }); }catch(_){}
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    }
  }catch(_){}
}

function updateUpdateRow(){
  const statusEl = document.getElementById("updateStatus");
  const btnNow = document.getElementById("updateNow");
  const btnCheck = document.getElementById("checkUpdate");
  if(!statusEl || !btnNow) return;

  if(SW_UPDATE_READY){
    statusEl.textContent = "Update: Ready";
    btnNow.style.display = "inline-block";
  }else{
    statusEl.textContent = "Update: Up to date";
    btnNow.style.display = "none";
  }

  if(btnCheck && !btnCheck.__bound){
    btnCheck.__bound = true;
    btnCheck.onclick = async ()=>{ await swCheckNow(); showToast("Checking for updates…"); };
  }
  if(btnNow && !btnNow.__bound){
    btnNow.__bound = true;
    btnNow.onclick = async ()=>{ await swApplyNow(); };
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

async function collectDiagnostics(){
  const diag = {
    appVersion: VERSION,
    schemaVersion: (typeof SCHEMA_VERSION !== "undefined" ? SCHEMA_VERSION : null),
    displayMode: getDisplayMode(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"),
    storage: {
      trips: Array.isArray(state?.trips) ? state.trips.length : null,
      areas: Array.isArray(state?.areas) ? state.areas.length : null,
    },
    backup: {
      lastBackupAt: state?.settings?.lastBackupAt || null,
    },
    serviceWorker: {
      supported: ("serviceWorker" in navigator),
      controller: (navigator.serviceWorker && navigator.serviceWorker.controller) ? true : false,
    },
  };

  try{
    if(navigator.serviceWorker){
      const reg = await navigator.serviceWorker.getRegistration();
      if(reg){
        diag.serviceWorker.scope = reg.scope || null;
        diag.serviceWorker.installing = !!reg.installing;
        diag.serviceWorker.waiting = !!reg.waiting;
        diag.serviceWorker.active = !!reg.active;
      }
    }
  }catch{}

  try{
    if(window.caches && caches.keys){
      diag.caches = await caches.keys();
    }
  }catch{}

  try{
    diag.lastError = {    };
  }catch{}

  return diag;
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

// v59: simple confirm modal (Yes/Cancel)
function confirmSaveModal({ title="Save this trip?", body="" } = {}){
  return new Promise((resolve)=>{
    const el = document.createElement("div");
    el.className = "modalOverlay";
    el.innerHTML = `
      <div class="modalCard card">
        <b>${escapeHtml(title)}</b>
        ${body ? `<div class="muted small" style="margin-top:8px;white-space:pre-wrap">${escapeHtml(body)}</div>` : ""}
        <div class="row" style="margin-top:14px;gap:10px;justify-content:flex-end">
          <button class="btn" id="m_cancel">Cancel</button>
          <button class="btn primary" id="m_yes">Yes, Save</button>
        </div>
      </div>
    `;

    const cleanup = (v)=>{
      try{ el.remove(); }catch{}
      resolve(v);
    };

    el.addEventListener("click", (e)=>{ if(e.target === el) cleanup(false); });
    document.body.appendChild(el);
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


// ---- Page Header (Option B: icon + title, shown on every page) ----
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
  return `
    <div class="pageHeader">
      <span class="phIcon">${iconSvg(m.icon)}</span>
      <h2 class="phTitle">${escapeHtml(m.title)}</h2>
      ${viewKey === "home" ? `<button class="phHelpBtn" id="homeHelp" type="button" aria-label="Help">?</button>` : ``}
    </div>
  `;
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
    `Shellfish Tracker ${APP_VERSION} (schema ${SCHEMA_VERSION})`,
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

async function readClipboardTextSafe() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) return "";
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

function insertTextAtCursor(el, text) {
  const t = String(text ?? "");
  if (!t) return;
  const node = el;
  if (!node || !(node instanceof HTMLElement)) return;
  const isText = node.tagName === "TEXTAREA" || (node.tagName === "INPUT" && (node.type === "text" || node.type === "search" || node.type === "tel" || node.type === "url" || node.type === "email" || node.type === "password" || node.type === "number"));
  if (!isText) return;

  const start = typeof node.selectionStart === "number" ? node.selectionStart : node.value.length;
  const end = typeof node.selectionEnd === "number" ? node.selectionEnd : node.value.length;
  const before = node.value.slice(0, start);
  const after = node.value.slice(end);
  node.value = before + t + after;

  const pos = start + t.length;
  try {
    node.setSelectionRange(pos, pos);
  } catch {}
  node.dispatchEvent(new Event("input", { bubbles: true }));
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

function getFilteredTripsLegacy(){
  const trips = Array.isArray(state.trips) ? state.trips.slice() : [];
  // Ensure newest first by date (and fallback to createdAt/id)
  trips.sort((a,b)=>{
    const da = String(a?.dateISO||"");
    const db = String(b?.dateISO||"");
    if(da !== db) return db.localeCompare(da);
    return String(b?.id||"").localeCompare(String(a?.id||""));
  });

  const f = state.filter || "YTD";
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last7 = new Date(now);
  last7.setDate(now.getDate() - 6);

  const toDate = (iso)=>{
    // iso expected YYYY-MM-DD
    const s = String(iso||"");
    if(s.length===10 && s[4]==="-" && s[7]==="-"){
      const y = Number(s.slice(0,4)), m = Number(s.slice(5,7))-1, d = Number(s.slice(8,10));
      return new Date(y,m,d);
    }
    // allow MDY as fallback
    const iso2 = parseMDYToISO(s);
    if(iso2) return toDate(iso2);
    return null;
  };

  const within = (dt)=>{
    if(!dt) return true; // if unknown date, keep it visible
    if(f==="YTD") return dt >= startOfYear;
    if(f==="Month") return dt >= startOfMonth;
    if(f==="7D") return dt >= last7;
    return true;
  };

  return trips.filter(t=> within(toDate(t?.dateISO)));
}

function mdyLabelFromISO(iso){
  const s = String(iso||"");
  return (s.length===10) ? s.replaceAll("-","") : "unknown";
}
function filenameFor(label, startISO="", endISO=""){
  const base = "shellfish_trips";
  if(label === "ALL") return base + "_ALL.csv";
  if(label === "YTD" || label === "Month" || label === "7D") return base + "_" + label + ".csv";
  if(startISO && endISO) return base + "_" + mdyLabelFromISO(startISO) + "_to_" + mdyLabelFromISO(endISO) + ".csv";
  return base + ".csv";
}
function exportTrips(trips, label, startISO="", endISO=""){
  // legacy wrapper (v36): keep behavior consistent with Trips screen
  exportTripsWithLabel(trips, String(label||"ALL").toUpperCase(), startISO, endISO);
}

function buildBackupPayloadFromState(st, exportedAtISO){
  const safeState = (st && typeof st === "object") ? st : {};
  return {
    app: "Shellfish Tracker",
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

function downloadBackupPayload(payload, prefix="shellfish_backup"){
  const y = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  const fname = `${prefix}_${y.getFullYear()}-${pad(y.getMonth()+1)}-${pad(y.getDate())}_${pad(y.getHours())}${pad(y.getMinutes())}.json`;
  downloadText(fname, JSON.stringify(payload, null, 2));
}

function exportBackup(){
  const payload = buildBackupPayloadFromState(state);
  downloadBackupPayload(payload, "shellfish_backup");
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

function importBackupFromFile(file){
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

        const replace = confirm(
          "Restore backup?\n\n" +
          "OK = Replace current trips/areas/dealers on this device\n" +
          "Cancel = Merge (skip likely duplicates)"
        );

        const hasExisting = (Array.isArray(state.trips) && state.trips.length) || (Array.isArray(state.areas) && state.areas.length) || (Array.isArray(state.dealers) && state.dealers.length);
        if(replace && hasExisting){
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

function filterByRange(trips, startISO, endISO){
  const s = String(startISO||"");
  const e = String(endISO||"");
  if(!(s.length===10 && e.length===10)) return trips;
  return trips.filter(t=>{
    const d = String(t?.dateISO||"");
    if(d.length!==10) return true;
    return d >= s && d <= e;
  });
}


function setFilter(f){
  state.filter = f;
  saveState();
  render();
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
function fmtMoney(n){
  n = Number(n);
  if(!Number.isFinite(n)) n = 0;
  return formatMoney(n);
}
function fmtLbs(n){
  n = Number(n);
  if(!Number.isFinite(n)) n = 0;
  return `${(Math.round((n + Number.EPSILON) * 10)/10).toFixed(1)} lb`;
}
function fmtPPL(amount, lbs){
  amount = Number(amount); lbs = Number(lbs);
  if(!Number.isFinite(amount) || !Number.isFinite(lbs) || lbs <= 0) return "$0.00/lb";
  const ppl = amount / lbs;
  return `${formatMoney(ppl)}/lb`;
}

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
function renderFilterBadge(){ return ""; }
function bindFilterBadgeToTrips(){ /* v62: filter badge removed */ }

// Trips filter bar (UI choice #2)
function renderTripsFilterBar(){
  ensureUnifiedFilters();
  const f = state.filters.active;
  const opt = getFilterOptionsFromTrips();

  const rangeOptions = [
    ["all","All"],
    ["ytd","YTD"],
    ["12m","Last 12m"],
    ["90d","Last 90d"],
    ["30d","Last 30d"],
    ["custom","Custom"]
  ];

  return `
    <div class="card">
      <div class="row" style="gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div style="min-width:140px;flex:1">
          <div class="muted small">Range</div>
          <select id="flt_range" class="select">
            ${rangeOptions.map(([k,l])=>`<option value="${k}" ${f.range===k?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>

        <div style="min-width:140px;flex:1">
          <div class="muted small">Dealer</div>
          <select id="flt_dealer" class="select">
            <option value="all" ${f.dealer==="all"?"selected":""}>All</option>
            ${opt.dealers.map(d=>`<option value="${escapeHtml(d)}" ${f.dealer===d?"selected":""}>${escapeHtml(d)}</option>`).join("")}
          </select>
        </div>

        <div style="min-width:140px;flex:1">
          <div class="muted small">Area</div>
          <select id="flt_area" class="select">
            <option value="all" ${f.area==="all"?"selected":""}>All</option>
            ${opt.areas.map(a=>`<option value="${escapeHtml(a)}" ${f.area===a?"selected":""}>${escapeHtml(a)}</option>`).join("")}
          </select>
        </div>

        <div style="min-width:140px;flex:1">
          <div class="muted small">Species</div>
          <select id="flt_species" class="select">
            <option value="all" ${f.species==="all"?"selected":""}>All</option>
            ${opt.species.map(s=>`<option value="${escapeHtml(s)}" ${f.species===s?"selected":""}>${escapeHtml(s)}</option>`).join("")}
          </select>
        </div>

        <div style="min-width:160px;flex:2;display:flex;align-items:flex-end">
          <button class="btn" id="exportTrips" type="button" style="width:100%">Export CSV</button>
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn" id="flt_reset">Reset</button>
        </div>
      </div>

      <div id="flt_custom_wrap" style="margin-top:10px;display:${f.range==="custom"?"block":"none"}">
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <div style="min-width:140px;flex:1">
            <div class="muted small">From</div>
            <input id="flt_from" type="date" class="input" value="${escapeHtml(String(f.fromISO||"").slice(0,10))}" />
          </div>
          <div style="min-width:140px;flex:1">
            <div class="muted small">To</div>
            <input id="flt_to" type="date" class="input" value="${escapeHtml(String(f.toISO||"").slice(0,10))}" />
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindTripsFilterBar(){
  ensureUnifiedFilters();
  const f = state.filters.active;

  const setAndRerender = ()=>{
    saveState();
    render();
  };

  const rangeEl = document.getElementById("flt_range");
  rangeEl?.addEventListener("change", ()=>{
    f.range = rangeEl.value;
    if(f.range === "custom"){
      const now = isoToday();
      const y = now.slice(0,4);
      if(!f.fromISO) f.fromISO = `${y}-01-01`;
      if(!f.toISO) f.toISO = now;
      if(f.fromISO > f.toISO){
        const tmp = f.fromISO; f.fromISO = f.toISO; f.toISO = tmp;
      }
    }
    setAndRerender();
  });

  document.getElementById("flt_dealer")?.addEventListener("change", (ev)=>{ f.dealer = ev.target.value; setAndRerender(); });
  document.getElementById("flt_area")?.addEventListener("change", (ev)=>{ f.area = ev.target.value; setAndRerender(); });
  document.getElementById("flt_species")?.addEventListener("change", (ev)=>{ f.species = ev.target.value; setAndRerender(); });

  const textEl = document.getElementById("flt_text");
  let textT;
  textEl?.addEventListener("input", ()=>{
    clearTimeout(textT);
    textT = setTimeout(()=>{ f.text = textEl.value; setAndRerender(); }, 120);
  });

  const fromEl = document.getElementById("flt_from");
  const toEl = document.getElementById("flt_to");
  fromEl?.addEventListener("change", ()=>{ f.fromISO = fromEl.value; f.range="custom"; setAndRerender(); });
  toEl?.addEventListener("change", ()=>{ f.toISO = toEl.value; f.range="custom"; setAndRerender(); });

  document.getElementById("flt_reset")?.addEventListener("click", ()=>{
    state.filters.active = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all", species:"all", text:"" };
    saveState();
    render();
  });
  // v62: Export CSV button lives in filter bar
  const exportBtn = document.getElementById("exportTrips");
  if(exportBtn){
    exportBtn.onclick = ()=>{
      const { rows, range, label } = getFilteredTrips();
      exportTripsWithLabel(rows, label, range.fromISO, range.toISO);
      showToast("CSV exported");
    };
  }


  if(state._scrollToFilters){
    state._scrollToFilters = false;
    saveState();
    requestAnimationFrame(()=>{ document.getElementById("flt_range")?.scrollIntoView({behavior:"smooth", block:"start"}); });
  }
}

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
      ? `This edit matches another trip:\n\nDate: ${formatDateMDY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave changes anyway?`
      : `This looks like a duplicate trip:\n\nDate: ${formatDateMDY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave anyway?`;
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

      <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
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

function ensureReportsFilter(){(){
  if(!state.reportsFilter || typeof state.reportsFilter !== "object") state.reportsFilter = { mode:"YTD", from:"", to:"" };
  if(!state.reportsFilter.mode) state.reportsFilter.mode = "YTD";
  if(state.reportsFilter.from == null) state.reportsFilter.from = "";
  if(state.reportsFilter.to == null) state.reportsFilter.to = "";
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

function modeRange(mode, fromMDY="", toMDY=""){
  const todayISO = isoToday();
  const now = new Date();
  const pad = (n)=>String(n).padStart(2,"0");

  if(mode === "YTD"){
    const start = `${now.getFullYear()}-01-01`;
    return { startISO:start, endISO:todayISO, label:"YTD" };
  }
  if(mode === "MONTH"){
    const start = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
    return { startISO:start, endISO:todayISO, label:"MONTH" };
  }
  if(mode === "7D"){
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    const start = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return { startISO:start, endISO:todayISO, label:"7D" };
  }
  if(mode === "RANGE"){
    const s = parseMDYToISO(fromMDY);
    const e = parseMDYToISO(toMDY);
    if(s && e){
      const a = s <= e ? {startISO:s,endISO:e} : {startISO:e,endISO:s};
      return { ...a, label:"RANGE" };
    }
    return { startISO:"", endISO:"", label:"RANGE" };
  }
  // ALL
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
    if(/[",
]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const header = ["Date","Dealer","Area","Pounds","Amount","$/Lb"].join(",");
  const lines = [header];
  for(const t of rows){
    const date = formatDateMDY(String(t?.dateISO||""));
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
  const csv = lines.join("
");
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

      <div class="muted small" style="margin-top:10px">
        Showing: <b>${escapeHtml(tripsActiveLabel(tf, r.label))}</b>
      </div>
    </div>
  `;

  const rows = sorted.length ? sorted.map(t=>{
    const date = formatDateMDY(t?.dateISO||"");
    const dealer = escapeHtml(String(t?.dealer||""));
    const area = escapeHtml(String(t?.area||""));
    const lbs = Number(t?.pounds)||0;
    const amt = Number(t?.amount)||0;
    const ppl = (lbs>0 && amt>0) ? (amt/lbs) : 0;
    return `
      <div class="trip triprow" data-id="${escapeHtml(String(t?.id||""))}" role="button" tabindex="0">
        <div class="trow">
          <div>
            <div class="metaRow"><span class="tmeta">${escapeHtml(date)}</span>${dealer?` <span class="dot">•</span> <span class="tmeta">${escapeHtml(dealer)}</span>`:""}</div>
            <div class="tname">${escapeHtml(area || "(area)")}</div>
            <div class="tsub">$/Lb: <b class="rate">${formatMoney(ppl)}</b></div>
          </div>
          <div class="tright">
            <div class="lbsBlue"><b class="lbsBlue">${to2(lbs)}</b> <span class="lbsBlue">lbs</span></div>
            <div><b class="money">${formatMoney(amt)}</b></div>
          </div>
        </div>
      </div>
    `;
  }).join("") : `<div class="muted small">No trips in this filter yet.</div>`;

  root.innerHTML = `
    <div class="page">
      <div class="pageHdr">
        <div>
          <div class="h1">Trips</div>
          <div class="muted small">Browse and export your trips.</div>
        </div>
        <div class="hdrBtns">
          <button class="btn" id="newTripBtn">+ New Trip</button>
        </div>
      </div>

      ${filtersCard}

      <div style="height:10px"></div>

      ${rows}
    </div>
  `;

  bindNavHandlers(state);

  // New trip
  document.getElementById("newTripBtn")?.addEventListener("click", ()=>{
    state.view = "new";
    saveState();
    render();
  });

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
      <div class="row" style="margin-top:10px">
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
      <div class="row" style="margin-top:10px">
        <button class="btn" id="backupNow">💾 Create Backup</button>
        <button class="btn" id="backupLater">Not now</button>
      </div>
    </div>
  ` : "";

  const f = String((state.homeFilter && state.homeFilter.mode) || "YTD").toUpperCase();
  const chip = (key,label) => `<button class="chip segBtn ${f===key?'on is-selected':''}" data-hf="${key}" type="button">${label}</button>`;

  const tripsSorted = getTripsNewestFirst(trips);
  const rows = tripsSorted.length ? tripsSorted.slice(0, HOME_TRIPS_LIMIT).map(t=>{
    const date = formatDateMDY(t?.dateISO);
    const dealer = (t?.dealer||"").toString();
    const lbs = to2(Number(t?.pounds)||0);
    const amt = to2(Number(t?.amount)||0);
    const ppl = computePPL(lbs, amt);
    const area = (t?.area||"").toString();
    const safeDealer = dealer ? dealer : "(dealer)";
    return `
      <div class="trip triprow" data-id="${t?.id||""}" role="button" tabindex="0">
        <div class="trow">
          <div>
            <div class="metaRow"><span class="tmeta">${date || ""}</span>${safeDealer ? ` <span class="dot">•</span> <span class="tmeta">${escapeHtml(safeDealer)}</span>` : ""}</div>
            <div class="tname">${escapeHtml(area || "(area)")}</div>
            <div class="tsub">$/Lb: <b class="rate">${formatMoney(ppl)}</b></div>
          </div>
          <div class="tright">
            <div class="lbsBlue"><b class="lbsBlue">${lbs}</b> <span class="lbsBlue">lbs</span></div>
            <div><b class="money">${formatMoney(amt)}</b></div>
          </div>
        </div>
      </div>
    `;
  }).join("") : `<div class="muted small">No trips in this range yet. Tap <b>＋ New Trip</b> to log your first one.</div>`;

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
        <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
          <input class="input" id="homeRangeFrom" inputmode="numeric" placeholder="From (MM/DD/YYYY)" value="${escapeHtml(hf.from||"")}" style="flex:1;min-width:160px" />
          <input class="input" id="homeRangeTo" inputmode="numeric" placeholder="To (MM/DD/YYYY)" value="${escapeHtml(hf.to||"")}" style="flex:1;min-width:160px" />
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

  // Home header Help ("?") button
  const hh = document.getElementById("homeHelp");
  if(hh){
    hh.onclick = ()=>{
      state.view = "help";
      saveState();
      render();
    };
  }


  // ensure top of view on iPhone
  getApp().scrollTop = 0;

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
      const from = String(document.getElementById("homeRangeFrom")?.value||"").trim();
      const to = String(document.getElementById("homeRangeTo")?.value||"").trim();
      state.homeFilter.from = from;
      state.homeFilter.to = to;
      saveState();
      renderHome();
    };
  }

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
    btnBackupNow.onclick = ()=>{
      try{
        exportBackup();
        state.settings = state.settings || {};
        state.settings.lastBackupAt = Date.now();
        state.settings.lastBackupTripCount = Array.isArray(state.trips) ? state.trips.length : 0;
        state.settings.backupSnoozeUntil = 0;
        saveState();
        showToast("Backup created");
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
  // Defaults
  const todayISO = new Date().toISOString().slice(0,10);
  const draft = state.draft || { dateISO: todayISO, dealer:"", pounds:"", amount:"", area:"" };
  const amountVal = String(draft.amount ?? "");


  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${escapeHtml(String(a||""))}" ${sel}>${label}</option>`;
  }).join("");



// Recent (last 2) unique values from saved trips (ignores filters)
// NOTE: Chips are always shown; if none exist yet we show a muted "No recent …" line.
const topAreas = (getLastUniqueFromTrips("area", 2));
const topDealers = (getLastUniqueFromTrips("dealer", 2));

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
}).join("");

;getApp().innerHTML = `
    ${renderPageHeader("new")}

    <div class="card formCard">

      <section class="trip-section">
      <div class="field">
        <div class="fieldLabel overline center">HARVEST DATE</div>
        <div class="dateRow">
          <span class="dateIcon">${iconSvg("calendar")}</span>
          <input class="input datePill" id="t_date" inputmode="numeric" placeholder="MM/DD/YYYY" value="${formatDateMDY(draft.dateISO||"")}" />
          <button class="todayBtn" id="todayBtn" type="button">Today</button>
        </div>
      </div>

      </section>

      <section class="trip-section">
      <div class="field">
        <div class="fieldLabel overline center">DEALERS</div>
        ${renderTopDealerChips(topDealers, draft.dealer, "topDealers")}
        <div class="selectRowWrap">
          <select class="input" id="t_dealer" aria-label="Select Dealer">
            ${dealerOptions}
          </select>
          <span class="chev">›</span>
        </div>
        <div id="dealerPrompt"></div>
      </div>

      </section>

      <section class="trip-section">
      <div class="grid2">
        <div class="field">
          <div class="fieldLabel overline">POUNDS</div>
          <div class="inputWrap">
            <input class="input inputWithSuffix" id="t_pounds" type="text" inputmode="decimal" placeholder="0.0" value="${escapeHtml(String(draft.pounds??""))}" />
            <span class="unitSuffix lbsBlue">lbs</span>
          </div>
        </div>
        <div class="field">
          <div class="fieldLabel overline">AMOUNT</div>
          <div class="inputWrap">
            <span class="moneyPrefix moneyGreen">$</span>
            <input class="input inputWithPrefix" id="t_amount" type="text" inputmode="decimal" placeholder="0.00" value="${escapeHtml(String(amountVal))}" />
          </div>
        </div>
      </div>
      <div class="rateLine muted small">$/lb: <b class="rate">${formatMoney(computePPL(Number(draft.pounds||0), Number(draft.amount||0)))}</b></div>

      </section>

      <section class="trip-section">
      <div class="field">
        <div class="fieldLabel overline center">AREA</div>
        ${renderTopAreaChips(topAreas, draft.area, "topAreas")}
        <div class="selectRowWrap">
          <select class="input" id="t_area" aria-label="Select Area">
            ${areaOptions}
          </select>
          <span class="chev">›</span>
        </div>
        <div id="areaPrompt"></div>
      </div>

      </section>

      <section class="trip-section trip-actions">
      <div class="actionsNew">
        <button class="btn primary" id="saveTrip" type="button" disabled>Save Trip</button>
        <div class="btnRow2">
                    <button class="btn danger" id="clearDraft" type="button">Clear</button>
        </div>
      </div>
      </section>

    </div>
  `;
  bindNavHandlers(state);

  const elDate = document.getElementById("t_date");
  const elDealer = document.getElementById("t_dealer");
  const elPounds = document.getElementById("t_pounds");
  const elAmount = document.getElementById("t_amount");

// Numeric input UX (Pounds + Amount):
// - first tap starts fresh (clears 0/placeholder-like values or selects all)
// - sanitize to digits + one dot while typing
// - normalize Amount to 2 decimals on blur
const sanitizeDecimalInput = (raw)=>{
  let s = String(raw || "").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if(dot !== -1){
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  return s;
};
const primeNumericField = (el, zeroValues)=>{
  try{
    const v = String(el.value || "").trim();
    if(!v || (zeroValues||[]).includes(v)){
      el.value = "";
    }else{
      requestAnimationFrame(()=>{ try{ el.select(); }catch(_){} });
    }
  }catch(_){}
};
const normalizeAmountOnBlur = (el)=>{
  try{
    const s = String(el.value || "").trim();
    if(!s){ el.value = "0.00"; return; }
    const n = Number(s);
    el.value = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }catch(_){}
};
  const elArea = document.getElementById("t_area");
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
    });
    elPounds.addEventListener("blur", ()=>{
      if(String(elPounds.value||"").endsWith(".")) elPounds.value = String(elPounds.value).slice(0, -1);
      updateSaveEnabled();
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
    });
    elAmount.addEventListener("blur", ()=>{
      normalizeAmountOnBlur(elAmount);
      updateSaveEnabled();
    });
  }

  if(elToday && elDate){
    elToday.onclick = ()=>{
      const today = isoToday();
      elDate.value = formatDateMDY(today);
      state.draft = state.draft || {};
      state.draft.dateISO = today;
      saveDraft();
      updateSaveEnabled();
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
      const mdy = String(elDate?.value||"").trim();
      const iso = parseMDYToISO(mdy) || "";
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
  if(btnSave){
    // iOS standalone can occasionally miss 'click'—bind both.
    btnSave.onclick = onSaveTrip;
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

  if(topAreaWrap && elArea){
  topAreaWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-area]");
    if(!btn) return;
    const a = btn.getAttribute("data-area") || "";
    elArea.value = a;
    state.draft = state.draft || {};
    state.draft.area = a;
    saveDraft();
    updateSaveEnabled();
  });
}


if(topDealerWrap && elDealer){
  topDealerWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-dealer]");
    if(!btn) return;
    const d = btn.getAttribute("data-dealer") || "";
    elDealer.value = d;
    state.draft = state.draft || {};
    state.draft.dealer = d;
    saveDraft();
    updateSaveEnabled();
  });
}

  // Initial state
  updateSaveEnabled();
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

  const topAreasR = (getLastUniqueFromTrips("area", 3));
  if(!topAreasR.length){
    topAreasR.push(...(Array.isArray(state.areas)?state.areas:[]).slice(0,3));
  }

// Top 3 most-used Dealers (from saved trips) for quick selection
  // Last 3 unique Dealers (based on entry order; ignores filters)
  const topDealersR = (getLastUniqueFromTrips("dealer", 3));
  if(!topDealersR.length){
    topDealersR.push(...(Array.isArray(state.dealers)?state.dealers:[]).slice(0,3));
  }
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
      <div class="form">
        <div class="field">
          <div class="label">Harvest date</div>
          <input class="input" id="r_date" inputmode="numeric" placeholder="MM/DD/YYYY" value="${formatDateMDY(d.dateISO||"")}" />
        </div>

        <div class="field">
          <div class="label">Dealer</div>
          ${renderTopDealerChips(topDealersR, d.dealer, "topDealersR")}<input class="input" id="r_dealer" placeholder="Machias Bay Seafood" value="${escapeHtml(String(d.dealer||""))}" />
          <div id="r_dealerSugg"></div>
          <div id="r_dealerPrompt"></div>
        </div>

        <div class="field">
          <div class="label">Pounds</div>
          <input class="input" id="r_pounds" inputmode="decimal" value="${escapeHtml(String(d.pounds??""))}" />
        </div>

        <div class="field">
          <div class="label">Amount</div>
          <input class="input" id="r_amount" inputmode="decimal" value="${escapeHtml(String(amountDispR))}" />
        </div>

        <div class="field">
          <div class="label">Area</div>
          ${renderTopAreaChips(topAreasR, d.area, "topAreasR")}
          <select class="select" id="r_area">
            ${areaOptionsR}
          </select>
        </div>

        <div class="pillbar">
          <span class="pill" id="pplPill">Price/Lb: <b class="rate">${formatMoney(ppl)}</b></span>
        </div>

        ${d.raw ? `
          <div class="sep"></div>
          <div class="muted small" style="white-space:pre-wrap">${escapeHtml(d.raw)}</div>
        ` : ``}

        <div class="actions">
          <button class="btn good" id="confirmSave">Confirm & Save Trip</button>
          <button class="btn ghost" id="cancelReview">Cancel</button>
        </div>
      </div>
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
    if(pplPill){
      const v = computePPL(Number(p||0), Number(a||0));
      pplPill.innerHTML = `Price/Lb: <b class="rate">${formatMoney(v)}</b>`;
    }
    // Live warnings (missing fields + possible duplicate)
    try{
      const warnEl = document.getElementById("reviewWarnings");
      if(warnEl){
        const dateISO = parseMDYToISO(document.getElementById("r_date")?.value || "");
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
                Similar trip found: <b>${escapeHtml(formatDateMDY(dup.dateISO||""))}</b> — ${escapeHtml(String(dup.dealer||""))} (<span class="money">${formatMoney(dup.amount||0)}</span> / <span class="lbsBlue">${to2(Number(dup.pounds||0))} lbs</span>)
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
      const a = btn.getAttribute("data-area") || "";
      elAreaLive.value = a;
      updateReviewDerived();
    });
  }

  if(topDealerWrapR && elDealerLive){
    topDealerWrapR.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-dealer]");
      if(!btn) return;
      const d = btn.getAttribute("data-dealer") || "";
      elDealerLive.value = d;
      updateReviewDerived();
    });
  }

  // Ensure pill reflects whatever is currently in the inputs.
  updateReviewDerived();
  const __confirmSave = document.getElementById("confirmSave");
  if(__confirmSave) __confirmSave.onclick = ()=>{
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
  };
}

function renderEditTrip(){
  const id = String(state.editId || "");
  const trips = Array.isArray(state.trips) ? state.trips : [];
  const t = trips.find(x => String(x?.id||"") === id);
  if(!t){
    state.view = nextView;
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

  const amountDispE = displayAmount(t.amount);

  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${escapeHtml(String(a||""))}" ${sel}>${label}</option>`;
  }).join("");

  // Top 3 most-used Areas (from saved trips) for quick selection
  const topAreasE = (()=>{
    const counts = new Map();
    for(const x of trips){
      const a = String(x.area||"").trim();
      if(!a) continue;
      counts.set(a, (counts.get(a)||0) + 1);
    }
    return Array.from(counts.entries())
      .sort((x,y)=> (y[1]-x[1]) || x[0].localeCompare(y[0]))
      .slice(0,3)
      .map(([a])=>a);
  })();


  getApp().innerHTML = `
    ${renderPageHeader("edit")}

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="navBack">← Back</button>
        <b>Edit Trip</b>
        <span class="muted small"></span>
      </div>
      <div class="hint">Tap Save Changes when finished. Delete removes the trip from your phone.</div>
    </div>

    <div class="card">
      <div class="form">
        <div class="field">
          <div class="label">Harvest date</div>
          <input class="input" id="e_date" inputmode="numeric" placeholder="MM/DD/YYYY" value="${formatDateMDY(draft.dateISO||"")}" />
        </div>

        <div class="field">
          <div class="label">Dealer</div>
          <input class="input" id="e_dealer" placeholder="Machias Bay Seafood" value="${escapeHtml(String(draft.dealer||""))}" />
        </div>

        <div class="field">
          <div class="label">Pounds</div>
          <input class="input" id="e_pounds" inputmode="decimal" placeholder="0.0" value="${String(draft.pounds??"")}" />
        </div>

        <div class="field">
          <div class="label">Amount</div>
          <input class="input" id="e_amount" inputmode="decimal" placeholder="$0.00" value="${escapeHtml(String(amountDispE))}" />
        </div>

        <div class="field">
          <div class="label">Area</div>
          ${renderTopAreaChips(topAreasE, draft.area, "topAreasE")}
          <select class="select" id="e_area">
            ${areaOptions}
          </select>
        </div>

        <div class="actions">
          <button class="btn primary" id="saveEdit">Save Changes</button>
          <button class="btn" id="navCancel">Cancel</button>
          <button class="btn danger" id="deleteTrip">Delete</button>
        </div>
      </div>
    </div>
  `;

  // ensure top on iPhone
  getApp().scrollTop = 0;

  const elDate = document.getElementById("e_date");
  const elDealer = document.getElementById("e_dealer");
  const elPounds = document.getElementById("e_pounds");
  const elAmount = document.getElementById("e_amount");
  const elArea = document.getElementById("e_area");

  bindAreaChips("topAreasE", (a)=>{ elArea.value = String(a||""); });

  bindNavHandlers(state);

  document.getElementById("saveEdit").onclick = ()=>{
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
  };

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
  const rf = state.reportsFilter || { mode:"YTD", from:"", to:"" };
  const fMode = String(rf.mode || "YTD").toUpperCase();
  const mode = state.reportsMode || "tables"; // "charts" | "tables"

  const r = modeRange(fMode, rf.from, rf.to);
  const hasValidRange = (r.label !== "RANGE") || (r.startISO && r.endISO);
  const trips = (r.label === "ALL") ? tripsAll : (hasValidRange ? filterByISOInclusive(tripsAll, r.startISO, r.endISO) : tripsAll);

  const chip = (key,label) => `<button class="chip ${fMode===key?'on':''}" data-rf="${key}">${label}</button>`;
  const seg = (key,label) => `<button class="chip ${mode===key?'on':''}" data-m="${key}">${label}</button>`;

  const rangeLabel = (fMode === "RANGE")
    ? (hasValidRange ? `${formatDateMDY(r.startISO)} → ${formatDateMDY(r.endISO)}` : "Set dates")
    : r.label;

  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:0">
          <b>Reports</b>
          <span class="pill">Range: <b>${escapeHtml(rangeLabel)}</b></span>
        </div>

        <div class="chipGrid cols-3" style="margin-top:10px">
          ${chip("YTD","YTD")}
          ${chip("MONTH","Month")}
          ${chip("7D","7 Days")}
          ${chip("RANGE","Range")}
        </div>

        ${fMode==="RANGE" ? `
          <div class="sep"></div>
          <div class="grid2">
            <div class="field">
              <div class="label">From (MM/DD/YYYY)</div>
              <input class="input" id="repRangeFrom" inputmode="numeric" placeholder="MM/DD/YYYY" value="${escapeHtml(rf.from||"")}" />
            </div>
            <div class="field">
              <div class="label">To (MM/DD/YYYY)</div>
              <input class="input" id="repRangeTo" inputmode="numeric" placeholder="MM/DD/YYYY" value="${escapeHtml(rf.to||"")}" />
            </div>
          </div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="repRangeApply">Apply</button>
          </div>
        ` : ""}

        <div class="hint">${fMode==="RANGE" && !hasValidRange ? "Set a valid date range to see tables and charts." : "No trips in this range yet."}</div>
      </div>
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

    const applyBtn = document.getElementById("repRangeApply");
    if(applyBtn){
      applyBtn.onclick = ()=>{
        const from = String(document.getElementById("repRangeFrom")?.value || "").trim();
        const to = String(document.getElementById("repRangeTo")?.value || "").trim();
        const s = parseMDYToISO(from);
        const e = parseMDYToISO(to);
        if(!s || !e){ showToast("Invalid range dates"); return; }
        state.reportsFilter.from = from;
        state.reportsFilter.to = to;
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
            <div>$/lb <b class="rate">${formatMoney(r.avg)}</b></div>
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
            <div>$/lb <b class="rate">${formatMoney(r.avg)}</b></div>
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

  const renderHLItem = (t)=>{
    if(!t) return `<div class="muted small">—</div>`;
    const date = escapeHtml(formatDateMDY(t?.dateISO||""));
    const dealer = escapeHtml(String(t?.dealer||"")) || "(dealer)";
    const area = escapeHtml(String(t?.area||"")) || "(area)";
    const lbsNum = Number(t?.pounds)||0;
    const amtNum = Number(t?.amount)||0;
    const ppl = (lbsNum>0 && amtNum>0) ? (amtNum/lbsNum) : 0;
    return `
      <div class="trip triprow hlTrip">
        <div class="trow">
          <div>
            <div class="metaRow"><span class="tmeta">${date}</span> <span class="dot">•</span> <span class="tmeta">${dealer}</span></div>
            <div class="tname">${area}</div>
            <div class="tsub">$/Lb: <b class="rate">${ppl>0 ? formatMoney(to2(ppl)) : "—"}</b></div>
          </div>
          <div class="tright">
            <div class="lbsBlue"><b class="lbsBlue">${to2(lbsNum)}</b> <span class="lbsBlue">lbs</span></div>
            <div><b class="money">${formatMoney(to2(amtNum))}</b></div>
          </div>
        </div>
      </div>
    `;
  };

  const renderChartsSection = ()=>{
    return `
      <div class="card">
        <b>Avg $/lb by Month</b>
        <div class="sep"></div>
        <canvas class="chart" id="c_ppl" height="180"></canvas>
      </div>
      <div class="card">
        <b>Dealer Amount (Top)</b>
        <div class="sep"></div>
        <canvas class="chart" id="c_dealer" height="200"></canvas>
      </div>
      <div class="card">
        <b>Monthly Pounds</b>
        <div class="sep"></div>
        <canvas class="chart" id="c_lbs" height="180"></canvas>
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

        <div class="hlHdr">Most Pounds</div>
        ${renderHLItem(maxLbs)}
        <div class="sep"></div>

        <div class="hlHdr">Least Pounds</div>
        ${renderHLItem(minLbs)}
        <div class="sep"></div>

        <div class="hlHdr">Highest Amount</div>
        ${renderHLItem(maxAmt)}
        <div class="sep"></div>

        <div class="hlHdr">Lowest Amount</div>
        ${renderHLItem(minAmt)}
        <div class="sep"></div>

        ${pplRows.length ? `
          <div class="hlHdr">Highest $/lb</div>
          ${renderHLItem(maxPpl)}
          <div class="sep"></div>

          <div class="hlHdr">Lowest $/lb</div>
          ${renderHLItem(minPpl)}
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

      <div class="chipGrid cols-3" style="margin-top:10px">
        ${chip("YTD","YTD")}
        ${chip("MONTH","Month")}
        ${chip("7D","7 Days")}
        ${chip("RANGE","Range")}
      </div>

      ${fMode==="RANGE" ? `
        <div class="sep"></div>
        <div class="grid2">
          <div class="field">
            <div class="label">From (MM/DD/YYYY)</div>
            <input class="input" id="repRangeFrom" inputmode="numeric" placeholder="MM/DD/YYYY" value="${escapeHtml(rf.from||"")}" />
          </div>
          <div class="field">
            <div class="label">To (MM/DD/YYYY)</div>
            <input class="input" id="repRangeTo" inputmode="numeric" placeholder="MM/DD/YYYY" value="${escapeHtml(rf.to||"")}" />
          </div>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn primary" id="repRangeApply">Apply</button>
        </div>
      ` : ""}

      <div class="chipGrid cols-3" style="margin-top:10px">
        ${seg("charts","Charts")}
        ${seg("tables","Tables")}
      </div>
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

  // apply range
  const applyBtn = document.getElementById("repRangeApply");
  if(applyBtn){
    applyBtn.onclick = ()=>{
      const from = String(document.getElementById("repRangeFrom")?.value || "").trim();
      const to = String(document.getElementById("repRangeTo")?.value || "").trim();
      const s = parseMDYToISO(from);
      const e = parseMDYToISO(to);
      if(!s || !e){ showToast("Invalid range dates"); return; }
      state.reportsFilter.from = from;
      state.reportsFilter.to = to;
      saveState();
      renderReports();
    };
  }

  // mode chips
  getApp().querySelectorAll(".chip[data-m]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.getAttribute("data-m");
      state.reportsMode = key;
      saveState();
      renderReports();
    };
  });

  if(mode === "charts"){
    setTimeout(()=>{ drawReportsCharts(monthRows, dealerRows); }, 0);
  }
}


function drawReportsCharts(monthRows, dealerRows){
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

  function drawAxes(ctx, w, h, pad){
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();
  }

  function formatShortMoney(v){
    const n = Number(v)||0;
    return "$" + (Math.round(n*100)/100).toFixed(2);
  }

  // Line: Avg $/lb by month
  {
    const c = setupCanvas(document.getElementById("c_ppl"));
    if(c){
      const {ctx,w,h} = c;
      const pad = 22;
      clear(ctx,w,h);
      drawAxes(ctx,w,h,pad);

      const vals = monthRows.map(r=> Number(r.avg)||0);
      const maxV = Math.max(1e-6, ...vals);
      const minV = Math.min(...vals);
      const span = (maxV - minV) || maxV || 1;

      const plotW = w - pad*2;
      const plotH = h - pad*2;

      ctx.strokeStyle = "rgba(43,135,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      vals.forEach((v,i)=>{
        const x = pad + (i/(vals.length-1 || 1))*plotW;
        const y = (h - pad) - ((v - minV)/span)*plotH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();

      ctx.fillStyle = "rgba(43,135,255,0.9)";
      vals.forEach((v,i)=>{
        const x = pad + (i/(vals.length-1 || 1))*plotW;
        const y = (h - pad) - ((v - minV)/span)*plotH;
        ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2); ctx.fill();
      });

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Arial";
      ctx.fillText("Jan", pad, h-6);
      ctx.fillText("Dec", w-pad-22, h-6);
      ctx.fillText(formatShortMoney(maxV), pad+4, pad+10);
    }
  }

  // Bar: Total $ by dealer (top 8)
  {
    const c = setupCanvas(document.getElementById("c_dealer"));
    if(c){
      const {ctx,w,h} = c;
      const pad = 22;
      clear(ctx,w,h);
      drawAxes(ctx,w,h,pad);

      const top = dealerRows.slice(0,8);
      const vals = top.map(r=> Number(r.amt)||0);
      const maxV = Math.max(1e-6, ...vals);

      const plotW = w - pad*2;
      const plotH = h - pad*2;
      const barW = plotW / (top.length || 1);

      top.forEach((r,i)=>{
        const v = Number(r.amt)||0;
        const bh = (v/maxV)*plotH;
        const x = pad + i*barW + 4;
        const y = (h - pad) - bh;
        ctx.fillStyle = "rgba(43,135,255,0.7)";
        ctx.fillRect(x, y, Math.max(6, barW-8), bh);
      });

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "10px system-ui, -apple-system, Segoe UI, Arial";
      top.forEach((r,i)=>{
        const lab = (r.name||"").slice(0,6);
        const x = pad + i*barW + 4;
        ctx.fillText(lab, x, h-6);
      });

      ctx.fillText(formatShortMoney(maxV), pad+4, pad+10);
    }
  }

  // Bar: Total Lbs by month
  {
    const c = setupCanvas(document.getElementById("c_lbs"));
    if(c){
      const {ctx,w,h} = c;
      const pad = 22;
      clear(ctx,w,h);
      drawAxes(ctx,w,h,pad);

      const vals = monthRows.map(r=> Number(r.lbs)||0);
      const maxV = Math.max(1e-6, ...vals);
      const plotW = w - pad*2;
      const plotH = h - pad*2;
      const barW = plotW / (vals.length || 1);

      vals.forEach((v,i)=>{
        const bh = (v/maxV)*plotH;
        const x = pad + i*barW + 1;
        const y = (h - pad) - bh;
        ctx.fillStyle = "rgba(43,135,255,0.7)";
        ctx.fillRect(x, y, Math.max(2, barW-2), bh);
      });

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "11px system-ui, -apple-system, Segoe UI, Arial";
      ctx.fillText("Jan", pad, h-6);
      ctx.fillText("Dec", w-pad-22, h-6);
      ctx.fillText(String(Math.round(maxV)), pad+4, pad+10);
    }
  }
}


function renderSettings(){
  ensureAreas();
  ensureDealers();

  const s = state.settings || (state.settings = {});
  const listMode = String(s.listMode || "areas").toLowerCase();

  const areaRows = state.areas.length ? state.areas.map((a, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(a)}</b></div>
      <button class="smallbtn danger" data-del-area="${i}">Delete</button>
    </div>
  `).join("") : `<div class="muted small" style="margin-top:10px">No areas yet. Add one below.</div>`;

  const dealerRows = state.dealers.length ? state.dealers.map((d, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(d)}</b></div>
      <button class="smallbtn danger" data-del-dealer="${i}">Delete</button>
    </div>
  `).join("") : `<div class="muted small" style="margin-top:10px">No dealers yet. Add one below.</div>`;

  getApp().innerHTML = `
    ${renderPageHeader("settings")}

    <div class="card">
      <b>Updates</b>
      <div class="sep"></div>
      <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap;align-items:center">
        <div class="muted small" id="updateStatus">Update: Up to date</div>
        <button class="btn" id="updateNow" style="display:none">Update Now</button>
        <button class="btn" id="checkUpdate">Check now</button>
      </div>
    </div>

    <div class="card">
      <b>Lists</b>
      <div class="sep"></div>

      <div class="segWrap" style="margin-top:10px">
        <button class="chip segBtn ${listMode==="areas"?"on is-selected":""}" data-listmode="areas" type="button">Areas</button>
        <button class="chip segBtn ${listMode==="dealers"?"on is-selected":""}" data-listmode="dealers" type="button">Dealers</button>
      </div>

      ${listMode==="dealers" ? `
        <div style="margin-top:12px">
          <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
            <input class="input" id="newDealer" placeholder="Add dealer (ex: Machias Bay Seafood)" style="flex:1;min-width:180px" />
            <button class="btn primary" id="addDealer">Add</button>
          </div>
          ${dealerRows}
        </div>
      ` : `
        <div style="margin-top:12px">
          <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
            <input class="input" id="newArea" placeholder="Add area (ex: 19/626)" style="flex:1;min-width:180px" />
            <button class="btn primary" id="addArea">Add</button>
          </div>
          ${areaRows}
        </div>
      `}
    </div>

    <div class="card">
      <b>Data</b>
      <div class="sep"></div>
      <div class="muted small" style="margin-top:10px">Create a backup file you can store in Files/Drive. Restore brings it back later.</div>
      <div class="hint" style="margin-top:10px"><b>Backup recommended</b> before major updates.</div>
      <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
        <button class="btn" id="downloadBackup">💾 Create Backup</button>
        <button class="btn" id="restoreBackup">📥 Restore Backup</button>
        <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" style="display:none" />
      </div>
    </div>

    <div class="card">
      <b>Help</b>
      <div class="sep"></div>
      <div class="muted small" style="margin-top:10px">Short instructions for manual entry, clipboard paste, backups, and install.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="openHelp">Open Help</button>
      </div>
    </div>

    <div class="card">
      <b>About</b>
      <div class="sep"></div>
      <div class="muted small" style="margin-top:10px">Created by <b>Jeremy Wood</b> — <a class="settingsEmail" href="mailto:jeremywwood76@gmail.com">jeremywwood76@gmail.com</a></div>
      <div class="muted small" style="margin-top:8px">Version: <b>${VERSION}</b></div>
      <div id="buildBadge" class="muted small" style="margin-top:8px"></div>

      <div class="muted small" style="margin-top:8px">© 2026 Jeremy Wood. All rights reserved.</div>
      <div class="sep" style="margin-top:10px"></div>
      <div class="muted small" style="margin-top:10px"><b>Legal</b></div>
      <div class="row" style="margin-top:10px;gap:10px;flex-wrap:wrap">
        <button class="btn" id="openTerms">Terms</button>
        <button class="btn" id="openPrivacy">Privacy</button>
        <button class="btn" id="openLicense">License</button>
      </div>
    </div>

    <details class="card" id="advancedBox">
      <summary style="cursor:pointer;"><b>Advanced</b></summary>
      <div class="sep" style="margin-top:10px"></div>

      <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
        <button class="btn" id="copyDebug">Copy Details</button>
        <button class="btn" id="refreshApp">Refresh App</button>
      </div>

      <div class="muted small" style="margin-top:10px">Erase removes all trips and lists on this device. Use a backup first.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn danger" id="resetData">Erase All Data</button>
      </div>
    </details>
  `;

  getApp().scrollTop = 0;
  updateBuildBadge();

  bindNavHandlers(state);

  document.getElementById("openHelp").onclick = ()=>{ pushView(state, "help"); };

  updateUpdateRow();

  document.getElementById("openTerms").onclick = ()=>{ window.location.href = "legal/terms.html"; };
  document.getElementById("openPrivacy").onclick = ()=>{ window.location.href = "legal/privacy.html"; };
  document.getElementById("openLicense").onclick = ()=>{ window.location.href = "legal/license.html"; };

  // List mode toggle
  getApp().querySelectorAll("button.chip[data-listmode]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const m = String(btn.getAttribute("data-listmode")||"areas").toLowerCase();
      state.settings = state.settings || {};
      state.settings.listMode = (m === "dealers") ? "dealers" : "areas";
      saveState();
      renderSettings();
    });
  });

  // Backup / Restore (JSON)
  const backupFile = document.getElementById("backupFile");
  document.getElementById("downloadBackup").onclick = ()=>{
    try{
      exportBackup();
      state.settings = state.settings || {};
      state.settings.lastBackupAt = Date.now();
      state.settings.lastBackupTripCount = Array.isArray(state.trips) ? state.trips.length : 0;
      state.settings.backupSnoozeUntil = 0;
      saveState();
      showToast("Backup created");
    }catch(e){
      console.error(e);
      showToast("Backup failed");
    }
  };
  document.getElementById("restoreBackup").onclick = ()=>{
    if(backupFile) backupFile.click();
  };
  if(backupFile){
    backupFile.onchange = async ()=>{
      const file = backupFile.files && backupFile.files[0];
      if(!file) return;
      try{
        const res = await importBackupFromFile(file);
        const msg = res.mode === "replace"
          ? `Restored backup (${res.tripsAdded} trips)`
          : `Merged backup (+${res.tripsAdded} trips)`;
        showToast(msg);
        if(res.warnings && res.warnings.length){
          const top = res.warnings.slice(0,3).join("\n");
          alert(`Restore warnings:\n\n${top}${res.warnings.length>3 ? `\n\n(+${res.warnings.length-3} more)` : ""}`);
        }
        renderSettings();
      }catch(e){
        console.error(e);
        showToast("Restore failed");
      }finally{
        backupFile.value = "";
      }
    };
  }

  const addAreaBtn = document.getElementById("addArea");
  if(addAreaBtn) addAreaBtn.onclick = ()=>{
    const v = String(document.getElementById("newArea")?.value||"").trim();
    if(!v) return;
    state.areas = Array.isArray(state.areas) ? state.areas : [];
    state.areas.push(v);
    ensureAreas();
    saveState();
    renderSettings();
  };

  const addDealerBtn = document.getElementById("addDealer");
  if(addDealerBtn) addDealerBtn.onclick = ()=>{
    const v = String(document.getElementById("newDealer")?.value||"").trim();
    if(!v) return;
    state.dealers = Array.isArray(state.dealers) ? state.dealers : [];
    state.dealers.push(v);
    ensureDealers();
    saveState();
    renderSettings();
  };

  getApp().querySelectorAll("[data-del-area]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const idx = Number(btn.getAttribute("data-del-area"));
      if(!(idx >= 0)) return;
      const label = state.areas[idx];
      if(!confirm(`Delete area "${label}"?`)) return;
      state.areas.splice(idx,1);
      saveState();
      renderSettings();
    });
  });

  getApp().querySelectorAll("[data-del-dealer]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = parseInt(btn.getAttribute("data-del-dealer")||"-1", 10);
      if(!(i>=0)) return;
      const label = state.dealers[i];
      if(!confirm(`Delete dealer "${label}"?`)) return;
      state.dealers.splice(i,1);
      ensureDealers();
      saveState();
      renderSettings();
    });
  });

  document.getElementById("copyDebug").onclick = async ()=>{
    const ok = await copyTextToClipboard(getDebugInfo());
    showToast(ok ? "Details copied" : "Copy failed");
  };

  document.getElementById("refreshApp").onclick = async ()=>{
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

  document.getElementById("resetData").onclick = ()=>{
    const typed = prompt('Type DELETE to permanently erase ALL trips and lists on this device.');
    if(typed !== "DELETE") return;
    state = { trips: [], areas: [], dealers: [], filter: "YTD", view: "home", settings: {} };
    saveState();
    render();
  };
}




function applyMDYMaskInput(el){
  if(!el) return;
  const fmt = (digits)=>{
    const d = (digits||"").replace(/\D/g,"").slice(0,8);
    const mm = d.slice(0,2);
    const dd = d.slice(2,4);
    const yy = d.slice(4,8);
    if(d.length <= 2) return mm;
    if(d.length <= 4) return mm + "/" + dd;
    return mm + "/" + dd + "/" + yy;
  };
  // format initial
  el.value = fmt(el.value);
  el.addEventListener("input", ()=>{
    const start = el.selectionStart || 0;
    const before = el.value;
    el.value = fmt(el.value);
    // best-effort caret: move to end if slashes inserted
    const delta = el.value.length - before.length;
    try{ el.setSelectionRange(start + delta, start + delta); }catch{}
  });
}

function renderHelp(){
  getApp().innerHTML = `
    ${renderPageHeader("help")}

    <div class="card">
      <b>Help</b>
      <div class="hint">How to use Shellfish Tracker (no paste required).</div>
    </div>

    <div class="card">
      <b>Main sections</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.6">
        <ul style="margin:8px 0 0 18px">
          <li><b>Home</b>: Your totals (filtered) + recent trips list.</li>
          <li><b>New Trip</b>: Enter a harvest check (date, dealer, pounds, amount, area).</li>
          <li><b>Reports</b>: Summaries and rollups for your selected time filter.</li>
          <li><b>Settings</b>: Backup/restore, lists (areas/dealers), and app options.</li>
        </ul>
      </div>
    </div>

    <div class="card">
      <b>Entering a trip</b>
      <div class="sep"></div>
      <ol class="muted helpText" style="margin:8px 0 0 18px;line-height:1.6">
        <li>Tap <b>New Trip</b>.</li>
        <li>Enter the <b>Harvest date</b> (MM/DD/YYYY).</li>
        <li>Enter the <b>Dealer</b> (or tap a quick-pick chip if shown).</li>
        <li>Enter <b>Pounds</b> and <b>Amount</b>.</li>
        <li>Select an <b>Area</b> (or tap a quick-pick chip if shown).</li>
        <li>Tap <b>Save Trip</b>.</li>
      </ol>
      <div class="hint">Tip: chips are “quick pick” shortcuts—tap to fill faster.</div>
    </div>

    <div class="card">
      <b>Filters & totals</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.6">
        Use <b>YTD / Month / Last 7 days</b> on Home to change what’s included in totals and the list.
        Reports uses the same filter.
      </div>
    </div>

    <div class="card">
      <b>Install / Offline</b>
      <div class="sep"></div>
      <div class="muted helpText" style="line-height:1.6">
        <b>iPhone/iPad install:</b> Open in Safari → tap Share → <b>Add to Home Screen</b>.
        Installed PWAs can lag behind updates due to cached files. If something looks wrong, use <b>Reset cache</b> then reload.
      </div>
    </div>
  `;

  getApp().scrollTop = 0;

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
      <b>Shellfish Tracker</b>
      <div class="sep"></div>
      <div class="muted small">Version: <b>${VERSION}</b></div>
      <div class="muted small" style="margin-top:8px">All data stays on this device unless you export/backup.</div>
      <div class="row" style="margin-top:12px">
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
    const subj = encodeURIComponent("Shellfish Tracker Feedback ("+VERSION+")");
    location.href = `mailto:?subject=${subj}&body=${body}`;
  };
}

function render(){
  if(!state.view) state.view = "home";

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
  const items = Array.isArray(topAreas) ? topAreas.filter(Boolean).map(x=>String(x)) : [];
  if(!items.length){
    return `<div class="recentEmpty muted small">No recent areas yet</div>`;
  }
  return `
    <div class="areachips" id="${containerId}">
      ${items.map(a=>{
        const on = (String(currentArea||"").trim() === String(a||"").trim());
        return `<button class="areachip${on ? " on" : ""}" type="button" data-area="${escapeHtml(a)}">${escapeHtml(a)}</button>`;
      }).join("")}
    </div>
  `;
}

function renderTopDealerChips(topDealers, currentDealer, containerId){
  const items = Array.isArray(topDealers) ? topDealers.filter(Boolean).map(x=>String(x)) : [];
  if(!items.length){
    return `
      <div class="recentEmpty muted small">No recent dealers yet</div>
    `;
  }
  return `
    <div class="areachips" id="${containerId}">
      ${items.map(d=>{
        const on = (String(currentDealer||"").trim().toLowerCase() === String(d||"").trim().toLowerCase());
        return `<button class="areachip${on ? " on" : ""}" type="button" data-dealer="${escapeHtml(d)}">${escapeHtml(d)}</button>`;
      }).join("")}
    </div>
  `;
}


function bindAreaChips(containerId, onPick){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.addEventListener("click", (e)=>{
    const btn = e.target && e.target.closest && e.target.closest("button[data-area]");
    if(!btn) return;
    const a = btn.getAttribute("data-area") || "";
    onPick(String(a));
  });
}