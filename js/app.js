// Shellfish Tracker — V1.5 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

import { uid, toCSV, downloadText, formatMoney, formatDateMDY, computePPL, to2, parseMDYToISO, parseNum, parseMoney, likelyDuplicate, normalizeKey, escapeHtml } from "./utils.js?v=ESM-007F";

const VERSION = "ESM-007F";
// ---- Toasts ----
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
  return [
    `Shellfish Tracker ${VERSION}` ,
    `UserAgent: ${navigator.userAgent}` ,
    `Trips: ${trips}` ,
    `Areas: ${areas}` ,
    last ? `LastAction: ${last}` : "" ,
    `Time: ${new Date().toISOString()}`
  ].filter(Boolean).join("\n");
}


const APP_VERSION = VERSION;



function parseOcrText(raw, knownAreas){
  const text = String(raw||"").replace(/\r/g,"\n");
  const lines = text.split("\n").map(s=>s.trim()).filter(Boolean);

  const out = {
    dateMDY: "",
    pounds: "",
    amount: "",
    dealer: "",
    area: "",
    confidence: { date:"low", pounds:"low", amount:"low", dealer:"low", area:"low" }
  };

  // DATE: prefer MM/DD/YYYY
  const dateFull = text.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2}|19\d{2})\b/);
  const dateShort = text.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2})\b/);
  if(dateFull){
    out.dateMDY = `${dateFull[1]}/${dateFull[2]}/${dateFull[3]}`;
    out.confidence.date = "high";
  }else if(dateShort){
    const yy = parseInt(dateShort[3],10);
    const yyyy = yy <= 79 ? (2000+yy) : (1900+yy);
    out.dateMDY = `${dateShort[1]}/${dateShort[2]}/${yyyy}`;
    out.confidence.date = "med";
  }

  // AMOUNT (Outside-first Live Text mode)
  // Rule: checks always include a decimal amount. Prefer the decimal nearest "CHECK AMOUNT"/"AMOUNT",
  // otherwise use the largest plausible decimal in the text. Never infer cents from digits-only values.
  let amt = "";
  let amtConf = "low";

  const decimals = [...text.matchAll(/\b(\d{1,6}\.\d{2})\b/g)]
    .map(m=>m[1])
    .filter(s=>{
      const v = parseFloat(s);
      return Number.isFinite(v) && v >= 1 && v <= 500000;
    });

  // 1) Strongest signal: a decimal amount appearing shortly after an AMOUNT label (across newlines)
  if(decimals.length){
    const kw = text.match(/\b(?:check\s*)?amount\b[\s\S]{0,120}?(\d{1,6}\.\d{2})\b/i);
    if(kw){
      amt = kw[1];
      amtConf = "high";
    }
  }

  // 2) $ + decimal anywhere
  if(!amt){
    const usd = [...text.matchAll(/\$\s*(\d{1,6}(?:,\d{3})*\.\d{2})\b/g)]
      .map(m=>m[1].replace(/,/g,""));
    if(usd.length){
      amt = usd[0];
      amtConf = "high";
    }
  }

  // 3) Fallback: choose the largest plausible decimal
  if(!amt && decimals.length){
    let maxv = -1, maxs = "";
    for(const s of decimals){
      const v = parseFloat(s);
      if(Number.isFinite(v) && v > maxv){
        maxv = v; maxs = s;
      }
    }
    if(maxs){
      amt = maxs;
      amtConf = "med";
    }
  }

  if(amt){
    out.amount = amt;
    out.confidence.amount = amtConf;
  }

