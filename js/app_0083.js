// Shellfish Tracker — V1.5 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

window.__SHELLFISH_APP_STARTED = false;

import { uid, toCSV, downloadText, formatMoney, formatDateMDY, computePPL, parseMDYToISO, parseNum, parseMoney, likelyDuplicate, normalizeKey, escapeHtml } from "./utils_0083.js";

const VERSION = 'ESM-0083-RC1.1';
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

function copyTextToClipboard(txt){
  return navigator.clipboard?.writeText(String(txt||""))
    .then(()=>true).catch(()=>false);
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
const APP_VERSION = VERSION;



function parseOcrText(raw, knownAreas){
  const textRaw = String(raw||"").replace(/\r/g,"\n");
  const text = textRaw.toUpperCase();
  const lines = textRaw.split("\n").map(s=>String(s).trim()).filter(Boolean);
  const linesU = lines.map(l=>l.toUpperCase());

  const out = {
    dateMDY: "",
    pounds: "",
    amount: "",
    dealer: "",
    area: "",
    confidence: { date:"low", pounds:"low", amount:"low", dealer:"low", area:"low" }
  };

  const isMachias = text.includes("MACHIAS BAY SEAFOOD");

  // --- DATE ---
  // Support MM/DD/YYYY, MM-DD-YY, and glued MMDD-YY / MMDDYY.
  const full = text.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2}|19\d{2})\b/);
  if(full){
    out.dateMDY = `${full[1]}/${full[2]}/${full[3]}`;
    out.confidence.date = "high";
  } else {
    const short = text.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2})\b/);
    if(short){
      const yy = parseInt(short[3],10);
      const yyyy = yy <= 79 ? (2000+yy) : (1900+yy);
      out.dateMDY = `${short[1]}/${short[2]}/${yyyy}`;
      out.confidence.date = "med";
    } else {
      const glued = text.match(/\b(0[1-9]|1[0-2])([0-2]\d|3[01])[\/\-]?(\d{2})\b/);
      if(glued){
        const mm = glued[1];
        const dd = glued[2];
        const yy = parseInt(glued[3],10);
        const yyyy = yy <= 79 ? (2000+yy) : (1900+yy);
        out.dateMDY = `${mm}/${dd}/${yyyy}`;
        out.confidence.date = "med";
      }
    }
  }

  // --- DEALER ---
  // Known dealer match (from Settings)
  if(Array.isArray(state.dealers) && state.dealers.length){
    const hay = text;
    let best = "";
    for(const d of state.dealers){
      const du = String(d||"").toUpperCase();
      if(du && hay.includes(du)){
        if(du.length > best.length) best = d;
      }
    }
    if(best){
      out.dealer = best;
      out.confidence.dealer = "high";
    }
  }
  // Prefer first ALLCAPS line ending with INC./LLC/CO., else first line.
  for(const l of linesU.slice(0,8)){
    if(l.includes("SEAFOOD")){
      out.dealer = "Machias BAY Seafood";
      out.confidence.dealer = "high";
      break;
    }
  }
  if(!out.dealer && lines.length){
    out.dealer = lines[0].trim().slice(0,40);
    out.confidence.dealer = "low";
  }

  // --- AMOUNT ---
  // Machias checks: amount must come from CHECK AMOUNT block.
  const parseMoneyFromWindow = (windowText, allowCents)=>{
    // normalize OCR C/O confusion in cents
    const w = windowText.replace(/[oO]/g,"0").replace(/[cC]/g,"0");
    const dec = w.match(/\b(\d{1,6}[.,]\d{2})\b/);
    if(dec){
      const v = parseFloat(dec[1].replace(",","."));
      if(Number.isFinite(v)) return v.toFixed(2);
    }
    const sp = w.match(/\b(\d{1,6})\s+(\d{2})\b/);
    if(sp){
      const v = parseFloat(`${sp[1]}.${sp[2]}`);
      if(Number.isFinite(v)) return v.toFixed(2);
    }
    const c0 = w.match(/\b(\d{1,6})\s*0\s*0\b/);
    if(c0){
      const v = parseFloat(`${c0[1]}.00`);
      if(Number.isFinite(v)) return v.toFixed(2);
    }
    if(allowCents){
      const digs = [...w.matchAll(/\b(\d{4,6})\b/g)].map(m=>m[1]);
      if(digs.length){
        const last = digs[digs.length-1];
        const v = parseInt(last,10)/100;
        if(Number.isFinite(v)) return v.toFixed(2);
      }
    }
    return "";
  };

  const findCheckAmount = ()=>{
    for(let i=0;i<linesU.length;i++){
      const winLines = linesU.slice(i, i+4);
      const winText = winLines.join(" ");
      const hasCheck = winText.includes("CHECK");
      const hasAmount = winText.includes("AMOUNT");
      if(hasCheck && hasAmount){
        // avoid MICR lines with slashes/hyphens unless they also contain CHECK/AMOUNT
        const val = parseMoneyFromWindow(winText, true);
        if(val) return val;
      }
    }
    return "";
  };

  let amt = "";
  if(isMachias){
    amt = findCheckAmount();
    if(amt){
      out.amount = amt;
      out.confidence.amount = "high";
    } else {
      // Do not fallback for Machias; leave blank rather than guess from MICR numbers.
      out.amount = "";
      out.confidence.amount = "low";
    }
  } else {
    // Generic: try CHECK AMOUNT first, then any decimal money-like token excluding MICR/phone/account lines.
    amt = findCheckAmount();
    if(!amt){
      const candidates = [];
      for(const l of linesU){
        if(l.includes("/") || l.includes("TEL") || l.includes("ACCOUNT") || l.includes("ROUTING") || l.includes("PO BOX")) continue;
        const m = l.match(/\b(\d{1,6}[.,]\d{2})\b/);
        if(m){
          const v = parseFloat(m[1].replace(",","."));
          if(Number.isFinite(v) && v>=1) candidates.push(v);
        }
      }
      if(candidates.length){
        const best = Math.max(...candidates);
        amt = best.toFixed(2);
      }
    }
    if(amt){
      out.amount = amt;
      out.confidence.amount = "med";
    }
  }

  // --- POUNDS ---
  // 1) decimal with comma or dot (e.g., 59,5) near DESCRIPTION
  const findPounds = ()=>{
    // explicit lb/lbs markers incl OCR IBS/1BS/|BS
    const marker = textRaw.match(/\b(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|pounds?|i?bs|\|bs|1bs)\b/i);
    if(marker){
      const v = parseFloat(marker[1].replace(",","."));
      if(Number.isFinite(v) && v>0) return {v:String(v), conf:"high"};
    }
    // DESCRIPTION block integer/decimal
    let descIdx = -1;
    for(let i=0;i<linesU.length;i++){
      if(linesU[i].includes("DESCRIPTION")){ descIdx = i; break; }
    }
    if(descIdx>=0){
      const slice = linesU.slice(descIdx, descIdx+12);
      // prefer decimal with one digit
      for(const l of slice){
        const m = l.match(/^\s*(\d{1,3}[.,]\d{1,2})\s*$/);
        if(m){
          const v = parseFloat(m[1].replace(",","."));
          if(Number.isFinite(v) && v>0) return {v:String(v), conf:"high"};
        }
      }
      for(const l of slice){
        const m = l.match(/^\s*(\d{1,3})\s*$/);
        if(m){
          const v = parseInt(m[1],10);
          if(Number.isFinite(v) && v>0 && v<=500) return {v:String(v), conf:"med"};
        }
      }
    }
    // fallback: first plausible number in range
    for(const l of linesU){
      if(l.includes("TEL") || l.includes("ACCOUNT") || l.includes("PO BOX") || l.includes("CHECK")) continue;
      const ms = [...l.matchAll(/\b(\d{1,3}(?:[.,]\d{1,2})?)\b/g)].map(m=>m[1]);
      for(const s of ms){
        const v = parseFloat(s.replace(",","."));
        if(Number.isFinite(v) && v>0 && v<=500) return {v:String(v), conf:"low"};
      }
    }
    return {v:"", conf:"low"};
  };

  const pounds = findPounds();
  if(pounds.v){
    out.pounds = pounds.v;
    out.confidence.pounds = pounds.conf;
  }

  // --- AREA ---
  // Existing behavior: try to match a known area substring in OCR text.
  if(Array.isArray(knownAreas) && knownAreas.length){
    const hay = text;
    let best = "";
    for(const a of knownAreas){
      const au = String(a||"").toUpperCase();
      if(au && hay.includes(au)){
        if(au.length > best.length) best = a;
      }
    }
    if(best){
      out.area = best;
      out.confidence.area = "med";
    }
  }

  return out;
}

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
window.addEventListener("error", e => setBootError(e?.message || e?.error || "Script error"));
window.addEventListener("unhandledrejection", e => setBootError(e?.reason || "Unhandled rejection"));

