import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";
import { createReportsMetricDetailSeam } from "./reports_metric_detail_v5.js";
import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";
import { createReportsOverviewSectionsSeam } from "./reports_overview_sections_v5.js";
import { createReportsTransitionSeam } from "./reports_transition_seam_v5.js";

export function createReportsScreenRenderer(deps){
  const {
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

  function ensureReportsFilter(state){
    if(!state?.reportsFilter || typeof state.reportsFilter !== "object"){
      state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
    }
    if(!state.reportsFilter.mode) state.reportsFilter.mode = "YTD";
    if(state.reportsFilter.from == null) state.reportsFilter.from = "";
    if(state.reportsFilter.to == null) state.reportsFilter.to = "";
    if(state.reportsFilter.dealer == null) state.reportsFilter.dealer = "";
    if(state.reportsFilter.area == null) state.reportsFilter.area = "";
    if(state.reportsFilter.adv == null) state.reportsFilter.adv = false;
    if(!Array.isArray(state.reportsFilter.customRangeCorrectionMessages)) state.reportsFilter.customRangeCorrectionMessages = [];
  }

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


  const reportsOverviewSections = createReportsOverviewSectionsSeam({
    escapeHtml,
    formatMoney,
    to2,
    renderStandardReadOnlyTripCard
  });

  const reportsTransitionSeam = createReportsTransitionSeam({
    drawReportsCharts,
    getApp,
    renderReportsScreen: (options)=> renderReportsScreen(options)
  });
  const invalidateReportsChartSchedule = reportsTransitionSeam.invalidateReportsChartSchedule;
  const scheduleReportsChartsDraw = reportsTransitionSeam.scheduleReportsChartsDraw;
  const animateReportsShellEnter = reportsTransitionSeam.animateReportsShellEnter;
  const queueReportsAnnouncement = reportsTransitionSeam.queueReportsAnnouncement;
  const flushReportsAnnouncement = reportsTransitionSeam.flushReportsAnnouncement;
  const queueReportsFocusIntent = reportsTransitionSeam.queueReportsFocusIntent;
  const applyReportsFocusIntent = reportsTransitionSeam.applyReportsFocusIntent;
  const runReportsTransition = reportsTransitionSeam.runReportsTransition;

function renderReportsScreen({ homeMetricOnly = false } = {}){
  const state = getState();
  ensureReportsFilter(state);

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
  const filteredReportsResult = applyUnifiedTripFilter(tripsAll, hasValidRange ? unified : { ...unified, range:"all" });
  let trips = isHomeMetricDetail && activeMetricDetail && homeScope
    ? homeScope.trips
    : filteredReportsResult.rows;
  const seasonalityUnified = { ...unified, range: "all", fromISO: "", toISO: "" };
  const seasonalityResult = applyUnifiedTripFilter(tripsAll, seasonalityUnified);
  const seasonalityTrips = isHomeMetricDetail && homeScope
    ? homeScope.trips
    : seasonalityResult.rows;
  const excludedQuarantinedCount = Number((isHomeMetricDetail && homeScope)
    ? 0
    : filteredReportsResult?.transparency?.excludedQuarantinedCount || 0);
  const quarantinedSupportCopy = excludedQuarantinedCount > 0
    ? `Some trips are excluded from Reports date filtering because their date is invalid (quarantined): ${excludedQuarantinedCount}.`
    : "";

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
        ${quarantinedSupportCopy ? `<div class="reportsRangeCorrectionSummary muted small" aria-live="polite">${escapeHtml(quarantinedSupportCopy)}</div>` : ""}
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

  const renderNoResultsState = ()=> reportsOverviewSections.renderNoResultsState({
    fMode,
    hasValidRange,
    hasSavedTrips,
    quarantinedSupportCopy
  });

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

  const renderActiveReportsSection = ()=> reportsOverviewSections.renderActiveReportsSection({
    activeReportsSection,
    highlightsStrip,
    monthRows,
    dealerRows,
    areaRows,
    tripsTimeline,
    seasonalityFoundation,
    isHomeMetricDetail,
    maxLbs,
    minLbs,
    maxAmt,
    minAmt,
    pplRows,
    maxPpl,
    minPpl,
    recordPools,
    trips,
    dealerRangeRows,
    getTripMetricValue
  });

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
