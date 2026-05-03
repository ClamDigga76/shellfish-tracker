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
    resetTripsFilters,
    onShareTripCard,
    openScreenshotCardPreview,
    renderTripsBrowseReadOnlyTripCard,
    openModal,
    closeModal,
    bindDatePill
  } = deps;
  const compactDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const formatCompactDate = (iso)=>{
    const safeIso = String(iso || "").slice(0, 10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(safeIso)) return "";
    const dt = new Date(`${safeIso}T00:00:00Z`);
    if(Number.isNaN(dt.getTime())) return "";
    return compactDateFormatter.format(dt);
  };

  function renderAllTrips(){
    const state = getState();
    ensureTripsFilter(state);
    const root = getApp();
    const ui = state.ui = state.ui || {};

    const { rows:sorted, range:r, tf, transparency } = getTripsFilteredRows(state);
    const opt = getFilterOptionsFromTrips();
    const hasActiveTripsCoreFilters = Boolean(
      (tf.range || "ytd") !== "ytd" ||
      String(tf.dealer || "all") !== "all" ||
      String(tf.area || "all") !== "all" ||
      ((tf.range === "custom") && (
        String(tf.fromISO || "").trim() !== "" ||
        String(tf.toISO || "").trim() !== ""
      )) ||
      String(tf.sort || "newest") !== "newest"
    );
    const isFiltersExpanded = ui.tripsFiltersExpanded === true;
    const resolvedRangeLabel = (tf.range === "custom" && tf.fromISO && tf.toISO)
      ? `${formatCompactDate(tf.fromISO)} – ${formatCompactDate(tf.toISO)}`
      : (r.label || "YTD");
    const dealerSummary = String(tf.dealer || "all") === "all" ? "All dealers" : `${tf.dealer}`;
    const areaSummary = String(tf.area || "all") === "all" ? "All areas" : `${tf.area}`;
    const tripsCountSummary = `${sorted.length} ${sorted.length === 1 ? "trip" : "trips"}`;
    const quickRangeOptions = [["ytd","YTD"],["mtd","This Month"],["last_month","Last Month"],["all","All Time"]];
    const activeMoreFiltersEntries = [
      { label: "Pounds", min: tf.minLbs, max: tf.maxLbs, unit: "lbs" },
      { label: "Pay", min: tf.minPay, max: tf.maxPay, unit: "$" },
      { label: "Price/lb", min: tf.minPpl, max: tf.maxPpl, unit: "$/lb" }
    ];
    const hasActiveMoreFilters = activeMoreFiltersEntries.some((entry)=> String(entry.min || "").trim() !== "" || String(entry.max || "").trim() !== "");
    const hasActiveTripsFilters = hasActiveTripsCoreFilters || hasActiveMoreFilters;
    const excludedQuarantinedCount = Number(transparency?.excludedQuarantinedCount || 0);
    const totalTripsCount = Array.isArray(state.trips) ? state.trips.length : 0;
    const hasAnyTrips = totalTripsCount > 0;
    const isDefaultYtdEmpty = !hasActiveTripsFilters && hasAnyTrips && sorted.length === 0 && String(tf.range || "ytd") === "ytd";
    const quarantinedSupportNote = excludedQuarantinedCount > 0
      ? `<div class="muted small mt8 tripsQuarantineSupportNote" role="status">Some trips are excluded from date filters because their date is invalid (quarantined): ${excludedQuarantinedCount}.</div>`
      : "";
    const hasUserMoreFiltersExpansionPref = typeof ui.tripsMoreFiltersExpanded === "boolean";
    const moreFiltersExpanded = hasUserMoreFiltersExpansionPref ? ui.tripsMoreFiltersExpanded : false;
    const activeMoreFiltersCount = activeMoreFiltersEntries.reduce((count, entry)=> count + ((String(entry.min || "").trim() !== "" || String(entry.max || "").trim() !== "") ? 1 : 0), 0);
    const activeMoreFiltersSummary = activeMoreFiltersEntries
      .map((entry)=>{
        const min = String(entry.min || "").trim();
        const max = String(entry.max || "").trim();
        if(!min && !max) return "";
        if(min && max) return `${entry.label} ${min}–${max}`;
        return min ? `${entry.label} ${min}+` : `${entry.label} ≤ ${max}`;
      })
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ");
    const isLegacyCustomRange = tf.range === "custom";
    const isCustomDatesExpanded = ui.tripsCustomDatesExpanded === true;

    const filtersCard = `
      <div class="card tripsFiltersCard tripsBrowseFiltersCard">
        <div class="tripsFiltersSummaryRow">
          <div class="tripsFiltersSummaryBlock">
            <div class="tripsFiltersSummaryPrimary">${escapeHtml(`YTD records · ${tripsCountSummary}`)}</div>
            <div class="tripsFiltersSummarySecondary" title="${escapeHtml(`All species · ${dealerSummary} · ${areaSummary}`)}">${escapeHtml(`All species · ${dealerSummary} · ${areaSummary}`)}</div>
          </div>
          <div class="tripsFiltersSummaryActions">
            <button class="btn btn-ghost tripsFiltersToggleBtn ${isFiltersExpanded || hasActiveTripsFilters ? "is-active" : ""}" id="tripsFiltersToggle" type="button" aria-expanded="${isFiltersExpanded ? "true" : "false"}" aria-controls="tripsFiltersBody"><span class="tripsFiltersToggleIcon" aria-hidden="true"><span class="tripsFilterStackIcon" aria-hidden="true"><span></span><span></span><span></span></span></span><span>${isFiltersExpanded ? "Hide filters" : "Filter / Sort"}</span></button>
          </div>
        </div>

        ${isFiltersExpanded ? `
          <div id="tripsFiltersBody" class="tripsFiltersBody">

            <div class="tripsFiltersSection">
              <div class="tripsFiltersSectionLabel">Quick Picks</div>
              <div class="tripsFiltersQuickRange" role="group" aria-label="Quick Range">
                ${quickRangeOptions.map(([k,l])=>`<button class="btn tripsFilterChip ${tf.range===k?"is-selected":""}" type="button" data-trips-range="${k}">${l}</button>`).join("")}
              </div>
            </div>
            <div class="tripsFiltersSection">
              <div class="tripsFiltersSectionLabel">Sort</div>
              <div class="tripsFiltersQuickRange" role="group" aria-label="Sort Trips">
                <button class="btn tripsFilterChip ${tf.sort !== "oldest" ? "is-selected" : ""}" type="button" data-trips-sort="newest">Newest first</button>
                <button class="btn tripsFilterChip ${tf.sort === "oldest" ? "is-selected" : ""}" type="button" data-trips-sort="oldest">Oldest first</button>
              </div>
            </div>

            <div class="tripsFiltersPairedFields">
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
            </div>

            <div class="tripsFiltersPairedFields">
              <div class="tripsFiltersSection">
                <div class="tripsFiltersSectionLabel">Species</div>
                <select id="flt_species" class="select">
                  <option value="all" selected>All species</option>
                  <option value="locked" disabled>Soft Shell Clams 🔒</option>
                </select>
              </div>
              <div class="tripsFiltersSection">
                <div class="tripsFiltersSectionLabel">Date Range</div>
                <button class="btn tripsDateRangeBtn" id="tripsDateRangePick" type="button"><span class="tripsDateRangeLabel">${escapeHtml(tf.range === "custom" ? (resolvedRangeLabel || "Custom dates") : "Custom dates")}</span><span class="tripsDateRangeChevron" aria-hidden="true">›</span></button>
              </div>
            </div>

            ${isCustomDatesExpanded ? `
              <div class="tripsFiltersSection tripsCustomDatesDropdown" aria-label="Custom dates">
                <div class="homeRangeInputs reportsSharedRangeInputs">
                  <input class="input" id="tripsRangeFrom" type="date" aria-label="Start date" value="${escapeHtml(String(tf.fromISO || ""))}" />
                  <input class="input" id="tripsRangeTo" type="date" aria-label="End date" value="${escapeHtml(String(tf.toISO || ""))}" />
                </div>
                <button class="btn good tripsRangeApplyBtn" id="tripsRangeApply" type="button">Apply</button>
              </div>
            ` : ""}

            <div class="tripsFiltersSection tripsMoreFiltersSection">
              <div class="tripsFiltersSectionLabel tripsMoreFiltersHeading">MORE FILTER OPTIONS</div>
              <button class="btn btn-ghost tripsMoreFiltersToggleBtn ${moreFiltersExpanded || hasActiveMoreFilters ? "is-active" : ""}" id="tripsMoreFiltersToggle" type="button" aria-expanded="${moreFiltersExpanded ? "true" : "false"}"><span class="tripsMoreFiltersToggleCopy"><span class="tripsMoreFiltersToggleMain">${activeMoreFiltersCount > 0 ? (activeMoreFiltersCount === 1 ? "1 filter active" : `${activeMoreFiltersCount} filters active`) : "Pounds • Pay • Price/lb"}</span><span class="tripsMoreFiltersToggleAction">${activeMoreFiltersCount > 0 ? "Edit" : (moreFiltersExpanded ? "Close" : "Open")}</span></span><span class="tripsMoreFiltersToggleChevron" aria-hidden="true">${moreFiltersExpanded ? "˄" : "˅"}</span></button>
              ${moreFiltersExpanded ? `
                <div class="tripsMoreFiltersFields">
                  <div class="tripsMoreFiltersGroup"><div class="tripsFiltersSectionLabel">Pounds</div><div class="tripsFiltersPairedFields"><input id="flt_min_lbs" class="select" type="number" step="any" value="${escapeHtml(String(tf.minLbs || ""))}" placeholder="Min lbs"><input id="flt_max_lbs" class="select" type="number" step="any" value="${escapeHtml(String(tf.maxLbs || ""))}" placeholder="Max lbs"></div></div>
                  <div class="tripsMoreFiltersGroup"><div class="tripsFiltersSectionLabel">Pay</div><div class="tripsFiltersPairedFields"><input id="flt_min_pay" class="select" type="number" step="any" value="${escapeHtml(String(tf.minPay || ""))}" placeholder="Min $"><input id="flt_max_pay" class="select" type="number" step="any" value="${escapeHtml(String(tf.maxPay || ""))}" placeholder="Max $"></div></div>
                  <div class="tripsMoreFiltersGroup"><div class="tripsFiltersSectionLabel">Price/lb</div><div class="tripsFiltersPairedFields"><input id="flt_min_ppl" class="select" type="number" step="any" value="${escapeHtml(String(tf.minPpl || ""))}" placeholder="Min $/lb"><input id="flt_max_ppl" class="select" type="number" step="any" value="${escapeHtml(String(tf.maxPpl || ""))}" placeholder="Max $/lb"></div></div>
                </div>
              ` : ""}
            </div>
            <div class="tripsFiltersSection tripsPaidVersionStrip" aria-label="Paid version info">
              <div class="tripsPaidVersionStripText">Paid version unlocks exact season totals, best days, dealer trends, and area strength.</div>
            </div>

            <div class="tripsFilterApplyRow">
              <button class="btn btn-ghost" id="flt_reset" type="button">Reset</button>
              <button class="btn good" id="flt_apply" type="button">Apply</button>
            </div>

            ${isLegacyCustomRange ? '<div class="muted small">Custom dates are active. Tap Reset to return to YTD.</div>' : ''}
          </div>
        ` : ""}
        ${quarantinedSupportNote}
      </div>
    `;

    let emptyStateTitle = "No trips match these filters";
    let emptyStateBody = "Try resetting filters or changing the range, dealer, area, or sort.";
    let emptyStateActions = `
      <button class="btn" id="tripsEmptyReset" type="button">Reset filters</button>
      <button class="btn good" id="tripsEmptyAdd" type="button">＋ Add Trip</button>
    `;

    if (!hasAnyTrips) {
      emptyStateTitle = "No trips logged yet";
      emptyStateBody = "Add your first trip to start building your catch log.";
      emptyStateActions = `<button class="btn good" id="tripsEmptyAdd" type="button">＋ Add Trip</button>`;
    } else if (isDefaultYtdEmpty) {
      emptyStateTitle = "No YTD trips yet";
      emptyStateBody = "You have trips saved, but none in this year-to-date view.";
      emptyStateActions = `
        <button class="btn" id="tripsEmptyShowAll" type="button">Show All Time</button>
        <button class="btn good" id="tripsEmptyAdd" type="button">＋ Add Trip</button>
      `;
    }

    const rows = sorted.length
      ? sorted.map(t=> renderTripsBrowseInteractiveTripCard(t)).join("")
      : `
        <div class="emptyState tripsEmptyState">
          <div class="emptyStateTitle">${emptyStateTitle}</div>
          <div class="emptyStateBody">${emptyStateBody}</div>
          ${excludedQuarantinedCount > 0 ? `<div class="emptyStateFollowup">Some trips are excluded from date filters because their date is invalid (quarantined): ${excludedQuarantinedCount}.</div>` : ""}
          <div class="emptyStateAction">
            ${emptyStateActions}
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
    root.querySelectorAll("[data-trip-action]").forEach((btn)=>{
      btn.addEventListener("click", async (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        const action = String(btn.getAttribute("data-trip-action") || "");
        const id = String(btn.getAttribute("data-id") || "");
        if(!id) return;
        if(action === "edit") {
          state.editId = id;
          state.view = "edit";
          saveState();
          renderApp();
          return;
        }
        if(action === "share") {
          const rawId = String(id || "");
          const allTrips = Array.isArray(state?.trips) ? state.trips : [];
          const trip = sorted.find((row)=> String(row?.id || "") === rawId)
            || allTrips.find((row)=> String(row?.id || "") === rawId)
            || null;
          if(!trip) {
            showToast("Share card unavailable");
            return;
          }
          if (typeof openScreenshotCardPreview === "function") {
            const opened = openScreenshotCardPreview({
              trip,
              renderTripsBrowseReadOnlyTripCard,
              openModal,
              closeModal,
              showToast,
              escapeHtml
            });
            if (opened) return;
          }
          if (typeof onShareTripCard !== "function") {
            showToast("Share card unavailable");
            return;
          }
          try {
            await onShareTripCard(trip);
          } catch (_error) {
            showToast("Share card unavailable");
          }
        }
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
    document.getElementById("flt_species")?.addEventListener("change", ()=>{ tf.species = "all"; rerender(); });
    document.getElementById("tripsDateRangePick")?.addEventListener("click", ()=>{
      ui.tripsCustomDatesExpanded = !isCustomDatesExpanded;
      rerender();
    });

    if (typeof bindDatePill === "function") {
      bindDatePill("tripsRangeFrom");
      bindDatePill("tripsRangeTo");
    }
    document.getElementById("tripsRangeApply")?.addEventListener("click", ()=>{
      tf.range = "custom";
      tf.fromISO = String(document.getElementById("tripsRangeFrom")?.value || "").trim();
      tf.toISO = String(document.getElementById("tripsRangeTo")?.value || "").trim();
      ui.tripsCustomDatesExpanded = false;
      rerender();
    });
    document.getElementById("tripsMoreFiltersToggle")?.addEventListener("click", ()=>{
      ui.tripsMoreFiltersExpanded = !moreFiltersExpanded;
      rerender();
    });
    [["flt_min_lbs","minLbs"],["flt_max_lbs","maxLbs"],["flt_min_pay","minPay"],["flt_max_pay","maxPay"],["flt_min_ppl","minPpl"],["flt_max_ppl","maxPpl"]].forEach(([id,key])=>{
      document.getElementById(id)?.addEventListener("input", (ev)=>{ tf[key] = String(ev.target.value || ""); });
    });
    document.getElementById("tripsFiltersToggle")?.addEventListener("click", ()=>{
      ui.tripsFiltersExpanded = !isFiltersExpanded;
      rerender();
    });

    document.getElementById("flt_apply")?.addEventListener("click", ()=>{
      ui.tripsFiltersExpanded = false;
      ui.tripsCustomDatesExpanded = false;
      ui.tripsMoreFiltersExpanded = false;
      scheduleStateSave();
      renderAllTrips();
    });

    document.getElementById("flt_reset")?.addEventListener("click", ()=>{
      resetTripsFilters(state);
      state.ui = state.ui || {};
      state.ui.tripsCustomDatesExpanded = false;
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
        showToast("Filters reset");
        renderAllTrips();
      };
    }

    const tripsEmptyShowAll = document.getElementById("tripsEmptyShowAll");
    if (tripsEmptyShowAll) {
      tripsEmptyShowAll.onclick = () => {
        tf.range = "all";
        tf.customRangeCorrectionMessages = [];
        scheduleStateSave();
        renderAllTrips();
      };
    }
  }

  return {
    renderAllTrips
  };
}
