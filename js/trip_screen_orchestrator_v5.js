function createTripMetricSyncEngine({ parseNum, parseMoney, syncTargets }) {
  let syncingMetric = false;
  let lockPair = ["pounds", "rate"];

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
      const amount = getFieldValue("amount");
      if (lockPair[0] === "pounds" && lockPair[1] === "amount") {
        if (Number.isFinite(pounds) && pounds > 0 && Number.isFinite(amount) && amount > 0) setMetricValue("rate", amount / pounds, 2);
        else setMetricValue("rate", 0, 2);
        return;
      }
      if (Number.isFinite(pounds) && pounds > 0 && Number.isFinite(rate) && rate > 0) setMetricValue("amount", pounds * rate, 2);
      else setMetricValue("amount", 0, 2);
    } finally {
      syncingMetric = false;
    }
  }

  function onUserEdit(field) {
    if (syncingMetric) return;
    if (field === "amount") lockPair = ["pounds", "amount"];
    if (field === "rate") lockPair = ["pounds", "rate"];
  }

  return {
    updateDerivedField,
    onUserEdit,
    getLockPair: () => [...lockPair]
  };
}

const METRIC_HELPER_TEXT_BY_PAIR = Object.freeze({
  "pounds+rate": "Pounds × Pay Rate = Amount (auto-calculated).",
  "pounds+amount": "Pay Rate is auto-calculated from Pounds + Amount."
});

function getMetricHelperText(lockPair = []) {
  const key = Array.isArray(lockPair) ? lockPair.join("+") : "";
  return METRIC_HELPER_TEXT_BY_PAIR[key] || METRIC_HELPER_TEXT_BY_PAIR["pounds+rate"];
}

function sanitizeDecimalInput(raw){
  let s = String(raw || "").replace(/[^\d.,]/g, "");
  const decimalIdx = s.search(/[.,]/);
  if(decimalIdx !== -1){
    const intPart = s.slice(0, decimalIdx).replace(/[.,]/g, "");
    const fracPart = s.slice(decimalIdx + 1).replace(/[.,]/g, "");
    s = `${intPart}.${fracPart}`;
  }else{
    s = s.replace(/[.,]/g, "");
  }
  return s;
}

function primeNumericField(el, zeroValues){
  try{
    const v = String(el.value || "").trim();
    if(!v || (zeroValues || []).includes(v)){
      el.value = "";
    }else{
      requestAnimationFrame(()=>{ try{ el.select(); }catch(_){} });
    }
  }catch(_){ }
}

function normalizeAmountOnBlur(el, parseMoney){
  try{
    const s = String(el.value || "").trim();
    if(!s){ el.value = "0.00"; return; }
    const n = parseMoney(s);
    el.value = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }catch(_){ }
}

function display2(val){
  if(val === "" || val == null) return "";
  const n = Number(val);
  if(!Number.isFinite(n)) return String(val);
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2);
}

function displayAmount(val){
  return display2(val);
}

