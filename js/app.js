// Shellfish Tracker — V1.5 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

import { toCSV, downloadText, formatMoney, formatDateMDY, computePPL, to2, parseMDYToISO, parseNum, parseMoney, likelyDuplicate, normalizeKey } from "./core/utils.js?v=ESM-004K";

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

function findDuplicateTrip(candidate, excludeId=""){
  const trips = Array.isArray(state.trips) ? state.trips : [];
  for(const t of trips){
    if(excludeId && String(t?.id||"") === String(excludeId)) continue;
    if(likelyDuplicate(t, candidate)) return t;
  }
  return null;
}

let state = loadState();
ensureAreas();
function showFatal(err){
  try{
    const pill = document.getElementById("bootPill");
    if(pill){
      pill.textContent = "ERROR";
      pill.classList.add("err");
      pill.title = String(err && (err.stack || err.message || err) || "Error");
    }
    const app = document.getElementById("app");
    if(app){
      const msg = String(err && (err.stack || err.message || err) || err || "Unknown error");
      const esc = msg.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
      app.innerHTML = `
        <div class="card">
          <b>App Error</b>
          <div class="sep"></div>
          <div class="muted small" style="white-space:pre-wrap">${esc}</div>
          <div class="row" style="margin-top:12px">
            <button class="btn" id="copyErr">Copy</button>
            <button class="btn" id="reload">Reload</button>
          </div>
        </div>
      `;
      const c = document.getElementById("copyErr");
      if(c) c.onclick = ()=> navigator.clipboard?.writeText(msg).catch(()=>{});
      const r = document.getElementById("reload");
      if(r) r.onclick = ()=> location.reload();
    }
  }catch{}
}
window.addEventListener("error", (e)=> showFatal(e?.error || e?.message || e));
window.addEventListener("unhandledrejection", (e)=> showFatal(e?.reason || e));

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
  }).join("") : `<div class="muted small">No trips in this range yet.</div>`;

  app.innerHTML = `
    <div class="card">
      <div class="row">
        <button class="btn primary" id="newTrip">＋ New Trip</button>
        <button class="btn" id="export">🧾 Export CSV</button>
        <button class="btn" id="settings">⚙️ Settings</button>
      </div>

      <div class="hint">Phase 2C-1: Trip list + filters restored (no edit overlay yet).</div>
    </div>

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

    <div class="card">
      <b>Trips</b>
      <div class="sep"></div>
      <div class="triplist">${rows}</div>
    </div>
  `;

  // ensure top of view on iPhone
  app.scrollTop = 0;


  // Open trip to edit
  app.querySelectorAll(".trip[data-id]").forEach(card=>{
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
  app.querySelectorAll("button.chip").forEach(btn=>{
    btn.addEventListener("click", ()=> setFilter(btn.getAttribute("data-f")));
  });

  document.getElementById("export").onclick = () => {
    const tripsFiltered = getFilteredTrips();
    const tripsAll = Array.isArray(state.trips) ? state.trips.slice() : [];

    const choice = prompt(
      "Export options:\n1 = Filtered (" + (state.filter||"YTD") + ")\n2 = All trips\n3 = Date range\n\nEnter 1, 2, or 3:",
      "1"
    );

    if(choice === "2"){
      exportTrips(tripsAll, "ALL");
      return;
    }
    if(choice === "3"){
      const start = prompt("Start date (MM/DD/YYYY):", "");
      const end = prompt("End date (MM/DD/YYYY):", "");
      const startISO = parseMDYToISO(start);
      const endISO = parseMDYToISO(end);
      if(!startISO || !endISO){
        alert("Invalid date range.");
        return;
      }
      const ranged = filterByRange(tripsAll, startISO, endISO);
      exportTrips(ranged, "RANGE", startISO, endISO);
      return;
    }

    exportTrips(tripsFiltered, (state.filter||"YTD"));
  };
  document.getElementById("settings").onclick = () => {
    state.view = "settings";
    saveState();
    render();
  };
  document.getElementById("newTrip").onclick = () => {
    state.view = "new";
    saveState();
    render();
  };
}

function renderNewTrip(){
  // Defaults
  const todayISO = new Date().toISOString().slice(0,10);
  const draft = state.draft || { dateISO: todayISO, dealer:"", pounds:"", amount:"", area:"" };

  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${String(a||"").replaceAll('"',"&quot;")}" ${sel}>${label}</option>`;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>New Trip</b>
        <span class="muted small">Phase 2C-2</span>
      </div>
      <div class="hint">Enter the check info. Date should be harvest date (MM/DD/YYYY).</div>
    </div>

    <div class="card">
      <div class="form">
        <div class="field">
          <div class="label">Harvest date</div>
          <input class="input" id="t_date" inputmode="numeric" placeholder="MM/DD/YYYY" value="${formatDateMDY(draft.dateISO||"")}" />
        </div>

        <div class="field">
          <div class="label">Dealer</div>
          <input class="input" id="t_dealer" placeholder="Machias Bay Seafood" value="${(draft.dealer||"").replaceAll('"',"&quot;")}" />
        </div>

        <div class="field">
          <div class="label">Pounds</div>
          <input class="input" id="t_pounds" inputmode="decimal" placeholder="0.0" value="${String(draft.pounds??"")}" />
        </div>

        <div class="field">
          <div class="label">Amount</div>
          <input class="input" id="t_amount" inputmode="decimal" placeholder="$0.00" value="${String(draft.amount??"")}" />
        </div>

        <div class="field">
          <div class="label">Area</div>
          <select class="select" id="t_area">
            ${areaOptions}
          </select>
        </div>

        <div class="field">
          <div class="label">Quick paste (optional)</div>
          <textarea class="textarea" id="t_paste" placeholder="Paste OCR text here (optional)"></textarea>
          <div class="actions">
            <button class="smallbtn" id="parsePaste">Parse paste</button>
            <span class="muted small">Parses date, pounds, and amount when it can.</span>
          </div>
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

  const saveDraft = ()=>{
    state.draft = {
      dateISO: parseMDYToISO(elDate.value) || draft.dateISO || todayISO,
      dealer: elDealer.value || "",
      pounds: elPounds.value || "",
      amount: elAmount.value || "",
      area: elArea.value || ""
    };
    saveState();
  };

  ["input","change","blur"].forEach(ev=>{
    elDate.addEventListener(ev, saveDraft);
    elDealer.addEventListener(ev, saveDraft);
    elPounds.addEventListener(ev, saveDraft);
    elAmount.addEventListener(ev, saveDraft);
    elArea.addEventListener(ev, saveDraft);
  });

  document.getElementById("parsePaste").onclick = ()=>{
    const txt = String(elPaste.value||"");
    if(!txt.trim()) return;

    // naive date search mm/dd/yy or mm-dd-yy
    const m = txt.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if(m){
      const iso = parseMDYToISO(`${m[1]}/${m[2]}/${m[3]}`);
      if(iso) elDate.value = formatDateMDY(iso);
    }

    // pounds: look for something like 43.5 near "lb" or standalone decimal
    const lbm = txt.match(/(\d{1,3}(?:\.\d{1,2})?)\s*(?:lb|lbs|pounds)/i) || txt.match(/\b(\d{1,3}\.\d{1,2})\b/);
    if(lbm) elPounds.value = String(lbm[1]);

    // amount: $ or plain digits
    const am = txt.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
    if(am) elAmount.value = String(am[1]).replaceAll(",","");
    else{
      // fallback: last long-ish number
      const nums = txt.match(/[\d]{3,7}/g);
      if(nums && nums.length) elAmount.value = String(parseMoney(nums[nums.length-1]));
    }

    saveDraft();
    render(); // re-render to update computed fields if needed later
    state.view = "new"; // keep view
    saveState();
  };

  document.getElementById("cancelTrip").onclick = ()=>{
    state.view = "home";
    saveState();
    render();
  };

  const backBtn = document.getElementById("backHome");
  if(backBtn){ backBtn.onclick = () => document.getElementById("cancelTrip").click(); }


  document.getElementById("clearDraft").onclick = ()=>{
    delete state.draft;
    saveState();
    render();
    state.view = "new";
    saveState();
  };

  document.getElementById("saveTrip").onclick = ()=>{
    const dateISO = parseMDYToISO(elDate.value);
    const dealer = String(elDealer.value||"").trim();
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

    const trip = {
      id: uid(),
      dateISO,
      dealer,
      pounds: to2(pounds),
      amount: to2(amount),
      area: String(elArea.value||"")
    };

    state.trips = Array.isArray(state.trips) ? state.trips : [];
    // Duplicate warning
    const candidate = { dateISO, dealer, pounds: to2(pounds), amount: to2(amount) };
    const dup = findDuplicateTrip(candidate, "");
    if(dup){
      const msg = `This looks like a duplicate trip:\n\nDate: ${formatDateMDY(dup.dateISO)}\nDealer: ${dup.dealer}\nLbs: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave anyway?`;
      if(!confirm(msg)) return;
    }


    state.trips.push(trip);

    // clear draft after save
    delete state.draft;

    state.view = "home";
    saveState();
    render();
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

  const draft = {
    dateISO: t.dateISO || "",
    dealer: t.dealer || "",
    pounds: String(t.pounds ?? ""),
    amount: String(t.amount ?? ""),
    area: t.area || ""
  };

  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${String(a||"").replaceAll('"',"&quot;")}" ${sel}>${label}</option>`;
  }).join("");

  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>Edit Trip</b>
        <span class="muted small">Phase 2C-3</span>
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
          <input class="input" id="e_amount" inputmode="decimal" placeholder="$0.00" value="${String(draft.amount??"")}" />
        </div>

        <div class="field">
          <div class="label">Area</div>
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
  app.scrollTop = 0;

  const elDate = document.getElementById("e_date");
  const elDealer = document.getElementById("e_dealer");
  const elPounds = document.getElementById("e_pounds");
  const elAmount = document.getElementById("e_amount");
  const elArea = document.getElementById("e_area");

  const goHome = ()=>{
    state.view = "home";
    saveState();
    render();
  };

  document.getElementById("backHome").onclick = goHome;
  document.getElementById("cancelEdit").onclick = goHome;

  document.getElementById("saveEdit").onclick = ()=>{
    const dateISO = parseMDYToISO(elDate.value);
    const dealer = String(elDealer.value||"").trim();
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
    // Duplicate warning (excluding this trip)
    const candidate = { dateISO, dealer, pounds: to2(pounds), amount: to2(amount) };
    const dup = findDuplicateTrip(candidate, id);
    if(dup){
      const msg = `This edit matches another trip:\n\nDate: ${formatDateMDY(dup.dateISO)}\nDealer: ${dup.dealer}\nLbs: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave changes anyway?`;
      if(!confirm(msg)) return;
    }



    t.dateISO = dateISO;
    t.dealer = dealer;
    t.pounds = to2(pounds);
    t.amount = to2(amount);
    t.area = String(elArea.value||"");

    saveState();
    goHome();
  };

  document.getElementById("deleteTrip").onclick = ()=>{
    if(!confirm("Delete this trip?")) return;
    state.trips = trips.filter(x => String(x?.id||"") !== id);
    delete state.editId;
    saveState();
    goHome();
  };
}


