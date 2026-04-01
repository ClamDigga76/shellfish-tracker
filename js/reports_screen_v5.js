import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";
import { createReportsMetricDetailSeam } from "./reports_metric_detail_v5.js";
import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";
import { createReportsBindingsSeam } from "./reports_bindings_v5.js";
import { createReportsOverviewSectionsSeam } from "./reports_overview_sections_v5.js";
import { createReportsShellControlsSeam } from "./reports_shell_controls_v5.js";
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

  const reportsShellControls = createReportsShellControlsSeam({
    escapeHtml,
    parseReportDateToISO,
    formatDateDMY
  });
  const ensureReportsFilter = reportsShellControls.ensureReportsFilter;
  const REPORTS_PRESET_FILTER_ITEMS = reportsShellControls.REPORTS_PRESET_FILTER_ITEMS;
  const REPORTS_PRESET_MODES = reportsShellControls.REPORTS_PRESET_MODES;
  const REPORTS_SECTION_ITEMS = reportsShellControls.REPORTS_SECTION_ITEMS;
  const resolveActiveReportsSection = reportsShellControls.resolveActiveReportsSection;
  const buildActiveFilterSummary = reportsShellControls.buildActiveFilterSummary;
  const renderCorrectionSummary = reportsShellControls.renderCorrectionSummary;
  const renderReportsTopShell = reportsShellControls.renderReportsTopShell;

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

  const reportsBindingsSeam = createReportsBindingsSeam();

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

  const activeReportsSection = resolveActiveReportsSection(reportsSectionKey);
  const {
    activeFilterSummaryLabel,
    renderActiveFilterSummary
  } = buildActiveFilterSummary(rf);
  const customRangeCorrectionMessages = Array.isArray(rf.customRangeCorrectionMessages) ? rf.customRangeCorrectionMessages : [];
  const correctionSummary = renderCorrectionSummary({
    filterMode: fMode,
    customRangeCorrectionMessages
  });

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

  const renderNoResultsState = ()=> reportsOverviewSections.renderNoResultsState({
    fMode,
    hasValidRange,
    hasSavedTrips,
    quarantinedSupportCopy
  });

  const applyPrimaryReportsFilterSelection = (key)=> reportsShellControls.applyPrimaryReportsFilterSelection(state, key);

  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      ${renderReportsTopShell({
        body: renderNoResultsState(),
        activePresetFilterKey,
        isAdvancedActive,
        advOpen,
        activeFilterSummaryLabel,
        renderActiveFilterSummary,
        correctionSummary,
        quarantinedSupportCopy,
        advPanel,
        activeReportsSection
      })}
    `;
    getApp().scrollTop = 0;

    reportsBindingsSeam.bindPresetRangeChips({
      root: getApp(),
      applyPrimaryReportsFilterSelection,
      saveState,
      showToast,
      renderReportsScreen,
      includeToast: true
    });

    reportsBindingsSeam.bindReportsAdvancedPanelWrapper({
      bindReportsAdvancedPanel,
      root: getApp(),
      state,
      saveState,
      renderReports,
      showToast,
      variant: "empty"
    });

    reportsBindingsSeam.bindEmptyStateActions({
      fMode,
      hasValidRange,
      hasSavedTrips,
      state,
      saveState,
      showToast,
      renderReportsScreen,
      renderApp
    });

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
      activePresetFilterKey,
      isAdvancedActive,
      advOpen,
      activeFilterSummaryLabel,
      renderActiveFilterSummary,
      correctionSummary,
      quarantinedSupportCopy,
      advPanel,
      activeReportsSection,
      body: `<div id="reportsTransitionRoot" class="reportsTransitionRoot" data-reports-view="${escapeHtml(reportsBodyView)}" data-detail-mode="${activeMetricDetail ? "reports" : "overview"}" role="tabpanel" aria-labelledby="reports-tab-${escapeHtml(activeReportsSection)}" tabindex="-1">
        ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : renderActiveReportsSection()}
      </div>`
    })}
  `;

  getApp().scrollTop = 0;
  animateReportsShellEnter(document.getElementById("reportsTransitionRoot"));
  flushReportsAnnouncement();
  applyReportsFocusIntent(getApp());

  reportsBindingsSeam.bindPresetRangeChips({
    root: getApp(),
    applyPrimaryReportsFilterSelection,
    saveState,
    renderReportsScreen
  });

  reportsBindingsSeam.bindSectionTabs({
    root: getApp(),
    activeReportsSection,
    REPORTS_SECTION_ITEMS,
    queueReportsAnnouncement,
    queueReportsFocusIntent,
    runReportsTransition,
    state,
    saveState
  });

  reportsBindingsSeam.bindReportsAdvancedPanelWrapper({
    bindReportsAdvancedPanel,
    root: getApp(),
    state,
    saveState,
    renderReports,
    showToast
  });

  reportsBindingsSeam.bindMetricDetailActions({
    root: getApp(),
    queueReportsAnnouncement,
    queueReportsFocusIntent,
    runReportsTransition,
    state,
    saveState,
    isHomeMetricDetail,
    activeMetricDetail,
    renderApp
  });


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
