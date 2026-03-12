const DEFAULT_SPECIES = "Soft-shell Clams";

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

    return {
      ...t,
      dateISO,
      invalidDateQuarantined: Boolean(t?.invalidDateQuarantined) || invalidDateQuarantined,
      pounds: Number.isFinite(pounds) ? pounds : 0,
      amount: Number.isFinite(amount) ? amount : 0,
      dealer: String(t?.dealer || "").trim(),
      area: String(t?.area || "").trim(),
      species: String(t?.species || DEFAULT_SPECIES).trim() || DEFAULT_SPECIES,
      notes: String(t?.notes || "")
    };
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

    if (!String(n.species || "").trim()) n.species = DEFAULT_SPECIES;
    if (n.notes == null) n.notes = String(t?.notes || "");
    return n;
  }

  function isValidAreaValue(v) {
    const area = String(v || "").trim();
    return !!area && area !== "__add_new_area__";
  }

  function validateTrip(t) {
    const errs = [];
    if (!t) errs.push("Trip");
    else {
      if (!t.dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.dateISO))) errs.push("Date");
      if (!String(t.dealer || "").trim()) errs.push("Dealer");
      if (!isValidAreaValue(t.area)) errs.push("Area");
      const lbs = Number(t.pounds);
      const amt = Number(t.amount);
      if (!(Number.isFinite(lbs) && lbs > 0)) errs.push("Pounds");
      if (!(Number.isFinite(amt) && amt > 0)) errs.push("Amount");
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

export function computeTripSaveEnabled({ dealer, area, poundsInput, amountInput, parseNum, parseMoney, isValidAreaValue }) {
  const dealerOk = !!String(dealer || "").trim();
  const areaOk = isValidAreaValue(area);
  const pounds = parseNum(poundsInput);
  const amount = parseMoney(amountInput);
  const poundsOk = Number.isFinite(pounds) && pounds > 0;
  const amountOk = Number.isFinite(amount) && amount > 0;

  return {
    dealerOk,
    areaOk,
    pounds,
    amount,
    poundsOk,
    amountOk,
    enabled: dealerOk && areaOk && poundsOk && amountOk
  };
}
