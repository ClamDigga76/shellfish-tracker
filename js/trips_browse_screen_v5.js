export function createTripsBrowseScreenRenderer(deps){
  const {
    getApp,
    getFilterOptionsFromTrips,
    escapeHtml,
    renderTripsBrowseInteractiveTripCard,
    renderPageHeader,
    bindNavHandlers,
    getState,
    saveState,
    scheduleStateSave,
    renderApp,
    showToast,
    ensureTripsFilter,
    getTripsFilteredRows,
    resetTripsFilters
  } = deps;

  function renderAllTrips(){
    const state = getState();
    ensureTripsFilter(state);
    const root = getApp();
    const ui = state.ui = state.ui || {};

    const { rows:sorted, range:r, tf, transparency } = getTripsFilteredRows(state);
    const opt = getFilterOptionsFromTrips();
    const hasActiveTripsFilters = Boolean(
      (tf.range || "ytd") !== "ytd" ||
      String(tf.dealer || "all") !== "all" ||
      String(tf.area || "all") !== "all" ||
      String(tf.species || "all") !== "all" ||
      String(tf.fromISO || "").trim() !== "" ||
      String(tf.toISO || "").trim() !== "" ||
      String(tf.text || "").trim() !== "" ||
      String(tf.sort || "newest") !== "newest"
    );
    const isFiltersExpanded = ui.tripsFiltersExpanded === true;
    const resolvedRangeLabel = r.label || "YTD";
    const dealerSummary = String(tf.dealer || "all") === "all" ? "All dealers" : `${tf.dealer}`;
    const areaSummary = String(tf.area || "all") === "all" ? "All areas" : `${tf.area}`;
    const tripsCountSummary = `${sorted.length} ${sorted.length === 1 ? "trip" : "trips"}`;
    const sortSummary = tf.sort === "oldest" ? "Oldest first" : "Newest first";
    const excludedQuarantinedCount = Number(transparency?.excludedQuarantinedCount || 0);
    const quarantinedSupportNote = excludedQuarantinedCount > 0
      ? `<div class="muted small mt8 tripsQuarantineSupportNote" role="status">Some trips are excluded from date filters because their date is invalid (quarantined): ${excludedQuarantinedCount}.</div>`
      : "";

    const quickRangeOptions = [
      ["mtd","Current Month"],
      ["ytd","YTD"],
      ["all","All Time"]
    ];
    const isLegacyCustomRange = tf.range === "custom";

    const filtersCard = `
      <div class="card tripsFiltersCard tripsBrowseFiltersCard">
        <div class="tripsFiltersSummaryRow">
          <div class="tripsFiltersSummaryBlock">
            <div class="tripsFiltersSummaryPrimary">${escapeHtml(`${resolvedRangeLabel} · ${tripsCountSummary}`)}</div>
            <div class="tripsFiltersSummarySecondary" title="${escapeHtml(`${dealerSummary} · ${areaSummary} · ${sortSummary}`)}">${escapeHtml(`${dealerSummary} · ${areaSummary} · ${sortSummary}`)}</div>
          </div>
          <div class="tripsFiltersSummaryActions">
            <button class="btn btn-ghost tripsFiltersToggleBtn" id="tripsFiltersToggle" type="button" aria-expanded="${isFiltersExpanded ? "true" : "false"}" aria-controls="tripsFiltersBody">${isFiltersExpanded ? "Hide filters" : "Filters"}</button>
          </div>
        </div>

        ${isFiltersExpanded ? `
          <div id="tripsFiltersBody" class="tripsFiltersBody">
            <div class="tripsFiltersPanelTitle">Filters</div>

            <div class="tripsFiltersSection">
              <div class="tripsFiltersSectionLabel">Quick Range</div>
              <div class="tripsFiltersQuickRange" role="group" aria-label="Quick Range">
                ${quickRangeOptions.map(([k,l])=>`<button class="btn tripsFilterChip ${tf.range===k?"is-selected":""}" type="button" data-trips-range="${k}">${l}</button>`).join("")}
              </div>
            </div>

            <div class="tripsFiltersSection">
              <div class="tripsFiltersSectionLabel">Dealer</div>
              <select id="flt_dealer" class="select">
                <option value="all" ${tf.dealer==="all"?"selected":""}>All dealers</option>
                ${opt.dealers.map(d=>`<option value="${escapeHtml(d)}" ${tf.dealer===d?"selected":""}>${escapeHtml(d)}</option>`).join("")}
              </select>
            </div>

            <div class="tripsFiltersSection">
              <div class="tripsFiltersSectionLabel">Area</div>
              <select id="flt_area" class="select">
                <option value="all" ${tf.area==="all"?"selected":""}>All areas</option>
                ${opt.areas.map(a=>`<option value="${escapeHtml(a)}" ${tf.area===a?"selected":""}>${escapeHtml(a)}</option>`).join("")}
              </select>
            </div>

            <div class="tripsFiltersSection">
              <div class="tripsFiltersSectionLabel">Sort</div>
              <div class="tripsFiltersQuickRange" role="group" aria-label="Sort Trips">
                <button class="btn tripsFilterChip ${tf.sort !== "oldest" ? "is-selected" : ""}" type="button" data-trips-sort="newest">Newest first</button>
                <button class="btn tripsFilterChip ${tf.sort === "oldest" ? "is-selected" : ""}" type="button" data-trips-sort="oldest">Oldest first</button>
              </div>
            </div>

            <div class="tripsFiltersSection tripsLockedPreviewSection" aria-label="Advanced Filters">
              <div class="tripsFiltersSectionLabel">Advanced Filters</div>
              <div class="tripsLockedPreviewList">
                <div class="tripsLockedPreviewRow" aria-hidden="true">
                  <span class="tripsLockedPreviewIcon" aria-hidden="true">🔒</span>
                  <div class="tripsLockedPreviewMeta">
                    <div class="tripsLockedPreviewTitle">Custom Range</div>
                    <div class="tripsLockedPreviewText">Pick exact start and end dates</div>
                  </div>
                  <span class="tripsLockedPreviewPill">Locked</span>
                </div>
                <div class="tripsLockedPreviewRow" aria-hidden="true">
                  <span class="tripsLockedPreviewIcon" aria-hidden="true">🔒</span>
                  <div class="tripsLockedPreviewMeta">
                    <div class="tripsLockedPreviewTitle">High-Value Trips</div>
                    <div class="tripsLockedPreviewText">Find your strongest earning or pound days</div>
                  </div>
                  <span class="tripsLockedPreviewPill">Upgrade</span>
                </div>
                <div class="tripsLockedPreviewRow" aria-hidden="true">
                  <span class="tripsLockedPreviewIcon" aria-hidden="true">🔒</span>
                  <div class="tripsLockedPreviewMeta">
                    <div class="tripsLockedPreviewTitle">Advanced Ranges</div>
                    <div class="tripsLockedPreviewText">Filter by pounds, amount, or price per lb</div>
                  </div>
                  <span class="tripsLockedPreviewPill">Locked</span>
                </div>
              </div>
            </div>

            <div class="tripsFilterApplyRow">
              ${hasActiveTripsFilters ? `<button class="btn btn-ghost" id="flt_reset" type="button">Reset</button>` : "<span></span>"}
              <button class="btn good" id="flt_apply" type="button">Apply</button>
            </div>

            ${isLegacyCustomRange ? '<div class="muted small">Legacy custom range is active. Reset to return to YTD quick filters.</div>' : ''}
          </div>
        ` : ""}
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

    root.querySelectorAll("[data-trips-range]").forEach((el)=>{
      el.addEventListener("click", ()=>{
        tf.range = el.getAttribute("data-trips-range") || "ytd";
        if(tf.range !== "custom") tf.customRangeCorrectionMessages = [];
        rerender();
      });
    });

    root.querySelectorAll("[data-trips-sort]").forEach((el)=>{
      el.addEventListener("click", ()=>{
        tf.sort = el.getAttribute("data-trips-sort") === "oldest" ? "oldest" : "newest";
        rerender();
      });
    });

    document.getElementById("flt_dealer")?.addEventListener("change", (ev)=>{ tf.dealer = ev.target.value; rerender(); });
    document.getElementById("flt_area")?.addEventListener("change", (ev)=>{ tf.area = ev.target.value; rerender(); });

    document.getElementById("tripsFiltersToggle")?.addEventListener("click", ()=>{
      ui.tripsFiltersExpanded = !isFiltersExpanded;
      rerender();
    });

    document.getElementById("flt_apply")?.addEventListener("click", ()=>{
      ui.tripsFiltersExpanded = false;
      scheduleStateSave();
      renderAllTrips();
    });

    document.getElementById("flt_reset")?.addEventListener("click", ()=>{
      resetTripsFilters(state);
      saveState();
      renderAllTrips();
    });

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
