import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";
import { createReportsMetricDetailSeam } from "./reports_metric_detail_v5.js";
import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";

export function createReportsScreenRenderer(deps){
  const {
    ensureReportsFilter,
    getState,
    buildUnifiedFilterFromReportsFilter,
    applyUnifiedTripFilter,
    parseReportDateToISO,
    formatReportDateValue,
    escapeHtml,
    resolveUnifiedRange,
    formatDateDMY,
    normalizeCustomRangeWithFeedback,
    getApp,
    renderPageHeader,
    saveState,
    bindDatePill,
    showToast,
    buildReportsAggregationState,
    resolveTripArea,
    buildReportsSeasonalityFoundation,
    canonicalDealerGroupKey,
    normalizeDealerDisplay,
    resolveTripPayRate,
    formatMoney,
    to2,
    drawReportsCharts,
    renderStandardReadOnlyTripCard,
    renderApp
  } = deps;

  const reportsAdvancedPanel = createReportsAdvancedPanelSeam({
    escapeHtml,
    formatReportDateValue,
    parseReportDateToISO,
    bindDatePill,
    normalizeCustomRangeWithFeedback
  });
  const renderReportsAdvancedPanel = typeof reportsAdvancedPanel?.renderAdvancedPanel === "function"
    ? reportsAdvancedPanel.renderAdvancedPanel
    : (()=>"");
  const bindReportsAdvancedPanel = typeof reportsAdvancedPanel?.bindAdvancedPanel === "function"
    ? reportsAdvancedPanel.bindAdvancedPanel
    : (()=>{});

  const reportsHighlights = createReportsHighlightsSeam({
    escapeHtml,
    formatMoney,
    to2
  });
  const renderReportsHighlightsStrip = typeof reportsHighlights?.renderHighlightsStrip === "function"
    ? reportsHighlights.renderHighlightsStrip
    : (()=>"");

  const REPORTS_TRANSITION_MS = 180;
  let reportsTransitionTimer = null;
  let reportsChartRenderToken = 0;
  let reportsChartScheduleRafId = 0;
  let pendingReportsAnnouncement = "";
  let reportsFocusIntent = null;

  function invalidateReportsChartSchedule(){
    reportsChartRenderToken += 1;
    if(reportsChartScheduleRafId){
      cancelAnimationFrame(reportsChartScheduleRafId);
      reportsChartScheduleRafId = 0;
    }
    return reportsChartRenderToken;
  }

  function scheduleReportsChartsDraw(monthRows, dealerRows, tripsTimeline, options){
    const renderToken = invalidateReportsChartSchedule();
    reportsChartScheduleRafId = requestAnimationFrame(()=>{
      reportsChartScheduleRafId = 0;
      if(renderToken !== reportsChartRenderToken) return;
      drawReportsCharts(monthRows, dealerRows, tripsTimeline, options);
    });
  }

  function animateReportsShellEnter(root){
    if(!root) return;
    root.classList.remove("is-ready");
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        root.classList.add("is-ready");
      });
    });
  }

  function queueReportsAnnouncement(message){
    const text = String(message || "").trim();
    if(!text) return;
    pendingReportsAnnouncement = text;
  }

  function flushReportsAnnouncement(){
    const text = String(pendingReportsAnnouncement || "").trim();
    if(!text) return;
    pendingReportsAnnouncement = "";
    try{
      const live = document.getElementById("ariaLive");
      if(!live) return;
      live.setAttribute("aria-live", "polite");
      live.textContent = "";
      setTimeout(()=>{
        live.textContent = text;
        setTimeout(()=>{ live.textContent = ""; }, 1800);
      }, 40);
    }catch(_){ }
  }

  function queueReportsFocusIntent(intent){
    if(!intent || typeof intent !== "object"){
      reportsFocusIntent = null;
      return;
    }
    reportsFocusIntent = intent;
  }

  function applyReportsFocusIntent(root){
    const intent = reportsFocusIntent;
    reportsFocusIntent = null;
    if(!intent || !root) return;
    const safeFocus = (target)=>{
      if(!(target instanceof HTMLElement)) return false;
      try{
        target.focus({ preventScroll: true });
        return true;
      }catch(_){
        return false;
      }
    };
    if(intent.type === "section-tab"){
      const tab = root.querySelector(`.chip[data-reports-section="${intent.key}"]`);
      if(safeFocus(tab)) return;
    }
    if(intent.type === "metric-button"){
      const metricBtn = root.querySelector(`[data-metric-detail="${intent.metricKey}"]`);
      if(safeFocus(metricBtn)) return;
    }
    if(intent.type === "metric-back"){
      const backBtn = root.querySelector("#reportsMetricBack");
      if(safeFocus(backBtn)) return;
    }
    const panel = root.querySelector("#reportsTransitionRoot");
    safeFocus(panel);
  }

  function runReportsTransition({ mutate, renderNext = () => renderReportsScreen(), homeMetricOnly = false } = {}){
    if(typeof mutate !== "function") return;
    const app = getApp();
    const root = app?.querySelector("#reportsTransitionRoot");
    const finish = ()=>{
      mutate();
      if(typeof renderNext === "function") renderNext({ homeMetricOnly });
    };
    if(!root){
      finish();
      return;
    }
    if(reportsTransitionTimer){
      clearTimeout(reportsTransitionTimer);
      reportsTransitionTimer = null;
    }
    root.classList.remove("is-ready");
    root.classList.add("is-leaving");
    reportsTransitionTimer = setTimeout(()=>{
      reportsTransitionTimer = null;
      finish();
    }, REPORTS_TRANSITION_MS);
  }

