// Shellfish Tracker — V1.5 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

import { toCSV, downloadText, formatMoney, formatDateMDY, computePPL, to2, parseMDYToISO } from "./core/utils.js";

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

const LS_KEY = "shellfish-v1.4.2";
const app = document.getElementById("app");

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) throw 0;
    const p = JSON.parse(raw);
    return {
      trips: Array.isArray(p?.trips) ? p.trips : [],
      view: p?.view || "home",
      filter: p?.filter || "YTD",
      settings: p?.settings || {},
      areas: p?.areas || []
    };
  }catch{
    return { trips: [], view: "home", filter: "YTD", settings: {}, areas: [] };
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

function setFilter(f){
  state.filter = f;
  saveState();
  render();
}

let state = loadState();
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

function renderHome(){
  const tripsAll = Array.isArray(state.trips) ? state.trips : [];
  const trips = getFilteredTrips();
  const totalAmount = trips.reduce((s,t)=> s + (Number(t?.amount)||0), 0);
  const totalLbs = trips.reduce((s,t)=> s + (Number(t?.pounds)||0), 0);

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
      <div class="trip">
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
  }).join("") : `<div class="muted small">No trips in this range yet.</div>`;

  app.innerHTML = `
    <div class="card">
      <div class="row">
        <button class="btn primary" id="newTrip">＋ New Trip</button>
        <button class="btn" id="export">🧾 Export CSV</button>
        <button class="btn" id="settings">⚙️ Settings</button>
      </div>

      <div class="filters">
        ${chip("YTD","YTD")}
        ${chip("Month","Month")}
        ${chip("7D","Last 7 days")}
      </div>

      <div class="hint">Phase 2C-1: Trip list + filters restored (no edit overlay yet).</div>
    </div>

    <div class="card">
      <b>Totals (filtered)</b>
      <div class="pillbar">
        <span class="pill">Trips: <b>${trips.length}</b></span>
        <span class="pill">Lbs: <b>${to2(totalLbs)}</b></span>
        <span class="pill">Total: <b>${formatMoney(totalAmount)}</b></span>
      </div>
    </div>

    <div class="card">
      <b>Trips</b>
      <div class="sep"></div>
      <div class="triplist">${rows}</div>
    </div>
  `;

  // Filters
  app.querySelectorAll("button.chip").forEach(btn=>{
    btn.addEventListener("click", ()=> setFilter(btn.getAttribute("data-f")));
  });

  document.getElementById("export").onclick = () => {
    const csv = toCSV(trips);
    downloadText("shellfish_trips.csv", csv);
  };
  document.getElementById("settings").onclick = () => {
    state.view = "settings";
    saveState();
    render();
  };
  document.getElementById("newTrip").onclick = () => {
    alert("Phase 2C-2 will restore the full New Trip overlay. For now, trip list + filters are restored.");
  };
}

function renderSettings(){
  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;width:100%">
        <b>Settings</b>
        <button class="btn" id="back">← Back</button>
      </div>
      <div class="hint">Phase 2C will restore full settings + areas manager.</div>
    </div>
  `;
  document.getElementById("back").onclick = () => {
    state.view = "home";
    saveState();
    render();
  };
}

function render(){
  if(!state.view) state.view = "home";
  if(state.view === "settings") return renderSettings();
  return renderHome();
}

try{ render(); }catch(err){ setBootError(err?.message || err); throw err; }
