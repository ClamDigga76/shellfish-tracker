export function createRootStateSaveSeam({
  localStorage,
  sessionStorage,
  history,
  locationHref,
  ensureNavState,
  loadStateWithLegacyFallback,
  buildDefaultAppState = () => ({}),
  LS_KEY,
  createTripDraftSaveEngine,
  showToast,
  getNowISO = ()=> new Date().toISOString()
} = {}){
  const TRIP_DRAFT_FALLBACK_KEY = "btc_trip_draft_emergency_v1";
  const SAFE_MODE_PARAM = "safeMode";
  const SAFE_MODE_SESSION_KEY = "shellfish-safe-mode-session";

  let emergencyDraftRecoveredOnBoot = false;
  let safeModeRequestedOnBoot = false;
  let legacyRecoveryMarkerClearedOnBoot = false;

  function hasMeaningfulTripDraft(draft){
    if(!draft || typeof draft !== "object") return false;
    const dealer = String(draft.dealer || "").trim();
    const area = String(draft.area || "").trim();
    const notes = String(draft.notes || "").trim();
    const dateISO = String(draft.dateISO || "").trim();
    const pounds = Number(draft.pounds);
    const amount = Number(draft.amount);
    return Boolean(dealer || area || notes || dateISO || (Number.isFinite(pounds) && pounds > 0) || (Number.isFinite(amount) && amount > 0));
  }

  function readEmergencyTripDraftFallback(){
    try{
      const raw = localStorage.getItem(TRIP_DRAFT_FALLBACK_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== "object") return null;
      if(!parsed.draft || typeof parsed.draft !== "object") return null;
      return parsed;
    }catch{
      return null;
    }
  }

  function clearEmergencyTripDraftFallback(){
    try{ localStorage.removeItem(TRIP_DRAFT_FALLBACK_KEY); }catch{}
  }

  function isSafeModeEnabled(){
    if(window.__SHELLFISH_SAFE_MODE__ === true) return true;
    try{
      const url = new URL(locationHref());
      if(url.searchParams.get(SAFE_MODE_PARAM) === "1") return true;
    }catch(_){ }
    try{
      return sessionStorage.getItem(SAFE_MODE_SESSION_KEY) === "1";
    }catch(_){
      return false;
    }
  }

  function clearSafeModeFlag(){
    try{ sessionStorage.removeItem(SAFE_MODE_SESSION_KEY); }catch(_){ }
    try{
      const url = new URL(locationHref());
      if(!url.searchParams.has(SAFE_MODE_PARAM)) return;
      url.searchParams.delete(SAFE_MODE_PARAM);
      history.replaceState(null, "", url.toString());
    }catch(_){ }
  }

  function loadState(){
    const loaded = loadStateWithLegacyFallback(localStorage, ensureNavState, buildDefaultAppState);
    safeModeRequestedOnBoot = isSafeModeEnabled();
    if(loaded && typeof loaded === "object"){
      if(safeModeRequestedOnBoot){
        loaded.__safeMode = true;
        loaded.__recoveryMode = true;
      }else{
        const hadLegacySafeMode = loaded.__safeMode === true;
        const hadLegacyRecoveryMode = loaded.__recoveryMode === true;
        delete loaded.__safeMode;
        delete loaded.__recoveryMode;
        legacyRecoveryMarkerClearedOnBoot = hadLegacySafeMode || hadLegacyRecoveryMode;
      }
    }
    const hasNormalDraft = hasMeaningfulTripDraft(loaded?.draft);
    if(hasNormalDraft) return loaded;

    const fallback = readEmergencyTripDraftFallback();
    if(!fallback) return loaded;

    try{
      loaded.draft = fallback.draft;
      if(fallback.reviewDraft && typeof fallback.reviewDraft === "object") loaded.reviewDraft = fallback.reviewDraft;
      emergencyDraftRecoveredOnBoot = true;
      clearEmergencyTripDraftFallback();
    }catch{}
    return loaded;
  }

  function wasEmergencyDraftRecoveredOnBoot(){
    return emergencyDraftRecoveredOnBoot;
  }

  function wasSafeModeRequestedOnBoot(){
    return safeModeRequestedOnBoot;
  }

  function wasLegacyRecoveryMarkerClearedOnBoot(){
    return legacyRecoveryMarkerClearedOnBoot;
  }

  function createStateSaveFlow({ getState } = {}){
    function safeSetItem(key, value){
      try{
        localStorage.setItem(key, value);
        return true;
      }catch(e){
        try{ console.warn("localStorage write failed", e); }catch(_){ }
        try{ showToast("Storage is full — export CSV and remove older trips."); }catch(_){ }
        return false;
      }
    }

    function buildEmergencyTripDraftPayload(){
      const state = getState?.();
      if(!hasMeaningfulTripDraft(state?.draft)) return null;
      return {
        kind: "trip-draft-emergency",
        updatedAt: getNowISO(),
        draft: state.draft,
        reviewDraft: (state?.reviewDraft && typeof state.reviewDraft === "object") ? state.reviewDraft : null
      };
    }

    function writeEmergencyTripDraftFallback(payload){
      try{
        localStorage.setItem(TRIP_DRAFT_FALLBACK_KEY, JSON.stringify(payload));
        return true;
      }catch{
        return false;
      }
    }

    function buildDurableStateSnapshot(){
      const state = getState?.();
      if(!state || typeof state !== "object") return state;
      const snapshot = { ...state };
      delete snapshot.__safeMode;
      delete snapshot.__recoveryMode;
      return snapshot;
    }

    function baseSaveState(){
      const runtimeState = getState?.();
      if(runtimeState?.__safeMode === true){
        return false;
      }
      const ok = safeSetItem(LS_KEY, JSON.stringify(buildDurableStateSnapshot()));
      if(ok) clearEmergencyTripDraftFallback();
      return ok;
    }

    const {
      saveStateNow,
      flushPendingStateSave,
      scheduleStateSave,
      saveDraft,
      bindLifecycleSaveFlush
    } = createTripDraftSaveEngine({
      saveState: baseSaveState,
      getEmergencyDraftPayload: ()=> buildEmergencyTripDraftPayload(),
      writeEmergencyDraftFallback: (payload)=> writeEmergencyTripDraftFallback(payload),
      onEmergencyDraftFallbackUsed: ()=> {
        try{ showToast("Saved an emergency trip draft backup"); }catch(_){ }
      }
    });

    return {
      saveStateNow,
      flushPendingStateSave,
      scheduleStateSave,
      saveDraft,
      bindLifecycleSaveFlush,
      saveState: ()=> saveStateNow()
    };
  }

  return {
    loadState,
    clearSafeModeFlag,
    wasEmergencyDraftRecoveredOnBoot,
    wasSafeModeRequestedOnBoot,
    wasLegacyRecoveryMarkerClearedOnBoot,
    createStateSaveFlow
  };
}
