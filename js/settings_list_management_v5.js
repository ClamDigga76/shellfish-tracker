export function createSettingsListManagement(deps){
  const {
    getState,
    setState,
    saveState,
    getApp,
    ensureAreas,
    ensureDealers,
    syncAreaState,
    addArea,
    countTripsForArea,
    deleteArea,
    protectedAreaName = "Area Not Recorded",
    normalizeKey,
    escapeHtml,
    showToast,
    copyTextWithFeedback,
    getDebugInfo,
    forceRefreshApp,
    render
  } = deps;
  const PROTECTED_AREA_NAME = String(protectedAreaName || "Area Not Recorded").trim();
  const PROTECTED_AREA_KEY = normalizeKey(PROTECTED_AREA_NAME);

  function isProtectedAreaName(rawAreaName){
    const areaKey = normalizeKey(String(rawAreaName || "").trim());
    return !!(areaKey && areaKey === PROTECTED_AREA_KEY);
  }

  function renderListMgmtPanel(mode){
    const state = getState();
    const m = String(mode || "areas").toLowerCase();
    if(!Array.isArray(state.areas)) state.areas = [];
    if(!Array.isArray(state.dealers)) state.dealers = [];

    const areaValues = Array.isArray(syncAreaState()) ? syncAreaState() : [];
    const editableAreaValues = areaValues.filter((areaName)=> !isProtectedAreaName(areaName));
    const areaRows2 = editableAreaValues.length ? editableAreaValues.map((areaName)=>`
      <div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-top:10px">
        <div style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(areaName)}</b></div>
        <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="smallbtn" data-rename-area-name="${escapeHtml(areaName)}" type="button">Rename</button>
          <button class="smallbtn danger" data-del-area-name="${escapeHtml(areaName)}" type="button">Delete</button>
        </div>
      </div>`).join("") : `<div class="emptyState compact" style="margin-top:10px"><div class="emptyStateTitle">No areas yet</div><div class="emptyStateBody">Add your first area below so New Trip choices are ready.</div></div>`;

    const dealerRows2 = state.dealers.length ? state.dealers.map((d, i)=>`
      <div class="row" style="justify-content:space-between;align-items:center;margin-top:10px">
        <div class="pill" style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${escapeHtml(d)}</b></div>
        <button class="smallbtn danger" data-del-dealer="${i}" type="button">Delete</button>
      </div>
    `).join("") : `<div class="emptyState compact" style="margin-top:10px"><div class="emptyStateTitle">No dealers yet</div><div class="emptyStateBody">Add your first dealer below so trip entry stays fast.</div></div>`;

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
          <input class="input" id="newArea" placeholder="Add area (ex: The Cove)" autocomplete="off" enterkeyhint="done" style="flex:1;min-width:180px" />
          <button class="btn primary" id="addArea" type="button">Add</button>
        </div>
        ${areaRows2}
      </div>
    `;
  }

  function getScroller(){
    return document.scrollingElement || document.documentElement || document.body;
  }


  function renameAreaInState(oldAreaName, nextAreaName){
    const state = getState();
    const oldName = String(oldAreaName || "").trim();
    const newName = String(nextAreaName || "").trim();
    if(!oldName || !newName) return { ok: false, reason: "invalid" };

    const oldKey = normalizeKey(oldName);
    const newKey = normalizeKey(newName);
    if(!oldKey || !newKey) return { ok: false, reason: "invalid" };
    if(oldKey === PROTECTED_AREA_KEY || newKey === PROTECTED_AREA_KEY) return { ok: false, reason: "protected" };
    if(oldKey === newKey) return { ok: false, reason: "same" };

    ensureAreas();
    const areas = Array.isArray(state.areas) ? state.areas : [];
    const oldIndex = areas.findIndex((area)=> normalizeKey(String(area || "")) === oldKey);
    if(oldIndex < 0) return { ok: false, reason: "missing" };
    const duplicate = areas.some((area, idx)=> idx !== oldIndex && normalizeKey(String(area || "")) === newKey);
    if(duplicate) return { ok: false, reason: "duplicate" };

    const canonicalOldName = String(areas[oldIndex] || oldName).trim();
    areas[oldIndex] = newName;

    const trips = Array.isArray(state.trips) ? state.trips : [];
    let updatedTrips = 0;
    for(let i = 0; i < trips.length; i += 1){
      const trip = trips[i];
      const tripArea = String(trip?.area || "").trim();
      if(!tripArea) continue;
      if(normalizeKey(tripArea) !== oldKey) continue;
      trips[i] = { ...trip, area: newName };
      updatedTrips += 1;
    }

    return { ok: true, from: canonicalOldName, to: newName, updatedTrips };
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
          const result = addArea(raw);
          if(!result?.value || result.created === false){ showToast("That area already exists"); return; }
          saveState();
          refreshListMgmt("areas", true);
          showToast("Area added");
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
          showToast("Dealer added");
        };
      }

      (getApp()?.querySelectorAll("button[data-rename-area-name]") || []).forEach((btn)=>{
        btn.onclick = ()=>{
          const areaName = String(btn.getAttribute("data-rename-area-name") || "").trim();
          if(!areaName){
            showToast("Area rename failed");
            return;
          }
          if(isProtectedAreaName(areaName)){
            showToast("Area is protected");
            return;
          }
          const typed = prompt(`Rename area "${areaName}" to:`, areaName);
          if(typed == null) return;
          const nextName = String(typed || "").trim();
          if(!nextName){
            showToast("Enter an area name");
            return;
          }
          if(nextName.length > 40){
            showToast("Keep it under 40 chars");
            return;
          }
          const result = renameAreaInState(areaName, nextName);
          if(!result?.ok){
            if(result?.reason === "protected"){
              showToast("Area is protected");
              return;
            }
            if(result?.reason === "same"){
              showToast("Area name is unchanged");
              return;
            }
            if(result?.reason === "duplicate"){
              showToast("That area already exists");
              return;
            }
            showToast("Area rename failed");
            return;
          }
          saveState();
          refreshListMgmt("areas", true);
          showToast(`Area renamed • Updated ${result.updatedTrips} trip(s)`);
        };
      });

      (getApp()?.querySelectorAll("button[data-del-area-name]") || []).forEach((btn)=>{
        btn.onclick = ()=>{
          const areaName = String(btn.getAttribute("data-del-area-name") || "");
          if(isProtectedAreaName(areaName)){
            showToast("Area is protected");
            return;
          }
          const tripCount = countTripsForArea(areaName);
          if(tripCount > 0){
            alert(`Can't delete area "${areaName}" yet. ${tripCount} trip(s) still use it.`);
            showToast("Area is used by saved trips");
            return;
          }
          if(!confirm(`Delete area "${areaName}"?`)) return;
          const result = deleteArea(areaName);
          if(!result?.ok){
            if(result?.reason === "protected"){
              showToast("Area is protected");
              return;
            }
            showToast("Area can't be deleted yet");
            return;
          }
          saveState();
          refreshListMgmt("areas", true);
          showToast("Area deleted");
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
          showToast("Dealer deleted");
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
      await copyTextWithFeedback(getDebugInfo(), "Support diagnostics copied");
    };

    document.getElementById("refreshApp").onclick = async ()=>{
      await forceRefreshApp();
    };

    document.getElementById("resetData").onclick = ()=>{
      const typed = prompt('Type DELETE to permanently erase ALL trips and lists on this device.');
      if(typed !== "DELETE") { showToast("Erase canceled"); return; }
      setState({ trips: [], areas: [], dealers: [], filter: "YTD", view: "home", settings: {} });
      saveState();
      showToast("All data erased");
      render();
    };
  }

  return { renderListMgmtPanel, bindListMgmtHandlers };
}