// POUNDS
  // Prefer explicit lbs markers; then use DESCRIPTION box (common on checks); fallback heuristic
  const lbs1 = text.match(/\b(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/i);
  if(lbs1){
    out.pounds = lbs1[1];
    out.confidence.pounds = "high";
  }else{
    // Many Machias Bay Seafood checks put lbs under "DESCRIPTION"
    let descLbs = "";
    const descNear = text.match(/\bdescription\b[\s:]*\n?\s*(\d{1,3}(?:\.\d+)?)\b/i);
    if(descNear) descLbs = descNear[1];

    if(!descLbs){
      for(let i=0;i<lines.length;i++){
        if(/^description$/i.test(lines[i])){
          const next = lines[i+1] || "";
          const mm = next.match(/\b(\d{1,3}(?:\.\d+)?)\b/);
          if(mm){ descLbs = mm[1]; break; }
        }
      }
    }

    if(descLbs){
      out.pounds = descLbs;
      out.confidence.pounds = "med";
    }else{
      // Avoid phone/ids (TEL, routing/account). Choose most frequent plausible number (<=300).
      const candidates = [];
      for(const line of lines){
        const l = line.toLowerCase();
        if(l.includes("tel") || l.includes("phone") || l.includes("routing") || l.includes("account") || l.includes("po box")) continue;
        const ms = [...line.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map(m=>m[1]);
        for(const s of ms){
          const v = parseFloat(s);
          if(!(v>0)) continue;
          if(out.amount && Math.abs(v-parseFloat(out.amount))<0.001) continue;
          if(v>=1 && v<=300) candidates.push(v);
        }
      }
      if(candidates.length){
        const freq = {};
        candidates.forEach(v=>{ const k=String(v); freq[k]=(freq[k]||0)+1; });
        let bestV = candidates[0], bestCount = 0;
        Object.keys(freq).forEach(k=>{
          const v=parseFloat(k), c=freq[k];
          if(c>bestCount || (c===bestCount && v>bestV)){
            bestV=v; bestCount=c;
          }
        });
        out.pounds = String(bestV);
        out.confidence.pounds = "low";
      }
    }
  }

  // AREA
  const areas = Array.isArray(knownAreas) ? knownAreas.filter(Boolean) : [];
  if(areas.length){
    const lower = text.toLowerCase();
    for(const a of areas){
      const al = String(a).toLowerCase();
      if(al && lower.includes(al)){
        out.area = a;
        out.confidence.area = "high";
        break;
      }
    }
  }

  // DEALER
  const noise = ["date","harvest","amount","total","subtotal","balance","lbs","lb","pounds","check","pay to","memo","account","routing","bank","deposit"];
  for(const line of lines){
    const l = line.toLowerCase();
    if(l.length<3) continue;
    if(!/[a-zA-Z]/.test(line)) continue;
    if(noise.some(n=>l.includes(n))) continue;
    const letters=(line.match(/[A-Za-z]/g)||[]).length;
    if(letters<4) continue;
    out.dealer=line;
    out.confidence.dealer="med";
    break;
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
const app = document.getElementById("app");

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

function exportBackup(){
  const payload = {
    app: "Shellfish Tracker",
    schema: 1,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      trips: Array.isArray(state.trips) ? state.trips : [],
      areas: Array.isArray(state.areas) ? state.areas : []
    }
  };
  const y = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  const fname = `shellfish_backup_${y.getFullYear()}-${pad(y.getMonth()+1)}-${pad(y.getDate())}_${pad(y.getHours())}${pad(y.getMinutes())}.json`;
  downloadText(fname, JSON.stringify(payload, null, 2));
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
        const json = JSON.parse(txt);
        const tripsIn = Array.isArray(json?.data?.trips) ? json.data.trips : (Array.isArray(json?.trips) ? json.trips : []);
        const areasIn = Array.isArray(json?.data?.areas) ? json.data.areas : (Array.isArray(json?.areas) ? json.areas : []);

        const importedTrips = tripsIn.map(normalizeTripForImport).filter(t=>t.dateISO || t.dealer || t.amount || t.pounds);
        const importedAreas = areasIn.map(a=>String(a||"").trim()).filter(Boolean);

        // Decide merge vs replace
        const replace = confirm("Restore backup?\n\nOK = Replace all current trips on this device\nCancel = Merge (skip likely duplicates)");

        const nextTrips = replace ? [] : (Array.isArray(state.trips) ? [...state.trips] : []);
        const seen = new Set(nextTrips.map(t=> normalizeKey(`${t?.dateISO||""}|${t?.dealer||""}|${t?.area||""}|${to2(Number(t?.pounds)||0)}|${to2(Number(t?.amount)||0)}`)));

        for(const t of importedTrips){
          const key = normalizeKey(`${t.dateISO}|${t.dealer}|${t.area}|${to2(t.pounds)}|${to2(t.amount)}`);
          if(!replace){
            // Keep existing likelyDuplicate rules too
            if(seen.has(key)) continue;
            const dup = nextTrips.some(x=> likelyDuplicate(x, t));
            if(dup) continue;
          }
          // Ensure unique id
          if(nextTrips.some(x=>x.id === t.id)) t.id = uid("t");
          nextTrips.push(t);
          seen.add(key);
        }

        const nextAreas = Array.isArray(state.areas) ? [...state.areas] : [];
        for(const a of importedAreas){
          if(!nextAreas.includes(a)) nextAreas.push(a);
        }

        state.trips = nextTrips;
        state.areas = nextAreas;
        saveState();
        resolve({ tripsAdded: importedTrips.length, mode: replace ? "replace" : "merge" });
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


function openEditTrip(id){
  state.editId = id;
  state.view = "edit";
  saveState();
  render();
}
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
  }).join("") : `<div class="muted small">No trips in this range yet. Tap <b>＋ New Trip</b> to log your first one.</div>`;

  app.innerHTML = `
    <div class="card">
      <div class="row">
        <button class="btn primary" id="newTrip">＋ New Trip</button>
        <button class="btn" id="reports">📊 Reports</button>
        <button class="btn" id="settings">⚙️ Settings</button>
        <button class="btn" id="help">❓ Help</button>
      </div>

      <div class="hint">Log a trip using Live Text copy/paste. Review → Confirm saves it.</div>
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

    document.getElementById("reports").onclick = ()=>{ state.view="reports"; state.lastAction="nav:reports"; saveState(); render(); };
    document.getElementById("help").onclick = ()=>{ state.view="help"; state.lastAction="nav:help"; saveState(); render(); };

  document.getElementById("settings").onclick = () => {
    state.view = "settings";
    state.lastAction="nav:settings";
    saveState();
    render();
  };
  document.getElementById("newTrip").onclick = () => {
    state.view = "new";
    state.lastAction="nav:new";
    saveState();
    render();
  };
}

function renderNewTrip(){
  // Defaults
  const todayISO = new Date().toISOString().slice(0,10);
  const draft = state.draft || { dateISO: todayISO, dealer:"", pounds:"", amount:"", area:"" };
  const amountDisp = displayAmount(draft.amount);


  const areaOptions = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(draft.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${String(a||"").replaceAll('"',"&quot;")}" ${sel}>${label}</option>`;
  }).join("");