const LS_KEY = "shellfish-v1.5.0";
// Signal to the page watchdog that the module loaded
try{ window.__SHELLFISH_STARTED = true; }catch{}
function getApp(){ return document.getElementById("app"); }

function loadState(){
  try{
    let raw = localStorage.getItem(LS_KEY);
    // migrate from prior key if needed
    if(!raw){
      raw = localStorage.getItem("shellfish-v1.4.2");
      if(raw){ try{ localStorage.setItem(LS_KEY, raw); }catch{} }
    }
    if(!raw) throw 0;
    const p = JSON.parse(raw);
    return {
      trips: Array.isArray(p?.trips) ? p.trips : [],
      view: p?.view || "home",
      filter: p?.filter || "YTD",
      settings: (p?.settings && typeof p.settings === "object") ? p.settings : {},
      areas: Array.isArray(p?.areas) ? p.areas : [],
      dealers: Array.isArray(p?.dealers) ? p.dealers : []
    };
  }catch{
    return { trips: [], view: "home", filter: "YTD", settings: {}, areas: [], dealers: [] };
  }
}

function getFilteredTrips(){
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
  const csv = toCSV(trips);
  downloadText(filenameFor(label, startISO, endISO), csv);
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


function commitTripFromDraft({ mode, editId="", inputs }){
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
      state.view = "home";
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

  const nextTrips = isEdit
    ? trips.map(t => (String(t?.id||"") === id ? trip : t))
    : trips.concat([trip]);

  state.trips = nextTrips;

  // clear transient state
  if(isEdit){
    delete state.editId;
  } else {
    delete state.draft;
    delete state.reviewDraft;
  }

  state.view = "home";
  saveState();
  render();
  return true;
}


let state = loadState();
ensureAreas();
ensureDealers();
function showFatal(err){
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

function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }


function renderHome(){
  const tripsAll = Array.isArray(state.trips) ? state.trips : [];
  const trips = getFilteredTrips();
  const totalAmount = trips.reduce((s,t)=> s + (Number(t?.amount)||0), 0);
  const totalLbs = trips.reduce((s,t)=> s + (Number(t?.pounds)||0), 0);


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

  const f = state.filter || "YTD";
  const chip = (key,label) => `<button class="chip ${f===key?'on':''}" data-f="${key}">${label}</button>`;

  const rows = trips.length ? trips.map(t=>{
    const date = formatDateMDY(t?.dateISO);
    const dealer = (t?.dealer||"").toString();
    const lbs = to2(Number(t?.pounds)||0);
    const amt = to2(Number(t?.amount)||0);
    const ppl = computePPL(lbs, amt);
    const area = (t?.area||"").toString();
    const safeDealer = dealer ? dealer : "(dealer)";
    return `
      <div class="trip" data-id="${t?.id||""}" role="button" tabindex="0">
        <div class="trip-top">
          <div class="trip-date">${date || ""}</div>
          <div class="trip-dealer">${safeDealer}</div>
        </div>
        <div class="trip-meta">
          <span class="pill">Lbs: <b>${lbs}</b></span>
          <span class="pill">Amt: <b>${formatMoney(amt)}</b></span>
          <span class="pill">PPL: <b>${formatMoney(ppl)}</b></span>
          ${area ? `<span class="pill">Area: <b>${area}</b></span>` : ""}
        </div>
      </div>
    `;
  }).join("") : `<div class="muted small">No trips in this range yet. Tap <b>＋ New Trip</b> to log your first one.</div>`;

  getApp().innerHTML = `
    <div class="card">
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <button class="btn primary" id="newTrip">＋ New Trip</button>
        <button class="btn" id="pasteExp">📋 Paste Receipt <span class="muted small">(Experimental)</span> <span id="expWarn" style="cursor:pointer">⚠️</span></button>
      </div>
      <div id="expTip" class="muted small" style="display:none;margin-top:8px;line-height:1.35;padding:8px 10px;border:1px solid rgba(0,0,0,.08);border-radius:12px">Experimental. Always review Amount, Pounds, and Date before saving.</div>

      <div class="row" style="margin-top:10px">
        <button class="btn" id="reports">📊 Reports</button>
        <button class="btn" id="settings">⚙️ Settings</button>
        <button class="btn" id="help">❓ Help</button>
      </div>

      <div class="hint">Manual entry is recommended. Receipt paste is optional.</div>
    </div>

    ${pwaStorageNoteHTML}

    ${backupReminderHTML}

    <div class="card">
      <div class="row" style="align-items:center;justify-content:space-between">
        <b>Totals (filtered)</b>
        <div class="filters" style="margin-top:0">
          ${chip("YTD","YTD")}
          ${chip("Month","Month")}
          ${chip("7D","Last 7 days")}
        </div>
      </div>
      <div class="pillbar">
        <span class="pill">Trips: <b>${trips.length}</b></span>
        <span class="pill">Lbs: <b>${to2(totalLbs)}</b></span>
        <span class="pill">Total: <b>${formatMoney(totalAmount)}</b></span>
      </div>
    </div>

    <div id="reviewWarnings"></div>

    <div class="card">
      <b>Trips</b>
      <div class="sep"></div>
      <div class="triplist">${rows}</div>
    </div>
  `;

  // ensure top of view on iPhone
  getApp().scrollTop = 0;

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

  // Filters
  getApp().querySelectorAll("button.chip").forEach(btn=>{
    btn.addEventListener("click", ()=> setFilter(btn.getAttribute("data-f")));
  });

    document.getElementById("reports").onclick = ()=>{ state.view="reports"; state.lastAction="nav:reports"; saveState(); render(); };
    
  const tip = document.getElementById("expTip");
  const warn = document.getElementById("expWarn");
  const toggleTip = (on)=>{
    if(!tip) return;
    tip.style.display = on ? "block" : "none";
  };
  if(warn){
    warn.onclick = (e)=>{ e.stopPropagation(); toggleTip(true); };
  }
  // hide tooltip on outside tap
  getApp().addEventListener("click", ()=> toggleTip(false));

  const btnPaste = document.getElementById("pasteExp");
  if(btnPaste){
    btnPaste.onclick = ()=>{
      state.view = "newTrip";
      state.openPasteOnNewTrip = true;
      saveState();
      render();
    };
  }

document.getElementById("help").onclick = ()=>{ state.view="help"; state.lastAction="nav:help"; saveState(); render(); };

  document.getElementById("settings").onclick = () => {
    state.view = "settings";
    state.lastAction="nav:settings";
    saveState();
    render();
  };


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

  document.getElementById("newTrip").onclick = () => {
    state.view = "new";
    state.lastAction="nav:new";
    saveState();
    render();
  };
}

function renderNewTrip(){
  ensureAreas();
  ensureDealers();
  // Defaults
  const todayISO = new Date().toISOString().slice(0,10);
  const draft = state.draft || { dateISO: todayISO, dealer:"", pounds:"", amount:"", area:"" };
  const amountDisp = displayAmount(draft.amount);


  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${String(a||"").replaceAll('"',"&quot;")}" ${sel}>${label}</option>`;
  }).join("");

