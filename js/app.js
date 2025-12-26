// Shellfish Tracker — V1.5 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

import { toCSV, downloadText, formatMoney } from "./core/utils.js";

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

let state = loadState();
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

function renderHome(){
  const trips = Array.isArray(state.trips) ? state.trips : [];
  const totalAmount = trips.reduce((s,t)=> s + (Number(t?.amount)||0), 0);

  app.innerHTML = `
    <div class="card">
      <div class="row">
        <button class="btn primary" id="newTrip">＋ New Trip</button>
        <button class="btn" id="export">🧾 Export CSV</button>
        <button class="btn" id="settings">⚙️ Settings</button>
      </div>
      <div class="hint">This is the polished UI shell. Next step restores the full V1.4.2 screens and overlay in <code>app.js</code>.</div>
    </div>

    <div class="card">
      <b>Totals (quick)</b>
      <div class="pillbar">
        <span class="pill">Trips: <b>${trips.length}</b></span>
        <span class="pill">Total: <b>${formatMoney(totalAmount)}</b></span>
      </div>
    </div>

    <div class="card">
      <b>Next</b>
      <div class="sep"></div>
      <div class="muted small">Proceed to Phase 2C: bring back the full V1.4.2 UI + overlay sheet, now that ESM is stable.</div>
    </div>
  `;

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
    alert("Phase 2C will restore the full New Trip overlay. For now this is UI-shell-only.");
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