// Top 3 most-used Areas (from saved trips) for quick selection
const topAreas = (()=>{
  const counts = new Map();
  for(const t of (Array.isArray(state.trips)?state.trips:[])){
    const a = String(t.area||"").trim();
    if(!a) continue;
    counts.set(a, (counts.get(a)||0) + 1);
  }
  return Array.from(counts.entries())
    .sort((x,y)=> (y[1]-x[1]) || x[0].localeCompare(y[0]))
    .slice(0,3)
    .map(([a])=>a);
})();


  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>New Trip</b>
        <span class="muted small">Live Text (Copy/Paste)</span>
      </div>
      <div class="hint">Enter the check info. Date should be harvest date (MM/DD/YYYY).</div>
    </div>

    <div class="card">
      <div class="form">
        <div class="field">
          <div class="label">Receipt text (copy → paste)</div>

          <button class="btn primary" id="pasteToReviewPrimary" style="width:100%;">Paste → Review</button>
          <div class="hint">After copying receipt text with Live Text, tap <b>Paste → Review</b>.</div>

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
          <input class="input" id="t_dealer" placeholder="Machias Bay Seafood" value="${(draft.dealer||"").replaceAll('"',"&quot;")}" />
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


const topAreaWrap = document.getElementById("topAreas");
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


  // --- Outside-first Live Text intake (copy → paste) ---
  const btnPastePrimary = document.getElementById("pasteToReviewPrimary");
  const fallbackHint = document.getElementById("pasteFallbackHint");
  const recentWrap = document.getElementById("recentPastes");
  const pasteDetails = document.getElementById("pasteDetails");
  const KEY_FALLBACK_SHOWN = "shellfish_clip_fallback_shown";
  const KEY_RECENT_PASTES = "shellfish_recent_pastes_v1"; // session-only

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

  renderRecents();