function renderReportsScreen({ homeMetricOnly = false } = {}){
  const state = getState();
  ensureReportsFilter();

  if (!homeMetricOnly) {
    const hasStaleHomeDetail = String(state.homeMetricDetail || "").trim()
      || (state.homeMetricDetailContext && typeof state.homeMetricDetailContext === "object");
    if (hasStaleHomeDetail) {
      state.homeMetricDetail = "";
      state.homeMetricDetailContext = null;
      saveState();
    }
  }

  const tripsAll = Array.isArray(state.trips) ? state.trips.slice() : [];
  const hasSavedTrips = tripsAll.length > 0;
  const rf = state.reportsFilter || { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
  const fMode = String(rf.mode || "YTD").toUpperCase();
  const REPORTS_PRESET_FILTER_ITEMS = [
    { key: "YTD", label: "YTD" },
    { key: "THIS_MONTH", label: "This Month" },
    { key: "LAST_MONTH", label: "Last Month" },
    { key: "90D", label: "Last 3 Months" },
    { key: "ALL", label: "All Time" }
  ];
  const REPORTS_PRESET_MODES = REPORTS_PRESET_FILTER_ITEMS.map((item)=> item.key);
  const hasReportsCustomConstraints = !!parseReportDateToISO(rf.from)
    || !!parseReportDateToISO(rf.to)
    || !!String(rf.dealer || "").trim()
    || !!String(rf.area || "").trim();
  const isPresetExactMatch = REPORTS_PRESET_MODES.includes(fMode) && !hasReportsCustomConstraints;
  const isAdvancedActive = !!rf.adv || !isPresetExactMatch;
  const activePresetFilterKey = isPresetExactMatch ? fMode : "";
  const reportsSectionKey = String(state.reportsSection || "insights").toLowerCase();
  const reportsMetricDetail = String(state.reportsMetricDetail || "").toLowerCase();
  const reportsMetricDetailContext = state.reportsMetricDetailContext && typeof state.reportsMetricDetailContext === "object"
    ? state.reportsMetricDetailContext
    : null;
  const homeMetricDetail = String(state.homeMetricDetail || "").toLowerCase();
  const homeMetricDetailContext = state.homeMetricDetailContext && typeof state.homeMetricDetailContext === "object"
    ? state.homeMetricDetailContext
    : null;
  const isHomeMetricDetail = !!homeMetricOnly;
  const activeMetricDetail = isHomeMetricDetail ? homeMetricDetail : reportsMetricDetail;
  const metricDetailContext = isHomeMetricDetail ? homeMetricDetailContext : reportsMetricDetailContext;

  if (homeMetricOnly && !activeMetricDetail) {
    renderApp();
    return;
  }

  const hasValidRange = (fMode !== "RANGE") || (parseReportDateToISO(rf.from) && parseReportDateToISO(rf.to));
  const mapHomeModeToUnifiedRange = (modeValue)=> {
    const normalized = String(modeValue || "YTD").toUpperCase();
    if(normalized === "ALL") return "all";
    if(normalized === "MONTH" || normalized === "THIS_MONTH") return "mtd";
    if(normalized === "LAST_MONTH") return "last_month";
    if(normalized === "7D" || normalized === "LAST_7_DAYS") return "7d";
    if(normalized === "30D") return "30d";
    if(normalized === "90D") return "90d";
    if(normalized === "12M") return "12m";
    if(normalized === "RANGE" || normalized === "CUSTOM") return "custom";
    return "ytd";
  };
  const buildHomeMetricScope = (homeFilter, homeScopeSnapshot = null)=> {
    const normalizedFilter = homeFilter && typeof homeFilter === "object"
      ? {
        mode: String(homeFilter.mode || "YTD").toUpperCase(),
        from: parseReportDateToISO(homeFilter.from || "") || "",
        to: parseReportDateToISO(homeFilter.to || "") || ""
      }
      : null;
    if(!normalizedFilter) return null;
    const unifiedFilter = {
      range: mapHomeModeToUnifiedRange(normalizedFilter.mode),
      fromISO: normalizedFilter.from,
      toISO: normalizedFilter.to,
      dealer: "all",
      area: "all",
      species: "all",
      text: ""
    };
    const resolvedRange = resolveUnifiedRange(unifiedFilter);
    const displayRangeLabel = unifiedFilter.range === "custom"
      ? `${formatDateDMY(resolvedRange.fromISO)} → ${formatDateDMY(resolvedRange.toISO)}`
      : String(resolvedRange.label || "YTD");
    const filtered = applyUnifiedTripFilter(tripsAll, unifiedFilter);
    const fallbackTripCount = filtered.rows.length;
    const snapshotTripCount = Number(homeScopeSnapshot?.tripCount);
    const tripCount = Number.isFinite(snapshotTripCount) && snapshotTripCount >= 0
      ? snapshotTripCount
      : fallbackTripCount;
    const contextText = `Home • Range ${displayRangeLabel} • ${tripCount} trips`;
    return {
      filter: normalizedFilter,
      unifiedFilter,
      resolvedRange,
      rangeLabel: displayRangeLabel,
      tripCount,
      contextText,
      trips: filtered.rows
    };
  };
  const homeScope = isHomeMetricDetail
    ? buildHomeMetricScope(metricDetailContext?.homeFilter, metricDetailContext?.homeScope)
    : null;
  const unified = (isHomeMetricDetail && activeMetricDetail && homeScope)
    ? homeScope.unifiedFilter
    : buildUnifiedFilterFromReportsFilter(rf);
  let trips = isHomeMetricDetail && activeMetricDetail && homeScope
    ? homeScope.trips
    : applyUnifiedTripFilter(tripsAll, hasValidRange ? unified : { ...unified, range:"all" }).rows;
  const seasonalityUnified = { ...unified, range: "all", fromISO: "", toISO: "" };
  const seasonalityTrips = isHomeMetricDetail && homeScope
    ? homeScope.trips
    : applyUnifiedTripFilter(tripsAll, seasonalityUnified).rows;

  const chip = ({ key, label })=> `<button class="chip segBtn reportsPrimaryFilterChip ${activePresetFilterKey===key?'on is-selected':''}" data-rf="${key}" type="button" role="tab" aria-selected="${activePresetFilterKey===key ? "true" : "false"}">${label}</button>`;
  const REPORTS_SECTION_ITEMS = [
    { key: "insights", label: "Insights", intro: "Top takeaways for this range." },
    { key: "charts", label: "Charts", intro: "Trend direction at a glance." },
    { key: "seasonality", label: "Seasonality", intro: "Matched windows across years." },
    { key: "records", label: "Records", intro: "High and low trip records." },
    { key: "detail", label: "Detail", intro: "Dealer, area, and monthly tables." }
  ];
  const activeReportsSection = REPORTS_SECTION_ITEMS.some((item)=> item.key === reportsSectionKey) ? reportsSectionKey : "insights";
  const renderReportsSectionChip = (item)=> `<button class="chip reportsSectionChip ${activeReportsSection===item.key?'on is-selected':''}" data-reports-section="${item.key}" type="button" role="tab" id="reports-tab-${item.key}" aria-controls="reportsTransitionRoot" aria-selected="${activeReportsSection===item.key ? 'true' : 'false'}" tabindex="${activeReportsSection===item.key ? "0" : "-1"}">
    <span>${item.label}</span>
  </button>`;
  const activeFilterTokens = [];
  const fromISO = parseReportDateToISO(rf.from);
  const toISO = parseReportDateToISO(rf.to);
  if(fromISO || toISO){
    const fromLabel = fromISO ? formatDateDMY(fromISO) : "Start";
    const toLabel = toISO ? formatDateDMY(toISO) : "End";
    activeFilterTokens.push(`Date ${fromLabel} → ${toLabel}`);
  }
  const dealerFilter = String(rf.dealer || "").trim();
  if(dealerFilter){
    activeFilterTokens.push(`Dealer ${dealerFilter}`);
  }
  const areaFilter = String(rf.area || "").trim();
  if(areaFilter){
    activeFilterTokens.push(`Area ${areaFilter}`);
  }
  const activeFilterSummaryLabel = activeFilterTokens.length
    ? `${activeFilterTokens.length} filter${activeFilterTokens.length === 1 ? "" : "s"} on`
    : "No custom filters";
  const renderActiveFilterSummary = activeFilterTokens.length
    ? `
      <div class="reportsActiveFilterSummary" aria-live="polite" aria-label="Active custom filters">
        <div class="reportsActiveFilterChipRow">${activeFilterTokens.map((token)=> `<span class="reportsActiveFilterChip">${escapeHtml(token)}</span>`).join("")}</div>
      </div>
    `
    : "";
  const customRangeCorrectionMessages = Array.isArray(rf.customRangeCorrectionMessages) ? rf.customRangeCorrectionMessages : [];
  const renderCorrectionSummary = (fMode === "RANGE" && customRangeCorrectionMessages.length)
    ? `<div class="reportsRangeCorrectionSummary muted small" aria-live="polite">${customRangeCorrectionMessages.map((msg)=>`<div>${escapeHtml(msg)}</div>`).join("")}</div>`
    : "";

  const advOpen = isAdvancedActive;
  const advPanel = renderReportsAdvancedPanel({
    reportsFilter: { ...rf, adv: advOpen },
    dealers: state.dealers,
    areas: state.areas
  });

  const resolvedReportsRange = isHomeMetricDetail && homeScope
    ? homeScope.resolvedRange
    : resolveUnifiedRange(unified);
  const rangeLabel = isHomeMetricDetail && homeScope
    ? homeScope.rangeLabel
    : (fMode === "RANGE")
      ? (hasValidRange ? `${formatDateDMY(resolvedReportsRange.fromISO)} → ${formatDateDMY(resolvedReportsRange.toISO)}` : "Set dates")
      : (fMode === "THIS_MONTH" ? "This Month"
        : (fMode === "LAST_MONTH" ? "Last Month"
          : (fMode === "90D" ? "Last 3 Months"
            : (fMode === "ALL" ? "All Time"
            : "YTD"))));
  const detailSurfaceClass = isHomeMetricDetail ? "homeMetricDetail" : "reportsMetricDetail";
  const detailCardClass = isHomeMetricDetail ? "homeMetricDetailCard" : "reportsMetricDetailCard";
  const detailBackClass = isHomeMetricDetail ? "homeMetricBackBtn" : "reportsMetricBackBtn";
  const detailEyebrowClass = isHomeMetricDetail ? "homeMetricEyebrow" : "reportsMetricEyebrow";
  const detailTitleClass = isHomeMetricDetail ? "homeMetricTitle" : "reportsMetricTitle";
  const detailContextClass = isHomeMetricDetail ? "homeMetricContext" : "reportsMetricContext";
  const detailHeroWrapClass = isHomeMetricDetail ? "homeMetricHeroWrap" : "reportsMetricHeroWrap";
  const detailHeroLabelClass = isHomeMetricDetail ? "homeMetricHeroLabel" : "reportsMetricHeroLabel";
  const detailHeroValueClass = isHomeMetricDetail ? "homeMetricHeroValue" : "reportsMetricHeroValue";
  const detailCompareClass = isHomeMetricDetail ? "homeMetricCompare" : "reportsMetricCompare";
  const detailCompareTextClass = isHomeMetricDetail ? "homeMetricCompareText" : "reportsMetricCompareText";
  const detailCompareRowsClass = isHomeMetricDetail ? "homeMetricCompareRows" : "reportsMetricCompareRows";
  const detailChartClass = isHomeMetricDetail ? "homeMetricChartBlock" : "reportsMetricChartBlock";
  const detailChartContextClass = isHomeMetricDetail ? "homeMetricChartContext" : "reportsMetricChartContext";
  const detailInsightClass = isHomeMetricDetail ? "homeMetricInsight" : "reportsMetricInsight";

  const renderReportsTopShell = ({ body = "", shellMode = "overview" } = {})=> `
    <div class="reportsTopShell reportsTopShell--${escapeHtml(shellMode)}">
      <section class="reportsTimeframeShell" aria-label="Reports timeframe controls">
        <div class="segWrap timeframeUnifiedControl reportsTimeframeControl reportsPrimaryFilterBar" role="tablist" aria-label="Reports quick range filters">
          ${REPORTS_PRESET_FILTER_ITEMS.map((item)=> chip(item)).join("")}
        </div>
      </section>

      <div class="reportsAdvancedShell" aria-label="Reports advanced filters">
        <button class="chip segBtn repAdvToggle reportsAdvancedDisclosure ${isAdvancedActive ? "on is-selected" : ""}" type="button" aria-expanded="${advOpen ? "true" : "false"}" aria-controls="reportsAdvancedInlinePanel">
          <span class="reportsAdvancedDisclosureTitle">Advanced</span>
          <span class="reportsAdvancedDisclosureState">${escapeHtml(activeFilterSummaryLabel)}</span>
        </button>
        ${renderActiveFilterSummary}
        ${renderCorrectionSummary}
        ${advPanel}
      </div>

      <section class="reportsNavShell" aria-label="Reports sections">
        <div class="reportsSectionSwitch" role="tablist" aria-label="Reports sections">
          ${REPORTS_SECTION_ITEMS.map((item)=> renderReportsSectionChip(item)).join("")}
        </div>
      </section>

      ${body}
    </div>
  `;

  const renderNoResultsState = ()=> {
    const invalidRange = fMode === "RANGE" && !hasValidRange;
    const beginnerEmpty = !hasSavedTrips;
    const title = invalidRange
      ? "Choose a valid date range"
      : (beginnerEmpty ? "Add a trip to start Reports" : "No trips in this range");
    const body = invalidRange
      ? "Set both dates, then tap Apply."
      : (beginnerEmpty
        ? "Once one trip is saved, trend insights appear here."
        : "No trips match this filter yet. Add a trip or switch to All Time.");
    const followup = invalidRange
      ? ""
      : (beginnerEmpty
        ? '<div class="emptyStateFollowup">Next step: open New Trip.</div>'
        : '<div class="emptyStateFollowup">Tip: switch to All Time for your widest view.</div>');
    return `
      <div class="emptyState ${beginnerEmpty ? "emptyStateBeginner" : ""}">
        <div class="emptyStateTitle">${title}</div>
        <div class="emptyStateBody">${body}</div>
        ${followup}
        <div class="emptyStateAction cardActionRow">
          <button class="btn primary" id="reportsEmptyPrimary" type="button">${invalidRange ? "Open advanced filters" : "＋ Add Trip"}</button>
          <button class="btn btn-ghost" id="reportsEmptySecondary" type="button">${invalidRange || beginnerEmpty ? "Open Help" : "Switch to All Time"}</button>
        </div>
      </div>
    `;
  };

  const applyPrimaryReportsFilterSelection = (key)=>{
    const normalizedKey = String(key || "YTD").toUpperCase();
    if(!state.reportsFilter || typeof state.reportsFilter !== "object"){
      state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
    }
    state.reportsFilter.mode = normalizedKey;
    state.reportsFilter.adv = false;
    if(normalizedKey !== "RANGE"){
      state.reportsFilter.from = "";
      state.reportsFilter.to = "";
      state.reportsFilter.customRangeCorrectionMessages = [];
    }
  };

  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      ${renderReportsTopShell({ body: renderNoResultsState() })}
    `;
    getApp().scrollTop = 0;

    // quick range buttons
    getApp().querySelectorAll(".chip[data-rf]").forEach((btn)=>{
      btn.onclick = ()=>{
        const key = String(btn.getAttribute("data-rf")||"YTD");
        applyPrimaryReportsFilterSelection(key);
        saveState();
        showToast("Filter updated");
        renderReportsScreen();
      };
    });

    bindReportsAdvancedPanel({
      root: getApp(),
      state,
      saveState,
      renderReports,
      showToast,
      variant: "empty"
    });

    const reportsEmptyPrimary = document.getElementById("reportsEmptyPrimary");
    if (reportsEmptyPrimary) {
      reportsEmptyPrimary.onclick = () => {
        if (fMode === "RANGE" && !hasValidRange) {
          if (!state.reportsFilter) state.reportsFilter = {};
          state.reportsFilter.adv = true;
          saveState();
          renderReportsScreen();
          return;
        }
        state.view = "new";
        saveState();
        showToast("Start with one trip");
        renderApp();
      };
    }

    const reportsEmptySecondary = document.getElementById("reportsEmptySecondary");
    if (reportsEmptySecondary) {
      reportsEmptySecondary.onclick = () => {
        if ((fMode === "RANGE" && !hasValidRange) || !hasSavedTrips) {
          state.helpJump = "reports";
          state.view = "help";
          saveState();
          renderApp();
          return;
        }
        if (!state.reportsFilter) state.reportsFilter = {};
        state.reportsFilter.mode = "ALL";
        state.reportsFilter.from = "";
        state.reportsFilter.to = "";
        saveState();
        showToast("Filter updated");
        renderReportsScreen();
      };
    }

    return;
  }

  const {
    dealerRows,
    areaRows,
    monthRows,
    maxLbs,
    minLbs,
    maxAmt,
    minAmt,
    pplRows,
    maxPpl,
    minPpl,
    tripsTimeline,
    recordPools,
    dealerRangeRows
  } = buildReportsAggregationState({
    trips,
    canonicalDealerGroupKey,
    normalizeDealerDisplay,
    resolveTripArea
  });

  const renderSummaryAverageLine = (row)=> `<span class="muted">Avg / Trip</span> <span class="money">${formatMoney(to2(row.amountPerTrip))}</span> • <span class="lbsBlue">${to2(row.poundsPerTrip)} lbs</span>`;
  const sortDealerRowsForSummary = (rows)=> rows.slice().sort((a, b)=> {
    const rateDiff = (Number(b?.avg) || 0) - (Number(a?.avg) || 0);
    if(rateDiff !== 0) return rateDiff;
    const lbsDiff = (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0);
    if(lbsDiff !== 0) return lbsDiff;
    return (Number(b?.amt) || 0) - (Number(a?.amt) || 0);
  });
  const sortAreaRowsForSummary = (rows)=> rows.slice().sort((a, b)=> {
    const lbsDiff = (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0);
    if(lbsDiff !== 0) return lbsDiff;
    return (Number(b?.amt) || 0) - (Number(a?.amt) || 0);
  });

  const renderDealerAggList = (rows, emptyMsg)=>{
    if(!rows.length) return `
      <div class="emptyState compact">
        <div class="emptyStateTitle">Insights pending</div>
        <div class="emptyStateBody">${escapeHtml(emptyMsg||"Add trips to unlock these insights.")}</div>
      </div>`;
    return rows.map(r=>{
      return `
        <div class="trow">
          <div>
            <div class="tname">${escapeHtml(r.name)}</div>
            <div class="tsub">${r.trips} trips • ${r.fishingDays || 0} days • <span class="lbsBlue">${to2(r.lbs)} lbs</span></div>
            <div class="tsub">${renderSummaryAverageLine(r)}</div>
          </div>
          <div class="tright">
            <div><span class="ppl">$/lb</span> <b class="rate ppl">${formatMoney(r.avg)}</b></div>
            <div><b class="money">${formatMoney(r.amt)}</b></div>
          </div>
        </div>
      `;
    }).join("");
  };

  const renderAreaAggList = (rows, emptyMsg)=>{
    if(!rows.length) return `
      <div class="emptyState compact">
        <div class="emptyStateTitle">Insights pending</div>
        <div class="emptyStateBody">${escapeHtml(emptyMsg||"Add trips to unlock these insights.")}</div>
      </div>`;
    return rows.map(r=>{
      return `
        <div class="trow">
          <div>
            <div class="tname">${escapeHtml(r.name)}</div>
            <div class="tsub">${r.trips} trips • ${r.fishingDays || 0} days</div>
            <div class="tsub"><span class="money">${formatMoney(to2(r.amt))}</span> outcome • <span class="ppl">$/lb</span> <b class="rate ppl">${formatMoney(r.avg)}</b></div>
          </div>
          <div class="tright">
            <div><b class="lbsBlue">${to2(r.lbs)} lbs</b></div>
            <div><b class="money">${formatMoney(r.amt)}</b></div>
          </div>
        </div>
      `;
    }).join("");
  };

  const renderMonthList = ()=>{
    return monthRows.map(r=>{
      return `
        <div class="trow">
          <div>
            <div class="tname">${escapeHtml(r.label)}</div>
            <div class="tsub">${r.trips} trips • ${r.fishingDays || 0} days • <span class="lbsBlue">${to2(r.lbs)} lbs</span></div>
            <div class="tsub">${renderSummaryAverageLine(r)}</div>
          </div>
          <div class="tright">
            <div><b class="money">${formatMoney(r.amt)}</b></div>
            <div><span class="ppl">$/lb</span> <b class="rate ppl">${formatMoney(r.avg)}</b></div>
          </div>
        </div>
      `;
    }).join("");
  };

  const getTripMetricValue = (trip, metric)=>{
    const lbsNum = Number(trip?.pounds) || 0;
    const amtNum = Number(trip?.amount) || 0;
    if(metric === "lbs") return lbsNum;
    if(metric === "amount") return amtNum;
    if(metric === "ppl") return typeof resolveTripPayRate === "function"
      ? resolveTripPayRate(trip)
      : ((lbsNum > 0 && amtNum > 0) ? (amtNum / lbsNum) : 0);
    return 0;
  };

  const selectRecordBaseline = (metric, direction, selectedTrip)=>{
    if(!selectedTrip) return null;
    const sourceTrips = recordPools?.[metric]?.[direction] || trips;
    const ordered = sourceTrips
      .map((trip)=> ({ trip, value: getTripMetricValue(trip, metric) }))
      .filter((row)=> Number.isFinite(row.value) && row.value > 0)
      .sort((a,b)=> direction === "max" ? (b.value - a.value) : (a.value - b.value));
    if(ordered.length < 2) return null;
    const selectedValue = getTripMetricValue(selectedTrip, metric);
    const selectedIdx = ordered.findIndex((row)=> row.trip === selectedTrip);
    if(selectedIdx === -1) return null;
    const baseline = ordered.find((row, idx)=> idx !== selectedIdx && row.value !== selectedValue);
    return baseline ? baseline.value : null;
  };

  const formatHLDeltaValue = (metric, deltaValue)=>{
    const absDelta = Math.abs(Number(deltaValue) || 0);
    const sign = deltaValue > 0 ? "+" : "-";
    if(!(absDelta > 0)) return "";
    if(metric === "lbs") return `${sign}${to2(absDelta)} lbs`;
    if(metric === "amount") return `${sign}${formatMoney(to2(absDelta))}`;
    if(metric === "ppl") return `${sign}${formatMoney(to2(absDelta))}/lb`;
    return `${sign}${to2(absDelta)}`;
  };

  const renderHLItem = (label, t, metric, direction)=>{
    if(!t) return `<div class="muted small">—</div>`;
    const lbsNum = Number(t?.pounds)||0;
    const amtNum = Number(t?.amount)||0;
    const ppl = getTripMetricValue(t, "ppl");
    let metricText = "—";
    let metricClass = "";
    if(metric === "lbs"){
      metricText = `${to2(lbsNum)} lbs`;
      metricClass = "lbsBlue";
    }else if(metric === "amount"){
      metricText = formatMoney(to2(amtNum));
      metricClass = "money";
    }else if(metric === "ppl"){
      metricText = ppl>0 ? `${formatMoney(to2(ppl))}/lb` : "—";
      metricClass = "rate ppl";
    }
    const currentValue = getTripMetricValue(t, metric);
    const baselineValue = selectRecordBaseline(metric, direction, t);
    const deltaValue = currentValue - (Number(baselineValue) || 0);
    const deltaRatio = (baselineValue && baselineValue > 0)
      ? (deltaValue / baselineValue)
      : null;
    const hasCompare = Number.isFinite(deltaRatio) && Math.abs(deltaRatio) >= 0.005;
    const deltaPct = hasCompare ? Math.round(Math.abs(deltaRatio) * 1000) / 10 : 0;
    const rawDeltaText = hasCompare ? formatHLDeltaValue(metric, deltaValue) : "";
    const compareWord = hasCompare
      ? (deltaRatio > 0 ? "higher" : "lower")
      : "";
    const compareTone = hasCompare
      ? (deltaRatio > 0 ? "up" : "down")
      : "steady";
    const compareText = hasCompare
      ? `${rawDeltaText} • ${deltaPct}% ${compareWord} vs previous record`
      : "";
    return `
      <div class="hlStatCard">
        <div class="hlTopRow hlTopRow--stacked">
          <div class="hlHdr">${escapeHtml(label)}</div>
          <div class="hlValue ${metricClass}">${escapeHtml(metricText)}</div>
          ${hasCompare ? `<div class="hlDelta tone-${compareTone}">${escapeHtml(compareText)}</div>` : ""}
        </div>
        <div class="hlTripCardWrap">
          <div class="hlTripCardHdr">Record trip</div>
          ${typeof renderStandardReadOnlyTripCard === "function" ? renderStandardReadOnlyTripCard(t, { variant: "standard" }) : ""}
        </div>
      </div>
    `;
  };

  const renderChartCard = ({ takeaway, title, subhead, hero, context, canvasId, height = 210 })=> `
    <div class="chartCard">
      <div class="chartTakeaway tone-${takeaway.tone}">${escapeHtml(takeaway.text)}</div>
      <div class="chartTitle">${escapeHtml(title)}</div>
      <div class="chartSubhead">${escapeHtml(subhead)}</div>
      <div class="chartHero">${hero}</div>
      <div class="chartContext">${context}</div>
      <canvas class="chart" id="${escapeHtml(canvasId)}" height="${height}"></canvas>
    </div>
  `;

  const renderChartsSection = ()=>{
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const priorMonth = monthRows.length > 1 ? monthRows[monthRows.length - 2] : null;
    const amountPeak = monthRows.reduce((best,r)=> (Number(r?.amt)||0) > (Number(best?.amt)||0) ? r : best, monthRows[0] || null);
    const pplPeak = monthRows.reduce((best,r)=> (Number(r?.avg)||0) > (Number(best?.avg)||0) ? r : best, monthRows[0] || null);
    const amountPerTripPeak = monthRows.reduce((best,r)=> (Number(r?.amountPerTrip)||0) > (Number(best?.amountPerTrip)||0) ? r : best, monthRows[0] || null);
    const lbsPeak = monthRows.reduce((best,r)=> (Number(r?.lbs)||0) > (Number(best?.lbs)||0) ? r : best, monthRows[0] || null);
    const dealerAmountPeak = dealerRows[0] || null;
    const tripsLatest = tripsTimeline[tripsTimeline.length - 1] || null;
    const tripsPrior = tripsTimeline.length > 1 ? tripsTimeline[tripsTimeline.length - 2] : null;
    const tripsPeak = tripsTimeline.reduce((best,r)=> (Number(r?.count)||0) > (Number(best?.count)||0) ? r : best, tripsTimeline[0] || null);
    const tripsTotal = tripsTimeline.reduce((sum,r)=> sum + (Number(r?.count)||0), 0);

    const trendTone = (delta, epsilon = 0.02)=>{
      if(Math.abs(delta) <= epsilon) return "steady";
      return delta > 0 ? "up" : "down";
    };

    const buildMonthTakeaway = (metricKey)=>{
      if(!latestMonth) return { text: "Holding steady", tone: "steady" };
      const latestVal = Number(latestMonth?.[metricKey]) || 0;
      const priorVal = Number(priorMonth?.[metricKey]) || 0;
      if(!priorMonth) return { text: "Strongest recent month", tone: "up" };
      if(priorVal <= 0 && latestVal <= 0) return { text: "Holding steady", tone: "steady" };
      const baseline = Math.max(1, Math.abs(priorVal));
      const delta = (latestVal - priorVal) / baseline;
      const tone = trendTone(delta, 0.04);
      if(tone === "up") return { text: "Up vs prior month", tone };
      if(tone === "down") return { text: "Down vs prior month", tone };
      return { text: "Holding steady", tone };
    };

    const buildTripsTakeaway = ()=>{
      const latest = Number(tripsLatest?.count) || 0;
      const prior = Number(tripsPrior?.count) || 0;
      if(!tripsPrior) return { text: "Baseline month set", tone: "steady" };
      if(latest === prior) return { text: "Trips unchanged month to month", tone: "steady" };
      return latest > prior
        ? { text: "Trips up vs prior month", tone: "up" }
        : { text: "Trips down vs prior month", tone: "down" };
    };

    const amountTakeaway = buildMonthTakeaway("amt");
    const pplTakeaway = buildMonthTakeaway("avg");
    const amountPerTripTakeaway = buildMonthTakeaway("amountPerTrip");
    const lbsTakeaway = buildMonthTakeaway("lbs");
    const tripsTakeaway = buildTripsTakeaway();
    const dealerRatePeak = dealerRows
      .filter((row)=> (Number(row?.lbs) || 0) > 0 && (Number(row?.avg) || 0) > 0)
      .reduce((best, row)=> (!best || (Number(row.avg) || 0) > (Number(best.avg) || 0) ? row : best), null);
    const dealerRateTakeaway = dealerRatePeak
      ? { text: "Pay-rate leaders stand out", tone: "up" }
      : { text: "Buyer pay rates still building", tone: "steady" };
    const dealerAmountTakeaway = dealerAmountPeak
      ? { text: "Top dealer still leads this range", tone: "up" }
      : { text: "Dealer mix still building", tone: "steady" };
    return [
      renderChartCard({
        takeaway: tripsTakeaway,
        title: "Trips over time",
        subhead: "Monthly trip count",
        hero: `<span class="trips">${tripsLatest ? tripsLatest.count : "—"}</span>`,
        context: `<span class="chartContextValue">${tripsLatest ? escapeHtml(tripsLatest.shortLabel) : "Latest month"}</span> • High <span class="trips">${tripsPeak ? tripsPeak.count : "—"}</span> • Total <span class="trips">${tripsTotal}</span>`,
        canvasId: "c_trips"
      }),
      renderChartCard({
        takeaway: lbsTakeaway,
        title: "Monthly Pounds",
        subhead: "Pounds by month",
        hero: `<span class="lbsBlue">${latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="lbsBlue">${lbsPeak ? `${to2(lbsPeak.lbs)} lbs` : "—"}</span>`,
        canvasId: "c_lbs"
      }),
      renderChartCard({
        takeaway: amountTakeaway,
        title: "Monthly Total Amount",
        subhead: "Total payout by month",
        hero: `<span class="money">${latestMonth ? formatMoney(to2(latestMonth.amt)) : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="money">${amountPeak ? formatMoney(to2(amountPeak.amt)) : "—"}</span>`,
        canvasId: "c_amount_monthly"
      }),
      renderChartCard({
        takeaway: pplTakeaway,
        title: "Avg $/lb by Month",
        subhead: "Pay rate by month",
        hero: `<span class="rate ppl">${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="rate ppl">${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</span>`,
        canvasId: "c_ppl"
      }),
      renderChartCard({
        takeaway: amountPerTripTakeaway,
        title: "Monthly Amount per Trip",
        subhead: "Average payout per trip",
        hero: `<span class="money">${latestMonth ? formatMoney(to2(latestMonth.amountPerTrip)) : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="money">${amountPerTripPeak ? formatMoney(to2(amountPerTripPeak.amountPerTrip)) : "—"}</span>`,
        canvasId: "c_amount_per_trip"
      }),
      renderChartCard({
        takeaway: dealerRateTakeaway,
        title: "Dealer Avg $/lb",
        subhead: "Dealer pay rates",
        hero: `<span class="rate ppl">${dealerRatePeak ? `${formatMoney(to2(dealerRatePeak.avg))}/lb` : "—"}</span>`,
        context: `Top pay-rate dealer: <span class="chartContextValue">${dealerRatePeak ? escapeHtml(String(dealerRatePeak.name || "—")) : "—"}</span>`,
        canvasId: "c_dealer_rate",
        height: 220
      }),
      renderChartCard({
        takeaway: dealerAmountTakeaway,
        title: "Dealer Amount",
        subhead: "Total payout by dealer",
        hero: `<span class="money">${dealerAmountPeak ? formatMoney(to2(dealerAmountPeak.amt)) : "—"}</span>`,
        context: `Leading dealer: <span class="chartContextValue">${dealerAmountPeak ? escapeHtml(String(dealerAmountPeak.name || "—")) : "—"}</span>`,
        canvasId: "c_dealer",
        height: 220
      })
    ].join("");
  };

  const reportsMetricDetailSeam = createReportsMetricDetailSeam({
    escapeHtml,
    formatMoney,
    formatReportDateValue,
    getTripMetricValue,
    resolveTripArea,
    to2
  });

  const seasonalityFoundation = isHomeMetricDetail
    ? null
    : buildReportsSeasonalityFoundation({ trips: seasonalityTrips, nowDate: new Date() });

  const compareFoundation = isHomeMetricDetail
    ? reportsMetricDetailSeam.buildHomeMetricDetailFoundation({ monthRows, dealerRows, areaRows })
    : buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows });
  const highlightsStrip = renderReportsHighlightsStrip({
    dealerRows,
    monthRows,
    areaRows,
    trips,
    compareFoundation: isHomeMetricDetail ? null : compareFoundation
  });
  const detailCharts = compareFoundation.detailCharts || {};
  const primaryBasisByMetric = compareFoundation.primaryBasis || {};
  const amountCompare = compareFoundation.metrics?.amount || null;
  const lbsCompare = compareFoundation.metrics?.pounds || null;

  const reportsSection = ({ title, intro = "", body, extraClass = "" })=> `
    <section class="reportsSection ${extraClass}">
      <div class="reportsSectionHead">
        <h2>${escapeHtml(title)}</h2>
        ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
      </div>
      ${body}
    </section>
  `;

  const formatSeasonalityMetric = (metricKey, value)=> {
    const safeValue = Number(value) || 0;
    if(metricKey === "trips") return `${Math.round(safeValue)} trips`;
    if(metricKey === "pounds") return `${to2(safeValue)} lbs`;
    if(metricKey === "amount") return formatMoney(to2(safeValue));
    if(metricKey === "ppl") return `${formatMoney(to2(safeValue))}/lb`;
    return `${to2(safeValue)}`;
  };

  const renderSeasonalitySection = ()=> {
    if(isHomeMetricDetail || !seasonalityFoundation || !seasonalityFoundation.hasHistory) return "";
    const monthRowsAllYears = Array.isArray(seasonalityFoundation.monthOfYearBuckets)
      ? seasonalityFoundation.monthOfYearBuckets.filter((row)=> row.contributingYears > 0)
      : [];
    const sameWindow = seasonalityFoundation.sameWindow || {};
    const bestWindowInsight = seasonalityFoundation.bestWindowInsight || {};
    const sameWindowBody = sameWindow.suppressed
      ? `<div class="muted small">${escapeHtml(sameWindow.reason || "This year-over-year card appears after more history builds.")}</div>`
      : `
        <div class="reportsSeasonalityValue money">${escapeHtml(formatSeasonalityMetric("amount", sameWindow.current.amount))}</div>
        <div class="reportsSeasonalitySub">${escapeHtml(sameWindow.label || "")}</div>
        <div class="reportsMetricCompare tone-${escapeHtml(sameWindow.tone === "up" ? "up" : (sameWindow.tone === "down" ? "down" : "steady"))}">
          <div class="reportsMetricCompareText">${escapeHtml(sameWindow.supportStrong ? "This year is ahead for the same part of the month." : "This same part-of-month view is available, but still early.")}</div>
          <div class="reportsMetricCompareRows">
            <div><span>${escapeHtml(String(sameWindow.current?.label || sameWindow.currentYear || "Current year"))}</span><b class="money">${escapeHtml(formatSeasonalityMetric("amount", sameWindow.current.amount))}</b></div>
            <div><span>${escapeHtml(String(sameWindow.previous?.label || sameWindow.priorYear || "Prior year"))}</span><b class="money">${escapeHtml(formatSeasonalityMetric("amount", sameWindow.previous.amount))}</b></div>
            <div><span>Trips</span><b class="trips">${escapeHtml(`${Math.round(Number(sameWindow.current?.trips) || 0)} vs ${Math.round(Number(sameWindow.previous?.trips) || 0)}`)}</b></div>
            <div><span>Pounds</span><b class="lbsBlue">${escapeHtml(`${to2(Number(sameWindow.current?.lbs) || 0)} vs ${to2(Number(sameWindow.previous?.lbs) || 0)} lbs`)}</b></div>
          </div>
        </div>`;
    const bestWindowBody = bestWindowInsight.suppressed
      ? `<div class="muted small">${escapeHtml(bestWindowInsight.reason || "Best seasonal window appears after more repeat history builds.")}</div>`
      : `
        <div class="reportsSeasonalityEyebrow">${escapeHtml(bestWindowInsight.metricLabel || "Best month-of-year by average amount")}</div>
        <div class="reportsSeasonalityValue money">${escapeHtml(bestWindowInsight.monthLabel || "")}</div>
        <div class="reportsSeasonalitySub">${escapeHtml(bestWindowInsight.summary || "")}</div>
        <div class="reportsSeasonalityMeta">
          <span class="money">${escapeHtml(formatSeasonalityMetric("amount", bestWindowInsight.amount))}</span>
          <span>avg amount</span>
          <span>•</span>
          <span class="trips">${escapeHtml(`${to2(Number(bestWindowInsight.trips) || 0)} avg trips/year`)}</span>
        </div>`;
    const monthTable = monthRowsAllYears.length
      ? `<div class="reportsSeasonalityTableWrap">
          <table class="reportsSeasonalityTable">
            <thead>
              <tr><th>Month</th><th>Across years</th><th>Avg amount</th><th>Trips</th></tr>
            </thead>
            <tbody>
              ${monthRowsAllYears.map((row)=> `
                <tr>
                  <td><b>${escapeHtml(row.monthLabel)}</b><div class="reportsSeasonalityTableHint">${escapeHtml(`${row.monthLabel} across all years`)}</div></td>
                  <td>${escapeHtml(`${row.contributingYears} years`)}</td>
                  <td class="money">${escapeHtml(formatSeasonalityMetric("amount", row.averageMonthlyAmount))}</td>
                  <td class="trips">${escapeHtml(`${Math.round(Number(row.trips) || 0)}`)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`
      : `<div class="muted small">Add at least two months of dated trips to unlock a seasonality table.</div>`;
    const chartBlock = seasonalityFoundation.chartModel
      ? `<div class="reportsSeasonalityChartBlock">
          <b>Average amount by month-of-year</b>
          <div class="reportsSeasonalitySub">Month-by-month seasonal pattern across all matching years.</div>
          <canvas class="chart" id="c_seasonality_amount" height="210"></canvas>
        </div>`
      : "";
    return reportsSection({
      title: "Seasonality",
      intro: "Matched windows across years.",
      body: `<div class="reportsSeasonalityGrid">
        <div class="card reportsSeasonalityCard">
          <div class="reportsSeasonalityEyebrow">Same part of the month</div>
          ${sameWindowBody}
        </div>
        <div class="card reportsSeasonalityCard">
          ${bestWindowBody}
        </div>
      </div>
      <div class="card reportsSeasonalityCard reportsSeasonalityCard--table">
        <div class="reportsSeasonalityEyebrow">Month-of-year performance</div>
        <div class="reportsSeasonalitySub">Use rows like “March across all years” to see repeat timing, not just one calendar month.</div>
        ${monthTable}
        ${chartBlock}
      </div>`,
      extraClass: "reportsSection--seasonality"
    });
  };

  const renderChartsBlock = ()=> reportsSection({
    title: "Charts",
    intro: "Trend direction at a glance.",
    body: `<div class="reportsChartsStack">${renderChartsSection()}</div>`,
    extraClass: "reportsSection--charts"
  });

  const buildMetricDetailView = (metricKey)=> reportsMetricDetailSeam.buildMetricDetailView({
    metricKey,
    compareFoundation,
    primaryBasisByMetric,
    detailCharts,
    isHomeMetricDetail,
    homeScope,
    rangeLabel,
    trips,
    recordPools,
    detailSurfaceClass,
    detailCardClass,
    detailBackClass,
    detailEyebrowClass,
    detailTitleClass,
    detailContextClass,
    detailHeroWrapClass,
    detailHeroLabelClass,
    detailHeroValueClass,
    detailCompareClass,
    detailCompareTextClass,
    detailCompareRowsClass,
    detailChartClass,
    detailChartContextClass,
    detailInsightClass
  });
  const buildMetricDetailChartConfig = (metricKey)=> reportsMetricDetailSeam.buildMetricDetailChartConfig({
    metricKey,
    compareFoundation,
    primaryBasisByMetric,
    detailCharts,
    isHomeMetricDetail,
    homeScope,
    rangeLabel,
    trips,
    recordPools,
    detailSurfaceClass,
    detailCardClass,
    detailBackClass,
    detailEyebrowClass,
    detailTitleClass,
    detailContextClass,
    detailHeroWrapClass,
    detailHeroLabelClass,
    detailHeroValueClass,
    detailCompareClass,
    detailCompareTextClass,
    detailCompareRowsClass,
    detailChartClass,
    detailChartContextClass,
    detailInsightClass
  });

  const renderTableCard = (title, body)=> `
    <div class="card">
      <b>${escapeHtml(title)}</b>
      <div class="sep"></div>
      ${body}
    </div>
  `;

  const formatRateValue = (value)=> {
    const safe = Number(value) || 0;
    return safe > 0 ? `${formatMoney(to2(safe))}/lb` : "—";
  };

  const renderDealerPriceRangeComparison = ()=>{
    if(!Array.isArray(dealerRangeRows) || !dealerRangeRows.length){
      return `
        <div class="emptyState compact">
          <div class="emptyStateTitle">Dealer range comparison unavailable</div>
          <div class="emptyStateBody">Add priced trips with dealer info to populate this table.</div>
        </div>
      `;
    }
    return dealerRangeRows.map((row, idx)=> `
      <div class="trow">
        <div>
          <div class="tname">${idx + 1}. ${escapeHtml(String(row?.name || "(Unspecified)"))}</div>
          <div class="tsub">${Number(row?.sampleCount) || 0} priced trips • Avg ${formatRateValue(row?.avg)}</div>
        </div>
        <div class="tright">
          <div><span class="ppl">Low</span> <b class="rate ppl">${formatRateValue(row?.rateLow)}</b></div>
          <div><span class="ppl">High</span> <b class="rate ppl">${formatRateValue(row?.rateHigh)}</b></div>
          <div><span class="ppl">Spread</span> <b class="rate ppl">${formatRateValue(row?.spread)}</b></div>
        </div>
      </div>
    `).join("");
  };

  const highLowBody = `
    ${renderHLItem("Most Pounds", maxLbs, "lbs", "max")}
    <div class="sep"></div>

    ${renderHLItem("Least Pounds", minLbs, "lbs", "min")}
    <div class="sep"></div>

    ${renderHLItem("Highest Amount", maxAmt, "amount", "max")}
    <div class="sep"></div>

    ${renderHLItem("Lowest Amount", minAmt, "amount", "min")}
    <div class="sep"></div>

    ${pplRows.length ? `
      ${renderHLItem("Highest $/lb", maxPpl, "ppl", "max")}
      <div class="sep"></div>

      ${renderHLItem("Lowest $/lb", minPpl, "ppl", "min")}
    ` : `
      <div class="emptyState compact">
        <div class="emptyStateTitle">$/lb insights unavailable</div>
        <div class="emptyStateBody">Add trips with both pounds and amount to populate this view.</div>
      </div>`}
  `;

  const renderRecordsBlock = ()=> reportsSection({
    title: "Records",
    intro: "High and low trip records for core metrics.",
    body: `<div class="reportsTablesStack">${renderTableCard("High / Low Summary", highLowBody)}</div>`,
    extraClass: "reportsSection--records"
  });

  const renderDetailBlock = ()=> reportsSection({
    title: "Detail",
    intro: "Dealer, area, and monthly tables.",
    body: `<div class="reportsTablesStack">${[
      renderTableCard("Dealer Summary", renderDealerAggList(sortDealerRowsForSummary(dealerRows), "Add a trip in this range to populate dealer totals.")),
      renderTableCard("Area Summary", renderAreaAggList(sortAreaRowsForSummary(areaRows), "Add a trip in this range to populate area totals.")),
      renderTableCard("Monthly Totals", renderMonthList()),
      renderTableCard("Dealer Price Range Comparison", renderDealerPriceRangeComparison())
    ].join("")}</div>`,
    extraClass: "reportsSection--detail"
  });

  const renderActiveReportsSection = ()=> {
    if(activeReportsSection === "charts") return renderChartsBlock();
    if(activeReportsSection === "seasonality") return renderSeasonalitySection() || reportsSection({
      title: "Seasonality",
      intro: "Available after enough dated history builds.",
      body: `<div class="reportsHighlightsEmpty"><div class="muted small">Add more dated trips across multiple months to reveal seasonality reads.</div></div>`,
      extraClass: "reportsSection--seasonality"
    });
    if(activeReportsSection === "records") return renderRecordsBlock();
    if(activeReportsSection === "detail") return renderDetailBlock();
    return reportsSection({
      title: "Insights",
      intro: "Top takeaways for this range.",
      body: `${highlightsStrip || `<div class="reportsHighlightsEmpty"><div class="muted small">Highlights appear automatically as more trips are added.</div></div>`}`,
      extraClass: "reportsSection--highlights"
    });
  };

  const reportsBodyView = activeMetricDetail ? "metric-detail" : activeReportsSection;
  getApp().innerHTML = homeMetricOnly ? `
    ${renderPageHeader("home")}

    <div id="reportsTransitionRoot" class="reportsTransitionRoot reportsTransitionRoot--detail" data-reports-view="${escapeHtml(reportsBodyView)}" data-detail-mode="home">
      ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : ""}
    </div>
  ` : `
    ${renderPageHeader("reports")}

    ${renderReportsTopShell({
      shellMode: activeMetricDetail ? "detail" : "overview",
      body: `<div id="reportsTransitionRoot" class="reportsTransitionRoot" data-reports-view="${escapeHtml(reportsBodyView)}" data-detail-mode="${activeMetricDetail ? "reports" : "overview"}" role="tabpanel" aria-labelledby="reports-tab-${escapeHtml(activeReportsSection)}" tabindex="-1">
        ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : renderActiveReportsSection()}
      </div>`
    })}
  `;

  getApp().scrollTop = 0;
  animateReportsShellEnter(document.getElementById("reportsTransitionRoot"));
  flushReportsAnnouncement();
  applyReportsFocusIntent(getApp());

  // range chips
  getApp().querySelectorAll(".chip[data-rf]").forEach((btn)=>{
    btn.onclick = ()=>{
      const key = String(btn.getAttribute("data-rf")||"YTD");
      applyPrimaryReportsFilterSelection(key);
      saveState();
      renderReportsScreen();
    };
  });

  // section switcher
  getApp().querySelectorAll(".chip[data-reports-section]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = String(btn.getAttribute("data-reports-section") || "insights").toLowerCase();
      if(key === activeReportsSection) return;
      const section = REPORTS_SECTION_ITEMS.find((item)=> item.key === key);
      queueReportsAnnouncement(`Reports section ${section?.label || "updated"}.`);
      queueReportsFocusIntent({ type: "section-tab", key });
      runReportsTransition({
        mutate: ()=>{
          state.reportsSection = key;
          saveState();
        }
      });
    };
  });
  getApp().querySelectorAll(".chip[data-reports-section]").forEach((btn)=>{
    btn.addEventListener("keydown", (event)=>{
      const tabs = Array.from(getApp().querySelectorAll(".chip[data-reports-section]"));
      const currentIdx = tabs.indexOf(btn);
      if(currentIdx === -1) return;
      if(event.key === "ArrowRight" || event.key === "ArrowLeft"){
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
        const nextTab = tabs[nextIdx];
        nextTab?.focus();
        nextTab?.click();
        return;
      }
      if(event.key === "Home" || event.key === "End"){
        event.preventDefault();
        const target = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
        target?.focus();
        target?.click();
        return;
      }
      if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        btn.click();
      }
    });
  });

  bindReportsAdvancedPanel({
    root: getApp(),
    state,
    saveState,
    renderReports,
    showToast
  });


  const metricDetailButtons = getApp().querySelectorAll("[data-metric-detail]");
  metricDetailButtons.forEach((btn)=>{
    btn.onclick = ()=>{
      const metricName = String(btn.getAttribute("data-metric-detail") || "metric").toLowerCase();
      queueReportsAnnouncement(`Opened ${metricName} metric detail in reports.`);
      queueReportsFocusIntent({ type: "metric-back" });
      runReportsTransition({
        mutate: ()=>{
          state.reportsMetricDetail = String(btn.getAttribute("data-metric-detail") || "").toLowerCase();
          state.reportsMetricDetailContext = { source: "reports" };
          state.homeMetricDetail = "";
          state.homeMetricDetailContext = null;
          saveState();
        }
      });
    };
  });

  const reportsMetricBack = document.getElementById("reportsMetricBack");
  if(reportsMetricBack){
    reportsMetricBack.onclick = ()=>{
      if(isHomeMetricDetail){
        queueReportsAnnouncement("Returned to Home from metric detail.");
        runReportsTransition({
          mutate: ()=>{
            state.homeMetricDetail = "";
            state.homeMetricDetailContext = null;
            state.view = "home";
            saveState();
          },
          renderNext: ()=>{ renderApp(); }
        });
        return;
      }
      queueReportsAnnouncement("Returned to reports overview.");
      queueReportsFocusIntent({ type: "metric-button", metricKey: activeMetricDetail });
      runReportsTransition({
        mutate: ()=>{
          state.reportsMetricDetail = "";
          state.reportsMetricDetailContext = null;
          saveState();
        }
      });
    };
  }


  if(activeMetricDetail){
    const metricDetailChartConfig = buildMetricDetailChartConfig(activeMetricDetail) || {};
    scheduleReportsChartsDraw(monthRows, dealerRows, tripsTimeline, {
      metricDetail: {
        metricKey: String(metricDetailChartConfig.metricKey || activeMetricDetail),
        compareChart: metricDetailChartConfig.compareChart || null,
        secondaryCharts: Array.isArray(metricDetailChartConfig.secondaryCharts)
          ? metricDetailChartConfig.secondaryCharts
          : []
      }
    });
    return;
  }

  invalidateReportsChartSchedule();

  if(activeReportsSection === "charts"){
    scheduleReportsChartsDraw(monthRows, dealerRows, tripsTimeline, {});
    return;
  }

  if(activeReportsSection === "seasonality"){
    scheduleReportsChartsDraw(monthRows, dealerRows, tripsTimeline, { seasonalityChart: seasonalityFoundation?.chartModel || null });
  }
}

function renderReports(){
  renderReportsScreen();
}

function renderHomeMetricDetail(){
  renderReportsScreen({ homeMetricOnly: true });
}

  return { renderReports, renderHomeMetricDetail };
}
