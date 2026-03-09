export function createSettingsListManagement(deps){
  const {
    getState,
    setState,
    saveState,
    getApp,
    ensureAreas,
    ensureDealers,
    normalizeKey,
    escapeHtml,
    showToast,
    copyTextWithFeedback,
    getDebugInfo,
    forceRefreshApp,
    render
  } = deps;

  function renderListMgmtPanel(mode){
    const state = getState();
    const m = String(mode || "areas").toLowerCase();
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

    return (m === "dealers") ? `
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

  function getScroller(){
    return document.scrollingElement || document.documentElement || document.body;
  }

  function countTripsUsingValue(kind, rawValue){
    const state = getState();
    const needle = String(rawValue || "").trim();
    if(!needle) return 0;
    const needleKey = normalizeKey(needle);
    const trips = Array.isArray(state?.trips) ? state.trips : [];
    let count = 0;
    for(const trip of trips){
      const tripValue = String(kind === "dealer" ? trip?.dealer : trip?.area || "").trim();
      if(!tripValue) continue;
      if(normalizeKey(tripValue) === needleKey) count += 1;
    }
    return count;
  }

  function refreshListMgmt(mode, preserveScroll){
    const state = getState();
    const sc = getScroller();
    const prev = preserveScroll ? (sc ? sc.scrollTop : 0) : 0;
    const m = String(mode || "areas").toLowerCase();
    state.settings = state.settings || {};
    if(!Array.isArray(state.areas)) state.areas = [];
    if(!Array.isArray(state.dealers)) state.dealers = [];
    state.settings.listMode = (m === "dealers") ? "dealers" : "areas";
    saveState();

    getApp().querySelectorAll("button.chip[data-listmode]").forEach((b)=>{
      const bm = String(b.getAttribute("data-listmode") || "").toLowerCase();
      const on = (bm === state.settings.listMode);
      b.classList.toggle("on", on);
      b.classList.toggle("is-selected", on);
    });

    const panel = document.getElementById("listMgmtPanel");
    if(panel){
      try{
        panel.innerHTML = renderListMgmtPanel(state.settings.listMode);
      }catch(err){
        try{ console.error("ListMgmt render failed", err); }catch(_){ }
        try{ state.settings = state.settings || {}; state.settings.listMgmtLastError = String(err?.message || err); saveState(); }catch(_){ }
        try{ state.areas = Array.isArray(state.areas) ? state.areas : []; }catch(_){ }
        try{ state.dealers = Array.isArray(state.dealers) ? state.dealers : []; }catch(_){ }
        try{
          panel.innerHTML =
            '<div class="muted small mt10">' +
            '<b>List Management error</b><br/>' +
            'Tap <b>Copy Debug</b> and send the error so we can fix it.<br/>' +
            '<span class="muted tiny">' + escapeHtml(err?.message || String(err)) + '</span>' +
            '</div>';
        }catch(_){ }
      }
    }

    bindListMgmtHandlers();

    try{ document.activeElement && document.activeElement.blur && document.activeElement.blur(); }catch(_){ }
    if(preserveScroll && sc){
      requestAnimationFrame(()=>{ sc.scrollTop = prev; });
    }
  }

  function bindListMgmtHandlers(){
    const state = getState();
    try{
      const root = getApp();
      if(root){
        root.querySelectorAll('button.chip[data-listmode]').forEach((btn)=>{
          btn.onclick = (e)=>{
            try{ e.preventDefault(); }catch(_){ }
            const mode = btn.getAttribute("data-listmode") || "areas";
            refreshListMgmt(mode, true);
          };
        });
      }

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
          const exists = state.areas.some((a)=>normalizeKey(String(a || "")) === key);
          if(exists){ showToast("That area already exists"); return; }
          state.areas.push(raw);
          ensureAreas();
          saveState();
          refreshListMgmt("areas", true);
        };
      }

      if(btnAddDealer){
        btnAddDealer.onclick = ()=>{
          const raw = String(elNewDealer?.value || "").trim();
          if(!raw){ showToast("Enter a dealer first"); elNewDealer?.focus(); return; }
          if(raw.length > 40){ showToast("Keep it under 40 chars"); elNewDealer?.focus(); return; }
          ensureDealers();
          const key = normalizeKey(raw);
          const exists = state.dealers.some((d)=>normalizeKey(String(d || "")) === key);
          if(exists){ showToast("That dealer already exists"); return; }
          state.dealers.push(raw);
          ensureDealers();
          saveState();
          refreshListMgmt("dealers", true);
        };
      }

      (getApp()?.querySelectorAll("button[data-del-area]") || []).forEach((btn)=>{
        btn.onclick = ()=>{
          const i = Number(btn.getAttribute("data-del-area"));
          if(!Number.isFinite(i) || i < 0) return;
          const name = String(state.areas?.[i] || "");
          const inUseCount = countTripsUsingValue("area", name);
          if(inUseCount > 0){
            alert(`Can't delete area \"${name}\" yet. ${inUseCount} trip(s) still use it.`);
            showToast("Area is used by saved trips");
            return;
          }
          if(!confirm(`Delete area "${name}"?`)) return;
          state.areas.splice(i, 1);
          ensureAreas();
          saveState();
          refreshListMgmt("areas", true);
        };
      });

      (getApp()?.querySelectorAll("button[data-del-dealer]") || []).forEach((btn)=>{
        btn.onclick = ()=>{
          const i = Number(btn.getAttribute("data-del-dealer"));
          if(!Number.isFinite(i) || i < 0) return;
          const name = String(state.dealers?.[i] || "");
          const inUseCount = countTripsUsingValue("dealer", name);
          if(inUseCount > 0){
            alert(`Can't delete dealer \"${name}\" yet. ${inUseCount} trip(s) still use it.`);
            showToast("Dealer is used by saved trips");
            return;
          }
          if(!confirm(`Delete dealer "${name}"?`)) return;
          state.dealers.splice(i, 1);
          ensureDealers();
          saveState();
          refreshListMgmt("dealers", true);
        };
      });

      if(elNewArea){
        elNewArea.onkeydown = (e)=>{ if(e.key === "Enter"){ e.preventDefault(); btnAddArea?.click(); } };
      }
      if(elNewDealer){
        elNewDealer.onkeydown = (e)=>{ if(e.key === "Enter"){ e.preventDefault(); btnAddDealer?.click(); } };
      }
    }catch(_){ }

    document.getElementById("copyDebug").onclick = async ()=>{
      await copyTextWithFeedback(getDebugInfo(), "Debug copied");
    };

    document.getElementById("refreshApp").onclick = async ()=>{
      await forceRefreshApp();
    };

    document.getElementById("resetData").onclick = ()=>{
      const typed = prompt('Type DELETE to permanently erase ALL trips and lists on this device.');
      if(typed !== "DELETE") return;
      setState({ trips: [], areas: [], dealers: [], filter: "YTD", view: "home", settings: {} });
      saveState();
      render();
    };
  }

  return { renderListMgmtPanel, bindListMgmtHandlers };
}
