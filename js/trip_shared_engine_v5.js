import { deriveTripSettlement, resolveTripPayRate } from "./utils_v5.js";

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


export function createTripProvenanceSummaryHelpers({ normalizeTrip, formatDateDMY }) {
  function formatTripAuditTimestamp(value) {
    const iso = String(value || "").trim();
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const day = formatDateDMY(date);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${day} ${hh}:${mm}`;
  }

  function buildTripProvenanceSummary(trip) {
    const normalizedTrip = normalizeTrip(trip);
    const provenance = ensureTripProvenanceShape(normalizedTrip, normalizedTrip?.createdAt);
    const history = Array.isArray(provenance.history) ? [...provenance.history].sort((a, b) => String(b.at).localeCompare(String(a.at))) : [];
    const summaryLines = [];
    const eventLabels = { created: "Created", edited: "Edited", imported: "Imported" };
    const sourceLabels = { manual: "in app", import: "from backup", restore: "from backup", legacy: "on this device", system: "in app" };
    const createdLine = formatTripAuditTimestamp(provenance.createdAt);
    if (createdLine) {
      const createdSource = sourceLabels[String(provenance.createdSource || "").trim().toLowerCase()] || "on this device";
      summaryLines.push(`Created ${createdLine} • ${createdSource}`);
    }
    if (provenance.updatedAt) {
      const updatedLine = formatTripAuditTimestamp(provenance.updatedAt);
      if (updatedLine) summaryLines.push(`Last edited ${updatedLine}`);
    }
    if (provenance.importedAt) {
      const importedLine = formatTripAuditTimestamp(provenance.importedAt);
      if (importedLine) summaryLines.push(`Imported ${importedLine}`);
    }
    const historyItems = history.slice(0, 4).map((event) => {
      const label = eventLabels[String(event.type || "").toLowerCase()] || "Updated";
      const stamp = formatTripAuditTimestamp(event.at) || "Unknown time";
      const source = sourceLabels[String(event.source || "").trim().toLowerCase()] || "in app";
      return `${label} ${stamp} • ${source}`;
    });
    return { summaryLines, historyItems };
  }

  return {
    buildTripProvenanceSummary
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
    const settlement = deriveTripSettlement({
      amount: resolvedAmount,
      writtenCheckAmount: Number(t?.writtenCheckAmount)
    });

    const nextTrip = {
      ...t,
      dateISO,
      invalidDateQuarantined: Boolean(t?.invalidDateQuarantined) || invalidDateQuarantined,
      pounds: Number.isFinite(pounds) ? pounds : 0,
      amount: Number.isFinite(resolvedAmount) ? resolvedAmount : 0,
      calculatedAmount: Number.isFinite(settlement.calculatedAmount) ? settlement.calculatedAmount : 0,
      writtenCheckAmount: Number.isFinite(settlement.writtenCheckAmount) ? settlement.writtenCheckAmount : 0,
      dealerAdjustment: Number.isFinite(settlement.dealerAdjustment) ? settlement.dealerAdjustment : 0,
      adjustmentClass: String(settlement.adjustmentClass || "none"),
      adjustmentClassification: String(settlement.adjustmentClassification || settlement.adjustmentClass || "none"),
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


const deriveTripPayRate = (trip) => resolveTripPayRate(trip);

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

export function createTripSharedCollectionsEngine({ getState, normalizeKey, normalizeTripRow }) {
  function getStateRef() {
    const source = typeof getState === "function" ? getState() : null;
    return (source && typeof source === "object") ? source : {};
  }

  function uniqueSorted(arr) {
    return [...new Set((arr || []).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function resolveAreaValue(value) {
    const rawValue = String(value || "").trim();
    return { areaId: "", canonicalName: rawValue, rawValue, key: normalizeKey(rawValue), matchedBy: rawValue ? "raw" : "empty", record: null };
  }

  function resolveTripArea(trip) {
    return resolveAreaValue(trip?.area || "");
  }

  function canonicalizeTripArea(trip) {
    if (!trip || typeof trip !== "object") return trip;
    const area = String(trip.area || "").trim();
    const nextTrip = { ...trip, area };
    if (Object.prototype.hasOwnProperty.call(nextTrip, "areaId")) delete nextTrip.areaId;
    return nextTrip;
  }

  function syncAreaState(nextState = getStateRef()) {
    const source = (nextState && typeof nextState === "object") ? nextState : getStateRef();
    if (!Array.isArray(source.areas)) source.areas = [];
    const tripAreas = Array.isArray(source.trips) ? source.trips.map((trip) => String(trip?.area || "").trim()) : [];
    source.areas = uniqueSorted([...source.areas, ...tripAreas, AREA_NOT_RECORDED]);
    if (source && typeof source === "object" && Object.prototype.hasOwnProperty.call(source, "areaRegistry")) delete source.areaRegistry;
    return source.areas;
  }

  function addArea(rawName) {
    const state = getStateRef();
    const name = String(rawName || "").trim();
    if (!name) return { created: false, value: "" };
    ensureAreas();
    const key = normalizeKey(name);
    const existing = (Array.isArray(state.areas) ? state.areas : []).find((area) => normalizeKey(area) === key) || "";
    if (existing) return { created: false, value: existing };
    state.areas.push(name);
    state.areas = uniqueSorted(state.areas);
    return { created: true, value: name };
  }

  function countTripsForArea(areaName) {
    const state = getStateRef();
    const key = normalizeKey(areaName);
    if (!key) return 0;
    return (Array.isArray(state.trips) ? state.trips : []).reduce((count, trip) => count + (normalizeKey(trip?.area || "") === key ? 1 : 0), 0);
  }

  function deleteArea(areaName) {
    const state = getStateRef();
    const key = normalizeKey(areaName);
    if (!key) return { ok: false, reason: "invalid-area" };
    if (key === normalizeKey(AREA_NOT_RECORDED)) return { ok: false, reason: "protected" };
    if (countTripsForArea(areaName) > 0) return { ok: false, reason: "in-use" };
    const nextAreas = (Array.isArray(state.areas) ? state.areas : []).filter((area) => normalizeKey(area) !== key);
    if (nextAreas.length === (Array.isArray(state.areas) ? state.areas : []).length) return { ok: false, reason: "missing" };
    state.areas = nextAreas;
    return { ok: true };
  }

  function ensureAreas() {
    syncAreaState(getStateRef());
  }

  function ensureDealers() {
    const state = getStateRef();
    if (!Array.isArray(state.dealers)) state.dealers = [];
    const seen = new Set();
    const out = [];
    for (const d of state.dealers) {
      const v = String(d || "").trim();
      if (!v) continue;
      const k = normalizeKey(v);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
    state.dealers = out;
  }

  function getFilterOptionsFromTrips() {
    const state = getStateRef();
    ensureAreas();
    const trips = Array.isArray(state.trips) ? state.trips.map((trip) => canonicalizeTripArea(normalizeTripRow(trip))).filter(Boolean) : [];
    return {
      dealers: uniqueSorted(trips.map((t) => t.dealer)),
      areas: uniqueSorted([...(Array.isArray(state.areas) ? state.areas : []), ...trips.map((t) => resolveTripArea(t).canonicalName || t.area)]),
      species: uniqueSorted(trips.map((t) => t.species))
    };
  }

  function getLastUniqueFromTrips(field, maxN) {
    const state = getStateRef();
    const out = [];
    const seen = new Set();
    const trips = Array.isArray(state.trips) ? state.trips : [];
    for (let i = trips.length - 1; i >= 0; i--) {
      const t = trips[i];
      const raw = field === "area"
        ? (resolveTripArea(t).canonicalName || String(t?.area || "").trim())
        : String(t?.[field] || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
      if (out.length >= maxN) break;
    }
    return out;
  }

  function findCanonicalFromList(value, list) {
    const v = String(value || "").trim();
    if (!v) return "";
    const key = v.toLowerCase();
    for (const item of (Array.isArray(list) ? list : [])) {
      const s = String(item || "").trim();
      if (!s) continue;
      if (s.toLowerCase() === key) return s;
    }
    return "";
  }

  function getValuesWithLegacyEntry(kind, legacyValue, values) {
    const list = Array.isArray(values) ? values.slice() : [];
    const legacy = String(legacyValue || "").trim();
    if (!legacy) return list;
    const legacyKey = normalizeKey(legacy);
    const hasLegacy = list.some((item) => normalizeKey(String(item || "").trim()) === legacyKey);
    if (!hasLegacy) list.unshift(legacy);
    return list;
  }

  function getDealerSelectList(topDealers, selectedDealer = "") {
    const state = getStateRef();
    const out = [];
    const seenDealerKeys = new Set();
    for (const dealer of getValuesWithLegacyEntry("dealer", selectedDealer, [...(Array.isArray(topDealers) ? topDealers : []), ...(Array.isArray(state.dealers) ? state.dealers : [])])) {
      const val = String(dealer || "").trim();
      if (!val) continue;
      const key = normalizeKey(val);
      if (seenDealerKeys.has(key)) continue;
      seenDealerKeys.add(key);
      out.push(val);
    }
    return out;
  }

  function buildAreaOptionsHtml({ selectedArea, addSentinel, escapeHtml }) {
    const state = getStateRef();
    ensureAreas();
    const selectedCanonical = resolveAreaValue(selectedArea).canonicalName || selectedArea;
    return ["", ...getValuesWithLegacyEntry("area", selectedCanonical, Array.isArray(state.areas) ? state.areas : [])].map((area) => {
      const label = area ? area : "—";
      const sel = (String(selectedCanonical || "") === String(area || "")) ? "selected" : "";
      return `<option value="${escapeHtml(String(area || ""))}" ${sel}>${label}</option>`;
    }).concat(`<option value="${addSentinel}">+ Add new Area</option>`).join("");
  }

  function buildDealerOptionsHtml({ selectedDealer, dealerList, addSentinel, escapeHtml }) {
    return ["", ...(Array.isArray(dealerList) ? dealerList : [])].map((dealer) => {
      const label = dealer ? dealer : "—";
      const sel = (normalizeKey(String(selectedDealer || "")) === normalizeKey(String(dealer || ""))) ? "selected" : "";
      const value = String(dealer || "").replaceAll('"', "&quot;");
      return `<option value="${value}" ${sel}>${escapeHtml(label)}</option>`;
    }).concat(`<option value="${addSentinel}">+ Add new Dealer</option>`).join("");
  }

  return {
    resolveAreaValue,
    resolveTripArea,
    canonicalizeTripArea,
    syncAreaState,
    addArea,
    countTripsForArea,
    deleteArea,
    ensureAreas,
    ensureDealers,
    uniqueSorted,
    getFilterOptionsFromTrips,
    getLastUniqueFromTrips,
    findCanonicalFromList,
    getValuesWithLegacyEntry,
    getDealerSelectList,
    buildAreaOptionsHtml,
    buildDealerOptionsHtml
  };
}
