import { createReportsMetricDetailSeam } from "./reports_metric_detail_v5.js";
import { createReportsMetricRouteSeam } from "./reports_metric_route_seam_v5.js";
import { buildRollingSeriesFromMonthRows, getRollingWindowForMetric } from "./reports_rolling_trends_v5.js";
import { createRowsComputationMemo } from "./runtime_memo_v5.js";

export function createHomeMetricDetailRenderer(deps){
  const {
    getState,
    getApp,
    saveState,
    renderApp,
    applyUnifiedTripFilter,
    buildUnifiedFilterFromReportsFilter,
    parseReportDateToISO,
    resolveUnifiedRange,
    formatDateDMY,
    buildReportsAggregationState,
    canonicalDealerGroupKey,
    normalizeDealerDisplay,
    resolveTripArea,
    drawReportsCharts,
    escapeHtml,
    formatMoney,
    to2
  } = deps;

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

  const reportsMetricDetailSeam = createReportsMetricDetailSeam({
    escapeHtml,
    formatMoney,
    to2
  });

  function renderHomeMetricDetail(){
    const state = getState();
    const activeMetricDetail = String(state?.homeMetricDetail || "").toLowerCase();
    const homeMetricContext = state?.homeMetricDetailContext && typeof state.homeMetricDetailContext === "object"
      ? state.homeMetricDetailContext
      : null;
    if(!activeMetricDetail || !homeMetricContext){
      renderApp();
      return;
    }

    const tripsAll = Array.isArray(state.trips) ? state.trips.slice() : [];
    const routeContext = reportsMetricRouteSeam.resolveMetricRouteContext({
      state,
      homeMetricOnly: true,
      tripsAll,
      reportsPresetModes: []
    });

    const trips = Array.isArray(routeContext.trips) ? routeContext.trips : [];
    const {
      dealerRows,
      areaRows,
      monthRows,
      tripsTimeline
    } = getMemoizedAggregationState(trips);

    const compareFoundation = reportsMetricDetailSeam.buildHomeMetricDetailFoundation({ monthRows, dealerRows, areaRows });
    const detailCharts = compareFoundation.detailCharts || {};
    const detailChartsWithRolling = {
      ...detailCharts,
      tripsRollingTrend: detailCharts.tripsRollingTrend || buildRollingSeriesFromMonthRows({
        monthRows,
        metricKey: "trips",
        windowSize: getRollingWindowForMetric("trips", { surface: "home" }),
        basisLabel: "Rolling trips trend • visible Home months"
      }),
      poundsRollingTrend: detailCharts.poundsRollingTrend || buildRollingSeriesFromMonthRows({
        monthRows,
        metricKey: "pounds",
        windowSize: getRollingWindowForMetric("pounds", { surface: "home" }),
        basisLabel: "Rolling pounds trend • visible Home months"
      }),
      amountRollingTrend: detailCharts.amountRollingTrend || buildRollingSeriesFromMonthRows({
        monthRows,
        metricKey: "amount",
        windowSize: getRollingWindowForMetric("amount", { surface: "home" }),
        basisLabel: "Rolling amount trend • visible Home months"
      }),
      pplRollingTrend: detailCharts.pplRollingTrend || buildRollingSeriesFromMonthRows({
        monthRows,
        metricKey: "ppl",
        windowSize: getRollingWindowForMetric("ppl", { surface: "home" }),
        basisLabel: "Rolling Price Per Pound trend • visible Home months"
      })
    };

    const metricDetailViewModel = {
      metricKey: activeMetricDetail,
      compareFoundation,
      primaryBasisByMetric: compareFoundation.primaryBasis || {},
      detailCharts: detailChartsWithRolling,
      isHomeMetricDetail: true,
      rangeLabel: routeContext.rangeLabel,
      trips,
      homeScope: routeContext.homeScope || null,
      surfaceMode: reportsMetricDetailSeam.resolveMetricDetailSurfaceMode({ isHomeMetricDetail: true })
    };

    const metricDetailHtml = reportsMetricDetailSeam.buildMetricDetailView(metricDetailViewModel);
    if(!metricDetailHtml){
      state.homeMetricDetail = "";
      state.homeMetricDetailContext = null;
      saveState();
      renderApp();
      return;
    }

    getApp().innerHTML = `
      <div class="homeMetricOnlyShell">
        <div id="reportsTransitionRoot" class="reportsTransitionRoot reportsTransitionRoot--detail" data-reports-view="metric-detail" data-detail-mode="home">
          ${metricDetailHtml}
        </div>
      </div>
    `;
    getApp().scrollTop = 0;

    const metricDetailChartConfig = reportsMetricDetailSeam.buildMetricDetailChartConfig(metricDetailViewModel) || {};
    drawReportsCharts(monthRows, dealerRows, tripsTimeline, {
      metricDetail: {
        metricKey: String(metricDetailChartConfig.metricKey || activeMetricDetail),
        compareChart: metricDetailChartConfig.compareChart || null,
        secondaryCharts: Array.isArray(metricDetailChartConfig.secondaryCharts)
          ? metricDetailChartConfig.secondaryCharts
          : []
      }
    });

    const homeBackBtn = getApp().querySelector(".homeMetricBackBtn");
    if(homeBackBtn){
      homeBackBtn.addEventListener("click", ()=> {
        state.homeMetricDetail = "";
        state.homeMetricDetailContext = null;
        saveState();
        renderApp();
      });
    }
  }

  return {
    renderHomeMetricDetail
  };
}
