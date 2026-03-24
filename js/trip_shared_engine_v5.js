const DEFAULT_SPECIES = "Soft-shell Clams";
const TRIP_HISTORY_LIMIT = 12;
export const AREA_NOT_RECORDED = "Area Not Recorded";

function isValidISODateTime(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString() === s;
}

function normalizeHistoryEvent(event) {
  const raw = (event && typeof event === "object") ? event : {};
  const type = String(raw.type || "").trim().toLowerCase();
  const at = String(raw.at || "").trim();
  if (!type || !isValidISODateTime(at)) return null;
  const source = String(raw.source || "").trim().toLowerCase() || "system";
  const note = String(raw.note || "").trim();
  const detail = raw.detail && typeof raw.detail === "object" ? { ...raw.detail } : null;
  return {
    type,
    at,
    source,
    ...(note ? { note } : {}),
    ...(detail ? { detail } : {})
  };
}

function dedupeHistoryEvents(history) {
  const seen = new Set();
  return history.filter((event) => {
    const key = JSON.stringify([event.type, event.at, event.source, event.note || "", event.detail || null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ensureTripProvenanceShape(trip, fallbackCreatedAt = "") {
  const sourceTrip = (trip && typeof trip === "object") ? trip : {};
  const raw = (sourceTrip.provenance && typeof sourceTrip.provenance === "object") ? sourceTrip.provenance : {};
  const createdAt = isValidISODateTime(raw.createdAt) ? String(raw.createdAt) : (isValidISODateTime(sourceTrip.createdAt) ? String(sourceTrip.createdAt) : (isValidISODateTime(fallbackCreatedAt) ? String(fallbackCreatedAt) : new Date().toISOString()));
  const history = dedupeHistoryEvents(
    (Array.isArray(raw.history) ? raw.history : [])
      .map(normalizeHistoryEvent)
      .filter(Boolean)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
  ).slice(-TRIP_HISTORY_LIMIT);
  const firstEvent = history[0] || null;
  const lastEvent = history[history.length - 1] || null;
  const createdSource = String(raw.createdSource || firstEvent?.source || "legacy").trim().toLowerCase() || "legacy";
  const importedAt = isValidISODateTime(raw.importedAt) ? String(raw.importedAt) : ((lastEvent?.type === "imported" && isValidISODateTime(lastEvent.at)) ? String(lastEvent.at) : "");
  const updatedAt = isValidISODateTime(raw.updatedAt) ? String(raw.updatedAt) : ((lastEvent?.type === "edited" && isValidISODateTime(lastEvent.at)) ? String(lastEvent.at) : "");
  const lastEventAt = isValidISODateTime(raw.lastEventAt) ? String(raw.lastEventAt) : (isValidISODateTime(lastEvent?.at) ? String(lastEvent.at) : "");

  return {
    createdAt,
    createdSource,
    updatedAt,
    importedAt,
    lastEventAt,
    history
  };
}

export function appendTripHistoryEvent(trip, event) {
  const sourceTrip = (trip && typeof trip === "object") ? { ...trip } : {};
  const normalizedEvent = normalizeHistoryEvent(event);
  const createdAt = String(sourceTrip.createdAt || "").trim();
  const provenance = ensureTripProvenanceShape(sourceTrip, createdAt);
  if (!normalizedEvent) {
    return {
      ...sourceTrip,
      provenance
    };
  }

  const history = dedupeHistoryEvents([...provenance.history, normalizedEvent])
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .slice(-TRIP_HISTORY_LIMIT);
  const nextProvenance = {
    ...provenance,
    history,
    lastEventAt: normalizedEvent.at
  };

  if (normalizedEvent.type === "created") {
    nextProvenance.createdAt = normalizedEvent.at;
    nextProvenance.createdSource = normalizedEvent.source || provenance.createdSource || "manual";
  }
  if (normalizedEvent.type === "edited") {
    nextProvenance.updatedAt = normalizedEvent.at;
  }
  if (normalizedEvent.type === "imported") {
    nextProvenance.importedAt = normalizedEvent.at;
  }

  return {
    ...sourceTrip,
    provenance: nextProvenance
  };
}

export function createTripDataEngine({ uid, isValidISODate }) {
  function normalizeTripRow(t) {
    if (!t) return null;

    let dateISO = String(t?.dateISO || t?.date || t?.when || t?.tripDate || "").slice(0, 10);
    let invalidDateQuarantined = false;

    if (!isValidISODate(dateISO) && t?.createdAt) {
      const d = new Date(t.createdAt);
      if (!Number.isNaN(d.getTime())) dateISO = d.toISOString().slice(0, 10);
    }
    if (!isValidISODate(dateISO)) {
      dateISO = "";
      invalidDateQuarantined = true;
    }

    const pounds = Number(t?.pounds ?? t?.lbs ?? 0);
    const amount = Number(t?.amount ?? t?.total ?? 0);
    const payRate = deriveTripPayRate(t);
    const resolvedAmount = Number.isFinite(amount) && amount > 0 ? amount : ((Number.isFinite(pounds) && pounds > 0 && Number.isFinite(payRate) && payRate > 0) ? pounds * payRate : 0);

    const nextTrip = {
      ...t,
      dateISO,
      invalidDateQuarantined: Boolean(t?.invalidDateQuarantined) || invalidDateQuarantined,
      pounds: Number.isFinite(pounds) ? pounds : 0,
      amount: Number.isFinite(resolvedAmount) ? resolvedAmount : 0,
      payRate: Number.isFinite(payRate) ? payRate : 0,
      dealer: String(t?.dealer || "").trim(),
      area: String(t?.area || "").trim(),
      species: String(t?.species || DEFAULT_SPECIES).trim() || DEFAULT_SPECIES,
      notes: String(t?.notes || "")
    };
    delete nextTrip.areaId;
    return nextTrip;
  }

  function normalizeTrip(t) {
    const n = normalizeTripRow(t);
    if (!n) return null;

    const id = String(n.id || n._id || "");
    n.id = id || uid();

    if (!n.createdAt) {
      try {
        const d = new Date(String(n.dateISO || "") + "T12:00:00");
        n.createdAt = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } catch (_) {
        n.createdAt = new Date().toISOString();
      }
    }

    n.provenance = ensureTripProvenanceShape(n, n.createdAt);
    n.createdAt = n.provenance.createdAt;

    if (!String(n.species || "").trim()) n.species = DEFAULT_SPECIES;
    if (n.notes == null) n.notes = String(t?.notes || "");
    return n;
  }

  function isValidAreaValue(v) {
    const area = String(v || "").trim();
    if (!area) return false;
    if (area === "__add_new_area__") return false;
    if (area === AREA_NOT_RECORDED) return true;
    return true;
  }

  function validateTrip(t) {
    const errs = [];
    if (!t) errs.push("Trip");
    else {
      if (!t.dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.dateISO))) errs.push("Date");
      if (!String(t.dealer || "").trim()) errs.push("Dealer");
      if (!isValidAreaValue(t.area)) errs.push("Area");
      const lbs = Number(t.pounds);
      const rate = Number(t.payRate);
      if (!(Number.isFinite(lbs) && lbs > 0)) errs.push("Pounds");
      if (!(Number.isFinite(rate) && rate > 0)) errs.push("Pay Rate");
    }
    return errs;
  }

  return { normalizeTripRow, normalizeTrip, isValidAreaValue, validateTrip };
}

export function createTripDraftSaveEngine({ saveState, getEmergencyDraftPayload, writeEmergencyDraftFallback, onEmergencyDraftFallbackUsed }) {
  let lifecycleSaveFlushBound = false;

  function saveStateNow() {
    if (window.__pendingStateSaveTimer) {
      clearTimeout(window.__pendingStateSaveTimer);
      window.__pendingStateSaveTimer = null;
    }
    return saveState();
  }

  function flushPendingStateSave() {
    if (!window.__pendingStateSaveTimer) return;
    clearTimeout(window.__pendingStateSaveTimer);
    window.__pendingStateSaveTimer = null;
    return saveState();
  }

  function scheduleStateSave(delayMs = 300) {
    const delay = Number.isFinite(Number(delayMs)) ? Number(delayMs) : 300;
    if (window.__pendingStateSaveTimer) clearTimeout(window.__pendingStateSaveTimer);
    window.__pendingStateSaveTimer = setTimeout(() => {
      window.__pendingStateSaveTimer = null;
      saveState();
    }, delay);
  }

  function saveDraft() {
    let fullStateSaved = false;
    try {
      fullStateSaved = (saveStateNow() !== false);
    } catch (_) {}
    if (fullStateSaved) return;

    try {
      if (typeof getEmergencyDraftPayload !== "function") return;
      if (typeof writeEmergencyDraftFallback !== "function") return;
      const payload = getEmergencyDraftPayload();
      if (!payload || typeof payload !== "object") return;
      const fallbackSaved = writeEmergencyDraftFallback(payload);
      if (fallbackSaved && typeof onEmergencyDraftFallbackUsed === "function") {
        onEmergencyDraftFallbackUsed(payload);
      }
    } catch (_) {}
  }

  function bindLifecycleSaveFlush() {
    if (lifecycleSaveFlushBound) return;
    lifecycleSaveFlushBound = true;

    const flush = () => {
      try {
        flushPendingStateSave();
      } catch (_) {}
    };

    window.addEventListener("pagehide", flush, { capture: true });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") flush();
      },
      { capture: true }
    );
  }

  return { saveStateNow, flushPendingStateSave, scheduleStateSave, saveDraft, bindLifecycleSaveFlush };
}


function deriveTripPayRate(trip) {
  const explicitRate = Number(trip?.payRate ?? trip?.rate ?? trip?.pricePerPound ?? 0);
  if (Number.isFinite(explicitRate) && explicitRate > 0) return explicitRate;
  const pounds = Number(trip?.pounds ?? trip?.lbs ?? 0);
  const amount = Number(trip?.amount ?? trip?.total ?? 0);
  if (Number.isFinite(pounds) && pounds > 0 && Number.isFinite(amount) && amount > 0) {
    return amount / pounds;
  }
  return 0;
}

export function createTripMetricSyncEngine({ parseNum, parseMoney, syncTargets }) {
  let syncingMetric = false;

  const getFieldValue = (field) => {
    if (field === "amount") return parseMoney(syncTargets.amount?.value);
    return parseNum(syncTargets[field]?.value);
  };
  const setMetricValue = (field, value, decimals = 2) => {
    const el = syncTargets[field];
    if (!el) return;
    if (!(Number.isFinite(value) && value > 0)) {
      el.value = "";
      return;
    }
    el.value = Number(value).toFixed(decimals);
  };

  function updateDerivedField() {
    if (syncingMetric) return;
    syncingMetric = true;
    try {
      const pounds = getFieldValue("pounds");
      const rate = getFieldValue("rate");
      if (Number.isFinite(pounds) && pounds > 0 && Number.isFinite(rate) && rate > 0) {
        setMetricValue("amount", pounds * rate, 2);
      } else {
        setMetricValue("amount", 0, 2);
      }
    } finally {
      syncingMetric = false;
    }
  }

  function onUserEdit() {
    if (syncingMetric) return;
  }

  return {
    updateDerivedField,
    onUserEdit,
    getLockPair: () => ["pounds", "rate"]
  };
}

export function computeTripSaveEnabled({ dealer, area, poundsInput, rateInput, parseNum, parseMoney, isValidAreaValue }) {
  const dealerOk = !!String(dealer || "").trim();
  const areaOk = isValidAreaValue(area);
  const pounds = parseNum(poundsInput);
  const rate = parseMoney(rateInput);
  const poundsOk = Number.isFinite(pounds) && pounds > 0;
  const rateOk = Number.isFinite(rate) && rate > 0;

  return {
    dealerOk,
    areaOk,
    pounds,
    rate,
    poundsOk,
    rateOk,
    enabled: dealerOk && areaOk && poundsOk && rateOk
  };
}