const dealerOptions = [""].concat(Array.isArray(state.dealers)?state.dealers:[]).map(d=>{
  const label = d ? d : "—";
  const sel = (String(draft.dealer||"").trim().toLowerCase() === String(d||"").trim().toLowerCase()) ? "selected" : "";
  const v = String(d||"").replaceAll('"',"&quot;");
  return `<option value="${v}" ${sel}>${escapeHtml(label)}</option>`;
}).join("");

// Last 3 unique Areas (based on entry order; ignores filters)
const topAreas = (getLastUniqueFromTrips("area", 3));
if(!topAreas.length){
  topAreas.push(...(Array.isArray(state.areas)?state.areas:[]).slice(0,3));
}



// Last 3 unique Dealers (based on entry order; ignores filters)
const topDealers = (getLastUniqueFromTrips("dealer", 3));
if(!topDealers.length){
  topDealers.push(...(Array.isArray(state.dealers)?state.dealers:[]).slice(0,3));
}
;getApp().innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>New Trip</b>
        <span class="muted small">Manual entry</span>
      </div>
      <div class="hint">Enter the check info. Date should be harvest date (MM/DD/YYYY).</div>
    </div>

    <div class="card">
      <div class="form">
        <div class="field">
          <div class="label">Receipt paste (Experimental)</div>

          <div id="entryPrompt" class="muted small" style="display:none; margin-bottom:10px; padding:10px 12px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); border-radius:14px;">
            <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
              <div><b>Clipboard text detected.</b> <span class="muted small">Paste and go to Review?</span></div>
              <div class="row" style="gap:8px;flex-wrap:nowrap">
                <button class="smallbtn" id="entryUse">Paste → Review</button>
                <button class="smallbtn" id="entryDismiss">Dismiss</button>
              </div>
            </div>
          </div>

          <button class="btn primary" id="pasteToReviewPrimary" style="width:100%;">Paste → Review</button>
          <div class="hint">Optional. Paste receipt text, then review before saving.</div>

          <div id="pasteFallbackHint" class="muted small" style="display:none; margin-top:10px;">
            If Paste doesn’t work, tap and hold in the box below and choose Paste, then tap <b>Paste → Review</b>.
          </div>

          <div id="recentPastes" class="row" style="margin-top:10px; display:none; gap:8px;"></div>

          <details id="pasteDetails" style="margin-top:10px;">
            <summary class="muted small" style="cursor:pointer;">Show/edit pasted text (optional)</summary>
            <textarea class="textarea" id="t_paste" placeholder="Tap and hold to Paste receipt text here (optional)" style="min-height:70px;"></textarea>
          </details>
        </div>

        <div class="field">
          <div class="label">Harvest date</div>
          <input class="input" id="t_date" inputmode="numeric" placeholder="MM/DD/YYYY" value="${formatDateMDY(draft.dateISO||"")}" />
        </div>

        <div class="field">
          <div class="label">Dealer</div>
          ${renderTopDealerChips(topDealers, draft.dealer, "topDealers")}<input class="input" id="t_dealer" placeholder="Machias Bay Seafood" value="${(draft.dealer||"").replaceAll('"',"&quot;")}" />
          <div id="t_dealerSugg"></div>
          <div id="t_dealerPrompt"></div>
        </div>

        <div class="field">
          <div class="label">Pounds</div>
          <input class="input" id="t_pounds" inputmode="decimal" placeholder="0.0" value="${String(draft.pounds??"")}" />
        </div>

        <div class="field">
          <div class="label">Amount</div>
          <input class="input" id="t_amount" inputmode="decimal" placeholder="$0.00" value="${escapeHtml(String(amountDisp))}" />
        </div>

        <div class="field">
          <div class="label">Area</div>
          ${renderTopAreaChips(topAreas, draft.area, "topAreas")}
