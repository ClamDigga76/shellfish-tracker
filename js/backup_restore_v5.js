export function createBackupRestoreSubsystem(deps){
  const {
    getState,
    saveState,
    ensureAreas,
    ensureDealers,
    SCHEMA_VERSION,
    APP_VERSION,
    VERSION,
    LS_LAST_BACKUP_META,
    formatDateDMY,
    downloadText,
    uid,
    normalizeKey,
    likelyDuplicate,
    to2,
    openModal,
    closeModal,
    escapeHtml,
    announce
  } = deps;

  function buildBackupPayloadFromState(st, exportedAtISO){
    const safeState = (st && typeof st === "object") ? st : {};
    const trips = Array.isArray(safeState.trips) ? safeState.trips : [];
    const areas = Array.isArray(safeState.areas) ? safeState.areas : [];
    const dealers = Array.isArray(safeState.dealers) ? safeState.dealers : [];
    return {
      app: "Bank the Catch",
      schema: SCHEMA_VERSION, // legacy
      schemaVersion: SCHEMA_VERSION,
      version: APP_VERSION, // legacy
      appVersion: APP_VERSION,
      exportedAt: exportedAtISO || new Date().toISOString(),
      backupMeta: {
        tripCount: trips.length,
        areaCount: areas.length,
        dealerCount: dealers.length,
        createdBy: "Bank the Catch"
      },
      data: {
        trips,
        areas,
        dealers,
        settings: (safeState.settings && typeof safeState.settings === "object") ? safeState.settings : {}
      }
    };
  }

  function __ymdLocal(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function __buildNum(){
    const m = /v5\.(\d+)/.exec(String(VERSION||""));
    return m ? m[1] : "0";
  }

  function __backupFilename(){
    return `bank-the-catch_backup_${__ymdLocal()}_build${__buildNum()}.json`;
  }

  function __setLastBackupMeta(meta){
    try{
      localStorage.setItem(LS_LAST_BACKUP_META, JSON.stringify(meta));
    }catch(_){ }
  }

  function __getLastBackupMeta(){
    try{
      const raw = localStorage.getItem(LS_LAST_BACKUP_META);
      if(raw){
        const obj = JSON.parse(raw);
        if(obj && typeof obj === "object") return obj;
      }
    }catch(_){ }

    try{
      const s = getState()?.settings;
      const at = Number(s?.lastBackupAt || 0);
      const tc = Number(s?.lastBackupTripCount ?? (Array.isArray(getState()?.trips) ? getState().trips.length : 0));
      if(at > 0){
        return { iso: new Date(at).toISOString(), tripCount: tc, build: __buildNum() };
      }
    }catch(_){ }

    return null;
  }

  function updateLastBackupLine(){
    const el = document.getElementById("lastBackupLine");
    if(!el) return;
    const meta = __getLastBackupMeta();
    if(!meta){
      el.textContent = "Last backup: none yet";
      return;
    }
    const d = new Date(String(meta.iso || ""));
    const ok = !isNaN(d.getTime());
    const dateStr = ok ? (formatDateDMY(d) || "unknown date") : "unknown date";
    const n = Number(meta.tripCount);
    const tripsStr = Number.isFinite(n) ? `${n} trip${n===1?"":"s"}` : "unknown trips";
    el.textContent = `Last backup: ${dateStr} — ${tripsStr}`;
  }

  function downloadBackupPayload(payload, prefixOrFilename="shellfish_backup"){
    const s = String(prefixOrFilename||"shellfish_backup");
    if(/\.json$/i.test(s)){
      downloadText(s, JSON.stringify(payload, null, 2));
      return;
    }
    const y = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    const fname = `${s}_${y.getFullYear()}-${pad(y.getMonth()+1)}-${pad(y.getDate())}_${pad(y.getHours())}${pad(y.getMinutes())}.json`;
    downloadText(fname, JSON.stringify(payload, null, 2));
  }

  async function exportBackup(){
    const state = getState();
    const exportedAtISO = new Date().toISOString();
    const payload = buildBackupPayloadFromState(state, exportedAtISO);
    const tripCount = Array.isArray(payload?.data?.trips) ? payload.data.trips.length : (Array.isArray(state.trips) ? state.trips.length : 0);
    const fname = __backupFilename();

    try{
      state.settings = state.settings || {};
      state.settings.lastBackupAt = Date.now();
      state.settings.lastBackupTripCount = tripCount;
      saveState();
    }catch(_){ }
    __setLastBackupMeta({ iso: exportedAtISO, tripCount, build: __buildNum(), filename: fname });

    try{
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const file = new File([blob], fname, { type: "application/json" });
      const canShareFiles = !!(navigator?.canShare && navigator.canShare({ files: [file] }));
      if(canShareFiles && navigator?.share){
        await navigator.share({ files: [file], title: "Bank the Catch backup" });
        try{ updateLastBackupLine(); }catch(_){ }
        return { ok:true, method:"share", filename: fname, tripCount };
      }
    }catch(_){ }

    try{
      downloadBackupPayload(payload, fname);
      try{ updateLastBackupLine(); }catch(_){ }
      return { ok:true, method:"download", filename: fname, tripCount };
    }catch(e){
      return { ok:false, error: e };
    }
  }

  function normalizeBackupPayload(raw){
    const obj = (raw && typeof raw === "object") ? raw : null;
    if(!obj) return { ok:false, errors:["Backup file is not valid JSON object"], warnings:[], normalized:null };

    const schemaVersion = Number(obj.schemaVersion ?? obj.schema ?? 0) || 0;
    const appVersion = String(obj.appVersion ?? obj.version ?? "");
    const exportedAt = String(obj.exportedAt || "");
    const backupMeta = (obj.backupMeta && typeof obj.backupMeta === "object") ? obj.backupMeta : {};
    const data = (obj.data && typeof obj.data === "object") ? obj.data : obj;

    const trips = Array.isArray(data.trips) ? data.trips : [];
    const areas = Array.isArray(data.areas) ? data.areas : [];
    const dealers = Array.isArray(data.dealers) ? data.dealers : [];
    const settings = (data.settings && typeof data.settings === "object") ? data.settings : {};

    const normalized = { schemaVersion, appVersion, exportedAt, backupMeta, data:{ trips, areas, dealers, settings } };
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

    if(normalized.schemaVersion <= 0) warnings.push("Backup schema version was not set; importing with compatibility mode.");
    if(!String(normalized.appVersion || "").trim()) warnings.push("Backup build/version is missing.");

    const exportedAt = String(normalized.exportedAt || "").trim();
    if(exportedAt){
      const exportedDate = new Date(exportedAt);
      if(isNaN(exportedDate.getTime())) warnings.push("Export date was unreadable.");
    }else{
      warnings.push("Export date was not included.");
    }

    if(Array.isArray(data.trips) && data.trips.length > 20000){
      warnings.push(`Large backup (${data.trips.length} trips) may be slow to import on mobile`);
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

  function readTextFile(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onerror = ()=> reject(new Error("Failed to read backup file"));
      reader.onload = ()=> resolve(String(reader.result || ""));
      reader.readAsText(file);
    });
  }

  function __formatFileSize(bytes){
    const n = Number(bytes);
    if(!Number.isFinite(n) || n <= 0) return "unknown size";
    if(n < 1024) return `${n} B`;
    if(n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function parseBackupFileForRestore(file){
    return readTextFile(file).then((txt)=>{
      let raw;
      try{ raw = JSON.parse(txt); }
      catch(e){ throw new Error(`Invalid JSON: ${String(e?.message || e || "Parse failed")}`); }

      const normalizedResult = normalizeBackupPayload(raw);
      if(!normalizedResult.ok) throw new Error(normalizedResult.errors.join("\n"));

      const obj = (raw && typeof raw === "object") ? raw : {};
      const data = (obj.data && typeof obj.data === "object") ? obj.data : obj;
      const normalized = normalizedResult.normalized;
      const warnings = [...(normalizedResult.warnings || [])];

      if(String(obj.app || "").trim() && String(obj.app).trim() !== "Bank the Catch"){
        warnings.push(`Backup app label was "${String(obj.app).trim()}".`);
      }

      if(!(obj.data && typeof obj.data === "object")){
        warnings.push("Legacy backup shape detected (top-level data). Import remains compatible.");
      }

      const expectedKeys = ["trips", "areas", "dealers", "settings"];
      for(const key of expectedKeys){
        if(!(key in data)) warnings.push(`Missing key: data.${key}`);
      }

      const fileSize = Number(file?.size || 0);
      if(fileSize > 5 * 1024 * 1024){
        warnings.push(`Large file (${__formatFileSize(fileSize)}) may take longer to restore`);
      }

      return {
        fileName: String(file?.name || "backup.json"),
        fileSize,
        warnings: [...new Set(warnings)],
        normalizedResult,
        counts: {
          trips: Array.isArray(normalized?.data?.trips) ? normalized.data.trips.length : 0,
          areas: Array.isArray(normalized?.data?.areas) ? normalized.data.areas.length : 0,
          dealers: Array.isArray(normalized?.data?.dealers) ? normalized.data.dealers.length : 0
        },
        metadata: {
          exportedAt: String(normalized?.exportedAt || ""),
          appVersion: String(normalized?.appVersion || ""),
          schemaVersion: Number(normalized?.schemaVersion || 0) || 0,
          createdBy: String(normalized?.backupMeta?.createdBy || ""),
          sourceTripCount: Number(normalized?.backupMeta?.tripCount || 0) || 0
        },
        hasSettingsKey: ("settings" in data)
      };
    });
  }

  function __formatRestoreMetaDate(iso){
    const s = String(iso || "").trim();
    if(!s) return "unknown";
    const d = new Date(s);
    if(isNaN(d.getTime())) return "unknown";
    const day = formatDateDMY(d) || "unknown";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${hh}:${mm}`;
  }

  function openRestorePreviewModal(preview){
    return new Promise((resolve)=>{
      const uidBase = uid("restorePreview");
      const modeMergeId = `${uidBase}_mode_merge`;
      const modeReplaceId = `${uidBase}_mode_replace`;
      const includeSettingsId = `${uidBase}_include_settings`;
      const replaceConfirmId = `${uidBase}_replace_confirm`;
      const cancelId = `${uidBase}_cancel`;
      const continueId = `${uidBase}_continue`;

      const warningHtml = (preview.warnings && preview.warnings.length)
        ? `<div class="modalErr" style="display:block;margin-top:10px"><b>Warnings</b><ul style="margin:8px 0 0 16px;padding:0">${preview.warnings.map(w=>`<li>${escapeHtml(String(w || ""))}</li>`).join("")}</ul></div>`
        : `<div class="muted small mt10">No validation warnings.</div>`;

      const counts = preview.counts || {};
      openModal({
        title: "Restore Preview",
        backdropClose: false,
        escClose: false,
        showCloseButton: false,
        position: "center",
        html: `
          <div class="muted small">File: <b>${escapeHtml(preview.fileName || "backup.json")}</b> (${escapeHtml(__formatFileSize(preview.fileSize))})</div>
          <div class="sep" style="margin:10px 0"></div>
          <div class="muted small">Contents</div>
          <div class="mt8" style="display:grid;gap:6px">
            <div class="row" style="justify-content:space-between"><span class="muted">Trips</span><b>${escapeHtml(String(counts.trips || 0))}</b></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Areas</span><b>${escapeHtml(String(counts.areas || 0))}</b></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Dealers</span><b>${escapeHtml(String(counts.dealers || 0))}</b></div>
          </div>
          <div class="muted small" style="margin-top:8px">This restore imports trips plus area/dealer lists from this file.</div>
          <div class="sep" style="margin:10px 0"></div>
          <div class="muted small">Metadata</div>
          <div class="mt8" style="display:grid;gap:6px">
            <div class="row" style="justify-content:space-between"><span class="muted">Exported</span><b>${escapeHtml(__formatRestoreMetaDate(preview?.metadata?.exportedAt))}</b></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Build/Version</span><b>${escapeHtml(String(preview?.metadata?.appVersion || "unknown"))}</b></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Schema</span><b>${escapeHtml(String(preview?.metadata?.schemaVersion || "unknown"))}</b></div>
          </div>
          ${warningHtml}
          <div class="sep" style="margin:10px 0"></div>
          <div class="muted small" style="margin-bottom:6px">Restore mode</div>
          <label class="row" style="gap:8px;align-items:flex-start">
            <input id="${modeMergeId}" type="radio" name="${uidBase}_restore_mode" value="merge" checked />
            <span>Merge (recommended): keep existing data and skip likely duplicates.</span>
          </label>
          <label class="row" style="gap:8px;align-items:flex-start;margin-top:6px">
            <input id="${modeReplaceId}" type="radio" name="${uidBase}_restore_mode" value="replace" />
            <span>Replace: overwrite current trips/lists with this backup.</span>
          </label>
          <label class="row" style="gap:8px;align-items:flex-start;margin-top:10px">
            <input id="${includeSettingsId}" type="checkbox" />
            <span>Also import settings from backup (off by default).</span>
          </label>
          <label class="row" id="${replaceConfirmId}_row" style="gap:8px;align-items:flex-start;margin-top:10px;display:none">
            <input id="${replaceConfirmId}" type="checkbox" />
            <span>I understand Replace removes current trips and list entries on this device before importing this backup.</span>
          </label>
          <div class="modalActions" style="margin-top:12px">
            <button class="btn" id="${cancelId}" type="button">Cancel</button>
            <button class="btn primary" id="${continueId}" type="button">Continue</button>
          </div>
        `,
        onOpen: ()=>{
          const replaceEl = document.getElementById(modeReplaceId);
          const mergeEl = document.getElementById(modeMergeId);
          const replaceConfirmEl = document.getElementById(replaceConfirmId);
          const replaceConfirmRow = document.getElementById(`${replaceConfirmId}_row`);
          const continueBtn = document.getElementById(continueId);

          const syncReplaceGuard = ()=>{
            const replaceChecked = !!replaceEl?.checked;
            if(replaceConfirmRow) replaceConfirmRow.style.display = replaceChecked ? "flex" : "none";
            if(replaceConfirmEl && !replaceChecked) replaceConfirmEl.checked = false;
            if(continueBtn){
              const safeToContinue = !replaceChecked || !!replaceConfirmEl?.checked;
              continueBtn.disabled = !safeToContinue;
              continueBtn.setAttribute("aria-disabled", safeToContinue ? "false" : "true");
            }
          };

          replaceEl?.addEventListener("change", syncReplaceGuard);
          mergeEl?.addEventListener("change", syncReplaceGuard);
          replaceConfirmEl?.addEventListener("change", syncReplaceGuard);
          syncReplaceGuard();

          const cancel = ()=>{ closeModal(); resolve(null); };
          document.getElementById(cancelId)?.addEventListener("click", cancel);
          document.getElementById(continueId)?.addEventListener("click", ()=>{
            const replaceChecked = !!document.getElementById(modeReplaceId)?.checked;
            const includeSettings = !!document.getElementById(includeSettingsId)?.checked;
            closeModal();
            resolve({ mode: replaceChecked ? "replace" : "merge", includeSettings });
          });
        }
      });
    });
  }

  function openReplaceSafetyBackupModal(){
    return new Promise((resolve)=>{
      const uidBase = uid("safetyBackup");
      const createId = `${uidBase}_create`;
      const skipId = `${uidBase}_skip`;
      const cancelId = `${uidBase}_cancel`;
      const errId = `${uidBase}_err`;

      openModal({
        title: "Create Safety Backup of current data first?",
        backdropClose: false,
        escClose: false,
        showCloseButton: false,
        position: "center",
        html: `
          <div class="muted small">Recommended before Replace restore mode.</div>
          <div class="modalErr" id="${errId}" style="display:none;margin-top:10px"></div>
          <div class="modalActions" style="margin-top:12px">
            <button class="btn" id="${cancelId}" type="button">Cancel</button>
            <button class="btn" id="${skipId}" type="button">Skip</button>
            <button class="btn primary" id="${createId}" type="button">Create Backup</button>
          </div>
        `,
        onOpen: ()=>{
          const errEl = document.getElementById(errId);
          const showErr = (msg)=>{
            if(!errEl) return;
            errEl.textContent = String(msg || "");
            errEl.style.display = "block";
          };

          document.getElementById(cancelId)?.addEventListener("click", ()=>{ closeModal(); resolve("cancel"); });
          document.getElementById(skipId)?.addEventListener("click", ()=>{ closeModal(); resolve("skip"); });
          document.getElementById(createId)?.addEventListener("click", ()=>{
            try{
              const safetyPayload = buildBackupPayloadFromState(getState());
              downloadBackupPayload(safetyPayload, "shellfish_safety_before_restore");
              closeModal();
              resolve("created");
            }catch(e){
              showErr(`Backup failed: ${String(e?.message || e || "Unknown error")}`);
            }
          });
        }
      });
    });
  }

  function openRestoreErrorModal(err){
    return new Promise((resolve)=>{
      const uidBase = uid("restoreErr");
      const closeId = `${uidBase}_ok`;
      const reason = String(err?.message || err || "Unknown restore error");

      announce("Restore failed. Open details for more information.", "assertive");

      openModal({
        title: "Restore failed",
        backdropClose: false,
        escClose: false,
        showCloseButton: false,
        position: "center",
        html: `
          <div class="muted small">We could not restore this backup file.</div>
          <details style="margin-top:10px">
            <summary class="muted small">Details</summary>
            <div class="muted small preWrap" style="margin-top:8px">${escapeHtml(reason)}</div>
          </details>
          <div class="modalActions" style="margin-top:12px">
            <button class="btn primary" id="${closeId}" type="button">OK</button>
          </div>
        `,
        onOpen: ()=>{
          document.getElementById(closeId)?.addEventListener("click", ()=>{ closeModal(); resolve(); });
        }
      });
    });
  }

  function normalizeTripForImport(t){
    const o = (t && typeof t === "object") ? t : {};
    const id = String(o.id || "").trim() || uid("t");
    const dateISO = String(o.dateISO || o.date || "").trim();
    const dealer = String(o.dealer || "").trim();
    const area = String(o.area || "").trim();
    const pounds = Number(o.pounds);
    const amount = Number(o.amount);
    const species = String(o.species || "Soft-shell Clams").trim() || "Soft-shell Clams";
    const notes = String(o.notes || "");
    return {
      ...o,
      id,
      dateISO,
      dealer,
      area,
      species,
      notes,
      pounds: Number.isFinite(pounds) ? pounds : 0,
      amount: Number.isFinite(amount) ? amount : 0,
    };
  }

  async function importBackupFromFile(file, opts={}){
    const state = getState();
    const parsed = opts?.parsedBackup || await parseBackupFileForRestore(file);
    const normalizedResult = parsed?.normalizedResult;
    const normalized = normalizedResult?.normalized;
    if(!normalized || !normalized.data){
      throw new Error("Backup parse failed");
    }

    const mode = String(opts?.mode || (opts?.forceOverwrite ? "replace" : "merge")).toLowerCase();
    const replace = mode === "replace";
    const includeSettings = !!opts?.includeSettings;

    const tripsIn = normalized.data.trips;
    const areasIn = normalized.data.areas;
    const dealersIn = normalized.data.dealers;
    const settingsIn = normalized.data.settings;

    const importedTrips = tripsIn.map(normalizeTripForImport).filter(t=>t.dateISO || t.dealer || t.amount || t.pounds);
    const importedAreas = areasIn.map(a=>String(a||"").trim()).filter(Boolean);
    const importedDealers = dealersIn.map(d=>String(d||"").trim()).filter(Boolean);

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

    const existingSettings = (state.settings && typeof state.settings === "object") ? { ...state.settings } : {};
    if(includeSettings){
      if(replace){
        state.settings = (settingsIn && typeof settingsIn === "object") ? { ...settingsIn } : {};
      }else{
        const importedSettings = (settingsIn && typeof settingsIn === "object") ? settingsIn : {};
        state.settings = { ...existingSettings, ...importedSettings };
      }
    }else{
      state.settings = existingSettings;
    }

    ensureAreas();
    ensureDealers();
    saveState();

    return {
      mode: replace ? "replace" : "merge",
      includeSettings,
      tripsInFile: importedTrips.length,
      tripsAdded: replace ? importedTrips.length : added,
      areasInFile: importedAreas.length,
      dealersInFile: importedDealers.length,
      warnings: normalizedResult?.warnings || []
    };
  }

  return {
    buildBackupPayloadFromState,
    updateLastBackupLine,
    downloadBackupPayload,
    exportBackup,
    parseBackupFileForRestore,
    openRestorePreviewModal,
    openReplaceSafetyBackupModal,
    openRestoreErrorModal,
    importBackupFromFile
  };
}