function renderSuggestions(list, current, dataAttr, escapeHtml){
  const cur = String(current||"").trim().toLowerCase();
  if(!cur) return "";
  const matches = [];
  for(const item of (Array.isArray(list)?list:[])){
    const s = String(item||"").trim();
    if(!s) continue;
    const key = s.toLowerCase();
    if(key === cur) continue;
    if(key.includes(cur)) matches.push(s);
    if(matches.length >= 8) break;
  }
  if(!matches.length) return "";
  return `<div class="muted small" style="margin-top:8px">Suggestions</div>
    <div class="chips" style="margin-top:8px">
      ${matches.map(s=>`<button class="chip" ${dataAttr}="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
    </div>`;
}

export function createTripScreenOrchestrator({
  state,
  ensureAreas,
  ensureDealers,
  DEFAULT_TRIP_SPECIES,
  isoToday,
  resolveQuickChipItems,
  getLastUniqueFromTrips,
  getDealerSelectList,
  buildDealerOptionsHtml,
  buildAreaOptionsHtml,
  renderTripEntryForm,
  escapeHtml,
  renderTopDealerChips,
  renderTopAreaChips,
  iconSvg,
  getApp,
  renderPageHeader,
  bindNavHandlers,
  bindDatePill,
  parseNum,
  parseMoney,
  formatMoney,
  deriveTripSettlement,
  computePPL,
  openModal,
  closeModal,
  normalizeKey,
  saveState,
  scheduleStateSave,
  computeTripSaveEnabled,
  isValidAreaValue,
  commitTripFromDraft,
  render,
  saveDraft,
  parseUsDateToISODate,
  formatDateDMY,
  normalizeDealerDisplay,
  announce,
  showToast,
  showFatal,
  DISPLAY_BUILD_VERSION,
  pushView,
  findCanonicalFromList,
  parseReportDateToISO,
  findDuplicateTrip,
  to2,
  openQuickChipCustomizeModal,
  bindQuickChipLongPress,
  bindAreaChips,
  bindQuickChips,
  clearPendingTripUndo,
  openConfirmModal,
  goBack,
  showUndoToast,
  renderHome,
  buildTripFormInputs,
  buildNewTripSaveSnapshot,
  buildTripProvenanceSummary,
  addTripToDeletedBin
}) {
function renderNewTrip(){
  ensureAreas();
  ensureDealers();
  const dealerAddSentinel = "__add_new_dealer__";
  const areaAddSentinel = "__add_new_area__";
  // Defaults
  const todayISO = new Date().toISOString().slice(0,10);
  const draft = state.draft || { dateISO: todayISO, dealer:"", pounds:"", amount:"", writtenCheckAmount:"", rate:"", area:"", species: DEFAULT_TRIP_SPECIES, notes:"" };
  const amountVal = String(draft.amount ?? "");
  const rateVal = String(draft.rate ?? "");
  const writtenCheckVal = String(draft.writtenCheckAmount ?? "");
  const settlementExpanded = Boolean(draft.settlementExpanded) || Boolean(writtenCheckVal);
  draft.species = String(draft.species || DEFAULT_TRIP_SPECIES).trim() || DEFAULT_TRIP_SPECIES;
  draft.notes = String(draft.notes || "");
  const settlementPreview = deriveTripSettlement({
    amount: parseMoney(draft.amount),
    writtenCheckAmount: parseMoney(draft.writtenCheckAmount)
  });


  // Recent (last 2) unique values from saved trips (ignores filters)
  // NOTE: Chips are always shown; if none exist yet we show a muted "No recent …" line.
  const topAreas = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 2), 2);
  const topDealers = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 2), 2);

  const dealerListForSelect = getDealerSelectList(topDealers, draft.dealer);
  const dealerOptions = buildDealerOptionsHtml(draft.dealer, dealerListForSelect, dealerAddSentinel);
  const areaOptions = buildAreaOptionsHtml(draft.area, areaAddSentinel);

const getBarSelectChoices = (kind)=>{
  if(kind === "dealer") return [...dealerListForSelect];
  return Array.isArray(state.areas) ? [...state.areas] : [];
};

const newTripFormHtml = renderTripEntryForm({
      mode: "new",
      formId: "newTripForm",
      dateId: "t_date",
      dealerId: "t_dealer",
      poundsId: "t_pounds",
      amountId: "t_amount",
      areaId: "t_area",
      speciesId: "t_species",
      notesId: "t_notes",
      rateId: "rateValue",
      settlementRevealId: "t_checkDiffToggle",
      settlementExpanded,
      writtenCheckAmountId: "t_written_check_amount",
      writtenCheckAmountValue: writtenCheckVal,
      settlementAdjustmentText: `${settlementPreview.dealerAdjustment >= 0 ? "+" : "-"}${formatMoney(Math.abs(settlementPreview.dealerAdjustment))}`,
      settlementHintText: settlementPreview.adjustmentClass === "rounded_up"
        ? "Likely rounded up."
        : (settlementPreview.adjustmentClass === "rounded_down" ? "Likely rounded down." : ""),
      dateValue: String(draft.dateISO || isoToday()),
      dealerOptions,
      areaOptions,
      speciesOptions: `<option value="${escapeHtml(DEFAULT_TRIP_SPECIES)}" selected>${escapeHtml(DEFAULT_TRIP_SPECIES)}</option>`,
      topDealerChipsHtml: renderTopDealerChips(topDealers, draft.dealer, "topDealers"),
      topAreaChipsHtml: renderTopAreaChips(topAreas, draft.area, "topAreas"),
      poundsValue: draft.pounds,
      amountValue: amountVal,
      rateValue: rateVal,
      notesValue: draft.notes,
      primaryActionLabel: "Save Trip",
      secondaryActionLabel: "Cancel",
      secondaryActionId: "navCancel",
      tertiaryActionLabel: "Clear Draft",
      tertiaryActionId: "clearDraft",
      dateIconHtml: iconSvg("calendar"),
      showSpeciesField: false,
      showNotesField: false,
      metricStateHelperId: "tripMetricStateHelperNew",
      metricStateHelperText: getMetricHelperText(["pounds", "rate"]),
      areaGuidanceText: "If the exact area is unknown, choose Area Not Recorded to save this trip accurately."
    }).replace("card formCard", "formCard");

;getApp().innerHTML = `
    ${renderPageHeader("new")}
    ${newTripFormHtml}
  `;
  bindNavHandlers(state);

  const elDate = document.getElementById("t_date");
  const elDealer = document.getElementById("t_dealer");
  const elPounds = document.getElementById("t_pounds");
  const elAmount = document.getElementById("t_amount");

  const elArea = document.getElementById("t_area");
  const elSpecies = document.getElementById("t_species");
  const elNotes = document.getElementById("t_notes");
  const elRate = document.getElementById("rateValue");
  const elWrittenCheckAmount = document.getElementById("t_written_check_amount");
  const elSettlementToggle = document.getElementById("t_checkDiffToggle");
  bindDatePill("t_date");

  const metricSync = createTripMetricSyncEngine({
    parseNum,
    parseMoney,
    computePPL,
    syncTargets: {
      pounds: elPounds,
      amount: elAmount,
      rate: elRate
    }
  });
  const metricStateHelperEl = document.getElementById("tripMetricStateHelperNew");
  const updateMetricStateHelper = ()=>{
    if(!metricStateHelperEl) return;
    metricStateHelperEl.textContent = getMetricHelperText(metricSync.getLockPair());
  };
  const updateRateLine = metricSync.updateDerivedField;
  const updateSettlementLine = ()=>{
    if(!elWrittenCheckAmount) return;
    const settlement = deriveTripSettlement({
      amount: parseMoney(elAmount?.value),
      writtenCheckAmount: parseMoney(elWrittenCheckAmount.value)
    });
    const adjustmentEl = document.getElementById("t_written_check_amount_adjustment");
    if(adjustmentEl){
      adjustmentEl.textContent = `${settlement.dealerAdjustment >= 0 ? "+" : "-"}${formatMoney(Math.abs(settlement.dealerAdjustment))}`;
    }
    const hintEl = document.querySelector("#newTripForm .tripSettlementHint");
    if(hintEl){
      hintEl.textContent = settlement.adjustmentClass === "rounded_up"
        ? "Likely rounded up."
        : (settlement.adjustmentClass === "rounded_down" ? "Likely rounded down." : "");
      hintEl.style.display = hintEl.textContent ? "block" : "none";
    }
  };
  updateMetricStateHelper();
  if(elSettlementToggle){
    elSettlementToggle.addEventListener("click", ()=>{
      const panel = document.querySelector("#newTripForm [data-settlement-panel]");
      if(!panel) return;
      const willOpen = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", willOpen);
      elSettlementToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      elSettlementToggle.textContent = willOpen ? "Hide check details" : "Check differs";
      state.draft = { ...(state.draft || draft), settlementExpanded: willOpen };
      saveDraft();
      if(willOpen) elWrittenCheckAmount?.focus();
    });
  }
  const createQuickAddHandler = ()=> (kind, opts = {})=>{
    const isDealer = (kind==="dealer");
    const label = isDealer ? "Dealer" : "Area";
    const placeholder = isDealer ? "New dealer name" : "New area (ex: 19/626)";
    const errId = "modalQuickAddErr";
    const inputId = "modalQuickAddInput";
    const addId = "modalQuickAddDoAdd";
    const cancelId = "modalQuickAddCancel";
    const onAdded = (typeof opts.onAdded === "function") ? opts.onAdded : null;

    openModal({
      title: `Add ${label}`,
      backdropClose: false,
      escClose: false,
      showCloseButton: false,
      position: "center",
      html: `
        <div class="field">
          <label class="srOnly" for="${inputId}">${escapeHtml(label)} name</label>
          <input class="input" id="${inputId}" placeholder="${escapeHtml(placeholder)}" autocomplete="${isDealer ? "organization" : "off"}" enterkeyhint="done" maxlength="40" />
          <div class="modalErr" id="${errId}" style="display:none"></div>
        </div>
        <div class="modalActions">
          <button class="btn" id="${cancelId}" type="button">Cancel</button>
          <button class="btn primary" id="${addId}" type="button">Add</button>
        </div>
      `,
      onOpen: ()=>{
        const elIn = document.getElementById(inputId);
        const elErr = document.getElementById(errId);
        const showErr = (msg)=>{ if(!elErr) return; elErr.textContent = msg; elErr.style.display = "block"; };
        const clearErr = ()=>{ if(!elErr) return; elErr.textContent = ""; elErr.style.display = "none"; };

        const commit = ()=>{
          clearErr();
          const raw = String(elIn?.value||"").trim();
          if(!raw){ showErr("Enter a value first."); elIn?.focus(); return; }
          if(raw.length > 40){ showErr("Keep it under 40 characters."); elIn?.focus(); return; }

          let addedValue = raw;
          if(isDealer){
            if(!Array.isArray(state.dealers)) state.dealers = [];
            const key = normalizeKey(raw);
            const exists = state.dealers.some(d => normalizeKey(String(d||"")) === key);
            if(exists){ showErr("That dealer already exists."); return; }
            state.dealers.push(raw);
            ensureDealers();
            addedValue = state.dealers.find(d => normalizeKey(String(d||"")) === key) || raw;
            state.draft = { ...(state.draft||draft), dealer: addedValue };
          }else{
            if(!Array.isArray(state.areas)) state.areas = [];
            const key = normalizeKey(raw);
            const exists = state.areas.some(a => normalizeKey(String(a||"")) === key);
            if(exists){ showErr("That area already exists."); return; }
            state.areas.push(raw);
            ensureAreas();
            addedValue = state.areas.find(a => normalizeKey(String(a||"")) === key) || raw;
            state.draft = { ...(state.draft||draft), area: addedValue };
          }

          saveState();
          closeModal();
          if(onAdded){ onAdded(addedValue); return; }
          render();
        };

        document.getElementById(cancelId)?.addEventListener("click", ()=>{ closeModal(); });
        document.getElementById(addId)?.addEventListener("click", commit);
        elIn?.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); commit(); } });
        setTimeout(()=>elIn?.focus(), 50);
      }
    });
  };
  const openQuickAdd = createQuickAddHandler();
  // Quick-pick chip containers
  const topAreaWrap = document.getElementById("topAreas");
  const topDealerWrap = document.getElementById("topDealers");

  // Enable Save only when required fields are valid, and keep lbs/$ coloring consistent.
  const updateSaveEnabled = ()=>{
    const ready = computeTripSaveEnabled({
      dealer: elDealer?.value,
      area: elArea?.value,
      poundsInput: elPounds?.value,
      rateInput: elRate?.value,
      parseNum,
      parseMoney,
      isValidAreaValue
    });

    if(elPounds) elPounds.classList.toggle("lbsBlue", ready.poundsOk);
    if(elAmount) elAmount.classList.toggle("money", Number(parseMoney(elAmount.value)) > 0);
    if(elRate) elRate.classList.toggle("ppl", ready.rateOk);

    const btn = document.getElementById("saveTrip");
    if(btn){
      const enabled = ready.enabled;
      btn.disabled = !enabled;
      btn.setAttribute("aria-disabled", enabled ? "false" : "true");
      // Prevent accidental taps while scrolling (iOS/Android)
      btn.style.pointerEvents = enabled ? "auto" : "none";
      btn.style.opacity = enabled ? "1" : "0.55";
    }
  };

  // Bind numeric field UX ONCE per render (never inside updateSaveEnabled)
  if(elPounds && !elPounds.__boundNumeric){
    elPounds.__boundNumeric = true;
    const prime = ()=>primeNumericField(elPounds, ["0","0.0","0.00"]);
    elPounds.addEventListener("pointerdown", prime);
    elPounds.addEventListener("focus", prime);
    elPounds.addEventListener("input", ()=>{
      metricSync.onUserEdit("pounds");
      updateMetricStateHelper();
      const s = sanitizeDecimalInput(elPounds.value);
      if(s !== elPounds.value) elPounds.value = s;
      updateSaveEnabled();
      updateRateLine();
      updateSettlementLine();
    });
    elPounds.addEventListener("blur", ()=>{
      if(String(elPounds.value||"").endsWith(".")) elPounds.value = String(elPounds.value).slice(0, -1);
      updateSaveEnabled();
      updateRateLine();
      updateSettlementLine();
    });
  }

  if(elRate && !elRate.__boundNumeric){
    elRate.__boundNumeric = true;
    const prime = ()=>primeNumericField(elRate, ["0","0.0","0.00"]);
    elRate.addEventListener("pointerdown", prime);
    elRate.addEventListener("focus", prime);
    elRate.addEventListener("input", ()=>{
      metricSync.onUserEdit("rate");
      updateMetricStateHelper();
      const s = sanitizeDecimalInput(elRate.value);
      if(s !== elRate.value) elRate.value = s;
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
    elRate.addEventListener("blur", ()=>{
      if(String(elRate.value||"").endsWith(".")) elRate.value = String(elRate.value).slice(0, -1);
      const rate = parseNum(elRate.value);
      if(rate > 0) elRate.value = rate.toFixed(2);
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
  }

  if(elAmount && !elAmount.__boundNumeric){
    elAmount.__boundNumeric = true;
    const prime = ()=>primeNumericField(elAmount, ["0","0.0","0.00"]);
    elAmount.addEventListener("pointerdown", prime);
    elAmount.addEventListener("focus", prime);
    elAmount.addEventListener("input", ()=>{
      metricSync.onUserEdit("amount");
      updateMetricStateHelper();
      const s = sanitizeDecimalInput(elAmount.value);
      if(s !== elAmount.value) elAmount.value = s;
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
    elAmount.addEventListener("blur", ()=>{
      if(String(elAmount.value||"").endsWith(".")) elAmount.value = String(elAmount.value).slice(0, -1);
      normalizeAmountOnBlur(elAmount, parseMoney);
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
  }
  if(elWrittenCheckAmount && !elWrittenCheckAmount.__boundNumeric){
    elWrittenCheckAmount.__boundNumeric = true;
    const prime = ()=>primeNumericField(elWrittenCheckAmount, ["0","0.0","0.00"]);
    elWrittenCheckAmount.addEventListener("pointerdown", prime);
    elWrittenCheckAmount.addEventListener("focus", prime);
    elWrittenCheckAmount.addEventListener("input", ()=>{
      const s = sanitizeDecimalInput(elWrittenCheckAmount.value);
      if(s !== elWrittenCheckAmount.value) elWrittenCheckAmount.value = s;
      updateSettlementLine();
      saveDraft();
    });
    elWrittenCheckAmount.addEventListener("blur", ()=>{
      if(String(elWrittenCheckAmount.value||"").endsWith(".")) elWrittenCheckAmount.value = String(elWrittenCheckAmount.value).slice(0, -1);
      normalizeAmountOnBlur(elWrittenCheckAmount, parseMoney);
      updateSettlementLine();
      saveDraft();
    });
  }

  const createNewTripSubmitHandler = (btnSave)=>async ()=>{
    try{
      if(btnSave?.disabled) return;
      if(state._savingTrip) return;
      state._savingTrip = true;
      saveState();

      const saveSnapshot = buildNewTripSaveSnapshot({
        rawDate: elDate?.value,
        rawDealer: elDealer?.value,
        rawPounds: elPounds?.value,
        rawAmount: elAmount?.value,
        rawWrittenCheckAmount: elWrittenCheckAmount?.value,
        rawRate: elRate?.value,
        rawArea: elArea?.value,
        rawSpecies: elSpecies?.value,
        rawNotes: elNotes?.value,
        defaultSpecies: DEFAULT_TRIP_SPECIES,
        parseUsDateToISODate,
        formatDateDMY,
        normalizeDealerDisplay,
        parseNum,
        parseMoney
      });
      state.draft = { ...(state.draft || {}), ...saveSnapshot.draft };

      if(!saveSnapshot.anyEntered){
        announce("Error: Enter trip details first", "assertive");
        showToast("Enter trip details first");
        state._savingTrip = false; saveState();
        return;
      }

      await commitTripFromDraft({
        mode: "new",
        inputs: saveSnapshot.inputs,
        nextView: "all_trips"
      });
      state._savingTrip = false; saveState();

    }catch(err){
      try{ showFatal(err, "saveTrip"); }catch{}
      state._savingTrip = false; saveState();
    }
  };

  // NEW TRIP: wire up buttons (Save / Cancel / Clear Draft) — v23
  const btnSave = document.getElementById("saveTrip");
  const onSaveTrip = createNewTripSubmitHandler(btnSave);
  const newTripForm = document.getElementById("newTripForm");
  if(newTripForm){
    newTripForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      onSaveTrip();
    });
  }
  if(elArea){
    elArea.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      onSaveTrip();
    });
  }
  if(btnSave){
    // iOS standalone can occasionally miss 'click'—bind both.
    btnSave.addEventListener("touchend", (e)=>{ if(btnSave.disabled) return; e.preventDefault(); onSaveTrip(); }, {passive:false});
  }
const btnClear = document.getElementById("clearDraft");
  if(btnClear){
    btnClear.onclick = async ()=>{
      const ok = await openConfirmModal({
        title: "Clear Draft",
        message: "Clear this draft?",
        confirmLabel: "Clear",
        cancelLabel: "Cancel"
      });
      if(!ok) return;
      delete state.draft;
      saveState();
      renderNewTrip();
    };
  }
  const createDraftHelpers = ()=>({
    persistDraft: ()=>{ try{ saveDraft(); }catch{}; try{ updateSaveEnabled(); }catch{} },
    persistDraftInput: ()=>{ try{ scheduleStateSave(); }catch{}; try{ updateSaveEnabled(); }catch{} },
    applyDraftValue: ({ key, value, inputEl })=>{
      const nextValue = String(value || "").trim();
      if(!nextValue || !inputEl) return;
      inputEl.value = nextValue;
      state.draft = state.draft || {};
      state.draft[key] = nextValue;
      saveDraft();
      updateSaveEnabled();
      updateRateLine();
    }
  });
  const { persistDraft, persistDraftInput, applyDraftValue } = createDraftHelpers();
  const captureLiveNewTripDraft = ()=>{
    state.draft = {
      ...(state.draft || {}),
      dateISO: String(elDate?.value || ""),
      dealer: String(elDealer?.value || ""),
      pounds: String(elPounds?.value || ""),
      amount: String(elAmount?.value || ""),
      writtenCheckAmount: String(elWrittenCheckAmount?.value || ""),
      rate: String(elRate?.value || ""),
      area: String(elArea?.value || ""),
      species: String(elSpecies?.value || DEFAULT_TRIP_SPECIES).trim() || DEFAULT_TRIP_SPECIES,
      notes: String(elNotes?.value || "")
    };
    return state.draft;
  };
  [elDate, elDealer, elPounds, elAmount, elRate, elWrittenCheckAmount, elSpecies, elNotes].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", persistDraftInput);
    el.addEventListener("change", persistDraft);
  });
  if(elArea){
    elArea.addEventListener("input", persistDraftInput);
    elArea.addEventListener("change", persistDraft);
  }

  const handleSelectAddNew = (kind, selectEl)=>{
    const sentinel = kind === "dealer" ? dealerAddSentinel : areaAddSentinel;
    const current = String(selectEl?.value || "");
    if(current !== sentinel) return false;
    openQuickAdd(kind, {
      onAdded: (addedValue)=>{
        const value = String(addedValue || "").trim();
        if(!value || !selectEl) return;
        const liveDraft = captureLiveNewTripDraft();
        selectEl.value = value;
        liveDraft[kind] = value;
        saveDraft();
        updateSaveEnabled();
        updateRateLine();
        renderNewTrip();
      }
    });
    return true;
  };

  elDealer?.addEventListener("change", ()=>{
    handleSelectAddNew("dealer", elDealer);
  });
  elArea?.addEventListener("change", ()=>{
    handleSelectAddNew("area", elArea);
  });

if(topAreaWrap && elArea){
  topAreaWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-area]");
    if(!btn) return;
    if(btn.__suppressNextClick){
      btn.__suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      return;
    }
    const a = String(btn.getAttribute("data-area") || "").trim();
    applyDraftValue({ key: "area", value: a, inputEl: elArea });
  });
}


if(topDealerWrap && elDealer){
  topDealerWrap.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-dealer]");
    if(!btn) return;
    if(btn.__suppressNextClick){
      btn.__suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      return;
    }
    const d = String(btn.getAttribute("data-dealer") || "").trim();
    applyDraftValue({ key: "dealer", value: d, inputEl: elDealer });
  });
}

  bindQuickChipLongPress(topAreaWrap, (btn)=>{
    const slot = Number(btn?.getAttribute("data-chip-index") || -1);
    if(slot < 0) return;
    openQuickChipCustomizeModal({
      kind: "area",
      chipIndex: slot,
      currentValue: String(btn?.getAttribute("data-area") || ""),
      choices: getBarSelectChoices("area"),
      onSaved: ()=>renderNewTrip()
    });
  });

  bindQuickChipLongPress(topDealerWrap, (btn)=>{
    const slot = Number(btn?.getAttribute("data-chip-index") || -1);
    if(slot < 0) return;
    openQuickChipCustomizeModal({
      kind: "dealer",
      chipIndex: slot,
      currentValue: String(btn?.getAttribute("data-dealer") || ""),
      choices: getBarSelectChoices("dealer"),
      onSaved: ()=>renderNewTrip()
    });
  });

  // Initial state
  updateSaveEnabled();
  updateRateLine();
  updateSettlementLine();
  updateMetricStateHelper();
}


function renderReviewTrip(){
  ensureAreas();
  ensureDealers();
  const d = state.reviewDraft;
  if(!d){
    state.view = "new";
    saveState();
    return renderNewTrip();
  }

  const ppl = computePPL(Number(d.pounds||0), Number(d.amount||0));
  const amountDispR = displayAmount(d.amount);

  // Build area options + top areas (same logic as New Trip)
  const areaOptionsR = ["", ...(Array.isArray(state.areas)?state.areas:[])].map(a=>{
    const label = a ? a : "—";
    const sel = (String(d.area||"") === String(a||"")) ? "selected" : "";
    return `<option value="${String(a||"").replaceAll('"','&quot;')}" ${sel}>${label}</option>`;
  }).join("");

  const dealerOptionsR = [""].concat(Array.isArray(state.dealers)?state.dealers:[]).map(dv=>{
    const label = dv ? dv : "—";
    const sel = (String(d.dealer||"").trim().toLowerCase() === String(dv||"").trim().toLowerCase()) ? "selected" : "";
    const v = String(dv||"").replaceAll('"',"&quot;");
    return `<option value="${v}" ${sel}>${escapeHtml(label)}</option>`;
  }).join("");

  const topAreasR = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 3), 3);