<select class="select" id="t_area">
            ${areaOptions}
          </select>
        </div>

        <div class="actions">
          <button class="btn primary" id="saveTrip">Save Trip</button>
          <button class="btn" id="cancelTrip">Cancel</button>
          <button class="btn danger" id="clearDraft">Clear</button>
        </div>
      </div>
    </div>
  `;

  const elDate = document.getElementById("t_date");
  const elDealer = document.getElementById("t_dealer");
  const elPounds = document.getElementById("t_pounds");
  const elAmount = document.getElementById("t_amount");
  const elArea = document.getElementById("t_area");
  
  const elPaste = document.getElementById("t_paste");

  try{
    if(state.openPasteOnNewTrip){
      const det = document.getElementById("pasteDetails");
      if(det) det.open = true;
      det?.scrollIntoView?.({behavior:"smooth", block:"start"});
      state.openPasteOnNewTrip = false;
      saveState();
    }
  }catch{}

  // Persist draft as the user edits fields (fixes iOS select + prevents resets)
  const persistDraft = ()=>{ try{ saveDraft(); }catch{} };
  [elDate, elDealer, elPounds, elAmount].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", persistDraft);
    el.addEventListener("change", persistDraft);
  });
  if(elArea){
    elArea.addEventListener("input", persistDraft);
    elArea.addEventListener("change", persistDraft);
  }

  
  if(elDealer){
    elDealer.addEventListener("input", ()=>{
      // typing resets prompt; canonicalize on blur instead of mid-typing
      dealerPromptArmed = "";
      updateDealerPrompt();
    });

    elDealer.addEventListener("blur", ()=>{
      const raw = String(elDealer.value||"").trim();
      const canonical = findCanonicalFromList(raw, state.dealers);
      if(canonical){
        // Q10=A: replace typed with saved canonical + sync dropdown
        elDealer.value = canonical;
        dealerPromptArmed = "";
        dealerPromptSuppressed = "";
        updateDealerPrompt();
        saveDraft();
        return;
      }
      if(!raw){
        dealerPromptArmed = "";
        updateDealerPrompt();
        saveDraft();
        return;
      }
      // Q6=A: arm prompt on blur only (if not saved)
      dealerPromptArmed = raw;
      updateDealerPrompt();
      saveDraft();
      renderNewTrip();
    });
  }




function updateDealerSuggestions(){
  const wrap = document.getElementById("t_dealerSugg");
  const el = document.getElementById("t_dealer");
  if(!wrap || !el) return;
  wrap.innerHTML = renderSuggestions(state.dealers, el.value, "data-dealer-sugg");
}
const topAreaWrap = document.getElementById("topAreas");
const topDealerWrap = document.getElementById("topDealers");

const dealerSuggWrap = document.getElementById("t_dealerSugg");
if(dealerSuggWrap && elDealer){
  dealerSuggWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-dealer-sugg]");
    if(!btn) return;
    const d = btn.getAttribute("data-dealer-sugg") || "";
    elDealer.value = d;
    dealerPromptArmed = "";
    dealerPromptSuppressed = "";
    updateDealerPrompt();
    saveDraft();
    updateDealerSuggestions();
  });
}

if(elDealer){
  elDealer.addEventListener("input", ()=>{
    updateDealerSuggestions();
  });
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
  });
}


  // --- Outside-first Live Text intake (copy → paste) ---
  const entryPrompt = document.getElementById("entryPrompt");
  const entryUseBtn = document.getElementById("entryUse");
  const entryDismissBtn = document.getElementById("entryDismiss");
  const btnPastePrimary = document.getElementById("pasteToReviewPrimary");
  const fallbackHint = document.getElementById("pasteFallbackHint");
  const recentWrap = document.getElementById("recentPastes");
  const pasteDetails = document.getElementById("pasteDetails");

  const KEY_ENTRY_DISMISSED = "shellfish_clip_entry_dismissed";
  const KEY_ENTRY_TRIED = "shellfish_clip_entry_tried";
  const KEY_FOCUS_TRIED = "shellfish_clip_focus_tried";
  const KEY_FALLBACK_SHOWN = "shellfish_clip_fallback_shown";
  const KEY_RECENT_PASTES = "shellfish_recent_pastes_v1"; // session-only

  let clipCandidate = "";

  function looksReceiptLike(txt){
    const s = String(txt||"").trim();
    if(s.length < 25) return false;
    if(/https?:\/\//i.test(s)) return false;
    if(/\b(subject|from|sent):/i.test(s) && s.split(/\r?\n/).length < 8) return false;

    const lines = s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(lines.length < 3) return false;

    if(!/[0-9]/.test(s) || !/[A-Za-z]/.test(s)) return false;

    const kw = /\b(amount|total|subtotal|balance|description|check|pay to|machias|seafood)\b|\$|\b(lbs?|pounds?)\b/i;
    return kw.test(s);
  }

  async function readClipboardBestEffort(){
    if(!navigator.clipboard || !navigator.clipboard.readText) return "";
    try{
      const t = await navigator.clipboard.readText();
      return String(t||"").trim();
    }catch{
      return "";
    }
  }

  function showFallbackHintOnce(){
    try{
      if(sessionStorage.getItem(KEY_FALLBACK_SHOWN) === "1") return;
      sessionStorage.setItem(KEY_FALLBACK_SHOWN, "1");
    }catch{}
    if(fallbackHint) fallbackHint.style.display = "block";
    if(pasteDetails) pasteDetails.open = true;
    if(elPaste) elPaste.focus();
  }

  function getRecents(){
    try{
      const raw = sessionStorage.getItem(KEY_RECENT_PASTES);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }

  function setRecents(arr){
    try{ sessionStorage.setItem(KEY_RECENT_PASTES, JSON.stringify(arr||[])); }catch{}
  }

  function addRecent(text){
    const t = String(text||"").trim();
    if(!t) return;
    const cur = getRecents();
    // de-dupe by first 60 chars
    const sig = t.slice(0,60);
    const next = [t, ...cur.filter(x => String(x||"").slice(0,60) !== sig)].slice(0,3);
    setRecents(next);
    renderRecents();
  }

  function renderRecents(){
    if(!recentWrap) return;
    const rec = getRecents();
    if(!rec.length){
      recentWrap.style.display = "none";
      recentWrap.innerHTML = "";
      return;
    }
    recentWrap.style.display = "flex";
    recentWrap.innerHTML = rec.map((_,i)=>`<button class="smallbtn" data-recent="${i}">${i===0 ? "Use last paste" : "Use previous"}</button>`).join("");
    recentWrap.querySelectorAll("button[data-recent]").forEach(btn=>{
      btn.onclick = ()=>{
        const i = Number(btn.getAttribute("data-recent"));
        const txt = getRecents()[i] || "";
        if(txt) applyPastedText(txt);
      };
    });
  }

  function saveDraft(){
    // Persist a lightweight draft so users don't lose progress.
    // Draft may be partial; validation still happens on Review.
    const dateISO = parseMDYToISO(String(elDate?.value||"")) || (state.draft?.dateISO || todayISO);
    state.draft = {
      dateISO: dateISO || todayISO,
      dealer: String(elDealer?.value || ""),
      pounds: String(elPounds?.value || ""),
      amount: String(elAmount?.value || ""),
      area: String(elArea?.value || "")
    };
    saveState();
  }

  function applyPastedText(txt){
    const t = String(txt||"").trim();
    if(!t) return;

    // keep the raw text available for audit/edit
    if(elPaste) elPaste.value = t;
    addRecent(t);

    // Parse into draft fields
    const parsed = parseOcrText(t, state.areas||[]);
    if(parsed.dateMDY) elDate.value = parsed.dateMDY;
    if(parsed.dealer) elDealer.value = parsed.dealer;
    if(parsed.pounds) elPounds.value = parsed.pounds;
    if(parsed.amount) elAmount.value = parsed.amount;
    if(parsed.area) elArea.value = parsed.area;

    saveDraft();

    // Always go to Review (still requires Confirm & Save)
    document.getElementById("saveTrip").click();
  }

  function hideEntryPrompt(markDismissed){
    if(entryPrompt) entryPrompt.style.display = "none";
    clipCandidate = "";
    if(markDismissed){
      try{ sessionStorage.setItem(KEY_ENTRY_DISMISSED, "1"); }catch{}
    }
  }

  async function maybePromptOnEntry(){
    try{
      if(sessionStorage.getItem(KEY_ENTRY_DISMISSED) === "1") return;
      if(sessionStorage.getItem(KEY_ENTRY_TRIED) === "1") return;
      sessionStorage.setItem(KEY_ENTRY_TRIED, "1");
    }catch{}

    const txt = await readClipboardBestEffort();
    if(!looksReceiptLike(txt)) return;

    clipCandidate = txt;
    if(entryPrompt) entryPrompt.style.display = "block";
  }

  async function maybePromptOnFocus(){
    // Focus is a user gesture; some browsers allow clipboard read here (best-effort).
    try{
      if(sessionStorage.getItem(KEY_ENTRY_DISMISSED) === "1") return;
      if(sessionStorage.getItem(KEY_FOCUS_TRIED) === "1") return;
      sessionStorage.setItem(KEY_FOCUS_TRIED, "1");
    }catch{}

    const txt = await readClipboardBestEffort();
    if(!looksReceiptLike(txt)) return;

    clipCandidate = txt;
    if(entryPrompt) entryPrompt.style.display = "block";
  }

  if(entryUseBtn){
    entryUseBtn.onclick = async ()=>{
      const txt = clipCandidate || await readClipboardBestEffort();
      if(txt){
        hideEntryPrompt(false);
        applyPastedText(txt);
      }else{
        showFallbackHintOnce();
      }
    };
  }
  if(entryDismissBtn){
    entryDismissBtn.onclick = ()=> hideEntryPrompt(true);
  }

  if(btnPastePrimary){
    btnPastePrimary.onclick = async ()=>{
      const txt = await readClipboardBestEffort();
      if(txt){
        applyPastedText(txt);
      }else{
        showFallbackHintOnce();
      }
    };
  }

  if(elPaste){
    elPaste.addEventListener("focus", ()=>{ maybePromptOnFocus(); });
  }

  renderRecents();
  maybePromptOnEntry();
const backBtn = document.getElementById("backHome");
  if(backBtn){ backBtn.onclick = ()=>{ state.view="home"; saveState(); render(); }; }


  document.getElementById("clearDraft").onclick = ()=>{
    // Clear only the in-progress draft (does not save a trip)
    state.view = "new";
    state.lastAction = "draft:cleared";
    delete state.reviewDraft;
    const todayISO = new Date().toISOString().slice(0,10);
    state.draft = { dateISO: todayISO, dealer:"", pounds:"", amount:"", area:"" };
    saveState();
    render();
  };

  let dealerPromptArmed = "";
  let dealerPromptSuppressed = "";

  function updateDealerPrompt(){
    const box = document.getElementById("t_dealerPrompt");
    if(!box) return;
    const current = String(document.getElementById("t_dealer")?.value||"").trim();
    const canonical = findCanonicalFromList(current, state.dealers);
    if(!current || canonical){
      box.innerHTML = "";
      return;
    }
    if(!dealerPromptArmed || dealerPromptArmed.toLowerCase() !== current.toLowerCase()){
      box.innerHTML = "";
      return;
    }
    if(dealerPromptSuppressed && dealerPromptSuppressed.toLowerCase() === current.toLowerCase()){
      box.innerHTML = "";
      return;
    }

    box.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">
      <div class="muted small">Save <b>${escapeHtml(current)}</b> to Dealers?</div>
      <button class="smallbtn" id="t_saveDealer">Save</button>
      <button class="smallbtn" id="t_noSaveDealer">Not now</button>
    </div>`;

    document.getElementById("t_saveDealer")?.addEventListener("click", ()=>{
      state.dealers = Array.isArray(state.dealers) ? state.dealers : [];
      state.dealers.push(current);
      ensureDealers();
      saveState();

      const canon = findCanonicalFromList(current, state.dealers) || current;
      const el = document.getElementById("t_dealer");
      if(el) el.value = canon;
      
      dealerPromptArmed = "";
      dealerPromptSuppressed = "";
      box.innerHTML = "";
      saveDraft();
      renderNewTrip();
    });

    document.getElementById("t_noSaveDealer")?.addEventListener("click", ()=>{
      dealerPromptSuppressed = current;
      dealerPromptArmed = "";
      box.innerHTML = "";
    });
  }



  document.getElementById("cancelTrip").onclick = ()=>{
    // Cancel returns home without saving
    state.view = "home";
    state.lastAction = "trip:cancel";
    saveState();
    render();
  };


  document.getElementById("saveTrip").onclick = ()=>{
    // Phase 3A: Build Review first (nothing saves until Confirm)
    const dateISO = parseMDYToISO(elDate.value);
    const dealer = normalizeDealerDisplay(String(elDealer.value||"").trim());
    const pounds = parseNum(elPounds.value);
    const amount = parseMoney(elAmount.value);

    const errs = [];
    if(!dateISO) errs.push("Date");
    if(!dealer) errs.push("Dealer");
    if(!(pounds > 0)) errs.push("Pounds");
    if(!(amount > 0)) errs.push("Amount");
    if(errs.length){
      alert("Missing/invalid: " + errs.join(", "));
      return;
    }

    const candidate = {
      dateISO,
      dealer,
      pounds: to2(pounds),
      amount: to2(amount),
      area: String(elArea.value||""),
      // keep draft fields for review
      raw: String(elPaste.value||"").trim()
    };

    // Store review draft and go to Review screen
    state.reviewDraft = candidate;
    state.view = "review";
    saveState();
    render();
  };
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
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backToNew">← Back</button>
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
          <span class="pill" id="pplPill">Price/Lb: <b>${formatMoney(ppl)}</b></span>
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
    state.view = "new";
    saveState();
    render();
  };
  document.getElementById("backToNew").onclick = goBack;
  document.getElementById("cancelReview").onclick = ()=>{
    if(confirm("Discard this review draft?")){
      delete state.reviewDraft;
      state.view = "new";
      saveState();
      render();
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
      pplPill.innerHTML = `Price/Lb: <b>${formatMoney(v)}</b>`;
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
                Similar trip found: <b>${escapeHtml(formatDateMDY(dup.dateISO||""))}</b> — ${escapeHtml(String(dup.dealer||""))} (${formatMoney(dup.amount||0)} / ${to2(Number(dup.pounds||0))} lbs)
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

  document.getElementById("confirmSave").onclick = ()=>{
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
    state.view = "home";
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
    return `<option value="${String(a||"").replaceAll('"',"&quot;")}" ${sel}>${label}</option>`;
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
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
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
          <input class="input" id="e_dealer" placeholder="Machias Bay Seafood" value="${String(draft.dealer||"").replaceAll('"',"&quot;")}" />
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
          <button class="btn" id="cancelEdit">Cancel</button>
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


  const goHome = ()=>{
    state.view = "home";
    saveState();
    render();
  };

  document.getElementById("backHome").onclick = goHome;
  document.getElementById("cancelEdit").onclick = goHome;

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
    goHome();
  };
}



function renderReports(){
  const trips = getFilteredTrips();
  const f = state.filter || "YTD";
  const mode = state.reportsMode || "tables"; // "charts" | "tables"


  if(!trips.length){

getApp().innerHTML = `
      <div class="card">
        <div class="row">
          <button class="btn" id="home">← Home</button>
          <button class="btn" id="export" disabled>🧾 Export CSV</button>
          <button class="btn" id="settings">⚙️ Settings</button>
          <button class="btn" id="help">❓ Help</button>
        </div>

        <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
          <b>Reports</b>
          <span class="pill">Range: <b>${escapeHtml(f)}</b></span>
        </div>

        <div class="filters" style="margin-top:10px">
          <button class="chip ${f==="YTD"?"on":""}" data-f="YTD">YTD</button>
          <button class="chip ${f==="Month"?"on":""}" data-f="Month">Month</button>
          <button class="chip ${f==="7D"?"on":""}" data-f="7D">Last 7 days</button>
        </div>

        <div class="hint">Save at least one trip to see totals, tables, charts, and export.</div>
      </div>
    `;
    getApp().scrollTop = 0;
    document.getElementById("home").onclick = ()=>{ state.view="home"; state.lastAction="nav:home"; saveState(); render(); };
    document.getElementById("settings").onclick = ()=>{ state.view="settings"; state.lastAction="nav:settings"; saveState(); render(); };
    document.getElementById("help").onclick = ()=>{ state.view="help"; state.lastAction="nav:help"; saveState(); render(); };
    getApp().querySelectorAll(".chip[data-f]").forEach(btn=>{
      btn.onclick = ()=>{
        state.filter = btn.getAttribute("data-f");
        saveState();
        renderReports();
      };
    });
    return;
  }


  const chip = (key,label) => `<button class="chip ${f===key?'on':''}" data-f="${key}">${label}</button>`;
  const seg = (key,label) => `<button class="chip ${mode===key?'on':''}" data-m="${key}">${label}</button>`;

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
  }).sort((a,b)=> b.amt - a.amt || b.lbs - a.lbs);

  const areaRows = Array.from(byArea.values()).map(x=>{
    const avg = x.lbs>0 ? x.amt/x.lbs : 0;
    return { ...x, avg };
  }).sort((a,b)=> b.amt - a.amt || b.lbs - a.lbs);

  const monthRows = Array.from(byMonth.entries()).map(([m,x])=>{
    const avg = x.lbs>0 ? x.amt/x.lbs : 0;
    return { month:m, ...x, avg };
  });
  const safe = trips.map(t=>{
    const lbs = Number(t?.pounds)||0;
    const amt = Number(t?.amount)||0;
    const pplRaw = (lbs>0 && amt>0) ? (amt / lbs) : 0;
    return {
      id: t?.id||"",
      dateISO: t?.dateISO||"",
      date: formatDateMDY(t?.dateISO),
      dealer: normalizeDealerDisplay(t?.dealer||"") || "(Unspecified)",
      area: ((t?.area||"").toString().trim()) || "(Unspecified)",
      lbs,
      amt,
      pplRaw,
      ppl: to2(pplRaw)
    };
  });

  const pickExtreme = (rows, valueFn, dir)=>{
    let best = null;
    let bestVal = null;
    for(const r of rows){
      const v = Number(valueFn(r));
      if(!Number.isFinite(v)) continue;
      if(best === null){
        best = r; bestVal = v; continue;
      }
      if(dir > 0 ? (v > bestVal) : (v < bestVal)){
        best = r; bestVal = v;
      }
    }
    return best;
  };

  const maxLbs = pickExtreme(safe.filter(x=>x.lbs>0), x=>x.lbs, +1);
  const minLbs = pickExtreme(safe.filter(x=>x.lbs>0), x=>x.lbs, -1);

  const maxAmt = pickExtreme(safe.filter(x=>x.amt>0), x=>x.amt, +1);
  const minAmt = pickExtreme(safe.filter(x=>x.amt>0), x=>x.amt, -1);
  const pplRows = safe.filter(x=>Number.isFinite(x.pplRaw) && x.pplRaw>0);
  const maxPpl = pickExtreme(pplRows, x=>x.pplRaw, +1);
  const minPpl = pickExtreme(pplRows, x=>x.pplRaw, -1);

  const renderAggList = (rows, emptyMsg) => {
    if(!rows.length) return `<div class="muted small">${emptyMsg}</div>`;
    return rows.map(r=>`
      <div class="row" style="justify-content:space-between;gap:12px;align-items:flex-start">
        <div>
          <b>${escapeHtml(r.name)}</b>
          <div class="muted small">Trips: ${r.trips}</div>
        </div>
        <div class="muted small" style="text-align:right">
          <div>Lbs: <b>${to2(r.lbs)}</b></div>
          <div>Total: <b>${formatMoney(to2(r.amt))}</b></div>
          <div>Avg $/lb: <b>${formatMoney(to2(r.avg))}</b></div>
        </div>
      </div>
      <div class="sep"></div>
    `).join("").replace(/<div class="sep"><\/div>\s*$/,"");
  };

  const renderMonthList = () => {
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return monthRows.map(r=>`
      <div class="row" style="justify-content:space-between;gap:12px">
        <div><b>${names[r.month-1]}</b><div class="muted small">Trips: ${r.trips}</div></div>
        <div class="muted small" style="text-align:right">
          <div>Lbs: <b>${to2(r.lbs)}</b></div>
          <div>Total: <b>${formatMoney(to2(r.amt))}</b></div>
          <div>Avg $/lb: <b>${formatMoney(to2(r.avg))}</b></div>
        </div>
      </div>
      <div class="sep"></div>
    `).join("").replace(/<div class="sep"><\/div>\s*$/,"");
  };

  const renderChartsSection = ()=>{
    return `
      <div class="card">
        <b>Charts</b>
        <div class="hint">Read-only. Uses the same range filter.</div>
        <div class="sep"></div>

        <div class="hlHeader">Avg $/lb by Month</div>
        <canvas id="c_ppl" class="chart" height="180"></canvas>

        <div class="sep"></div>
        <div class="hlHeader">Total $ by Dealer (Top 8)</div>
        <canvas id="c_dealer" class="chart" height="220"></canvas>

        <div class="sep"></div>
        <div class="hlHeader">Total Lbs by Month</div>
        <canvas id="c_lbs" class="chart" height="200"></canvas>
      </div>
    `;
  };


  const renderExtremeRow = (row, headlineLabel, headlineValue, opts = {})=>{
    if(!row) return `<div class="muted small">No matching trips found.</div>`;
    const hide = Array.isArray(opts.hide) ? opts.hide : [];
    const hasPrice = Number.isFinite(row.pplRaw) && row.pplRaw>0;

    const showLbs = !hide.includes("lbs");
    const showAmt = !hide.includes("amt");
    const showPpl = !hide.includes("ppl");

    const parts = [
      {key:"lbs", label:"Lbs", show: showLbs, value: to2(row.lbs)},
      {key:"amt", label:"Amount", show: showAmt, value: formatMoney(to2(row.amt))},
      {key:"ppl", label:"$ / lb", show: showPpl, value: hasPrice ? formatMoney(to2(row.pplRaw)) : "—"},
    ].filter(p=>p.show);

    return `
      <div class="hlRow">
        <div class="hlTop">
          <div class="hlDate">${escapeHtml(row.date || "")}</div>
          <div class="hlSub">${escapeHtml(row.dealer)} • ${escapeHtml(row.area)}</div>
        </div>

        <div class="hlStats">
          <div class="hlHeadline">
            <span class="hlLabel">${escapeHtml(headlineLabel)}</span>
            <span class="hlValue">${escapeHtml(String(headlineValue))}</span>
          </div>
          ${parts.map(p=>`
            <div class="hlLine">
              <span class="hlLabel">${escapeHtml(p.label)}</span>
              <span class="hlValue">${escapeHtml(String(p.value))}</span>
            </div>
          `).join("")}
        </div>
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

        <div class="hlHeader">Highest lbs</div>
        ${renderExtremeRow(maxLbs, "Lbs", to2(maxLbs?.lbs||0), {hide:["lbs"]})}
        <div class="sep"></div>
        <div class="hlHeader">Lowest lbs</div>
        ${renderExtremeRow(minLbs, "Lbs", to2(minLbs?.lbs||0), {hide:["lbs"]})}

        <div class="sep"></div>
        <div class="hlHeader">Highest $ amount</div>
        ${renderExtremeRow(maxAmt, "Amount", formatMoney(to2(maxAmt?.amt||0)), {hide:["amt"]})}
        <div class="sep"></div>
        <div class="hlHeader">Lowest $ amount</div>
        ${renderExtremeRow(minAmt, "Amount", formatMoney(to2(minAmt?.amt||0)), {hide:["amt"]})}

        <div class="sep"></div>
                ${pplRows.length ? `
          <div class="hlHeader">Highest $/lb</div>
          ${renderExtremeRow(maxPpl, "$ / lb", formatMoney(to2(maxPpl?.pplRaw||0)), {hide:["ppl"]})}
          <div class="sep"></div>
          <div class="hlHeader">Lowest $/lb</div>
          ${renderExtremeRow(minPpl, "$ / lb", formatMoney(to2(minPpl?.pplRaw||0)), {hide:["ppl"]})}
        ` : `<div class="muted small">No trips with valid pounds + amount in this range.</div>`}
      </div>
    `;
  };

  getApp().innerHTML = `
    <div class="card">
      <div class="row">
        <button class="btn" id="home">← Home</button>
        <button class="btn" id="export">🧾 Export CSV</button>
        <button class="btn" id="settings">⚙️ Settings</button>
        <button class="btn" id="help">❓ Help</button>
      </div>

      <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
        <b>Reports</b>
        <span class="pill">Range: <b>${escapeHtml(f)}</b></span>
      </div>

      <div class="filters" style="margin-top:10px">
        ${chip("YTD","YTD")}
        ${chip("Month","Month")}
        ${chip("7D","Last 7 days")}
      </div>

      <div class="filters" style="margin-top:10px">
        ${seg("charts","Charts")}
        ${seg("tables","Tables")}
      </div>

      <div class="hint">Reporting v2. Read-only.</div>
    </div>

    ${mode === "charts" ? renderChartsSection() : renderTablesSection()}
  `;

  getApp().scrollTop = 0;

  // nav
  document.getElementById("home").onclick = ()=>{ state.view="home"; saveState(); render(); };
  document.getElementById("export").onclick = () => {
    const tripsAll = Array.isArray(state.trips) ? state.trips.slice() : [];
    const tripsFiltered = getFilteredTrips();

    const choice = prompt(
      "Export options:\n1 = Filtered (" + (state.filter||"YTD") + ")\n2 = All trips\n3 = Date range\n\nEnter 1, 2, or 3:",
      "1"
    );

    if(choice === "2"){ exportTrips(tripsAll, "ALL"); showToast("CSV exported"); return; }
    if(choice === "3"){
      const start = prompt("Start date (MM/DD/YYYY):", "");
      const end = prompt("End date (MM/DD/YYYY):", "");
      const startISO = parseMDYToISO(start);
      const endISO = parseMDYToISO(end);
      if(!startISO || !endISO){ alert("Invalid date range."); return; }
      const ranged = filterByRange(tripsAll, startISO, endISO);
      exportTrips(ranged, "RANGE", startISO, endISO);
      showToast("CSV exported");
      return;
    }

    exportTrips(tripsFiltered, (state.filter||"YTD"));
    showToast("CSV exported");
  };
  document.getElementById("settings").onclick = ()=>{ state.view="settings"; state.lastAction="nav:settings"; saveState(); render(); };
  const h = document.getElementById("help");
  if(h) h.onclick = ()=>{ state.view="help"; state.lastAction="nav:help"; saveState(); render(); };

  // range chips
  getApp().querySelectorAll(".chip[data-f]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.getAttribute("data-f");
      state.filter = key;
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
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>Settings</b>
        <span class="muted small"></span>
      </div>
      <div class="hint">Lists, backups, and help.</div>
    </div>

    <div class="card">
      <b>Lists</b>
      <div class="sep"></div>

      <div style="margin-top:10px">
        <div class="muted small"><b>Areas</b></div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
          <input class="input" id="newArea" placeholder="Add area (ex: 19/626)" style="flex:1;min-width:180px" />
          <button class="btn primary" id="addArea">Add</button>
        </div>
        ${areaRows}
      </div>

      <div style="margin-top:18px">
        <div class="muted small"><b>Dealers</b></div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
          <input class="input" id="newDealer" placeholder="Add dealer (ex: Machias Bay Seafood)" style="flex:1;min-width:180px" />
          <button class="btn primary" id="addDealer">Add</button>
        </div>
        ${dealerRows}
      </div>
    </div>

    <div class="card">
      <b>Data</b>
      <div class="sep"></div>
      <div class="muted small" style="margin-top:10px">Create a backup file you can store in Files/Drive. Restore brings it back later.</div>
      <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
        <button class="btn" id="downloadBackup">💾 Create Backup</button>
        <button class="btn" id="restoreBackup">📥 Restore Backup</button>
        <input id="backupFile" type="file" accept="application/json,.json,text/plain,.txt" style="display:none" />
      </div>
    </div>

    <div class="card">
      <b>Help</b>
      <div class="sep"></div>
      <div class="muted small" style="margin-top:10px">Short instructions for manual entry, receipt paste, backups, and install.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="openHelp">Open Help</button>
      </div>
    </div>

    <div class="card">
      <b>About</b>
      <div class="sep"></div>
      <div class="muted small" style="margin-top:10px">Version: <b>${VERSION}</b></div>
      <div id="buildBadge" class="muted small" style="margin-top:8px"></div>
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

  const goHome = ()=>{ state.view="home"; saveState(); render(); };
  document.getElementById("backHome").onclick = goHome;

  document.getElementById("openHelp").onclick = ()=>{ state.view="help"; saveState(); render(); };

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

  document.getElementById("addArea").onclick = ()=>{
    const v = String(document.getElementById("newArea").value||"").trim();
    if(!v) return;
    state.areas = Array.isArray(state.areas) ? state.areas : [];
    state.areas.push(v);
    ensureAreas();
    saveState();
    renderSettings();
  };

  document.getElementById("addDealer").onclick = ()=>{
    const v = String(document.getElementById("newDealer").value||"").trim();
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


function renderHelp(){
  getApp().innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>Help</b>
        <span class="muted small"></span>
      </div>
      <div class="hint">Quick help for entering trips and installing the app.</div>
    </div>

    <div class="card">
      <b>Manual Entry (Recommended)</b>
      <div class="sep"></div>
      <ol class="muted small" style="margin:8px 0 0 18px;line-height:1.5">
        <li>Pick <b>Dealer</b> (chips or type).</li>
        <li>Pick <b>Area</b> (chips or dropdown).</li>
        <li>Enter <b>Pounds + Amount + Date</b>, then <b>Save</b>.</li>
      </ol>
    </div>

    <div class="card">
      <b>Receipt Paste (Experimental)</b>
      <div class="sep"></div>
      <ol class="muted small" style="margin:8px 0 0 18px;line-height:1.5">
        <li>iPhone: Photo → Live Text → Copy.</li>
        <li><b>Paste</b> into the app.</li>
        <li><b>Review</b> the fields.</li>
        <li><b>Save</b>.</li>
      </ol>
      <div class="hint">Tip: iOS may show a small <b>Paste</b> bubble for privacy. Tap it once to allow paste.</div>
    </div>

    <div class="card">
      <b>Backup & Restore</b>
      <div class="sep"></div>
      <ol class="muted small" style="margin:8px 0 0 18px;line-height:1.5">
        <li>Backup often.</li>
        <li>Restore if you reinstall.</li>
        <li><b>Trips + Areas + Dealers</b> included.</li>
      </ol>
    </div>

    <div class="card">
      <b>Install the App (iPhone & Android)</b>
      <div class="sep"></div>
      <div class="muted small"><b>iPhone/iPad:</b> Share → <b>Add to Home Screen</b>. Launch from the icon for the best app-like feel.</div>
      <div class="muted small" style="margin-top:8px"><b>Android:</b> Menu → <b>Install app</b> (or Add to Home screen).</div>
      <div class="muted small" style="margin-top:8px;line-height:1.45"><b>Data note:</b> Trips saved in Safari may not appear in the installed Home Screen app (and vice-versa) because they can use separate on-device storage. Use <b>Create Backup</b> in the one that has your trips, then <b>Restore Backup</b> in the other to move them.</div>
    </div>
  `;
  getApp().scrollTop = 0;

  document.getElementById("backHome").onclick = ()=>{ state.view="home"; state.lastAction="nav:home"; saveState(); render(); };
}

function renderAbout(){
  getApp().innerHTML = `
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
  if(state.view === "settings") return renderSettings();
  if(state.view === "new") return renderNewTrip();
  if(state.view === "review") return renderReviewTrip();
  if(state.view === "edit") return renderEditTrip();
  if(state.view === "reports") return renderReports();
  if(state.view === "help") return renderHelp();
  if(state.view === "about") return renderAbout();
  return renderHome();
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
  if(!topAreas || !topAreas.length) return "";
  return `
    <div class="muted small" style="margin-top:6px;margin-bottom:6px"><b>Top areas</b> <span class="muted small">(quick pick)</span></div>
    <div class="areachips" id="${containerId}">
      ${topAreas.map(a=>{
        const on = (String(currentArea||"").trim() === String(a||"").trim());
        return `<button class="areachip${on ? " on" : ""}" type="button" data-area="${escapeHtml(a)}">${escapeHtml(a)}</button>`;
      }).join("")}
    </div>
  `;
}

function renderTopDealerChips(topDealers, currentDealer, containerId){
  if(!topDealers || !topDealers.length) return "";
  return `
    <div class="muted small" style="margin-top:6px;margin-bottom:4px"><b>Top dealers</b> <span class="muted small">(quick pick)</span></div>
    <div class="areachips" id="${containerId}">
      ${topDealers.map(d=>{
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
