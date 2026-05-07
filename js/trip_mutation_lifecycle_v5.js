export function createTripMutationLifecycleSeam({
  getState,
  setState,
  saveState,
  render,
  showToast,
  showMilestoneToast,
  triggerHaptic,
  maybeOfferInstallAfterFirstSave,
  openConfirmModal,
  announce,
  uid,
  parseUsDateToISODate,
  normalizeDealerDisplay,
  parseNum,
  parseMoney,
  deriveTripSettlement,
  to2,
  ensureAreas,
  addArea,
  DEFAULT_TRIP_SPECIES,
  isValidAreaValue,
  getTripsNewestFirst,
  formatDateDMY,
  formatMoney,
  appendTripHistoryEvent,
  normalizeTrip,
  canonicalizeTripArea,
  validateTrip,
  likelyDuplicate,
  normalizeKey,
  computePPL,
  DELETED_TRIPS_LIMIT
}){
  let pendingTripUndo = null;

  function cloneUndoValue(v){
    if(typeof structuredClone === "function"){
      try{ return structuredClone(v); }catch(_){ }
    }
    try{ return JSON.parse(JSON.stringify(v)); }catch(_){ return v; }
  }

  function applyUndoSnapshot(snapshot){
    const snap = snapshot || {};
    const state = getState();
    state.trips = Array.isArray(snap.trips) ? cloneUndoValue(snap.trips) : [];
    state.deletedTrips = Array.isArray(snap.deletedTrips) ? cloneUndoValue(snap.deletedTrips) : [];
    if(Object.prototype.hasOwnProperty.call(snap, "navStack")){
      state.navStack = Array.isArray(snap.navStack) ? cloneUndoValue(snap.navStack) : [];
    }
    if(Object.prototype.hasOwnProperty.call(snap, "editId")) state.editId = snap.editId;
    else delete state.editId;
    if(Object.prototype.hasOwnProperty.call(snap, "draft")) state.draft = cloneUndoValue(snap.draft);
    else delete state.draft;
    if(Object.prototype.hasOwnProperty.call(snap, "reviewDraft")) state.reviewDraft = cloneUndoValue(snap.reviewDraft);
    else delete state.reviewDraft;
    state.view = String(snap.view || state.view || "home");
    saveState();
    render();
  }

  function clearPendingTripUndo(){
    if(!pendingTripUndo) return;
    try{ clearTimeout(pendingTripUndo.timer); }catch(_){ }
    pendingTripUndo = null;
  }

  function showUndoToast({ message, snapshot, durationMs = 3200 }){
    clearPendingTripUndo();
    const token = Date.now();
    const undoSnapshot = cloneUndoValue(snapshot);
    const onUndo = ()=>{
      if(!pendingTripUndo || pendingTripUndo.token !== token) return;
      clearPendingTripUndo();
      applyUndoSnapshot(undoSnapshot);
      showToast("Undone");
    };
    const timer = setTimeout(()=>{
      if(pendingTripUndo && pendingTripUndo.token === token){
        pendingTripUndo = null;
      }
    }, durationMs);
    pendingTripUndo = { token, timer };
    showToast(message, { actionLabel: "Undo", onAction: onUndo, durationMs });
  }

  function scoreDuplicateTripMatch(existingTrip, candidate){
    if(!likelyDuplicate(existingTrip, candidate)) return -1;

    let score = 0;
    const sameDate = String(existingTrip?.dateISO || "") === String(candidate?.dateISO || "");
    const sameDealer = normalizeKey(existingTrip?.dealer) === normalizeKey(candidate?.dealer);
    const samePounds = Math.abs((Number(existingTrip?.pounds) || 0) - (Number(candidate?.pounds) || 0)) <= 0.01;
    const sameAmount = Math.abs((Number(existingTrip?.amount) || 0) - (Number(candidate?.amount) || 0)) <= 0.01;
    const existingArea = normalizeKey(existingTrip?.area);
    const candidateArea = normalizeKey(candidate?.area);
    const sameArea = existingArea && candidateArea && existingArea === candidateArea;

    if(sameDate) score += 4;
    if(sameDealer) score += 4;
    if(samePounds) score += 3;
    if(sameAmount) score += 3;
    if(sameArea) score += 1;

    return score;
  }

  function findDuplicateTrip(candidate, excludeId=""){
    const state = getState();
    const trips = getTripsNewestFirst(Array.isArray(state.trips) ? state.trips : []);
    const excludedId = String(excludeId || "");
    let best = null;
    let bestScore = -1;
    let bestIndex = Number.POSITIVE_INFINITY;

    for(let i = 0; i < trips.length; i++){
      const t = trips[i];
      if(excludedId && String(t?.id || "") === excludedId) continue;
      const score = scoreDuplicateTripMatch(t, candidate);
      if(score < 0) continue;
      if(score > bestScore || (score === bestScore && i < bestIndex)){
        best = t;
        bestScore = score;
        bestIndex = i;
      }
    }

    return best;
  }

  function getAllTimeMetricSnapshot(trips){
    const rows = Array.isArray(trips) ? trips : [];
    const validRows = rows.filter(Boolean);
    if(!validRows.length) return null;

    const poundsRows = validRows.filter((t)=> Number(t?.pounds) > 0);
    const amountRows = validRows.filter((t)=> Number(t?.amount) > 0);
    const pplRows = validRows.filter((t)=> Number(t?.pounds) > 0 && Number(t?.amount) > 0);

    const pickExtreme = (sourceRows, valueOf, mode)=>{
      if(!sourceRows.length) return null;
      let pick = sourceRows[0];
      let value = valueOf(sourceRows[0]);
      for(let i = 1; i < sourceRows.length; i++){
        const v = valueOf(sourceRows[i]);
        if(mode === "high"){
          if(v > value){
            value = v;
            pick = sourceRows[i];
          }
        }else if(v < value){
          value = v;
          pick = sourceRows[i];
        }
      }
      return { id: String(pick?.id || ""), value: Number(value) || 0 };
    };

    return {
      pounds: {
        high: pickExtreme(poundsRows, (t)=> Number(t?.pounds) || 0, "high"),
        low: pickExtreme(poundsRows, (t)=> Number(t?.pounds) || 0, "low")
      },
      amount: {
        high: pickExtreme(amountRows, (t)=> Number(t?.amount) || 0, "high"),
        low: pickExtreme(amountRows, (t)=> Number(t?.amount) || 0, "low")
      },
      pricePerPound: {
        high: pickExtreme(pplRows, (t)=> computePPL(Number(t?.pounds) || 0, Number(t?.amount) || 0), "high"),
        low: pickExtreme(pplRows, (t)=> computePPL(Number(t?.pounds) || 0, Number(t?.amount) || 0), "low")
      }
    };
  }

  function buildAllTimeMilestoneToast(beforeSnap, afterSnap){
    const metricOrder = [
      { key: "pounds", label: "pounds", format: (v)=> `${to2(v)} lbs` },
      { key: "amount", label: "amount", format: (v)=> formatMoney(v) },
      { key: "pricePerPound", label: "price per pound", format: (v)=> `${formatMoney(v)}/lb` }
    ];

    const buildDetail = ({ delta, priorValue, format })=>{
      const signed = `${delta >= 0 ? "+" : "-"}${format(Math.abs(delta))}`;
      if(!(Number(priorValue) > 0)) return signed;
      const pct = (Math.abs(delta) / Number(priorValue)) * 100;
      if(!Number.isFinite(pct)) return signed;
      return `${signed} (${delta >= 0 ? "+" : "-"}${to2(pct)}%)`;
    };

    for(const metric of metricOrder){
      for(const direction of ["high", "low"]){
        const prev = beforeSnap?.[metric.key]?.[direction] || null;
        const next = afterSnap?.[metric.key]?.[direction] || null;
        if(!next || !next.id) continue;
        if(prev && prev.id === next.id && Math.abs((Number(prev.value) || 0) - (Number(next.value) || 0)) <= 0.0001) continue;

        const delta = Number(next.value) - (Number(prev?.value) || 0);
        const headline = `New all-time ${direction} ${metric.label}`;
        return {
          headline,
          detail: buildDetail({ delta, priorValue: Number(prev?.value) || 0, format: metric.format })
        };
      }
    }
    return null;
  }

  function logMilestoneDebug(payload = {}){
    try{
      console.debug("[milestone]", payload);
    }catch(_){ }
  }

  async function commitTripFromDraft({ mode, editId="", inputs, nextView="home" }){
    clearPendingTripUndo();
    const state = getState();
    const dateISO = parseUsDateToISODate(String(inputs?.date||""));
    const dealer = normalizeDealerDisplay(String(inputs?.dealer||"").trim());
    const poundsNum = parseNum(inputs?.pounds);
    const rawAmountNum = parseMoney(inputs?.amount);
    const rawWrittenCheckAmountNum = parseMoney(inputs?.writtenCheckAmount);
    const rateNum = parseMoney(inputs?.rate) || (Number.isFinite(poundsNum) && poundsNum > 0 && Number.isFinite(rawAmountNum) && rawAmountNum > 0 ? rawAmountNum / poundsNum : 0);
    const calculatedAmountNum = (Number.isFinite(poundsNum) && poundsNum > 0 && Number.isFinite(rateNum) && rateNum > 0)
      ? poundsNum * rateNum
      : rawAmountNum;
    const settlement = deriveTripSettlement({
      amount: calculatedAmountNum,
      writtenCheckAmount: rawWrittenCheckAmountNum
    });
    const amountNum = settlement.calculatedAmount;
    ensureAreas();
    const rawArea = String(inputs?.area||"").trim();
    const areaCreate = addArea(rawArea);
    const area = areaCreate?.value || rawArea;
    const species = String(inputs?.species || DEFAULT_TRIP_SPECIES).trim() || DEFAULT_TRIP_SPECIES;
    const notes = String(inputs?.notes || "").trim();

    const errs = [];
    if(!dateISO) errs.push("Date");
    if(!dealer) errs.push("Dealer");
    if(!isValidAreaValue(area)) errs.push("Area");
    if(!(poundsNum > 0)) errs.push("Pounds");
    if(!(rateNum > 0)) errs.push("Pay Rate");
    if(errs.length){
      announce(`Error: Missing/invalid: ${errs.join(", ")}`, "assertive");
      showToast("Missing/invalid: " + errs.join(", "), { haptic: "none" });
      return false;
    }

    const trips = Array.isArray(state.trips) ? state.trips : [];
    const isEdit = String(mode||"") === "edit";

    let existing = null;
    let id = "";
    if(isEdit){
      id = String(editId||"");
      existing = trips.find(t => String(t?.id||"") === id) || null;
      if(!existing){
        announce("Error: Trip not found. Returning home.", "assertive");
        showToast("Trip not found. Returning home.", { haptic: "none" });
        state.view = nextView;
        saveState();
        render();
        return false;
      }
    } else {
      id = uid();
    }

    const candidate = { dateISO, dealer, pounds: to2(poundsNum), amount: to2(amountNum), payRate: to2(rateNum), area };
    const dup = findDuplicateTrip(candidate, isEdit ? id : "");
    if(dup){
      const recentLabel = dup === getTripsNewestFirst(Array.isArray(state.trips) ? state.trips : [])[0]
        ? "A very recent similar trip was found."
        : "This may be a duplicate trip.";
      const msg = isEdit
        ? `${recentLabel}\n\nThis edit matches another trip:\n\nDate: ${formatDateDMY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave these changes anyway?`
        : `${recentLabel}\n\nDate: ${formatDateDMY(dup.dateISO)}\nDealer: ${dup.dealer||""}\nPounds: ${to2(dup.pounds)}\nAmount: ${formatMoney(dup.amount)}\n\nSave this trip anyway?`;
      const ok = await openConfirmModal({
        title: "Possible Duplicate",
        message: msg,
        confirmLabel: isEdit ? "Save Changes" : "Save Anyway",
        cancelLabel: "Cancel",
        confirmTone: "default"
      });
      if(!ok) return false;
    }

    const eventAt = new Date().toISOString();
    const tripWithAudit = appendTripHistoryEvent({
      ...(existing || {}),
      id,
      dateISO,
      dealer,
      pounds: to2(poundsNum),
      amount: to2(amountNum),
      calculatedAmount: to2(settlement.calculatedAmount),
      writtenCheckAmount: to2(settlement.writtenCheckAmount),
      dealerAdjustment: to2(settlement.dealerAdjustment),
      adjustmentClass: settlement.adjustmentClass,
      adjustmentClassification: settlement.adjustmentClassification,
      payRate: to2(rateNum),
      area,
      species,
      notes
    }, {
      type: isEdit ? "edited" : "created",
      at: eventAt,
      source: "manual"
    });
    const trip = !isEdit
      ? { ...tripWithAudit, createdAt: eventAt }
      : tripWithAudit;

    const tripNorm = normalizeTrip(canonicalizeTripArea(trip));
    const vErrs = validateTrip(tripNorm);
    if(vErrs.length){
      announce(`Error: Missing/invalid: ${vErrs.join(", ")}`, "assertive");
      showToast("Missing/invalid: " + vErrs.join(", "), { haptic: "none" });
      return false;
    }

    const beforeRecords = getAllTimeMetricSnapshot(trips);
    const nextTrips = isEdit
      ? trips.map(t => (String(t?.id||"") === id ? tripNorm : t))
      : trips.concat([tripNorm]);
    const afterRecords = getAllTimeMetricSnapshot(nextTrips);
    const milestoneToast = buildAllTimeMilestoneToast(beforeRecords, afterRecords);
    if(beforeRecords || afterRecords){
      logMilestoneDebug({
        stage: "resolved",
        beforeRecords,
        afterRecords,
        milestoneToast
      });
    }

    const undoSnapshot = {
      trips,
      view: state.view,
      navStack: Array.isArray(state.navStack) ? state.navStack : []
    };
    if(Object.prototype.hasOwnProperty.call(state, "editId")) undoSnapshot.editId = state.editId;
    if(Object.prototype.hasOwnProperty.call(state, "draft")) undoSnapshot.draft = state.draft;
    if(Object.prototype.hasOwnProperty.call(state, "reviewDraft")) undoSnapshot.reviewDraft = state.reviewDraft;

    state.trips = nextTrips;

    if(isEdit){
      delete state.editId;
    } else {
      delete state.draft;
      delete state.reviewDraft;
    }

    state.view = nextView;
    saveState();
    triggerHaptic("light");
    render();
    showUndoToast({ message: "Trip saved.", snapshot: undoSnapshot });
    if(milestoneToast){
      let celebrationShown = false;
      try{
        celebrationShown = showMilestoneToast({
          headline: milestoneToast.headline,
          detail: milestoneToast.detail
        }) === true;
      }catch(_){
        celebrationShown = false;
      }
      if(!celebrationShown){
        showToast(`All-time milestone reached: ${milestoneToast.headline}`);
      }
      logMilestoneDebug({
        stage: "ui",
        milestoneToast,
        celebrationShown,
        fallbackUsed: !celebrationShown
      });
    }
    if(!isEdit){ try{ setTimeout(()=>{ maybeOfferInstallAfterFirstSave(); }, 350); }catch(_){} }
    return true;
  }

  function ensureDeletedTripsState(){
    const state = getState();
    if(!Array.isArray(state.deletedTrips)) state.deletedTrips = [];
    state.deletedTrips = state.deletedTrips.filter((entry)=> entry && typeof entry === "object" && entry.trip && typeof entry.trip === "object");
    return state.deletedTrips;
  }

  function buildDeletedTripRecord(trip){
    const normalized = normalizeTrip(trip);
    if(!normalized) return null;
    return {
      id: uid("deleted_trip"),
      trip: normalized,
      tripId: String(normalized.id || ""),
      deletedAt: new Date().toISOString()
    };
  }

  function addTripToDeletedBin(trip){
    const record = buildDeletedTripRecord(trip);
    if(!record) return null;
    const deletedTrips = ensureDeletedTripsState();
    deletedTrips.unshift(record);
    if(deletedTrips.length > DELETED_TRIPS_LIMIT) deletedTrips.length = DELETED_TRIPS_LIMIT;
    return record;
  }

  function restoreDeletedTrip(deletedEntryId){
    const state = getState();
    const deletedTrips = ensureDeletedTripsState();
    const entryId = String(deletedEntryId || "");
    const entryIndex = deletedTrips.findIndex((entry)=> String(entry?.id || "") === entryId);
    if(entryIndex < 0) return { ok:false, reason:"missing" };
    const entry = deletedTrips[entryIndex];
    const restoredTrip = normalizeTrip(entry.trip);
    if(!restoredTrip) return { ok:false, reason:"invalid" };
    const trips = Array.isArray(state.trips) ? state.trips : [];
    if(trips.some((trip)=> String(trip?.id || "") === String(restoredTrip.id || ""))){
      restoredTrip.id = uid("t");
    }
    const dealerName = normalizeDealerDisplay(String(restoredTrip.dealer || "").trim());
    if(dealerName){
      if(!Array.isArray(state.dealers)) state.dealers = [];
      const dealerKey = normalizeKey(dealerName);
      const dealerExists = state.dealers.some((dealer)=> normalizeKey(String(dealer || "")) === dealerKey);
      if(!dealerExists){
        state.dealers.push(dealerName);
      }
    }
    ensureAreas();
    const rawArea = String(restoredTrip.area || "").trim();
    if(rawArea){
      const areaCreate = addArea(rawArea);
      if(areaCreate?.value){
        restoredTrip.area = areaCreate.value;
      }
    }
    state.trips = [restoredTrip, ...trips];
    state.deletedTrips = deletedTrips.filter((entry)=> String(entry?.id || "") !== entryId);
    return { ok:true, trip: restoredTrip, idChanged: String(entry?.tripId || "") !== String(restoredTrip.id || "") };
  }

  function permanentlyDeleteDeletedTrip(deletedEntryId){
    const state = getState();
    const deletedTrips = ensureDeletedTripsState();
    const entryId = String(deletedEntryId || "");
    const startLen = deletedTrips.length;
    state.deletedTrips = deletedTrips.filter((entry)=> String(entry?.id || "") !== entryId);
    return startLen !== state.deletedTrips.length;
  }

  function clearDeletedTripsBin(){
    const state = getState();
    const count = ensureDeletedTripsState().length;
    state.deletedTrips = [];
    return count;
  }

  return {
    commitTripFromDraft,
    findDuplicateTrip,
    clearPendingTripUndo,
    showUndoToast,
    ensureDeletedTripsState,
    buildDeletedTripRecord,
    addTripToDeletedBin,
    restoreDeletedTrip,
    permanentlyDeleteDeletedTrip,
    clearDeletedTripsBin
  };
}
