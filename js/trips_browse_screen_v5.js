export function createTripsBrowseScreenRenderer(deps){
  const {
    ensureTripsFilter,
    getApp,
    getTripsFilteredRows,
    getFilterOptionsFromTrips,
    escapeHtml,
    tripsActiveLabel,
    renderTripsBrowseInteractiveTripCard,
    renderPageHeader,
    bindNavHandlers,
    getState,
    saveState,
    scheduleStateSave,
    renderApp,
    normalizeCustomRangeWithFeedback,
    bindDatePill,
    exportTripsWithLabel,
    showToast
  } = deps;

  function resetTripsFilters(state){
    state.filters = state.filters || {};
    state.filters.active = { range:"ytd", fromISO:"", toISO:"", dealer:"all", area:"all", species:"all", text:"", customRangeCorrectionMessages:[] };
    state.tripsFilter = state.filters.active;
  }

  function renderAllTrips(){
    const state = getState();
    ensureTripsFilter();
    const root = getApp();

    const { rows:sorted, range:r, tf, transparency } = getTripsFilteredRows();
    const opt = getFilterOptionsFromTrips();
    const excludedQuarantinedCount = Number(transparency?.excludedQuarantinedCount || 0);
    const quarantinedSupportNote = excludedQuarantinedCount > 0
      ? `<div class="muted small mt8 tripsQuarantineSupportNote" role="status">Some trips are excluded from date filters because their date is invalid (quarantined): ${excludedQuarantinedCount}.</div>`
      : "";

    const rangeOptions = [
      ["all","All Time"],
      ["ytd","YTD"],
      ["12m","Last 12 Months"],
      ["90d","Last 90 Days"],
      ["30d","Last 30 Days"],
      ["custom","Custom Range"]
    ];
    const customRangeCorrectionMessages = Array.isArray(tf.customRangeCorrectionMessages) ? tf.customRangeCorrectionMessages : [];
    const customRangeCorrectionHtml = (tf.range === "custom" && customRangeCorrectionMessages.length)
      ? `<div class="muted small mt8 tripsCustomRangeNote" aria-live="polite">${customRangeCorrectionMessages.map((msg)=>`<div>${escapeHtml(msg)}</div>`).join("")}</div>`
      : "";

    const filtersCard = `
      <div class="card tripsFiltersCard tripsBrowseFiltersCard">
        <div class="tripsFiltersGrid">
          <div class="tripsFilterField">
            <div class="muted small">Range</div>
            <select id="flt_range" class="select">
              ${rangeOptions.map(([k,l])=>`<option value="${k}" ${tf.range===k?"selected":""}>${l}</option>`).join("")}
            </select>
          </div>

          <div class="tripsFilterField">
            <div class="muted small">Dealer</div>
            <select id="flt_dealer" class="select">
              <option value="all" ${tf.dealer==="all"?"selected":""}>All</option>
              ${opt.dealers.map(d=>`<option value="${escapeHtml(d)}" ${tf.dealer===d?"selected":""}>${escapeHtml(d)}</option>`).join("")}
            </select>
          </div>

          <div class="tripsFilterField">
            <div class="muted small">Area</div>
            <select id="flt_area" class="select">
              <option value="all" ${tf.area==="all"?"selected":""}>All</option>
              ${opt.areas.map(a=>`<option value="${escapeHtml(a)}" ${tf.area===a?"selected":""}>${escapeHtml(a)}</option>`).join("")}
            </select>
          </div>

          <div class="tripsFilterField tripsFilterField--disabled">
            <div class="muted small">Species</div>
            <select id="flt_species" class="select" disabled aria-disabled="true">
              <option>Coming soon</option>
            </select>
          </div>

        </div>

        <div class="tripsFilterActions">
          <div class="tripsFilterActionExport">
            <button class="btn" id="exportTrips" type="button">Export CSV</button>
          </div>
          <button class="btn btn-ghost" id="flt_reset" type="button">Reset</button>
        </div>

        <div id="flt_custom_wrap" class="tripsCustomRangeWrap" style="display:${tf.range==="custom"?"block":"none"}">
          <div class="row tripsCustomRangeRow">
            <div class="tripsFilterField">
              <div class="muted small">From</div>
              <input id="flt_from" type="date" class="input" value="${escapeHtml(String(tf.fromISO||"").slice(0,10))}" />
            </div>
            <div class="tripsFilterField">
              <div class="muted small">To</div>
              <input id="flt_to" type="date" class="input" value="${escapeHtml(String(tf.toISO||"").slice(0,10))}" />
            </div>
          </div>
          ${customRangeCorrectionHtml}
        </div>

        <div class="muted small mt10 tripsFilterSummary">
          <b>${escapeHtml(tripsActiveLabel(tf, r.label))}</b>
        </div>
        ${quarantinedSupportNote}
      </div>
    `;

    const rows = sorted.length
      ? sorted.map(t=> renderTripsBrowseInteractiveTripCard(t)).join("")
      : `
        <div class="emptyState tripsEmptyState">
          <div class="emptyStateTitle">No trips in this Trips view</div>
          <div class="emptyStateBody">No trips match this view yet. Add a trip, or clear filters if needed.</div>
          ${excludedQuarantinedCount > 0 ? `<div class="emptyStateFollowup">Some trips are excluded from date filters because their date is invalid (quarantined): ${excludedQuarantinedCount}.</div>` : ""}
          <div class="emptyStateAction">
            <button class="btn good" id="tripsEmptyAdd" type="button">＋ Add Trip</button>
            <button class="btn" id="tripsEmptyReset" type="button">Clear filters</button>
          </div>
        </div>`;

    root.innerHTML = `
      ${renderPageHeader("all_trips")}

      <div class="screenFirstCard">
        ${filtersCard}
      </div>

      <div class="triplist tripsBrowseList">
        ${rows}
      </div>
    `;

    bindNavHandlers(state);
    root.querySelectorAll(".triprow").forEach(el=>{
      el.addEventListener("click", ()=>{
        const id = el.getAttribute("data-id") || "";
        if(!id) return;
        state.editId = id;
        state.view = "edit";
        saveState();
        renderApp();
      });
    });

    const rerender = ()=>{ scheduleStateSave(); renderAllTrips(); };

    const rangeEl = document.getElementById("flt_range");
    rangeEl?.addEventListener("change", ()=>{
      tf.range = rangeEl.value;
      if(tf.range === "custom"){
        const normalized = normalizeCustomRangeWithFeedback({ fromISO: tf.fromISO, toISO: tf.toISO });
        tf.fromISO = normalized.fromISO;
        tf.toISO = normalized.toISO;
        tf.customRangeCorrectionMessages = normalized.messages;
      }else{
        tf.customRangeCorrectionMessages = [];
      }
      rerender();
    });

    document.getElementById("flt_dealer")?.addEventListener("change", (ev)=>{ tf.dealer = ev.target.value; rerender(); });
    document.getElementById("flt_area")?.addEventListener("change", (ev)=>{ tf.area = ev.target.value; rerender(); });

    const fromEl = document.getElementById("flt_from");
    const toEl = document.getElementById("flt_to");
    fromEl?.addEventListener("change", ()=>{
      tf.fromISO = fromEl.value;
      tf.range = "custom";
      const normalized = normalizeCustomRangeWithFeedback({ fromISO: tf.fromISO, toISO: tf.toISO });
      tf.fromISO = normalized.fromISO;
      tf.toISO = normalized.toISO;
      tf.customRangeCorrectionMessages = normalized.messages;
      rerender();
    });
    toEl?.addEventListener("change", ()=>{
      tf.toISO = toEl.value;
      tf.range = "custom";
      const normalized = normalizeCustomRangeWithFeedback({ fromISO: tf.fromISO, toISO: tf.toISO });
      tf.fromISO = normalized.fromISO;
      tf.toISO = normalized.toISO;
      tf.customRangeCorrectionMessages = normalized.messages;
      rerender();
    });
    bindDatePill("flt_from");
    bindDatePill("flt_to");

    document.getElementById("flt_reset")?.addEventListener("click", ()=>{
      resetTripsFilters(state);
      saveState();
      renderAllTrips();
    });

    const exportBtn = document.getElementById("exportTrips");
    if(exportBtn){
      exportBtn.onclick = ()=>{
        const { rows, range } = getTripsFilteredRows();
        exportTripsWithLabel(rows, range.label, range.startISO, range.endISO);
        showToast("CSV exported");
      };
    }

    const tripsEmptyAdd = document.getElementById("tripsEmptyAdd");
    if (tripsEmptyAdd) {
      tripsEmptyAdd.onclick = () => {
        state.view = "new";
        saveState();
        renderApp();
      };
    }

    const tripsEmptyReset = document.getElementById("tripsEmptyReset");
    if (tripsEmptyReset) {
      tripsEmptyReset.onclick = () => {
        resetTripsFilters(state);
        saveState();
        showToast("Filters cleared");
        renderAllTrips();
      };
    }
  }

  return {
    renderAllTrips
  };
}