// Top 3 most-used Dealers (from saved trips) for quick selection
  // Last 3 unique Dealers (based on entry order; ignores filters)
  const topDealersR = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 3), 3);
getApp().innerHTML = `
    ${renderPageHeader("review")}

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center">
        <button class="smallbtn" id="navBack">← Back</button>
        <b>Review & Confirm</b>
        <span class="muted small">v ${DISPLAY_BUILD_VERSION}</span>
      </div>
      <div class="hint">Nothing saves until you press <b>Confirm &amp; Save Trip</b>. Edit any field if needed.</div>
    </div>

    <div class="card">
      <form class="form" id="reviewTripForm">
        <div class="field">
          <label class="label" for="r_date">Harvest date</label>
          <input class="input" id="r_date" type="date" enterkeyhint="next" value="${escapeHtml(String(d.dateISO||"").slice(0,10))}" />
        </div>

        <div class="field">
          <label class="label" for="r_dealer">Dealer</label>
          ${renderTopDealerChips(topDealersR, d.dealer, "topDealersR")}<input class="input" id="r_dealer" placeholder="Machias Bay Seafood" autocomplete="organization" enterkeyhint="next" value="${escapeHtml(String(d.dealer||""))}" />
          <div id="r_dealerSugg"></div>
          <div id="r_dealerPrompt"></div>
        </div>

        <div class="field">
          <label class="label" for="r_pounds">Pounds</label>
          <input class="input" id="r_pounds" type="text" inputmode="decimal" enterkeyhint="next" required min="0" step="0.1" pattern="[0-9]*[.,]?[0-9]*" value="${escapeHtml(String(d.pounds??""))}" />
        </div>

        <div class="field">
          <label class="label" for="r_amount">Amount</label>
          <input class="input" id="r_amount" type="text" inputmode="decimal" enterkeyhint="next" required min="0" step="0.01" pattern="[0-9]*[.,]?[0-9]*" value="${escapeHtml(String(amountDispR))}" />
        </div>

        <div class="field">
          <label class="label" for="r_area">Area</label>
          ${renderTopAreaChips(topAreasR, d.area, "topAreasR")}
          <select class="select" id="r_area" enterkeyhint="done">
            ${areaOptionsR}
          </select>
        </div>

        <div class="pillbar">
          <span class="pill" id="pplPill">Price/Lb: <b class="rate ppl">${formatMoney(ppl)}</b></span>
        </div>

        <div id="reviewWarnings"></div>

        ${d.raw ? `
          <div class="sep"></div>
          <div class="muted small" style="white-space:pre-wrap">${escapeHtml(d.raw)}</div>
        ` : ``}

        <div class="actions">
          <button class="btn good" id="confirmSave" type="submit">Confirm & Save Trip</button>
          <button class="btn ghost" id="cancelReview" type="button">Cancel</button>
        </div>
      </form>
    </div>
  `;

  getApp().scrollTop = 0;

  const goBack = ()=>{
    pushView(state, "new");
  };
  const __navBack = document.getElementById("navBack");
  if(__navBack) __navBack.onclick = ()=> goBack(state);
  const __cancelReview = document.getElementById("cancelReview");
  if(__cancelReview) __cancelReview.onclick = async ()=>{
    const ok = await openConfirmModal({
      title: "Discard Review Draft",
      message: "Discard this review draft?",
      confirmLabel: "Discard",
      cancelLabel: "Keep Editing"
    });
    if(!ok) return;
    delete state.reviewDraft;
    pushView(state, "new");
  };

  // Persist draft + live-update Price/Lb + Area selection
  const pplPill = document.getElementById("pplPill");
  const elPoundsLive = document.getElementById("r_pounds");
  const elAmountLive = document.getElementById("r_amount");
  const elAreaLive = document.getElementById("r_area");
  const elDateLive = document.getElementById("r_date");
  const elDealerLive = document.getElementById("r_dealer");

  const updateReviewDerived = (immediateSave = false)=>{
    if(!state.reviewDraft) return;
    const p = parseNum(elPoundsLive ? elPoundsLive.value : "");
    const a = parseMoney(elAmountLive ? elAmountLive.value : "");
    const area = String(elAreaLive ? elAreaLive.value : "").trim();
    const dateMDY = String(elDateLive ? elDateLive.value : "").trim();
    const dealer = normalizeDealerDisplay(String(elDealerLive ? elDealerLive.value : "").trim());
    state.reviewDraft.pounds = p;
    state.reviewDraft.amount = a;
    state.reviewDraft.area = area;
    state.reviewDraft.dateMDY = dateMDY;
    state.reviewDraft.dealer = dealer;

    // Color consistency: lbs blue, $ green
    try{
      const poundsOk = Number.isFinite(p) && p > 0;
      const amountOk = Number.isFinite(a) && a > 0;
      if(elPoundsLive) elPoundsLive.classList.toggle("lbsBlue", poundsOk);
      if(elAmountLive) elAmountLive.classList.toggle("money", amountOk);
    }catch(_){ }

    if(pplPill){
      const v = computePPL(Number(p||0), Number(a||0));
      pplPill.innerHTML = `Price/Lb: <b class="rate ppl">${formatMoney(v)}</b>`;
    }
    // Live warnings (missing fields + possible duplicate)
    try{
      const warnEl = document.getElementById("reviewWarnings");
      if(warnEl){
        const dateISO = parseReportDateToISO(document.getElementById("r_date")?.value || "");
        const dealer = normalizeDealerDisplay(String(document.getElementById("r_dealer")?.value || "").trim());
        const pounds = p;
        const amount = a;

        const missing = [];
        if(!dateISO) missing.push("Date");
        if(!dealer) missing.push("Dealer");
        if(!(pounds > 0)) missing.push("Pounds");
        if(!isValidAreaValue(document.getElementById("r_area")?.value || "")) missing.push("Area");
        if(!(amount > 0)) missing.push("Amount");

        const candidate = { dateISO, dealer, pounds, amount };
        const dup = (dateISO && dealer && pounds > 0 && amount > 0) ? findDuplicateTrip(candidate, null) : null;

        let html = "";
        if(missing.length){
          html += `
            <div class="card" style="border-color:rgba(255,184,77,.55);background:rgba(255,184,77,.10)">
              <b>Needs attention</b>
              <div class="muted small" style="margin-top:6px;line-height:1.35">
                Missing/invalid: <b>${missing.join(", ")}</b>
              </div>
            </div>
          `;
        }
        if(dup){
          html += `
            <div class="card" style="border-color:rgba(255,184,77,.55);background:rgba(255,184,77,.10)">
              <b>Possible duplicate</b>
              <div class="muted small" style="margin-top:6px;line-height:1.35">
                Similar trip found: <b>${escapeHtml(formatDateDMY(dup.dateISO||""))}</b> — ${escapeHtml(String(dup.dealer||""))} (<span class="money">${formatMoney(dup.amount||0)}</span> / <span class="lbsBlue">${to2(Number(dup.pounds||0))} lbs</span>)
              </div>
            </div>
          `;
        }
        warnEl.innerHTML = html;
      }
    }catch(_){}
    if(immediateSave) saveState();
    else scheduleStateSave();
  };

  function updateReviewDealerPrompt(){
    const box = document.getElementById("r_dealerPrompt");
    if(!box) return;
    const current = String(document.getElementById("r_dealer")?.value||"").trim();
    const canonical = findCanonicalFromList(current, state.dealers);
    if(!current || canonical){
      box.innerHTML = "";
      return;
    }
    const rd = state.reviewDraft || {};
    const armed = String(rd._dealerPromptValue||"").trim();
    const suppressed = String(rd._dealerPromptSuppressed||"").trim();
    if(!armed || armed.toLowerCase() !== current.toLowerCase()){
      box.innerHTML = "";
      return;
    }
    if(suppressed && suppressed.toLowerCase() === current.toLowerCase()){
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">
      <div class="muted small">Save <b>${escapeHtml(current)}</b> to Dealers?</div>
      <button class="smallbtn" id="r_saveDealer">Save</button>
      <button class="smallbtn" id="r_noSaveDealer">Not now</button>
    </div>`;

    document.getElementById("r_saveDealer")?.addEventListener("click", ()=>{
      state.dealers = Array.isArray(state.dealers) ? state.dealers : [];
      state.dealers.push(current);
      ensureDealers();
      saveState();

      const canon = findCanonicalFromList(current, state.dealers) || current;
      const el = document.getElementById("r_dealer");
      if(el) el.value = canon;
      
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft.dealer = canon;
      state.reviewDraft._dealerPromptValue = null;
      state.reviewDraft._dealerPromptSuppressed = null;
      saveState();
      renderReviewTrip();
    });

    document.getElementById("r_noSaveDealer")?.addEventListener("click", ()=>{
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft._dealerPromptSuppressed = current;
      state.reviewDraft._dealerPromptValue = null;
      saveState();
      updateReviewDealerPrompt();
    });
  }



  // iOS sometimes fires change more reliably than input for certain keyboards/pickers.
  [elPoundsLive, elAmountLive].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", ()=>updateReviewDerived(false));
    el.addEventListener("change", ()=>updateReviewDerived(true));
    el.addEventListener("blur", ()=>updateReviewDerived(true));
  });
  if(elAreaLive){
    elAreaLive.addEventListener("input", ()=>updateReviewDerived(false));
    elAreaLive.addEventListener("change", ()=>updateReviewDerived(true));
  }


  [elDateLive, elDealerLive].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", ()=>updateReviewDerived(false));
    el.addEventListener("change", ()=>updateReviewDerived(true));
    el.addEventListener("blur", ()=>updateReviewDerived(true));
  });

  if(elDealerLive){
    elDealerLive.addEventListener("blur", ()=>{
      const raw = String(elDealerLive.value||"").trim();
      const canonical = findCanonicalFromList(raw, state.dealers);
      if(canonical){
        elDealerLive.value = canonical;
        state.reviewDraft = state.reviewDraft || {};
        state.reviewDraft.dealer = canonical;
        state.reviewDraft._dealerPromptValue = null;
        state.reviewDraft._dealerPromptSuppressed = null;
        saveState();
        updateReviewDealerPrompt();
        updateReviewDerived();
        return;
      }
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft.dealer = raw;
      state.reviewDraft._dealerPromptValue = raw ? raw : null;
      saveState();
      updateReviewDealerPrompt();
      updateReviewDerived();
    });
    elDealerLive.addEventListener("input", ()=>{
      state.reviewDraft = state.reviewDraft || {};
      state.reviewDraft._dealerPromptValue = null;
      scheduleStateSave();
      updateReviewDealerPrompt();
    });
  }

  bindDatePill("r_date");
  
  
function updateReviewDealerSuggestions(){
  const wrap = document.getElementById("r_dealerSugg");
  const el = document.getElementById("r_dealer");
  if(!wrap || !el) return;
  wrap.innerHTML = renderSuggestions(state.dealers, el.value, "data-dealer-sugg-r", escapeHtml);
}
const topAreaWrapR = document.getElementById("topAreasR");
const topDealerWrapR = document.getElementById("topDealersR");

const dealerSuggWrapR = document.getElementById("r_dealerSugg");
if(dealerSuggWrapR && elDealerLive){
  dealerSuggWrapR.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-dealer-sugg-r]");
    if(!btn) return;
    const d = btn.getAttribute("data-dealer-sugg-r") || "";
    elDealerLive.value = d;
    state.reviewDraft = state.reviewDraft || {};
    state.reviewDraft.dealer = d;
    state.reviewDraft._dealerPromptValue = null;
    state.reviewDraft._dealerPromptSuppressed = null;
    saveState();
    updateReviewDealerPrompt();
    updateReviewDerived();
    updateReviewDealerSuggestions();
  });
}

if(elDealerLive){
  elDealerLive.addEventListener("input", ()=>{
    updateReviewDealerSuggestions();
  });
}
  if(topAreaWrapR && elAreaLive){
    bindQuickChips("topAreasR", "area", (area)=>{
      elAreaLive.value = area;
      updateReviewDerived();
    });
  }

  if(topDealerWrapR && elDealerLive){
    bindQuickChips("topDealersR", "dealer", (dealer)=>{
      elDealerLive.value = dealer;
      updateReviewDerived();
    });
  }

  bindQuickChipLongPress(topAreaWrapR, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "area",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-area") || ""),
      onSaved: ()=>renderReviewTrip()
    });
  });

  bindQuickChipLongPress(topDealerWrapR, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "dealer",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-dealer") || ""),
      onSaved: ()=>renderReviewTrip()
    });
  });

  // Ensure pill reflects whatever is currently in the inputs.
  updateReviewDerived();
  const reviewTripForm = document.getElementById("reviewTripForm");
  if(reviewTripForm) reviewTripForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const elDate = document.getElementById("r_date");
    const elDealer = document.getElementById("r_dealer");
    const elPounds = document.getElementById("r_pounds");
    const elAmount = document.getElementById("r_amount");
    const elArea = document.getElementById("r_area");
    commitTripFromDraft({
      mode: "new",
      inputs: {
        date: elDate.value,
        dealer: elDealer.value,
        pounds: elPounds.value,
        amount: elAmount.value,
        area: elArea.value,
        species: DEFAULT_TRIP_SPECIES
      }
    });
  });
  if(elAmountLive && elAreaLive){
    elAmountLive.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      elAreaLive.focus();
    });
  }
  if(elAreaLive && reviewTripForm){
    elAreaLive.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      reviewTripForm.requestSubmit();
    });
  }
}

function renderEditTrip(){
  ensureAreas();
  ensureDealers();
  const id = String(state.editId || "");
  const trips = Array.isArray(state.trips) ? state.trips : [];
  const t = trips.find(x => String(x?.id||"") === id);
  if(!t){
    // If the trip no longer exists (deleted, reset, or bad deep-link), fail safe.
    state.editId = null;
    state.view = "all_trips";
    saveState();
    return render();
  }

  const trip = t;

  const draft = {
    dateISO: t.dateISO || "",
    dealer: t.dealer || "",
    pounds: String(t.pounds ?? ""),
    amount: String(t.amount ?? ""),
    rate: String(t.payRate ?? ((Number(t.pounds) > 0 && Number(t.amount) > 0) ? (Number(t.amount) / Number(t.pounds)).toFixed(2) : "")),
    writtenCheckAmount: String(t.writtenCheckAmount ?? ""),
    area: t.area || "",
    species: t.species || DEFAULT_TRIP_SPECIES,
    notes: String(t.notes || "")
  };

  const dealerAddSentinel = "__add_new_dealer__";
  const areaAddSentinel = "__add_new_area__";
  const amountDispE = displayAmount(t.amount);
  const rateDispE = String(draft.rate ?? "");
  const settlementPreviewE = deriveTripSettlement({
    amount: Number(t.amount || 0),
    writtenCheckAmount: Number(t.writtenCheckAmount || 0)
  });
  const settlementExpandedE = settlementPreviewE.hasDifference || Boolean(draft.writtenCheckAmount);

  const topAreasE = resolveQuickChipItems("area", getLastUniqueFromTrips("area", 2), 2);
  const topDealersE = resolveQuickChipItems("dealer", getLastUniqueFromTrips("dealer", 2), 2);

  const dealerListForSelect = getDealerSelectList(topDealersE, draft.dealer);
  const dealerOptions = buildDealerOptionsHtml(draft.dealer, dealerListForSelect, dealerAddSentinel);
  const areaOptions = buildAreaOptionsHtml(draft.area, areaAddSentinel);


  const tripProvenance = buildTripProvenanceSummary(trip);
  const provenanceSummaryHtml = (tripProvenance.summaryLines.length || tripProvenance.historyItems.length)
    ? `
      <div class="card" style="margin-top:12px">
        <div class="muted small" style="text-transform:uppercase;letter-spacing:.08em">Trip audit</div>
        ${tripProvenance.summaryLines.length ? `<div class="mt8" style="display:grid;gap:6px">${tripProvenance.summaryLines.map((line)=>`<div class="muted small">${escapeHtml(line)}</div>`).join("")}</div>` : ""}
        ${tripProvenance.historyItems.length ? `<div class="sep" style="margin:10px 0"></div><div class="muted small">Recent activity</div><div class="mt8" style="display:grid;gap:6px">${tripProvenance.historyItems.map((line)=>`<div class="muted small">${escapeHtml(line)}</div>`).join("")}</div>` : ""}
      </div>
    `
    : "";

  const editTripFormHtml = renderTripEntryForm({
      mode: "edit",
      formId: "editTripForm",
      dateId: "e_date",
      dealerId: "e_dealer",
      poundsId: "e_pounds",
      amountId: "e_amount",
      areaId: "e_area",
      speciesId: "e_species",
      notesId: "e_notes",
      rateId: "rateValueEdit",
      settlementRevealId: "e_checkDiffToggle",
      settlementExpanded: settlementExpandedE,
      writtenCheckAmountId: "e_written_check_amount",
      writtenCheckAmountValue: draft.writtenCheckAmount,
      settlementAdjustmentText: `${settlementPreviewE.dealerAdjustment >= 0 ? "+" : "-"}${formatMoney(Math.abs(settlementPreviewE.dealerAdjustment))}`,
      settlementHintText: settlementPreviewE.adjustmentClass === "rounded_up"
        ? "Likely rounded up."
        : (settlementPreviewE.adjustmentClass === "rounded_down" ? "Likely rounded down." : ""),
      dateValue: draft.dateISO,
      dealerOptions,
      areaOptions,
      speciesOptions: `<option value="${escapeHtml(DEFAULT_TRIP_SPECIES)}" selected>${escapeHtml(DEFAULT_TRIP_SPECIES)}</option>`,
      topDealerChipsHtml: renderTopDealerChips(topDealersE, draft.dealer, "topDealersE"),
      topAreaChipsHtml: renderTopAreaChips(topAreasE, draft.area, "topAreasE"),
      poundsValue: draft.pounds,
      amountValue: amountDispE,
      rateValue: rateDispE,
      notesValue: draft.notes,
      primaryActionLabel: "Save Changes",
      secondaryActionLabel: "Cancel",
      secondaryActionId: "navCancel",
      tertiaryActionLabel: "Delete",
      tertiaryActionId: "deleteTrip",
      extraCardClass: "edit-mode",
      dateIconHtml: iconSvg("calendar"),
      showSpeciesField: false,
      showNotesField: false,
      metricStateHelperId: "tripMetricStateHelperEdit",
      metricStateHelperText: getMetricHelperText(["pounds", "rate"]),
      areaGuidanceText: "If the exact area is unknown, choose Area Not Recorded to keep this trip complete."
    }).replace("card formCard", "formCard");

  getApp().innerHTML = `
    ${renderPageHeader("edit")}
    ${editTripFormHtml}
    ${provenanceSummaryHtml}
  `;

  // ensure top on iPhone
  getApp().scrollTop = 0;

  const elDate = document.getElementById("e_date");
  const elDealer = document.getElementById("e_dealer");
  const elPounds = document.getElementById("e_pounds");
  const elAmount = document.getElementById("e_amount");
  const elArea = document.getElementById("e_area");
  const elSpecies = document.getElementById("e_species");
  const elNotes = document.getElementById("e_notes");
  const elRate = document.getElementById("rateValueEdit");
  const elWrittenCheckAmount = document.getElementById("e_written_check_amount");
  const elSettlementToggle = document.getElementById("e_checkDiffToggle");
  const topDealerWrapE = document.getElementById("topDealersE");
  const topAreaWrapE = document.getElementById("topAreasE");

  const metricSync = createTripMetricSyncEngine({
    parseNum,
    parseMoney,
    computePPL,
    syncTargets: {
      pounds: elPounds,
      amount: elAmount,
      rate: elRate
    }
  });
  const metricStateHelperEl = document.getElementById("tripMetricStateHelperEdit");
  const updateMetricStateHelper = ()=>{
    if(!metricStateHelperEl) return;
    metricStateHelperEl.textContent = getMetricHelperText(metricSync.getLockPair());
  };
  const updateRateLine = metricSync.updateDerivedField;
  const updateSettlementLine = ()=>{
    if(!elWrittenCheckAmount) return;
    const settlement = deriveTripSettlement({
      amount: parseMoney(elAmount?.value),
      writtenCheckAmount: parseMoney(elWrittenCheckAmount.value)
    });
    const adjustmentEl = document.getElementById("e_written_check_amount_adjustment");
    if(adjustmentEl){
      adjustmentEl.textContent = `${settlement.dealerAdjustment >= 0 ? "+" : "-"}${formatMoney(Math.abs(settlement.dealerAdjustment))}`;
    }
    const hintEl = document.querySelector("#editTripForm .tripSettlementHint");
    if(hintEl){
      hintEl.textContent = settlement.adjustmentClass === "rounded_up"
        ? "Likely rounded up."
        : (settlement.adjustmentClass === "rounded_down" ? "Likely rounded down." : "");
      hintEl.style.display = hintEl.textContent ? "block" : "none";
    }
  };
  if(elSettlementToggle){
    elSettlementToggle.addEventListener("click", ()=>{
      const panel = document.querySelector("#editTripForm [data-settlement-panel]");
      if(!panel) return;
      const willOpen = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", willOpen);
      elSettlementToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      elSettlementToggle.textContent = willOpen ? "Hide check details" : "Check differs";
      if(willOpen) elWrittenCheckAmount?.focus();
    });
  }

  const openQuickAdd = (kind, opts = {})=>{
    const isDealer = (kind === "dealer");
    const label = isDealer ? "Dealer" : "Area";
    const placeholder = isDealer ? "New dealer name" : "New area (ex: 19/626)";
    const errId = "modalQuickAddErr";
    const inputId = "modalQuickAddInput";
    const addId = "modalQuickAddDoAdd";
    const cancelId = "modalQuickAddCancel";
    const onAdded = (typeof opts.onAdded === "function") ? opts.onAdded : null;

    openModal({
      title: `Add ${label}`,
      backdropClose: false,
      escClose: false,
      showCloseButton: false,
      position: "center",
      html: `
        <div class="field">
          <label class="srOnly" for="${inputId}">${escapeHtml(label)} name</label>
          <input class="input" id="${inputId}" placeholder="${escapeHtml(placeholder)}" autocomplete="${isDealer ? "organization" : "off"}" enterkeyhint="done" maxlength="40" />
          <div class="modalErr" id="${errId}" style="display:none"></div>
        </div>
        <div class="modalActions">
          <button class="btn" id="${cancelId}" type="button">Cancel</button>
          <button class="btn primary" id="${addId}" type="button">Add</button>
        </div>
      `,
      onOpen: ()=>{
        const elIn = document.getElementById(inputId);
        const elErr = document.getElementById(errId);
        const showErr = (msg)=>{
          if(!elErr) return;
          elErr.textContent = msg;
          elErr.style.display = "block";
        };
        const clearErr = ()=>{
          if(!elErr) return;
          elErr.textContent = "";
          elErr.style.display = "none";
        };

        const commit = ()=>{
          clearErr();
          const raw = String(elIn?.value || "").trim();
          if(!raw){
            showErr("Enter a value first.");
            elIn?.focus();
            return;
          }
          if(raw.length > 40){
            showErr("Keep it under 40 characters.");
            elIn?.focus();
            return;
          }

          let addedValue = raw;
          if(isDealer){
            if(!Array.isArray(state.dealers)) state.dealers = [];
            const key = normalizeKey(raw);
            const exists = state.dealers.some(d => normalizeKey(String(d || "")) === key);
            if(exists){ showErr("That dealer already exists."); return; }
            state.dealers.push(raw);
            ensureDealers();
            addedValue = state.dealers.find(d => normalizeKey(String(d || "")) === key) || raw;
          }else{
            if(!Array.isArray(state.areas)) state.areas = [];
            const key = normalizeKey(raw);
            const exists = state.areas.some(a => normalizeKey(String(a || "")) === key);
            if(exists){ showErr("That area already exists."); return; }
            state.areas.push(raw);
            ensureAreas();
            addedValue = state.areas.find(a => normalizeKey(String(a || "")) === key) || raw;
          }

          saveState();
          closeModal();
          if(onAdded) onAdded(addedValue);
        };

        document.getElementById(cancelId)?.addEventListener("click", ()=>closeModal());
        document.getElementById(addId)?.addEventListener("click", commit);
        elIn?.addEventListener("keydown", (e)=>{
          if(e.key !== "Enter") return;
          e.preventDefault();
          commit();
        });

        setTimeout(()=>elIn?.focus(), 50);
      }
    });
  };

  bindAreaChips("topAreasE", (a)=>{
    const nextArea = String(a||"").trim();
    if(!nextArea) return;
    elArea.value = nextArea;
    updateSaveEnabled();
  });
  if(topDealerWrapE && elDealer){
    topDealerWrapE.addEventListener("click", (e)=>{
      const btn = e.target.closest("button[data-dealer]");
      if(!btn) return;
      if(btn.__suppressNextClick){
        btn.__suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        if(typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        return;
      }
      const nextDealer = String(btn.getAttribute("data-dealer") || "").trim();
      if(!nextDealer) return;
      elDealer.value = nextDealer;
      updateSaveEnabled();
    });
  }

  const handleSelectAddNew = (kind, selectEl)=>{
    const sentinel = kind === "dealer" ? dealerAddSentinel : areaAddSentinel;
    if(String(selectEl?.value || "") !== sentinel) return;
    openQuickAdd(kind, {
      onAdded: (addedValue)=>{
        if(!selectEl) return;
        selectEl.value = String(addedValue || "").trim();
        updateSaveEnabled();
      }
    });
  };
  elDealer?.addEventListener("change", ()=>handleSelectAddNew("dealer", elDealer));
  elArea?.addEventListener("change", ()=>handleSelectAddNew("area", elArea));


  bindQuickChipLongPress(topDealerWrapE, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "dealer",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-dealer") || ""),
      choices: [...dealerListForSelect],
      onSaved: ()=>renderEditTrip()
    });
  });
  bindQuickChipLongPress(topAreaWrapE, (btn)=>{
    const chipIndex = Number(btn?.getAttribute("data-chip-index") || -1);
    if(chipIndex < 0) return;
    openQuickChipCustomizeModal({
      kind: "area",
      chipIndex,
      currentValue: String(btn?.getAttribute("data-area") || ""),
      onSaved: ()=>renderEditTrip()
    });
  });
  bindDatePill("e_date");

  bindNavHandlers(state);

  // Color consistency: lbs blue, $ green
  const updateSaveEnabled = ()=>{
    try{
      const ready = computeTripSaveEnabled({
        dealer: (String(elDealer?.value || "") === dealerAddSentinel) ? "" : elDealer?.value,
        area: elArea?.value,
        poundsInput: elPounds?.value,
        rateInput: elRate?.value,
        parseNum,
        parseMoney,
        isValidAreaValue
      });
      if(elPounds) elPounds.classList.toggle("lbsBlue", ready.poundsOk);
      if(elAmount) elAmount.classList.toggle("money", Number(parseMoney(elAmount.value)) > 0);
      if(elRate) elRate.classList.toggle("ppl", ready.rateOk);
      const btn = document.getElementById("saveEdit");
      if(btn){
        const enabled = ready.enabled;
        btn.disabled = !enabled;
        btn.setAttribute("aria-disabled", enabled ? "false" : "true");
        btn.style.pointerEvents = enabled ? "auto" : "none";
        btn.style.opacity = enabled ? "1" : "0.55";
      }
    }catch(_){ }
  };
  updateSaveEnabled();
  updateRateLine();
  updateSettlementLine();
  updateMetricStateHelper();

  // Big-number keypad + better formatting (match New Trip)
  if(elPounds && !elPounds.__boundNumeric){
    elPounds.__boundNumeric = true;
    const prime = ()=>primeNumericField(elPounds, ["0","0.","0.0"]);
    elPounds.addEventListener("pointerdown", prime);
    elPounds.addEventListener("focus", prime);
    elPounds.addEventListener("input", ()=>{
      metricSync.onUserEdit("pounds");
      updateMetricStateHelper();
      const s = sanitizeDecimalInput(elPounds.value);
      if(s !== elPounds.value) elPounds.value = s;
      updateSaveEnabled();
      updateRateLine();
      updateSettlementLine();
    });
    elPounds.addEventListener("blur", ()=>{
      if(String(elPounds.value||"").endsWith(".")) elPounds.value = String(elPounds.value).slice(0, -1);
      updateSaveEnabled();
      updateRateLine();
      updateSettlementLine();
    });
  }

  if(elRate && !elRate.__boundNumeric){
    elRate.__boundNumeric = true;
    const prime = ()=>primeNumericField(elRate, ["0","0.0","0.00"]);
    elRate.addEventListener("pointerdown", prime);
    elRate.addEventListener("focus", prime);
    elRate.addEventListener("input", ()=>{
      metricSync.onUserEdit("rate");
      updateMetricStateHelper();
      const s = sanitizeDecimalInput(elRate.value);
      if(s !== elRate.value) elRate.value = s;
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
    elRate.addEventListener("blur", ()=>{
      if(String(elRate.value||"").endsWith(".")) elRate.value = String(elRate.value).slice(0, -1);
      const rate = parseNum(elRate.value);
      if(rate > 0) elRate.value = rate.toFixed(2);
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
  }

  if(elAmount && !elAmount.__boundNumeric){
    elAmount.__boundNumeric = true;
    const prime = ()=>primeNumericField(elAmount, ["0","0.0","0.00"]);
    elAmount.addEventListener("pointerdown", prime);
    elAmount.addEventListener("focus", prime);
    elAmount.addEventListener("input", ()=>{
      metricSync.onUserEdit("amount");
      updateMetricStateHelper();
      const s = sanitizeDecimalInput(elAmount.value);
      if(s !== elAmount.value) elAmount.value = s;
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
    elAmount.addEventListener("blur", ()=>{
      if(String(elAmount.value||"").endsWith(".")) elAmount.value = String(elAmount.value).slice(0, -1);
      normalizeAmountOnBlur(elAmount, parseMoney);
      updateRateLine();
      updateSaveEnabled();
      updateSettlementLine();
    });
  }
  if(elWrittenCheckAmount && !elWrittenCheckAmount.__boundNumeric){
    elWrittenCheckAmount.__boundNumeric = true;
    const prime = ()=>primeNumericField(elWrittenCheckAmount, ["0","0.0","0.00"]);
    elWrittenCheckAmount.addEventListener("pointerdown", prime);
    elWrittenCheckAmount.addEventListener("focus", prime);
    elWrittenCheckAmount.addEventListener("input", ()=>{
      const s = sanitizeDecimalInput(elWrittenCheckAmount.value);
      if(s !== elWrittenCheckAmount.value) elWrittenCheckAmount.value = s;
      updateSettlementLine();
      updateSaveEnabled();
    });
    elWrittenCheckAmount.addEventListener("blur", ()=>{
      if(String(elWrittenCheckAmount.value||"").endsWith(".")) elWrittenCheckAmount.value = String(elWrittenCheckAmount.value).slice(0, -1);
      normalizeAmountOnBlur(elWrittenCheckAmount, parseMoney);
      updateSettlementLine();
      updateSaveEnabled();
    });
  }

  [elDate, elDealer, elPounds, elAmount, elWrittenCheckAmount, elArea, elSpecies, elNotes].forEach(el=>{
    if(!el) return;
    el.addEventListener("input", ()=>{ updateSaveEnabled(); updateRateLine(); updateSettlementLine(); });
    el.addEventListener("change", ()=>{ updateSaveEnabled(); updateRateLine(); updateSettlementLine(); });
  });

  const editTripForm = document.getElementById("editTripForm");
  if(editTripForm) editTripForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    await commitTripFromDraft({
      mode: "edit",
      editId: id,
      inputs: buildTripFormInputs({
        date: elDate.value,
        dealer: elDealer.value,
        pounds: elPounds.value,
        amount: elAmount.value,
        writtenCheckAmount: elWrittenCheckAmount?.value || "",
        rate: elRate.value,
        area: elArea.value,
        species: elSpecies?.value || draft.species || DEFAULT_TRIP_SPECIES,
        notes: (elNotes?.value ?? draft.notes ?? ""),
        defaultSpecies: DEFAULT_TRIP_SPECIES
      })
    });
  });
  if(elArea && editTripForm){
    elArea.addEventListener("keydown", (e)=>{
      if(e.key !== "Enter") return;
      e.preventDefault();
      editTripForm.requestSubmit();
    });
  }

  document.getElementById("deleteTrip").onclick = async ()=>{
    clearPendingTripUndo();
    const ok = await openConfirmModal({
      title: "Delete Trip",
      message: "Move this trip to Recently Deleted? You can restore it later from Settings.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel"
    });
    if(!ok) return;
    const undoSnapshot = {
      trips,
      deletedTrips: Array.isArray(state.deletedTrips) ? [...state.deletedTrips] : [],
      view: state.view
    };
    if(Object.prototype.hasOwnProperty.call(state, "editId")) undoSnapshot.editId = state.editId;
    if(Object.prototype.hasOwnProperty.call(state, "draft")) undoSnapshot.draft = state.draft;
    if(Object.prototype.hasOwnProperty.call(state, "reviewDraft")) undoSnapshot.reviewDraft = state.reviewDraft;
    addTripToDeletedBin(t);
    state.trips = trips.filter(x => String(x?.id||"") !== id);
    delete state.editId;
    saveState();
    goBack(state);
    showUndoToast({ message: "Moved to Recently Deleted", snapshot: undoSnapshot });
  };
}

  return {
    renderNewTrip,
    renderReviewTrip,
    renderEditTrip
  };
}