const backBtn = document.getElementById("backHome");
  if(backBtn){ backBtn.onclick = ()=>{ state.view="home"; saveState(); render(); }; }


  document.getElementById("clearDraft").onclick = ()=>{
    delete state.draft;
    saveState();
    render();
    state.view = "new";
    saveState();
  };

  document.getElementById("cancelTrip").onclick = ()=>{
    state.view = "home";
    state.lastAction="trip:saved";
    saveState();
    render();
    showToast("Trip saved");
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

  const topAreasR = (()=>{
    const counts = new Map();
    for(const t of (Array.isArray(state.trips)?state.trips:[])){
      const a = String(t.area||"").trim();
      if(!a) continue;
      counts.set(a, (counts.get(a)||0) + 1);
    }
    return Array.from(counts.entries())
      .sort((x,y)=> (y[1]-x[1]) || x[0].localeCompare(y[0]))
      .slice(0,3)
      .map(([a])=>a);
  })();

  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backToNew">← Back</button>
        <b>Review & Confirm</b>
        <span class="muted small"></span>
      </div>
      <div class="hint">Nothing saves until you press <b>Confirm & Save</b>. Edit any field if needed.</div>
    </div>

    <div class="card">
      <div class="form">
        <div class="field">
          <div class="label">Harvest date</div>
          <input class="input" id="r_date" inputmode="numeric" placeholder="MM/DD/YYYY" value="${formatDateMDY(d.dateISO||"")}" />
        </div>

        <div class="field">
          <div class="label">Dealer</div>
          <input class="input" id="r_dealer" placeholder="Machias Bay Seafood" value="${escapeHtml(String(d.dealer||""))}" />
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
          <button class="btn good" id="confirmSave">Confirm & Save</button>
          <button class="btn ghost" id="cancelReview">Cancel</button>
        </div>
      </div>
    </div>
  `;

  app.scrollTop = 0;

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

  const updateReviewDerived = ()=>{
    if(!state.reviewDraft) return;
    const p = parseNum(elPoundsLive ? elPoundsLive.value : "");
    const a = parseMoney(elAmountLive ? elAmountLive.value : "");
    const area = String(elAreaLive ? elAreaLive.value : "").trim();
    state.reviewDraft.pounds = p;
    state.reviewDraft.amount = a;
    state.reviewDraft.area = area;
    if(pplPill){
      const v = computePPL(Number(p||0), Number(a||0));
      pplPill.innerHTML = `Price/Lb: <b>${formatMoney(v)}</b>`;
    }
    saveState();
  };

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

  const topAreaWrapR = document.getElementById("topAreasR");
  if(topAreaWrapR && elAreaLive){
    topAreaWrapR.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-area]");
      if(!btn) return;
      const a = btn.getAttribute("data-area") || "";
      elAreaLive.value = a;
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

    const trip = {
      id: uid(),
      dateISO,
      dealer,
      pounds: to2(pounds),
      amount: to2(amount),
      area: String(elArea.value||"").trim()
    };

    state.trips = Array.isArray(state.trips) ? state.trips : [];
    const candidate = { dateISO, dealer, pounds: to2(pounds), amount: to2(amount) };
    const dup = findDuplicateTrip(candidate, "");
    if(dup){
      const msg = `This looks like a duplicate trip:\n\nDate: ${formatDateMDY(dup.dateISO)}\nDealer: ${dup.dealer}\nLbs: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave anyway?`;
      if(!confirm(msg)) return;
    }

    state.trips.push(trip);

    // clear draft + reviewDraft
    delete state.draft;
    delete state.reviewDraft;

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


  app.innerHTML = `
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
          ${renderTopAreaChips(topAreasE, trip.area, "topAreasE")}
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

  bindAreaChips("topAreasE", (a)=>{ trip.area = a; saveState(); renderEditTrip(trip.id); });


  const goHome = ()=>{
    state.view = "home";
    saveState();
    render();
  };

  document.getElementById("backHome").onclick = goHome;
    showToast(ok ? "Debug info copied" : "Copy failed");
  };
    const subj = encodeURIComponent("Shellfish Tracker Feedback ("+VERSION+")");
    location.href = `mailto:jeremywwood76@gmail.com?subject=${subj}&body=${body}`;
  };

  document.getElementById("cancelEdit").onclick = goHome;

  document.getElementById("saveEdit").onclick = ()=>{
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



function renderReports(){
  const trips = getFilteredTrips();
  const f = state.filter || "YTD";
  const mode = state.reportsMode || "tables"; // "charts" | "tables"

  if(!trips.length){
    app.innerHTML = `
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
    app.scrollTop = 0;
    document.getElementById("home").onclick = ()=>{ state.view="home"; state.lastAction="nav:home"; saveState(); render(); };
    document.getElementById("settings").onclick = ()=>{ state.view="settings"; state.lastAction="nav:settings"; saveState(); render(); };
    document.getElementById("help").onclick = ()=>{ state.view="help"; state.lastAction="nav:help"; saveState(); render(); };
    app.querySelectorAll(".chip[data-f]").forEach(btn=>{
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

  const priceTrips = trips.map(t=>{
    const lbs = Number(t?.pounds)||0;
    const amt = Number(t?.amount)||0;
    const ppl = computePPL(lbs, amt);
    return {
      id: t?.id||"",
      dateISO: t?.dateISO||"",
      date: formatDateMDY(t?.dateISO),
      dealer: normalizeDealerDisplay(t?.dealer||"") || "(Unspecified)",
      area: ((t?.area||"").toString().trim()) || "(Unspecified)",
      lbs: to2(lbs),
      ppl
    };
  }).filter(x=> Number(x.ppl) > 0);

  const best = priceTrips.slice().sort((a,b)=> b.ppl - a.ppl).slice(0,3);
  const worst = priceTrips.slice().sort((a,b)=> a.ppl - b.ppl).slice(0,3);

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

  const renderTripPriceList = (rows, emptyMsg) => {
    if(!rows.length) return `<div class="muted small">${emptyMsg}</div>`;
    return rows.map(r=>`
      <div class="row" style="justify-content:space-between;gap:12px;align-items:flex-start">
        <div>
          <b>${escapeHtml(r.date || "")}</b>
          <div class="muted small">${escapeHtml(r.dealer)} • ${escapeHtml(r.area)}</div>
        </div>
        <div class="muted small" style="text-align:right">
          <div>Lbs: <b>${escapeHtml(r.lbs)}</b></div>
          <div>$ / lb: <b>${formatMoney(to2(r.ppl))}</b></div>
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

        <div class="muted small" style="margin-bottom:6px"><b>Avg $/lb by Month</b></div>
        <canvas id="c_ppl" class="chart" height="180"></canvas>

        <div class="sep"></div>
        <div class="muted small" style="margin-bottom:6px"><b>Total $ by Dealer (Top 8)</b></div>
        <canvas id="c_dealer" class="chart" height="220"></canvas>

        <div class="sep"></div>
        <div class="muted small" style="margin-bottom:6px"><b>Total Lbs by Month</b></div>
        <canvas id="c_lbs" class="chart" height="200"></canvas>
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
        <b>Best / Worst Price</b>
        <div class="sep"></div>
        <div class="muted small" style="margin-bottom:6px"><b>Best $/lb</b></div>
        ${renderTripPriceList(best, "No priced trips found.")}
        <div class="sep"></div>
        <div class="muted small" style="margin-bottom:6px"><b>Worst $/lb</b></div>
        ${renderTripPriceList(worst, "No priced trips found.")}
      </div>
    `;
  };

  app.innerHTML = `
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

  app.scrollTop = 0;

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
  app.querySelectorAll(".chip[data-f]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.getAttribute("data-f");
      state.filter = key;
      saveState();
      renderReports();
    };
  });

  // mode chips
  app.querySelectorAll(".chip[data-m]").forEach(btn=>{
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
        <span class="muted small"></span>
      </div>
      <div class="hint">Manage areas used on trips. Delete-all now requires typing DELETE.</div>
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
      <div class="muted small" style="margin-top:10px">Backup lets you save trips/areas as a <b>.json</b> file on this device (Files/Drive) for safekeeping.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="downloadBackup">💾 Create backup</button>
        <button class="btn" id="restoreBackup">📥 Restore backup</button>
        <input id="backupFile" type="file" accept="application/json,.json" style="display:none" />
      </div>
      <div class="muted small" style="margin-top:10px">Reset clears all trips and settings on this device.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn danger" id="resetData">Reset app data</button>
      </div>
    </div>
  `;

  app.scrollTop = 0;

  const goHome = ()=>{ state.view="home"; saveState(); render(); };
  document.getElementById("backHome").onclick = goHome;

  // Backup / Restore (JSON)
  const backupFile = document.getElementById("backupFile");
  document.getElementById("downloadBackup").onclick = ()=>{
    try{ exportBackup(); showToast("Backup created"); }catch(e){ showToast("Backup failed"); }
  };
  document.getElementById("restoreBackup").onclick = ()=>{
    if(backupFile) backupFile.click();
  };
  if(backupFile){
    backupFile.onchange = async ()=>{
      const file = backupFile.files && backupFile.files[0];
      if(!file) return;
      try{
        await importBackupFromFile(file);
        showToast("Backup restored");
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
    // Phase 3B-1: Typed confirm to prevent accidental wipe
    const typed = prompt('Type DELETE to permanently erase ALL trips and settings on this device.');
    if(typed !== "DELETE") return;
    state = { trips: [], areas: [], filter: "YTD", view: "home" };
    saveState();
    render();
  };

  // (backup handlers are wired above)
}


function renderHelp(){
  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backHome">← Back</button>
        <b>Help</b>
        <span class="muted small"></span>
      </div>
      <div class="hint">Fast reference for field testing.</div>
    </div>

    <div class="card">
      <b>Quick Start</b>
      <div class="sep"></div>
      <ol class="muted small" style="margin:8px 0 0 18px;line-height:1.5">
        <li>Take a photo of the check/receipt (Camera).</li>
        <li>Tap the photo thumbnail → Live Text → Copy.</li>
        <li>Open Shellfish Tracker → tap <b>Paste → Review</b>.</li>
        <li>Fix anything that looks wrong (especially pounds), then <b>Confirm</b>.</li>
      </ol>
      <div class="hint">Note: iOS may show a small <b>Paste</b> bubble for privacy. Tap it once to allow paste.</div>
    </div>

    <div class="card">
      <b>Backup</b>
      <div class="sep"></div>
      <div class="muted small">Settings → Data → <b>Create backup</b> saves a .json file (Trips + Areas). Keep it in Files/Drive.</div>
    </div>

    <div class="card">
      <b>Add to Home Screen (PWA)</b>
      <div class="sep"></div>
      <div class="muted small"><b>iPhone:</b> Share → Add to Home Screen. Launch from the icon for the best app-like feel.</div>
      <div class="muted small" style="margin-top:8px"><b>Android:</b> Menu → Install app (or Add to Home screen).</div>
    </div>

    <div class="card">
      <b>About / Debug</b>
      <div class="sep"></div>
      <div class="muted small">Version: <b>${VERSION}</b></div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="copyDebug">Copy Debug Info</button>
        <button class="btn" id="feedback">Send Feedback</button>
      </div>
    </div>

    <div class="card">
      <b>Contact</b>
      <div class="sep"></div>
      <div class="muted small">Questions or feedback?</div>
      <div class="muted small" style="margin-top:6px"><b>Jeremy Wood</b></div>
      <div class="muted small"><a href="mailto:jeremywwood76@gmail.com" style="color:inherit">jeremywwood76@gmail.com</a></div>
    </div>
  `;
  app.scrollTop = 0;

  document.getElementById("backHome").onclick = ()=>{ state.view="home"; state.lastAction="nav:home"; saveState(); render(); };

  document.getElementById("copyDebug").onclick = async ()=>{
    const ok = await copyTextToClipboard(getDebugInfo());
    showToast(ok ? "Debug info copied" : "Copy failed");
  };

  document.getElementById("feedback").onclick = ()=>{
    const body = encodeURIComponent(getDebugInfo() + "\n\nWhat happened?\n");
    const subj = encodeURIComponent("Shellfish Tracker Feedback ("+VERSION+")");
    location.href = `mailto:jeremywwood76@gmail.com?subject=${subj}&body=${body}`;
  };
}

function renderAbout(){
  app.innerHTML = `
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
  app.scrollTop = 0;

  document.getElementById("backSettings").onclick = ()=>{ state.view="settings"; state.lastAction="nav:settings"; saveState(); render(); };

  document.getElementById("copyDebug").onclick = async ()=>{
    const ok = await copyTextToClipboard(getDebugInfo());
    showToast(ok ? "Debug info copied" : "Copy failed");
  };

  document.getElementById("feedback").onclick = ()=>{
    const body = encodeURIComponent(getDebugInfo() + "\n\nWhat happened?\n");
    const subj = encodeURIComponent("Shellfish Tracker Feedback ("+VERSION+")");
    location.href = `mailto:jeremywwood76@gmail.com?subject=${subj}&body=${body}`;
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

try{ render(); }catch(err){ setBootError(err?.message || err); throw err; }

// ---- Display helpers (no state) ----
function display2(val){
  if(val === "" || val == null) return "";
  const n = Number(val);
  return Number.isFinite(n) ? to2(n).toFixed(2) : String(val);
}
function displayPounds(val){
  // pounds are numeric; show up to 2 decimals like amount (no currency symbol)
  return display2(val);
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