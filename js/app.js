// Shellfish Tracker — V1.5 ESM (Phase 2C-UI)
// Goal: Restore polished UI shell (cards/buttons) while keeping ESM structure stable.

import { uid, toCSV, downloadText, formatMoney, formatDateMDY, computePPL, to2, parseMDYToISO, parseNum, parseMoney, likelyDuplicate, normalizeKey, escapeHtml } from "./core/utils.js?v=ESM-006E";



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

  // AMOUNT
  // Prefer explicit $ with cents, then explicit decimals, then check-style digits (e.g., 19350 => 193.50)
  const money = [...text.matchAll(/\$\s*([0-9]{1,6}(?:,[0-9]{3})*(?:\.[0-9]{2})?|\d+\.\d{2})\b/g)].map(m=>m[1].replace(/,/g,""));
  if(money.length){
    out.amount = money[0];
    out.confidence.amount = "high";
  }else{
    const money2 = [...text.matchAll(/\b([0-9]{1,6}(?:\.[0-9]{2}))\b/g)].map(m=>m[1]);
    if(money2.length){
      let maxv=-1, maxs="";
      money2.forEach(s=>{ const v=parseFloat(s); if(v>maxv){maxv=v; maxs=s;} });
      if(maxs){ out.amount=maxs; out.confidence.amount="med"; }
    }else{
      // Check OCR often drops the decimal: "CHECK AMOUNT 19350" => 193.50
      let centsDigits = "";
      const near = text.match(/\b(?:check\s*)?amount\b[\s:]*\n?\s*(\d{4,6})\b/i);
      if(near) centsDigits = near[1];

      if(!centsDigits){
        for(let i=0;i<lines.length;i++){
          if(/^(?:check\s*)?amount$/i.test(lines[i])){
            const next = lines[i+1] || "";
            const mm = next.match(/\b(\d{4,6})\b/);
            if(mm){ centsDigits = mm[1]; break; }
          }
        }
      }

      if(centsDigits){
        const n = parseInt(centsDigits,10);
        if(Number.isFinite(n) && n>=1000){
          out.amount = (n/100).toFixed(2);
          out.confidence.amount = "med";
        }
      }
    }
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
  }).join("") : `<div class="muted small">No trips in this range yet.</div>`;

  app.innerHTML = `
    <div class="card">
      <div class="row">
        <button class="btn primary" id="newTrip">＋ New Trip</button>
        <button class="btn" id="export">🧾 Export CSV</button>
        <button class="btn" id="reports">📊 Reports</button>
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
    document.getElementById("reports").onclick = ()=>{ state.view="reports"; saveState(); render(); };

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
        <span class="muted small">OCR v1 (Phase 4B)</span>
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
            <button class="smallbtn" id="parsePaste">Parse OCR</button>
            <button class="smallbtn" id="ocrToReview">Send to Review</button>
            <span class="muted small">Parses date / dealer / lbs / amount (best-effort). Nothing saves until Review & Confirm.</span>
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
    const parsed = parseOcrText(elPaste.value, state.areas||[]);
    if(parsed.dateMDY) elDate.value = parsed.dateMDY;
    if(parsed.dealer) elDealer.value = parsed.dealer;
    if(parsed.pounds) elPounds.value = parsed.pounds;
    if(parsed.amount) elAmount.value = parsed.amount;
    if(parsed.area) elArea.value = parsed.area;

    saveDraft();

    const msg =
      `OCR Parse Results:\n`+
      `Date: ${parsed.dateMDY||"(none)"} (${parsed.confidence.date})\n`+
      `Dealer: ${parsed.dealer||"(none)"} (${parsed.confidence.dealer})\n`+
      `Pounds: ${parsed.pounds||"(none)"} (${parsed.confidence.pounds})\n`+
      `Amount: ${parsed.amount||"(none)"} (${parsed.confidence.amount})\n`+
      `Area: ${parsed.area||"(none)"} (${parsed.confidence.area})\n\n`+
      `Tip: Always verify in Review before saving.`;
    alert(msg);
  };
  document.getElementById("ocrToReview").onclick = ()=>{
    const parsed = parseOcrText(elPaste.value, state.areas||[]);
    if(parsed.dateMDY) elDate.value = parsed.dateMDY;
    if(parsed.dealer) elDealer.value = parsed.dealer;
    if(parsed.pounds) elPounds.value = parsed.pounds;
    if(parsed.amount) elAmount.value = parsed.amount;
    if(parsed.area) elArea.value = parsed.area;

    saveDraft();

    // Jump straight to Review (still requires Confirm & Save)
    document.getElementById("saveTrip").click();
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

  app.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="backToNew">← Back</button>
        <b>Review & Confirm</b>
        <span class="muted small">Phase 3A</span>
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
          <input class="input" id="r_amount" inputmode="decimal" value="${escapeHtml(String(d.amount??""))}" />
        </div>

        <div class="field">
          <div class="label">Area</div>
          <input class="input" id="r_area" placeholder="(optional)" value="${escapeHtml(String(d.area||""))}" />
        </div>

        <div class="pillbar">
          <span class="pill">Price/Lb: <b>${formatMoney(ppl)}</b></span>
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
  document.getElementById("export").onclick = ()=>{ state.view="home"; saveState(); render(); setTimeout(()=>{ const b=document.getElementById("export"); if(b) b.click(); }, 0); };
  document.getElementById("settings").onclick = ()=>{ state.view="settings"; saveState(); render(); };

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
        <span class="muted small">Phase 3B-1/3</span>
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
    // Phase 3B-1: Typed confirm to prevent accidental wipe
    const typed = prompt('Type DELETE to permanently erase ALL trips and settings on this device.');
    if(typed !== "DELETE") return;
    state = { trips: [], areas: [], filter: "YTD", view: "home" };
    saveState();
    render();
  };
}

function render(){
  if(!state.view) state.view = "home";
  if(state.view === "settings") return renderSettings();
  if(state.view === "new") return renderNewTrip();
  if(state.view === "review") return renderReviewTrip();
  if(state.view === "edit") return renderEditTrip();
  if(state.view === "reports") return renderReports();
  return renderHome();
}

try{ render(); }catch(err){ setBootError(err?.message || err); throw err; }
