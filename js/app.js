// Shellfish Tracker — V1.5 ESM (Phase 2C Parity)
// Full V1.4.2 UI + logic restored inside js/app.js
// ESM-005

import {
  uid, to2, clamp, pad2,
  formatDateMDY, parseMDYToISO,
  parseNum, parseMoney,
  computePPL, formatMoney,
  normalizeKey, likelyDuplicate,
  escapeHtml,
  downloadText, toCSV
} from "./core/utils.js";

(() => {
  const bootPill = document.getElementById("bootPill");
  function setBootError(msg){
    try{
      if(!bootPill) return;
      bootPill.textContent = "ERROR";
      bootPill.title = String(msg||"Unknown error");
      bootPill.classList.add("err");
    }catch{}
  }
  window.addEventListener("error", (e)=>setBootError(e?.message||e?.error||"Script error"));
  window.addEventListener("unhandledrejection", (e)=>setBootError(e?.reason||"Unhandled rejection"));

  const LS_KEY = "shellfish-v1.4.2";
  const DEFAULT_AREAS = [
    { name: "Point of Flats", note: "" },
    { name: "Big Bay", note: "" },
    { name: "Yoho Cove", note: "" },
    { name: "The Crick", note: "" }
  ];
  const DEFAULT_SETTINGS = { warnDuplicates: true, defaultArea: "" };

  const app = document.getElementById("app");
  const tripOverlay = document.getElementById("tripOverlay");
  const tripTitle = document.getElementById("tripTitle");
  const tripBody = document.getElementById("tripBody");
  const tripCancelBtn = document.getElementById("tripCancelBtn");
  const tripSaveBtn = document.getElementById("tripSaveBtn");

  function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function dateFromISO(iso){
    const p=String(iso||"").split("-");
    if(p.length!==3) return null;
    const y=Number(p[0]), m=Number(p[1]), day=Number(p[2]);
    if(!Number.isFinite(y)||!Number.isFinite(m)||!Number.isFinite(day)) return null;
    return new Date(y, m-1, day);
  }

  function filterLabel(k){ return k==="7D"?"Last 7 days":(k==="M"?"This Month":"YTD"); }
  function rangeForFilter(k){
    const now=new Date();
    const end=startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate()+1));
    let start;
    if(k==="7D") start=startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate()-6));
    else if(k==="M") start=startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    else start=startOfDay(new Date(now.getFullYear(), 0, 1));
    return {start, end};
  }
  function filterTripsByRange(trips,k){
    const r=rangeForFilter(k);
    return trips.filter(t=>{
      const d=dateFromISO(t.dateISO);
      if(!d) return false;
      const sd=startOfDay(d);
      return sd>=r.start && sd<r.end;
    });
  }
  function sortedTrips(trips){
    return [...trips].sort((a,b)=> a.dateISO===b.dateISO ? (b.createdAt||0)-(a.createdAt||0) : String(b.dateISO).localeCompare(String(a.dateISO)) );
  }

  function loadState(){
    try{
      const raw=localStorage.getItem(LS_KEY);
      if(!raw) return { trips: [], settings: {...DEFAULT_SETTINGS}, areas: [...DEFAULT_AREAS], view: "home", filter: "YTD" };
      const p=JSON.parse(raw);
      const trips=Array.isArray(p?.trips)?p.trips.map(t=>({
        id:String(t.id||uid()),
        dateISO:String(t.dateISO||""),
        dealer:String(t.dealer||""),
        pounds:clamp(Number(t.pounds||0),0),
        amount:Number(t.amount||0),
        area:t.area?String(t.area):"",
        createdAt:Number(t.createdAt||Date.now()),
        source: t.source ? String(t.source) : "manual",
        ocrRawText: t.ocrRawText ? String(t.ocrRawText) : "",
        photoName: t.photoName ? String(t.photoName) : ""
      })).filter(t=>!!t.dateISO):[];
      const settings={...DEFAULT_SETTINGS,...(p?.settings||{})};
      const areasRaw=Array.isArray(p?.areas)?p.areas:DEFAULT_AREAS;
      const areas=areasRaw.map(a=>({name:String(a?.name||"").trim(),note:String(a?.note||"").trim()})).filter(a=>a.name);
      return { trips, settings, areas: areas.length?areas:[...DEFAULT_AREAS], view: p?.view||"home", filter: p?.filter||"YTD" };
    }catch{
      return { trips: [], settings: {...DEFAULT_SETTINGS}, areas: [...DEFAULT_AREAS], view: "home", filter: "YTD" };
    }
  }

  let state=loadState();
  function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

  // OCR parse helpers (parity)
  function toLines(raw){
    let s=String(raw||"");
    s=s.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    s=s.replace(/\\+r\\+n/g,"\n");
    s=s.replace(/\\+n/g,"\n");
    s=s.replace(/\\+r/g,"\n");
    return s.split(/\n/).map(l=>l.replaceAll("\u00A0"," ").trim()).filter(Boolean);
  }
  function findFirstMDY(lines){
    const candidates=[];
    const scoreAt=(i)=>{
      const up=(lines[i]||"").toUpperCase();
      const prev=(lines[i-1]||"").toUpperCase();
      const next=(lines[i+1]||"").toUpperCase();
      let score=1;
      if(prev.includes("DATE") || up.includes("DATE") || next.includes("DATE") || prev.includes("DATED") || up.includes("DATED") || next.includes("DATED")) score+=6;
      const m=up.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.](\d{2,4})\b/);
      if(m && String(m[1]||"").length===4) score+=2;
      return score;
    };
    const tryExtract=(line)=>{
      const s=String(line||"");
      const m=s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
      if(!m) return "";
      const mm=Number(m[1]), dd=Number(m[2]);
      let yy=String(m[3]);
      if(yy.length===2){ const n=Number(yy); yy=String((n<=79?2000:1900)+n); }
      const y=Number(yy);
      if(!(mm>=1&&mm<=12&&dd>=1&&dd<=31&&y>=1900&&y<=2100)) return "";
      return pad2(mm)+"/"+pad2(dd)+"/"+yy;
    };
    for(let i=0;i<lines.length;i++){
      const d=tryExtract(lines[i]);
      if(d) candidates.push({d, score: scoreAt(i)});
    }
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0]?.d || "";
  }
  function qtyAfterDescription(lines){
    let idx=-1;
    for(let i=0;i<lines.length;i++){
      const u=lines[i].toUpperCase();
      if(u.startsWith("DESCRIPTION")){ idx=i; break; }
    }
    if(idx<0) return "";
    const stopStarts=["CHECK NO","CHECK AMOUNT","AMOUNT","DATE","INVOICE","DOLLARS"];
    for(let k=idx+1;k<Math.min(lines.length,idx+6);k++){
      const l=lines[k];
      const up=l.toUpperCase();
      let stop=false;
      for(const s of stopStarts){ if(up.startsWith(s)){ stop=true; break; } }
      if(stop) break;
      const m=l.match(/\b(\d{1,4})(?:\s*[,\.]\s*(\d))?\b/);
      if(m){
        const n = m[2] ? Number(m[1]+"."+m[2]) : Number(m[1]);
        if(Number.isFinite(n) && n>0 && n<2000) return String(n);
      }
    }
    return "";
  }
  function amountAfterCheckAmount(lines){
    const scan=(start, end)=>{
      for(let k=start;k<end;k++){
        const l=lines[k];
        const m=l.match(/\b\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/);
        if(m){
          const cleaned=String(m[1]).replaceAll(",","");
          const v=parseMoney(cleaned);
          if(v>=1 && v<=50000) return v.toFixed(2);
        }
      }
      return "";
    };
    let idx=-1;
    for(let i=0;i<lines.length;i++){
      const u=lines[i].toUpperCase();
      if(u.startsWith("CHECK AMOUNT") || u.includes("CHECK AMOUNT")) { idx=i; break; }
    }
    if(idx>=0){
      const v=scan(idx, Math.min(lines.length, idx+8));
      if(v) return v;
    }
    let best=0;
    for(let i=0;i<lines.length;i++){
      const l=lines[i];
      const matches=[...l.matchAll(/\b\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/g)];
      for(const m of matches){
        const cleaned=String(m[1]).replaceAll(",","");
        const v=parseMoney(cleaned);
        if(Number.isFinite(v) && v>best && v<=50000) best=v;
      }
    }
    return best>0 ? best.toFixed(2) : "";
  }
  function parseOcrBridge(raw){
    const lines=toLines(raw);
    let dealer="";
    for(const l of lines){
      const u=l.toUpperCase();
      if(u.includes("MACHIAS BAY SEAFOOD")){ dealer=l; break; }
    }
    if(!dealer) dealer = lines.find(l=>/[A-Za-z]/.test(l)) || "";
    const date=findFirstMDY(lines);
    let qty=qtyAfterDescription(lines);
    if(!qty){
      for(const l of lines){
        const m=l.match(/\b(\d{1,4})\s*[,\.]\s*(\d)\b/);
        if(m){
          const n=Number(m[1]+"."+m[2]);
          if(Number.isFinite(n) && n>0 && n<2000){ qty=String(n); break; }
        }
      }
    }
    const paid=amountAfterCheckAmount(lines);
    return { dealer, date, qty, paid };
  }

  let editingId=null;
  let form=null;

  tripCancelBtn.addEventListener("click", ()=>closeTripSheet());
  const tripCancelBtn2 = document.getElementById("tripCancelBtn2");
  const tripSaveBtn2 = document.getElementById("tripSaveBtn2");
  if(tripCancelBtn2) tripCancelBtn2.addEventListener("click", ()=>closeTripSheet());
  if(tripSaveBtn2) tripSaveBtn2.addEventListener("click", ()=>tripSaveBtn.click());

  tripOverlay.addEventListener("click", (e)=>{ if(e.target===tripOverlay) closeTripSheet(); });

  function openTripSheet(trip){
    editingId=trip?trip.id:null;
    const t=trip||{ dateISO: "", dealer: "", pounds: "", amount: "", area: state.settings.defaultArea || "" };
    form={
      dateInput: t.dateISO,
      dealer: t.dealer,
      pounds: String(t.pounds ?? ""),
      amount: String(t.amount ?? ""),
      area: t.area || "",
      ocrText: "",
      photoUrl: "",
      photoName: "",
      photoFile:null,
      enhanceForOcr:true
    };
    tripTitle.textContent = trip?"Edit Trip":"New Trip";
    renderTripSheet();
    tripOverlay.classList.add("show");
    tripOverlay.setAttribute("aria-hidden","false");
  }

  function closeTripSheet(){
    tripOverlay.classList.remove("show");
    tripOverlay.setAttribute("aria-hidden","true");
    if(form?.photoUrl){ try{ URL.revokeObjectURL(form.photoUrl); }catch{} }
    form=null;
    editingId=null;
  }

  tripSaveBtn.addEventListener("click", ()=>{
    if(!form) return;
    const dateISO = parseMDYToISO(form.dateInput);
    const dealer = (form.dealer||"").trim();
    const pounds = clamp(parseNum(form.pounds||"0"),0);
    const amount = parseMoney(form.amount||"0");
    const area = (form.area||"").trim();

    if(!dateISO) return alert("Date is required.");
    if(!dealer) return alert("Dealer is required.");
    if(pounds<=0) return alert("Pounds must be greater than 0.");

    const base={
      id: editingId || uid(),
      dateISO,
      dealer,
      pounds: to2(pounds),
      amount: to2(amount),
      area,
      createdAt: editingId ? (state.trips.find(t=>t.id===editingId)?.createdAt || Date.now()) : Date.now(),
      source: (form.ocrText && form.ocrText.trim()) ? "ocr" : "manual",
      ocrRawText: (form.ocrText||"").trim(),
      photoName: (form.photoName||"")
    };

    if(state.settings.warnDuplicates){
      const others=state.trips.filter(t=>t.id!==base.id);
      const dup=others.find(t=>likelyDuplicate(t,base));
      if(dup){
        const ok=confirm("Possible duplicate.\nExisting: "+formatDateMDY(dup.dateISO)+" • "+dup.dealer+"\nSave anyway?");
        if(!ok) return;
      }
    }

    const idx=state.trips.findIndex(t=>t.id===base.id);
    if(idx>=0) state.trips[idx]=base; else state.trips.unshift(base);

    state.settings.defaultArea = base.area;
    saveState();
    closeTripSheet();
    render();
  });

  function renderTripSheet(){
    if(!form) return;
    const ppl=computePPL(parseNum(form.pounds||"0"), parseMoney(form.amount||"0"));
    const areaOptions = state.areas.map(a=>"<option value=\"" + escapeHtml(a.name) + "\">" + escapeHtml(a.name) + "</option>").join("");

    tripBody.innerHTML = `
      <div class="card">
        <div class="subhead"><b>Photo</b><span class="muted small">optional</span></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="pickPhotoBtn">📷 Add Check Photo</button></div>
        <input id="photoFile" type="file" accept="image/*" style="display:none" />
        ${form.photoUrl ? `<div class="imgWrap"><img class="imgPreview" src="${form.photoUrl}" alt="Check photo" /></div><div class="pillbar"><span class="pill">Photo: ${escapeHtml(form.photoName||"image")}</span></div>` : ""}
      </div>

      <div class="card">
        <div class="subhead"><b>OCR (Scan Check)</b><span class="muted small">optional</span></div>
        <div class="hint">Best results: iPhone Notes Scan → Copy All → paste into <b>OCR Text</b> → tap <b>Parse</b>. Photo OCR is experimental and may fail on checks.</div>

        <div class="togRow" style="padding:8px 0 2px">
          <div class="togTxt"><b>Enhance for OCR</b><span>Improves accuracy on checks (recommended).</span></div>
          <label class="switch"><input type="checkbox" id="enhanceOcr" ${form.enhanceForOcr?"checked":""} /><span class="slider"></span></label>
        </div>

        <label for="ocrText">OCR Text</label>
        <textarea id="ocrText" placeholder="OCR output will appear here...">${escapeHtml(form.ocrText||"")}</textarea>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="applyOcrBtn">🔎 Parse</button>
          <button class="btn" id="clearOcrBtn">Clear</button>
        </div>
      </div>

      <div class="card">
        <div class="subhead"><b>Manual Fields</b><span class="muted small">required</span></div>
        <label>Date (MM/DD/YYYY)</label>
        <input id="fDate" value="${escapeHtml(formatDateMDY(parseMDYToISO(form.dateInput)||form.dateInput)||"")}" placeholder="12/11/2025" />
        <label>Dealer</label>
        <input id="fDealer" value="${escapeHtml(form.dealer||"")}" placeholder="MACHIAS BAY SEAFOOD INC." />
        <label>Qty (lbs)</label>
        <input id="fPounds" value="${escapeHtml(form.pounds||"")}" inputmode="decimal" placeholder="43.5" />
        <label>Paid ($)</label>
        <input id="fAmount" value="${escapeHtml(form.amount||"")}" inputmode="decimal" placeholder="152.25" />
        <div class="pillbar"><span class="pill">$ / lb: <b>${(ppl ? to2(ppl).toFixed(2) : "0.00")}</b></span></div>
        <div class="sep"></div>
        <label>Area</label>
        <div class="chips" id="areaChips"></div>
        <select id="fArea"><option value="">Select…</option>${areaOptions}</select>
      </div>
    `;

    const ocrText=document.getElementById("ocrText");
    ocrText.addEventListener("input", ()=>{ form.ocrText=ocrText.value; });

    const enhanceOcr=document.getElementById("enhanceOcr");
    enhanceOcr.addEventListener("change", ()=>{ form.enhanceForOcr = !!enhanceOcr.checked; });

    document.getElementById("applyOcrBtn").addEventListener("click", ()=>{
      try{
        const p=parseOcrBridge(form.ocrText||"");
        if(p.dealer) form.dealer=p.dealer;
        if(p.date) form.dateInput=p.date;
        if(p.qty) form.pounds=p.qty;
        if(p.paid) form.amount=p.paid;
        renderTripSheet();
      }catch{
        alert("OCR parse failed.");
      }
    });
    document.getElementById("clearOcrBtn").addEventListener("click", ()=>{ form.ocrText=""; renderTripSheet(); });

    const fDate=document.getElementById("fDate");
    const fDealer=document.getElementById("fDealer");
    const fPounds=document.getElementById("fPounds");
    const fAmount=document.getElementById("fAmount");
    const fArea=document.getElementById("fArea");
    const areaChips=document.getElementById("areaChips");

    fDate.addEventListener("input", ()=>{ form.dateInput=fDate.value; });
    fDealer.addEventListener("input", ()=>{ form.dealer=fDealer.value; });
    fPounds.addEventListener("input", ()=>{ form.pounds=fPounds.value; renderTripSheet(); });
    fAmount.addEventListener("input", ()=>{ form.amount=fAmount.value; renderTripSheet(); });

    fArea.value=form.area||"";
    fArea.addEventListener("change", ()=>{ form.area=fArea.value; renderTripSheet(); });

    const top=state.areas.slice(0,4).map(a=>a.name);
    areaChips.innerHTML = top.map(n=>{
      const active = normalizeKey(n)===normalizeKey(form.area||"") ? "active" : "";
      return `<button class="chip ${active}" type="button" data-area="${escapeHtml(n)}">${escapeHtml(n)}</button>`;
    }).join("");
    areaChips.addEventListener("click",(e)=>{
      const b=e.target.closest("button[data-area]");
      if(!b) return;
      form.area=b.getAttribute("data-area")||"";
      renderTripSheet();
    });
  }

  function render(){
    if(state.view==="areas") return renderAreas();
    if(state.view==="settings") return renderSettings();
    return renderHome();
  }

  function renderHome(){
    const key=state.filter||"YTD";
    const all=sortedTrips(state.trips);
    const trips=sortedTrips(filterTripsByRange(all,key));

    const totalPounds=to2(trips.reduce((s,t)=>s+(t.pounds||0),0));
    const totalAmount=to2(trips.reduce((s,t)=>s+(t.amount||0),0));
    const avgPPL=computePPL(totalPounds,totalAmount);

    app.innerHTML = `
      <div class="card">
        <div class="row">
          <button class="btn" id="exportBtn">🧾 Export CSV</button>
          <button class="btn primary" id="newTripBtn">＋ New Trip</button>
          <button class="btn" id="settingsBtn">⚙️ Settings</button>
        </div>
        <div class="hint">Trips are saved locally on this device. Export CSV anytime.</div>
      </div>

      <div class="card">
        <div class="subhead"><b>Totals (${filterLabel(key)})</b><span class="muted small">tap to change</span></div>
        <div class="chips" id="filterChips">
          <button class="chip ${key==="YTD"?"active":""}" type="button" data-f="YTD">YTD</button>
          <button class="chip ${key==="M"?"active":""}" type="button" data-f="M">Month</button>
          <button class="chip ${key==="7D"?"active":""}" type="button" data-f="7D">Last 7 days</button>
        </div>
        <div class="pillbar">
          <span class="pill">Trips: <b>${trips.length}</b></span>
          <span class="pill">Total lbs: <b>${totalPounds.toFixed(2)}</b></span>
          <span class="pill">Total: <b>${formatMoney(totalAmount)}</b></span>
          <span class="pill">Avg $/lb: <b>${avgPPL.toFixed(2)}</b></span>
        </div>
      </div>

      <div class="card">
        <div class="subhead"><b>Recent Trips</b><span class="muted small">tap View</span></div>
        <div class="sep"></div>
        ${trips.length===0 ? `<div class="muted small">No trips in this range. Tap <b>New Trip</b> to log a harvest.</div>` : `<div class="list" id="tripList"></div>`}
      </div>
    `;

    document.getElementById("newTripBtn").addEventListener("click", ()=>openTripSheet(null));
    document.getElementById("settingsBtn").addEventListener("click", ()=>{ state.view="settings"; saveState(); render(); });
    document.getElementById("exportBtn").addEventListener("click", ()=>{
      const key=state.filter||"YTD";
      const csv=toCSV(sortedTrips(filterTripsByRange(state.trips,key)));
      downloadText("shellfish_trips_"+new Date().toISOString().slice(0,10)+".csv", csv);
    });

    document.getElementById("filterChips").addEventListener("click",(e)=>{
      const b=e.target.closest("button[data-f]");
      if(!b) return;
      state.filter=b.getAttribute("data-f")||"YTD";
      saveState();
      render();
    });

    const list=document.getElementById("tripList");
    if(list){
      list.innerHTML = trips.map(t=>`
        <div class="trip" data-id="${t.id}">
          <div>
            <b>${escapeHtml(formatDateMDY(t.dateISO))}</b>
            <span>${escapeHtml(t.dealer)} • ${to2(t.pounds).toFixed(2)} lbs • ${formatMoney(t.amount)} • ${escapeHtml(t.area||"")}</span>
          </div>
          <div class="right"><button class="btn" data-view="${t.id}">View</button></div>
        </div>
      `).join("");
      list.addEventListener("click",(e)=>{
        const btn=e.target.closest("button[data-view]");
        if(!btn) return;
        const id=btn.getAttribute("data-view");
        const trip=state.trips.find(t=>t.id===id);
        if(trip) openTripSheet(trip);
      });
    }
  }

  function renderSettings(){
    app.innerHTML = `
      <div class="card">
        <div class="subhead"><b>Settings</b><button class="btn" id="backHomeBtn">← Back</button></div>
        <div class="hint">Start of week is fixed to <b>Sunday</b>. Currency is <b>USD</b>.</div>
      </div>

      <div class="card">
        <b>Behavior</b>
        <div class="sep"></div>
        <div class="togRow">
          <div class="togTxt"><b>Duplicate-trip warning</b><span>Warn if date + dealer + qty + amount matches an existing trip.</span></div>
          <label class="switch"><input type="checkbox" id="sWarnDup" /><span class="slider"></span></label>
        </div>
      </div>

      <div class="card">
        <b>Data & Lists</b>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="areasBtn">🗺️ Manage Areas</button>
          <button class="btn danger" id="wipeBtn">🧹 Clear Data</button>
        </div>
        <div class="hint">Clear Data deletes trips, areas, and settings on this device.</div>
      </div>
    `;

    document.getElementById("backHomeBtn").addEventListener("click", ()=>{ state.view="home"; saveState(); render(); });

    const sWarnDup=document.getElementById("sWarnDup");
    sWarnDup.checked=!!state.settings.warnDuplicates;
    sWarnDup.addEventListener("change", ()=>{ state.settings.warnDuplicates=!!sWarnDup.checked; saveState(); });

    document.getElementById("areasBtn").addEventListener("click", ()=>{ state.view="areas"; saveState(); render(); });

    document.getElementById("wipeBtn").addEventListener("click", ()=>{
      const ok=confirm("Delete all trips, areas, and settings on this device?");
      if(!ok) return;
      localStorage.removeItem(LS_KEY);
      state=loadState();
      render();
    });
  }

  function renderAreas(){
    const rows=state.areas.map((a,i)=>`
      <div class="trip" style="align-items:flex-start">
        <div><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.note||"")}</span></div>
        <div class="right"><button class="btn danger" data-del="${i}">Delete</button></div>
      </div>
    `).join("");

    app.innerHTML = `
      <div class="card">
        <div class="subhead"><b>Areas</b><button class="btn" id="backBtn">← Back</button></div>
        <div class="hint">Used in New Trip. Default areas are prefilled.</div>
      </div>

      <div class="card">
        <label>New area name</label>
        <input id="newAreaName" placeholder="e.g., Big Bay" />
        <label>Note (optional)</label>
        <input id="newAreaNote" placeholder="optional" />
        <div class="row" style="margin-top:10px">
          <button class="btn good" id="addAreaBtn">Add Area</button>
          <button class="btn" id="resetAreasBtn">Reset Defaults</button>
        </div>
      </div>

      <div class="card">
        <div class="subhead"><b>Current Areas</b><span class="muted small">${state.areas.length}</span></div>
        <div class="sep"></div>
        <div class="list" id="areasList">${rows || `<div class="muted small">No areas.</div>`}</div>
      </div>
    `;

    document.getElementById("backBtn").addEventListener("click", ()=>{ state.view="settings"; saveState(); render(); });

    document.getElementById("addAreaBtn").addEventListener("click", ()=>{
      const name=document.getElementById("newAreaName").value.trim();
      const note=document.getElementById("newAreaNote").value.trim();
      if(!name) return alert("Area name required.");
      if(state.areas.some(a=>normalizeKey(a.name)===normalizeKey(name))) return alert("Area already exists.");
      state.areas.push({name, note});
      saveState();
      render();
    });

    document.getElementById("resetAreasBtn").addEventListener("click", ()=>{
      const ok=confirm("Reset areas to defaults?");
      if(!ok) return;
      state.areas=[...DEFAULT_AREAS];
      saveState();
      render();
    });

    document.getElementById("areasList").addEventListener("click", (e)=>{
      const btn=e.target.closest("button[data-del]");
      if(!btn) return;
      const idx=Number(btn.getAttribute("data-del"));
      if(!Number.isFinite(idx) || idx<0 || idx>=state.areas.length) return;
      const name=state.areas[idx]?.name || "";
      const ok=confirm("Delete area \""+name+"\"?");
      if(!ok) return;
      state.areas.splice(idx,1);
      saveState();
      render();
    });
  }

  window.addEventListener("keydown",(e)=>{
    if(e.key==="Escape"){
      if(tripOverlay.classList.contains("show")) closeTripSheet();
      else if(state.view!=="home"){ state.view="home"; saveState(); render(); }
    }
  });

  try{ render(); }catch(err){ setBootError(err?.message||err); throw err; }
})();
