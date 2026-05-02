import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";
import { createReportsMetricDetailSeam } from "./reports_metric_detail_v5.js";
import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";
import { createReportsBindingsSeam } from "./reports_bindings_v5.js";
import { createReportsOverviewSectionsSeam } from "./reports_overview_sections_v5.js";
import { createReportsShellControlsSeam } from "./reports_shell_controls_v5.js";
import { createReportsTransitionSeam } from "./reports_transition_seam_v5.js";
import { createReportsMetricRouteSeam } from "./reports_metric_route_seam_v5.js";
import { buildRollingSeriesFromMonthRows, getRollingWindowForMetric } from "./reports_rolling_trends_v5.js";
import { HOME_SHARED_CHART_IDS, buildHomeSharedChartModel, getHomeSharedChartDefinition } from "./reports_chart_definitions_v5.js";
import { createRowsComputationMemo } from "./runtime_memo_v5.js";

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
    renderStandardReadOnlyTripCard,
    buildRollingSeriesFromMonthRows,
    getRollingWindowForMetric
  });

  const reportsBindingsSeam = createReportsBindingsSeam();
  const reportsMetricRouteSeam = createReportsMetricRouteSeam({
    parseReportDateToISO,
    resolveUnifiedRange,
    formatDateDMY,
    applyUnifiedTripFilter,
    buildUnifiedFilterFromReportsFilter
  });

  const getMemoizedAggregationState = createRowsComputationMemo((rows)=> buildReportsAggregationState({
    trips: rows,
    canonicalDealerGroupKey,
    normalizeDealerDisplay,
    resolveTripArea
  }));

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

  const didClearStaleHomeDetail = reportsMetricRouteSeam.clearStaleHomeDetailForReports({
    state,
    homeMetricOnly
  });
  if(didClearStaleHomeDetail){
    saveState();
  }

  const tripsAll = Array.isArray(state.trips) ? state.trips.slice() : [];
  const hasSavedTrips = tripsAll.length > 0;
  const routeContext = reportsMetricRouteSeam.resolveMetricRouteContext({
    state,
    homeMetricOnly,
    tripsAll,
    reportsPresetModes: REPORTS_PRESET_MODES
  });
  const {
    rf,
    fMode,
    hasValidRange,
    isAdvancedActive,
    activePresetFilterKey,
    reportsSectionKey,
    isHomeMetricDetail,
    activeMetricDetail,
    trips,
    seasonalityTrips,
    quarantinedSupportCopy,
    rangeLabel,
    reportsBodyView
  } = routeContext;

  if (homeMetricOnly && !activeMetricDetail) {
    renderApp();
    return;
  }

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
      queueReportsFocusIntent,
      renderReportsScreen,
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

    flushReportsAnnouncement();
    applyReportsFocusIntent(getApp());

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
  } = getMemoizedAggregationState(trips);

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
  const {
    buildMetricDetailView,
    buildMetricDetailChartConfig,
    resolveMetricDetailSurfaceMode
  } = reportsMetricDetailSeam;

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
  const rollingSurface = isHomeMetricDetail ? "home" : "reports";
  const detailChartsWithRolling = {
    ...detailCharts,
    tripsRollingTrend: detailCharts.tripsRollingTrend || buildRollingSeriesFromMonthRows({
      monthRows,
      metricKey: "trips",
      windowSize: getRollingWindowForMetric("trips", { surface: rollingSurface }),
      basisLabel: isHomeMetricDetail ? "Rolling trips trend • visible Home months" : "Rolling trips trend • active Insights range"
    }),
    poundsRollingTrend: detailCharts.poundsRollingTrend || buildRollingSeriesFromMonthRows({
      monthRows,
      metricKey: "pounds",
      windowSize: getRollingWindowForMetric("pounds", { surface: rollingSurface }),
      basisLabel: isHomeMetricDetail ? "Rolling pounds trend • visible Home months" : "Rolling pounds trend • active Insights range"
    }),
    amountRollingTrend: detailCharts.amountRollingTrend || buildRollingSeriesFromMonthRows({
      monthRows,
      metricKey: "amount",
      windowSize: getRollingWindowForMetric("amount", { surface: rollingSurface }),
      basisLabel: isHomeMetricDetail ? "Rolling amount trend • visible Home months" : "Rolling amount trend • active Insights range"
    }),
    pplRollingTrend: detailCharts.pplRollingTrend || buildRollingSeriesFromMonthRows({
      monthRows,
      metricKey: "ppl",
      windowSize: getRollingWindowForMetric("ppl", { surface: rollingSurface }),
      basisLabel: isHomeMetricDetail ? "Rolling Price Per Pound trend • visible Home months" : "Rolling Price Per Pound trend • active Insights range"
    })
  };
  const primaryBasisByMetric = compareFoundation.primaryBasis || {};
  const amountCompare = compareFoundation.metrics?.amount || null;
  const lbsCompare = compareFoundation.metrics?.pounds || null;
  const metricDetailViewModel = activeMetricDetail
    ? {
      metricKey: activeMetricDetail,
      compareFoundation,
      primaryBasisByMetric,
      detailCharts: detailChartsWithRolling,
      isHomeMetricDetail,
      rangeLabel,
      trips,
      homeScope: routeContext?.homeScope || null,
      surfaceMode: resolveMetricDetailSurfaceMode({ isHomeMetricDetail })
    }
    : null;

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

  getApp().innerHTML = homeMetricOnly ? `
    <div class="homeMetricOnlyShell">
      <div id="reportsTransitionRoot" class="reportsTransitionRoot reportsTransitionRoot--detail" data-reports-view="${escapeHtml(reportsBodyView)}" data-detail-mode="home">
      ${metricDetailViewModel ? buildMetricDetailView(metricDetailViewModel) : ""}
      </div>
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
        ${metricDetailViewModel ? buildMetricDetailView(metricDetailViewModel) : renderActiveReportsSection()}
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
    queueReportsFocusIntent,
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
    renderApp,
    showToast
  });


  if(activeMetricDetail){
    const metricDetailChartConfig = buildMetricDetailChartConfig(metricDetailViewModel) || {};
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

  if(activeReportsSection === "high-value"){
    const chartDeck = HOME_SHARED_CHART_IDS.map((chartId)=> {
      const definition = getHomeSharedChartDefinition(chartId) || {};
      const canvasId = `reportsHighValue${chartId.charAt(0).toUpperCase()}${chartId.slice(1)}`;
      return {
        canvasId,
        metricKey: String(definition?.metricKey || ""),
        chartModel: buildHomeSharedChartModel({ chartId, monthRows, dealerRows, areaRows })
      };
    });
    scheduleReportsChartsDraw(monthRows, dealerRows, tripsTimeline, { chartDeck, homeInsightsMode: true });
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
