export function createBackupRestoreSubsystem(deps){
  const {
    getState,
    saveState,
    ensureAreas,
    ensureDealers,
    SCHEMA_VERSION,
    APP_VERSION,
    LS_LAST_BACKUP_META,
    LS_RESTORE_ROLLBACK_SNAPSHOT,
    formatDateDMY,
    downloadText,
    uid,
    normalizeKey,
    likelyDuplicate,
    to2,
    openModal,
    closeModal,
    escapeHtml,
    announce,
    normalizeTrip,
    appendTripHistoryEvent
  } = deps;



  function __cloneData(value){
    if(typeof structuredClone === "function") {
      try{ return structuredClone(value); }catch(_){ }
    }
    try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; }
  }

  function __readJSONLocal(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    }catch(_){
      return null;
    }
  }

  function __writeJSONLocal(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
  function __generateBackupId(){
    const fromUid = (typeof uid === "function") ? String(uid()).trim() : "";
    if(fromUid) return `btc-${fromUid}`;
    return `btc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function __sanitizeBackupSettings(settings){
    const safeSettings = (settings && typeof settings === "object") ? __cloneData(settings) : {};
    delete safeSettings.listMgmtLastError;
    delete safeSettings.migratedAt;
    delete safeSettings.migratedFrom;
    if(safeSettings.quickChips && typeof safeSettings.quickChips === "object"){
      delete safeSettings.quickChips.areaPinnedCustom;
      delete safeSettings.quickChips.dealerPinnedCustom;
    }
    return safeSettings;
  }

  function buildBackupPayloadFromState(st, exportedAtISO, backupId){
    const safeState = (st && typeof st === "object") ? st : {};
    const trips = Array.isArray(safeState.trips) ? safeState.trips : [];
    const areas = Array.isArray(safeState.areas) ? safeState.areas : [];
    const dealers = Array.isArray(safeState.dealers) ? safeState.dealers : [];
    const deletedTrips = Array.isArray(safeState.deletedTrips) ? safeState.deletedTrips : [];
    const safeBackupId = String(backupId || __generateBackupId());
    return {
      app: "Bank the Catch",
      schema: SCHEMA_VERSION, // legacy
      schemaVersion: SCHEMA_VERSION,
      version: APP_VERSION, // legacy
      appVersion: APP_VERSION,
      backupId: safeBackupId,
      exportedAt: exportedAtISO || new Date().toISOString(),
      backupMeta: {
        backupId: safeBackupId,
        tripCount: trips.length,
        areaCount: areas.length,
        dealerCount: dealers.length,
        deletedTripCount: deletedTrips.length,
        createdBy: "Bank the Catch"
      },
      data: {
        trips,
        areas,
        dealers,
        deletedTrips,
        settings: __sanitizeBackupSettings(safeState.settings)
      }
    };
  }

  function __ymdLocal(dateLike){
    const d = (dateLike && !Number.isNaN(new Date(dateLike).getTime())) ? new Date(dateLike) : new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function __tripCountLabel(tripCount){
    const n = Number.isFinite(Number(tripCount)) ? Math.max(0, Number(tripCount)) : 0;
    return n === 1 ? "1-trip" : `${n}-trips`;
  }

  function __backupFilename({ exportedAtISO, tripCount }={}){
    return `Bank-the-Catch-Backup-${__ymdLocal(exportedAtISO)}-${__tripCountLabel(tripCount)}.json`;
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
        return { iso: new Date(at).toISOString(), tripCount: tc };
      }
    }catch(_){ }

    return null;
  }

  function buildRestoreRollbackSnapshotMeta(snapshot){
    const snap = (snapshot && typeof snapshot === "object") ? snapshot : null;
    if(!snap || !snap.payload || typeof snap.payload !== "object") return null;
    const payload = snap.payload;
    const trips = Array.isArray(payload.trips) ? payload.trips : [];
    const areas = Array.isArray(payload.areas) ? payload.areas : [];
    const dealers = Array.isArray(payload.dealers) ? payload.dealers : [];
    return {
      createdAt: String(snap.createdAt || ""),
      mode: String(snap.mode || "merge"),
      includeSettings: !!snap.includeSettings,
      sourceFileName: String(snap.sourceFileName || ""),
      appVersion: String(snap.appVersion || APP_VERSION || ""),
      schemaVersion: Number(snap.schemaVersion || SCHEMA_VERSION || 0) || 0,
      tripCount: trips.length,
      areaCount: areas.length,
      dealerCount: dealers.length,
      deletedTripCount: Array.isArray(payload.deletedTrips) ? payload.deletedTrips.length : 0
    };
  }

  function getRestoreRollbackSnapshot(){
    const snapshot = __readJSONLocal(LS_RESTORE_ROLLBACK_SNAPSHOT);
    return buildRestoreRollbackSnapshotMeta(snapshot) ? snapshot : null;
  }

  function getRestoreRollbackSnapshotMeta(){
    return buildRestoreRollbackSnapshotMeta(getRestoreRollbackSnapshot());
  }

  function clearRestoreRollbackSnapshot(){
    try{ localStorage.removeItem(LS_RESTORE_ROLLBACK_SNAPSHOT); }catch(_){ }
  }

  function clearBackupRecoveryMetadata(){
    try{ localStorage.removeItem(LS_LAST_BACKUP_META); }catch(_){ }
    clearRestoreRollbackSnapshot();
  }

  function capturePreRestoreRollbackSnapshot({ mode="merge", includeSettings=false, sourceFileName="" }={}){
    const state = getState();
    const payload = buildBackupPayloadFromState(state, new Date().toISOString()).data;
    const snapshot = {
      kind: "restore-rollback-snapshot",
      createdAt: new Date().toISOString(),
      mode: String(mode || "merge"),
      includeSettings: !!includeSettings,
      sourceFileName: String(sourceFileName || ""),
      appVersion: APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      payload: {
        trips: __cloneData(Array.isArray(payload?.trips) ? payload.trips : []),
        areas: __cloneData(Array.isArray(payload?.areas) ? payload.areas : []),
        dealers: __cloneData(Array.isArray(payload?.dealers) ? payload.dealers : []),
        deletedTrips: __cloneData(Array.isArray(payload?.deletedTrips) ? payload.deletedTrips : []),
        settings: __cloneData((payload?.settings && typeof payload.settings === "object") ? payload.settings : {})
      }
    };
    __writeJSONLocal(LS_RESTORE_ROLLBACK_SNAPSHOT, snapshot);
    return buildRestoreRollbackSnapshotMeta(snapshot);
  }

  function restoreFromRollbackSnapshot(){
    const snapshot = getRestoreRollbackSnapshot();
    const meta = buildRestoreRollbackSnapshotMeta(snapshot);
    if(!snapshot || !meta) throw new Error("No restore rollback snapshot is available.");

    const payload = snapshot.payload || {};
    const nextSettings = (payload.settings && typeof payload.settings === "object") ? __cloneData(payload.settings) : {};
    const state = getState();
    state.trips = __cloneData(Array.isArray(payload.trips) ? payload.trips : []);
    state.areas = __cloneData(Array.isArray(payload.areas) ? payload.areas : []);
    state.dealers = __cloneData(Array.isArray(payload.dealers) ? payload.dealers : []);
    state.deletedTrips = __cloneData(Array.isArray(payload.deletedTrips) ? payload.deletedTrips : []);
    state.settings = nextSettings;
    state.trips = Array.isArray(state.trips) ? state.trips.map((trip)=>normalizeTrip(trip)).filter(Boolean) : [];
    ensureAreas();
    ensureDealers();
    saveState();
    clearRestoreRollbackSnapshot();
    return meta;
  }

  function updateRestoreRollbackLine(){
    const el = document.getElementById("restoreRollbackLine");
    const btn = document.getElementById("restoreRollbackBtn");
    const meta = getRestoreRollbackSnapshotMeta();
    if(btn){
      btn.disabled = !meta;
      btn.setAttribute("aria-disabled", meta ? "false" : "true");
      btn.hidden = !meta;
    }
    if(!el) return;
    if(!meta){
      el.textContent = "Temporary restore rollback snapshot: none yet.";
      return;
    }
    const stamp = __formatRestoreMetaDate(meta.createdAt);
    const modeLabel = meta.mode === "replace" ? "Replace" : "Merge";
    const filePart = meta.sourceFileName ? ` from ${meta.sourceFileName}` : "";
    el.textContent = `Temporary rollback snapshot ready: ${stamp} before ${modeLabel}${filePart} (${meta.tripCount} trips, ${meta.areaCount} areas, ${meta.dealerCount} dealers).`;
  }

  function getBackupHealthState(){
    const safeState = getState();
    const tripCount = Array.isArray(safeState?.trips) ? safeState.trips.length : 0;
    const meta = __getLastBackupMeta();
    const backedUpTripCount = Number(meta?.tripCount);
    const hasBackup = !!meta;
    const hasTrips = tripCount > 0;
    const backupCoversCurrentTrips = hasBackup && Number.isFinite(backedUpTripCount) && backedUpTripCount >= tripCount;

    if(!hasTrips){
      return {
        tone: "quiet",
        code: "quiet-no-trips",
        visible: false,
        currentTripCount: tripCount,
        backedUpTripCount: Number.isFinite(backedUpTripCount) ? backedUpTripCount : 0,
        message: ""
      };
    }

    if(!hasBackup){
      return {
        tone: "warning",
        code: "missing-backup",
        visible: true,
        currentTripCount: tripCount,
        backedUpTripCount: 0,
        message: `Backup recommended: this device has ${tripCount} saved trip${tripCount === 1 ? "" : "s"}, but no backup yet.`
      };
    }

    if(!backupCoversCurrentTrips){
      const safeBackedUpTrips = Number.isFinite(backedUpTripCount) ? Math.max(0, backedUpTripCount) : 0;
      const tripsAhead = Math.max(1, tripCount - safeBackedUpTrips);
      return {
        tone: "stale",
        code: "backup-stale",
        visible: true,
        currentTripCount: tripCount,
        backedUpTripCount: safeBackedUpTrips,
        message: `Backup may be outdated: this device has ${tripCount} saved trips, but the latest backup only covers ${safeBackedUpTrips}. ${tripsAhead} newer trip${tripsAhead === 1 ? "" : "s"} may not be protected.`
      };
    }

    return {
      tone: "healthy",
      code: "backup-current",
      visible: false,
      currentTripCount: tripCount,
      backedUpTripCount,
      message: ""
    };
  }

  function updateBackupHealthWarning(){
    const lane = document.getElementById("backupHealthLane");
    if(!lane) return getBackupHealthState();
    const health = getBackupHealthState();
    lane.hidden = !health.visible;
    lane.className = `settingsBackupHealth settingsBackupHealth--${health.tone}`;
    lane.textContent = health.visible ? health.message : "";
    lane.setAttribute("aria-hidden", health.visible ? "false" : "true");
    return health;
  }

  function updateLastBackupLine(){
    const el = document.getElementById("lastBackupLine");
    if(!el) return;
    const meta = __getLastBackupMeta();
    if(!meta){
      el.textContent = "Last backup: none yet • Your saved trips stay only on this device until you create one.";
      return;
    }
    const d = new Date(String(meta.iso || ""));
    const ok = !isNaN(d.getTime());
    const dateStr = ok ? (formatDateDMY(d) || "unknown date") : "unknown date";
    const n = Number(meta.tripCount);
    const tripsStr = Number.isFinite(n) ? `${n} trip${n===1?"":"s"}` : "unknown trips";
    let freshness = "";
    if(ok){
      const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
      freshness = days <= 0 ? "today" : (days === 1 ? "1 day ago" : `${days} days ago`);
    }
    el.textContent = `Last backup: ${dateStr}${freshness ? ` (${freshness})` : ""} — ${tripsStr}`;
  }

  function downloadBackupPayload(payload, prefixOrFilename="bank-the-catch_backup"){
    const s = String(prefixOrFilename||"bank-the-catch_backup");
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
    const backupId = __generateBackupId();
    const payload = buildBackupPayloadFromState(state, exportedAtISO, backupId);
    const tripCount = Array.isArray(payload?.data?.trips) ? payload.data.trips.length : (Array.isArray(state.trips) ? state.trips.length : 0);
    const fname = __backupFilename({ exportedAtISO: payload.exportedAt, tripCount });
    let shareWasCanceled = false;
    let shareCancelError = null;
    const commitSuccessfulExport = (method)=>{
      try{
        state.settings = state.settings || {};
        state.settings.lastBackupAt = Date.now();
        state.settings.lastBackupTripCount = tripCount;
        saveState();
      }catch(_){ }
      __setLastBackupMeta({ iso: exportedAtISO, tripCount, backupId, filename: fname });
      try{ updateLastBackupLine(); }catch(_){ }
      try{ updateBackupHealthWarning(); }catch(_){ }
      return { ok:true, method, filename: fname, tripCount };
    };

    try{
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const file = new File([blob], fname, { type: "application/json" });
      const canShareFiles = !!(navigator?.canShare && navigator.canShare({ files: [file] }));
      if(canShareFiles && navigator?.share){
        await navigator.share({ files: [file] });
        return commitSuccessfulExport("share");
      }
    }catch(shareErr){
      const shareCancelled = String(shareErr?.name || "").toLowerCase() === "aborterror";
      if(shareCancelled){
        shareWasCanceled = true;
        shareCancelError = shareErr;
      }
    }

    try{
      downloadBackupPayload(payload, fname);
      return commitSuccessfulExport("download");
    }catch(e){
      if(shareWasCanceled){
        return { ok:false, reason:"share-canceled", error: shareCancelError, fallbackError: e };
      }
      return { ok:false, error: e };
    }
  }

  function normalizeBackupPayload(raw){
    const obj = (raw && typeof raw === "object") ? raw : null;
    if(!obj) return { ok:false, errors:["Backup file must contain a JSON object at the top level."], warnings:[], normalized:null };

    const schemaVersion = Number(obj.schemaVersion ?? obj.schema ?? 0) || 0;
    const appVersion = String(obj.appVersion ?? obj.version ?? "");
    const exportedAt = String(obj.exportedAt || "");
    const backupMeta = (obj.backupMeta && typeof obj.backupMeta === "object") ? __cloneData(obj.backupMeta) : {};
    const backupId = String(obj.backupId ?? backupMeta.backupId ?? "").trim();
    if(backupId && !String(backupMeta.backupId || "").trim()) backupMeta.backupId = backupId;
    const data = (obj.data && typeof obj.data === "object") ? obj.data : obj;

    const trips = Array.isArray(data.trips) ? data.trips : [];
    const areas = Array.isArray(data.areas) ? data.areas : [];
    const dealers = Array.isArray(data.dealers) ? data.dealers : [];
    const settings = (data.settings && typeof data.settings === "object") ? data.settings : {};
    const deletedTrips = Array.isArray(data.deletedTrips) ? data.deletedTrips : [];
    const normalized = { schemaVersion, appVersion, exportedAt, backupId, backupMeta, data:{ trips, areas, dealers, deletedTrips, settings } };
    const { errors, warnings } = validateNormalizedBackupPayload(normalized);
    return { ok: errors.length === 0, errors, warnings, normalized };
  }

  function validateNormalizedBackupPayload(normalized){
    const errors = [];
    const warnings = [];
    if(!normalized || typeof normalized !== "object"){
      errors.push("Backup validation failed.");
      return { errors, warnings };
    }
    const data = normalized.data;
    if(!data || typeof data !== "object"){
      errors.push("Backup is missing a readable data section.");
      return { errors, warnings };
    }

    if(!Array.isArray(data.trips)) errors.push("Backup trips must be an array.");
    if(!Array.isArray(data.areas)) errors.push("Backup areas must be an array.");
    if(data.settings && typeof data.settings !== "object") errors.push("Backup settings must be an object.");
    if(!Array.isArray(data.dealers)) errors.push("Backup dealers must be an array.");
    if(!Array.isArray(data.deletedTrips)) errors.push("Backup deleted trips must be an array.");

    if(normalized.schemaVersion <= 0) warnings.push("Backup schema version is missing; restore will use compatibility mode.");
    if(!String(normalized.appVersion || "").trim()) warnings.push("Backup build/version is missing.");

    const exportedAt = String(normalized.exportedAt || "").trim();
    if(exportedAt){
      const exportedDate = new Date(exportedAt);
      if(isNaN(exportedDate.getTime())) warnings.push("Export date could not be read.");
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

  function classifyRestoreError(err){
    const reason = String(err?.message || err || "Unknown restore error").trim();
    const r = reason.toLowerCase();
    if(r.includes("invalid json") || r.includes("unexpected token")){
      return {
        heading: "This Bank the Catch backup file could not be read as JSON.",
        tips: [
          "Confirm you selected a Bank the Catch backup file.",
          "Try opening the file in Files/Drive to make sure it is not empty or truncated."
        ]
      };
    }
    if(r.includes("must be an array") || r.includes("must be an object") || r.includes("missing")){
      return {
        heading: "This Bank the Catch backup file is missing required sections or has incompatible structure.",
        tips: [
          "Use a complete backup exported from Bank the Catch.",
          "If this is a legacy backup, re-export from a known-good copy when possible."
        ]
      };
    }
    if(r.includes("failed to read backup file")){
      return {
        heading: "This Bank the Catch backup file could not be read from this device.",
        tips: [
          "Try selecting the file again from Files/Drive.",
          "If the file is in cloud storage, wait for download to finish, then retry."
        ]
      };
    }
    return {
      heading: "Bank the Catch could not finish restoring this backup file.",
      tips: [
        "Retry with the same file once.",
        "If it still fails, try another known-good backup file."
      ]
    };
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
      catch(e){ throw new Error(`Invalid JSON file content: ${String(e?.message || e || "Parse failed")}`); }

      const normalizedResult = normalizeBackupPayload(raw);
      if(!normalizedResult.ok) throw new Error(normalizedResult.errors.join("\n"));

      const obj = (raw && typeof raw === "object") ? raw : {};
      const data = (obj.data && typeof obj.data === "object") ? obj.data : obj;
      const normalized = normalizedResult.normalized;
      const warnings = [...(normalizedResult.warnings || [])];

      if(String(obj.app || "").trim() && String(obj.app).trim() !== "Bank the Catch"){
        warnings.push(`Backup app label was "${String(obj.app).trim()}" instead of "Bank the Catch".`);
      }

      if(!(obj.data && typeof obj.data === "object")){
        warnings.push("Legacy backup shape detected (top-level data). Import will continue in compatibility mode.");
      }

      const expectedKeys = ["trips", "areas", "dealers", "deletedTrips", "settings"];
      for(const key of expectedKeys){
        if(!(key in data)) warnings.push(`Missing key: data.${key} (using safe default).`);
      }

      const fileSize = Number(file?.size || 0);
      if(fileSize > 5 * 1024 * 1024){
        warnings.push(`Large file (${__formatFileSize(fileSize)}) may take longer to restore on mobile.`);
      }

      return {
        fileName: String(file?.name || "bank-the-catch_backup.json"),
        fileSize,
        warnings: [...new Set(warnings)],
        normalizedResult,
        counts: {
          trips: Array.isArray(normalized?.data?.trips) ? normalized.data.trips.length : 0,
          areas: Array.isArray(normalized?.data?.areas) ? normalized.data.areas.length : 0,
          dealers: Array.isArray(normalized?.data?.dealers) ? normalized.data.dealers.length : 0,
          deletedTrips: Array.isArray(normalized?.data?.deletedTrips) ? normalized.data.deletedTrips.length : 0
        },
        metadata: {
          exportedAt: String(normalized?.exportedAt || ""),
          appVersion: String(normalized?.appVersion || ""),
          schemaVersion: Number(normalized?.schemaVersion || 0) || 0,
          backupId: String(normalized?.backupId || normalized?.backupMeta?.backupId || ""),
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

  function __formatRestorePreviewDateLine(iso){
    const s = String(iso || "").trim();
    if(!s) return "Backup date unavailable";
    const d = new Date(s);
    if(isNaN(d.getTime())) return "Backup date unavailable";
    const dateLabel = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    const timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Backup from ${dateLabel} at ${timeLabel}`;
  }

  function __pluralize(count, singular, plural=`${singular}s`){
    const n = Number(count) || 0;
    return `${n} ${n === 1 ? singular : plural}`;
  }

  function __buildRestoreSummaryHtml(result){
    const mode = String(result?.mode || "merge");
    const tripsAdded = Number(result?.tripsAdded || 0);
    const tripsSkipped = Number(result?.tripsSkippedDuplicates || 0);
    const deletedTripsInFile = Number(result?.deletedTripsInFile || 0);
    const deletedTripsImported = Number(result?.deletedTripsImported || 0);
    const areasAdded = Number(result?.areasAdded || 0);
    const dealersAdded = Number(result?.dealersAdded || 0);
    const settingsApplied = !!result?.settingsApplied;
    const settingsAvailable = !!result?.settingsInFile;
    const countsHtml = mode === "replace"
      ? `
        <div class="restoreResultMetric"><span class="restoreResultMetricLabel">Trips restored</span><b>${escapeHtml(String(tripsAdded))}</b></div>
        <div class="restoreResultMetric"><span class="restoreResultMetricLabel">Areas restored</span><b>${escapeHtml(String(result?.areasInFile || 0))}</b></div>
        <div class="restoreResultMetric"><span class="restoreResultMetricLabel">Dealers restored</span><b>${escapeHtml(String(result?.dealersInFile || 0))}</b></div>
      `
      : `
        <div class="restoreResultMetric"><span class="restoreResultMetricLabel">Trips added</span><b>${escapeHtml(String(tripsAdded))}</b></div>
        <div class="restoreResultMetric"><span class="restoreResultMetricLabel">Likely duplicates skipped</span><b>${escapeHtml(String(tripsSkipped))}</b></div>
        <div class="restoreResultMetric"><span class="restoreResultMetricLabel">New areas added</span><b>${escapeHtml(String(areasAdded))}</b></div>
        <div class="restoreResultMetric"><span class="restoreResultMetricLabel">New dealers added</span><b>${escapeHtml(String(dealersAdded))}</b></div>
      `;

    const settingsLine = settingsApplied
      ? 'Settings from this backup were applied on this device.'
      : (settingsAvailable
          ? 'Settings were left unchanged on this device.'
          : 'This backup file did not include settings to apply.');

    const deletedLine = deletedTripsInFile > 0
      ? (mode === "replace"
          ? `${__pluralize(deletedTripsImported, 'recently deleted item')} restored to Recently Deleted.`
          : `${__pluralize(deletedTripsImported, 'recently deleted item')} merged into Recently Deleted.`)
      : 'No Recently Deleted items were included in this backup.';

    return `
      <div class="restoreResultPanel">
        <div class="restoreResultLead">${escapeHtml(mode === "replace" ? 'Replace finished. This device now reflects the backup file you reviewed.' : 'Merge finished. Current device data stayed in place and only new backup content was added.')}</div>
        <div class="restoreResultGrid">${countsHtml}</div>
        <div class="restoreResultNotes">
          <div>${escapeHtml(settingsLine)}</div>
          <div>${escapeHtml(deletedLine)}</div>
        </div>
      </div>
    `;
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

      const warningCount = Array.isArray(preview.warnings) ? preview.warnings.length : 0;
      const warningHtml = warningCount
        ? `<div class="restorePreviewWarning ${warningCount >= 2 ? "restorePreviewWarning--strong" : ""}" role="status" aria-live="polite"><div class="restorePreviewWarningTitle">Review carefully before restoring</div><div class="restorePreviewWarningBody">${warningCount === 1 ? "This file can still be restored, but one part of it needs extra attention." : `This file can still be restored, but ${escapeHtml(String(warningCount))} parts of it need extra attention.`}</div><ul class="restorePreviewWarningList">${preview.warnings.map(w=>`<li>${escapeHtml(String(w || ""))}</li>`).join("")}</ul><div class="restorePreviewWarningHint">If anything looks unfamiliar, stop here and confirm the file source before continuing.</div></div>`
        : `<div class="restorePreviewSafeNote" role="status" aria-live="polite">Backup looks complete.</div>`;

      const counts = preview.counts || {};
      openModal({
        title: "Restore Preview",
        backdropClose: false,
        escClose: false,
        showCloseButton: false,
        position: "center",
        html: `
          <div class="restorePreviewLayout">
            <div class="restorePreviewTopSummary">
              <div class="restorePreviewTopTitle">Backup ready to restore</div>
              <div class="restorePreviewTopCount">${escapeHtml(String(counts.trips || 0))} trips found</div>
              <div class="restorePreviewTopDate">${escapeHtml(__formatRestorePreviewDateLine(preview?.metadata?.exportedAt))}</div>
            </div>
            ${warningHtml}
            <section class="restorePreviewCard" aria-label="Backup contents">
              <div class="restorePreviewCardLabel">What will be restored</div>
              <div class="restorePreviewCountsGrid">
                <div class="restorePreviewCountRow"><span>Trips</span><b>${escapeHtml(String(counts.trips || 0))}</b></div>
                <div class="restorePreviewCountRow"><span>Areas</span><b>${escapeHtml(String(counts.areas || 0))}</b></div>
                <div class="restorePreviewCountRow"><span>Dealers</span><b>${escapeHtml(String(counts.dealers || 0))}</b></div>
                <div class="restorePreviewCountRow"><span>Recently Deleted</span><b>${escapeHtml(String(counts.deletedTrips || 0))}</b></div>
              </div>
            </section>
            <section class="restorePreviewModes" aria-label="Restore method">
              <div class="restorePreviewModesTitle">Restore method</div>
              <label class="restorePreviewChoice">
                <input id="${modeMergeId}" type="radio" name="${uidBase}_restore_mode" value="merge" checked />
                <span><b>Merge backup — recommended</b><small>Adds missing trips and keeps your current trips safe.</small></span>
              </label>
              <label class="restorePreviewChoice">
                <input id="${modeReplaceId}" type="radio" name="${uidBase}_restore_mode" value="replace" />
                <span><b>Replace this device’s data</b><small>Removes current trips and lists on this device, then imports this backup.</small></span>
              </label>
            </section>
            <label class="restorePreviewChoice restorePreviewChoice--checkbox">
              <input id="${includeSettingsId}" type="checkbox" />
              <span><b>Also import app settings from this backup</b><small>Optional. Your current app settings stay unchanged unless this is turned on.</small></span>
            </label>
            <details class="restorePreviewDetails">
              <summary>Backup details</summary>
              <div class="restorePreviewDetailsGrid">
                <div class="restorePreviewDetailRow"><span>File name</span><b>${escapeHtml(preview.fileName || "bank-the-catch_backup.json")}</b></div>
                <div class="restorePreviewDetailRow"><span>File size</span><b>${escapeHtml(__formatFileSize(preview.fileSize))}</b></div>
                <div class="restorePreviewDetailRow"><span>Exported date</span><b>${escapeHtml(__formatRestoreMetaDate(preview?.metadata?.exportedAt))}</b></div>
                <div class="restorePreviewDetailRow"><span>Build/Version</span><b>${escapeHtml(String(preview?.metadata?.appVersion || "unknown"))}</b></div>
                <div class="restorePreviewDetailRow"><span>Schema</span><b>${escapeHtml(String(preview?.metadata?.schemaVersion || "unknown"))}</b></div>
                <div class="restorePreviewDetailRow"><span>Backup ID</span><b>${escapeHtml(String(preview?.metadata?.backupId || "not included"))}</b></div>
                <div class="restorePreviewDetailRow"><span>Created by</span><b>${escapeHtml(String(preview?.metadata?.createdBy || "unknown"))}</b></div>
              </div>
            </details>
          </div>
          <label class="row" id="${replaceConfirmId}_row" style="gap:8px;align-items:flex-start;margin-top:10px;display:none">
            <input id="${replaceConfirmId}" type="checkbox" />
            <span>I understand Replace first removes current trips and list entries on this device. I should protect current data with a fresh backup before continuing.</span>
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
        title: "Protect current data before Replace?",
        backdropClose: false,
        escClose: false,
        showCloseButton: false,
        position: "center",
        html: `
          <div class="muted small">Recommended: create a Bank the Catch safety backup now so you can recover if this Replace result is not what you expected.</div>
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
              downloadBackupPayload(safetyPayload, "bank-the-catch_safety-before-restore");
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
      const guidance = classifyRestoreError(reason);

      announce("Restore failed. Open details for next steps.", "assertive");

      openModal({
        title: "Restore failed",
        backdropClose: false,
        escClose: false,
        showCloseButton: false,
        position: "center",
        html: `
          <div class="muted small">${escapeHtml(guidance.heading)}</div>
          <ul class="muted small" style="margin:10px 0 0 16px;padding:0">
            ${guidance.tips.map(t=>`<li>${escapeHtml(String(t || ""))}</li>`).join("")}
          </ul>
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

  function normalizeTripForImport(t, context = {}){
    const o = (t && typeof t === "object") ? t : {};
    const id = String(o.id || "").trim() || uid("t");
    const dateISO = String(o.dateISO || o.date || "").trim();
    const dealer = String(o.dealer || "").trim();
    const area = String(o.area || "").trim();
    const pounds = Number(o.pounds);
    const amount = Number(o.amount);
    const species = String(o.species || "Soft-shell Clams").trim() || "Soft-shell Clams";
    const notes = String(o.notes || "");
    const importedAt = new Date().toISOString();
    const importedTrip = appendTripHistoryEvent({
      ...o,
      id,
      dateISO,
      dealer,
      area,
      species,
      notes,
      pounds: Number.isFinite(pounds) ? pounds : 0,
      amount: Number.isFinite(amount) ? amount : 0
    }, {
      type: "imported",
      at: importedAt,
      source: context.mode === "replace" ? "restore" : "import",
      detail: {
        fileName: String(context.fileName || "")
      }
    });
    return normalizeTrip(importedTrip);
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
    const deletedTripsIn = normalized.data.deletedTrips;

    const importedTrips = tripsIn.map((trip)=>normalizeTripForImport(trip, { mode, fileName: String(parsed?.fileName || file?.name || "") })).filter(t=>t.dateISO || t.dealer || t.amount || t.pounds);
    const importedAreas = areasIn.map(a=>String(a||"").trim()).filter(Boolean);
    const importedDealers = dealersIn.map(d=>String(d||"").trim()).filter(Boolean);
    const importedDeletedTrips = Array.isArray(deletedTripsIn) ? __cloneData(deletedTripsIn) : [];

    capturePreRestoreRollbackSnapshot({
      mode: replace ? "replace" : "merge",
      includeSettings,
      sourceFileName: String(parsed?.fileName || file?.name || "")
    });

    const nextTrips = replace ? [] : (Array.isArray(state.trips) ? [...state.trips] : []);
    const existingAreas = replace ? [] : (Array.isArray(state.areas) ? state.areas.map((value)=>String(value || "").trim()).filter(Boolean) : []);
    const existingDealers = replace ? [] : (Array.isArray(state.dealers) ? state.dealers.map((value)=>String(value || "").trim()).filter(Boolean) : []);
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
    state.deletedTrips = replace ? importedDeletedTrips : (Array.isArray(state.deletedTrips) ? [...state.deletedTrips, ...importedDeletedTrips] : importedDeletedTrips);
    state.trips = Array.isArray(state.trips) ? state.trips.map((trip)=>normalizeTrip(trip)).filter(Boolean) : [];

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

    const tripsSkippedDuplicates = replace ? 0 : Math.max(0, importedTrips.length - added);
    const settingsInFile = !!(settingsIn && typeof settingsIn === "object" && Object.keys(settingsIn).length);

    return {
      mode: replace ? "replace" : "merge",
      includeSettings,
      settingsInFile,
      settingsApplied: includeSettings && settingsInFile,
      fileName: String(parsed?.fileName || file?.name || ""),
      tripsInFile: importedTrips.length,
      tripsAdded: replace ? importedTrips.length : added,
      tripsSkippedDuplicates,
      areasInFile: importedAreas.length,
      areasAdded: replace ? importedAreas.length : importedAreas.filter((value)=> !existingAreas.includes(value)).length,
      dealersInFile: importedDealers.length,
      dealersAdded: replace ? importedDealers.length : importedDealers.filter((value)=> !existingDealers.includes(value)).length,
      deletedTripsInFile: importedDeletedTrips.length,
      deletedTripsImported: importedDeletedTrips.length,
      warnings: normalizedResult?.warnings || []
    };
  }

  function openRestoreResultModal(result){
    return new Promise((resolve)=>{
      const uidBase = uid("restoreResult");
      const okId = `${uidBase}_ok`;
      const title = String(result?.mode || "merge") === "replace" ? "Restore complete" : "Merge complete";
      const summaryHtml = __buildRestoreSummaryHtml(result);
      openModal({
        title,
        backdropClose: false,
        escClose: false,
        showCloseButton: false,
        position: "center",
        html: `
          ${summaryHtml}
          <div class="modalActions" style="margin-top:12px">
            <button class="btn primary" id="${okId}" type="button">OK</button>
          </div>
        `,
        onOpen: ()=>{
          document.getElementById(okId)?.addEventListener("click", ()=>{ closeModal(); resolve(); });
        }
      });
    });
  }

  return {
    buildBackupPayloadFromState,
    getBackupHealthState,
    updateBackupHealthWarning,
    updateLastBackupLine,
    getRestoreRollbackSnapshotMeta,
    updateRestoreRollbackLine,
    downloadBackupPayload,
    exportBackup,
    parseBackupFileForRestore,
    openRestorePreviewModal,
    openReplaceSafetyBackupModal,
    openRestoreErrorModal,
    openRestoreResultModal,
    importBackupFromFile,
    restoreFromRollbackSnapshot,
    clearBackupRecoveryMetadata
  };
}