function renderSettings(){
  ensureAreas();

  const areaRows = state.areas.length ? state.areas.map((a, i)=>`
    <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
      <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${a}</b></div>
      <button class="smallbtn danger" data-del-area="${i}">Delete</button>
    </div>
  `).join("") : `<div class="muted small" style="margin-top:10px">No areas yet. Add one below.</div>`;

  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>Settings</b>
        <span class="muted small">Phase 2C-4/5</span>
      </div>
      <div class="hint">Manage areas used on trips. Duplicate-warning is now enabled on Save.</div>
    </div>

    <div class="card">
      <b>Areas</b>
      <div class="sep"></div>

      <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">
        <input class="input" id="newArea" placeholder="Add area (ex: 19/626)" style="flex:1;min-width:180px" />
        <button class="btn primary" id="addArea">Add</button>
      </div>

      ${areaRows}
    </div>

    <div class="card">
      <b>Data</b>
      <div class="sep"></div>
      <div class="muted small" style="margin-top:10px">Reset clears all trips and settings on this device.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn danger" id="resetData">Reset app data</button>
      </div>
    </div>
  `;

  app.scrollTop = 0;

  const goHome = ()=>{ state.view="home"; saveState(); render(); };
  document.getElementById("backHome").onclick = goHome;

  document.getElementById("addArea").onclick = ()=>{
    const v = String(document.getElementById("newArea").value||"").trim();
    if(!v) return;
    state.areas = Array.isArray(state.areas) ? state.areas : [];
    state.areas.push(v);
    ensureAreas();
    saveState();
    renderSettings();
  };

  app.querySelectorAll("[data-del-area]").forEach(btn=>{
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

  document.getElementById("resetData").onclick = ()=>{
    if(!confirm("This will delete ALL trips and settings on this device. Continue?")) return;
    state = { trips: [], areas: [], filter: "YTD", view: "home" };
    saveState();
    render();
  };
}

function render(){
  if(!state.view) state.view = "home";
  if(state.view === "settings") return renderSettings();
  if(state.view === "new") return renderNewTrip();
  if(state.view === "edit") return renderEditTrip();
  return renderHome();
}

try{ render(); }catch(err){ setBootError(err?.message || err); throw err; }
