import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";
import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";

const HOME_METRIC_DETAIL_COMPARE_CONTRACT = Object.freeze({
  fairWindowLabel: "Visible Home month view",
  compareModel: "home-full-month",
  compareModelLabel: "Month view",
  supportLabel: "Visible Home month view",
  support: "Using the latest two visible Home months.",
  explanation: "",
  missingReason: "Add one more visible month to unlock month-to-month detail.",
  missingSuppressionCode: "missing-home-months",
  missingExplanation: "Show one more month in Home, then this comparison will appear.",
  metricExplanation: (label)=> `${label} uses the same month pair shown in the chart and values.`
});

function buildHomeMetricDetailFoundation({ monthRows }){
  const safeMonths = Array.isArray(monthRows) ? monthRows.filter((row)=> row?.monthKey) : [];
  const currentMonth = safeMonths[safeMonths.length - 1] || null;
  const previousMonth = safeMonths[safeMonths.length - 2] || null;
  const current = summarizeHomeMonthRow(currentMonth);
  const previous = summarizeHomeMonthRow(previousMonth);

  const period = currentMonth && previousMonth
    ? buildHomeComparablePeriod({ currentMonth, previousMonth, current, previous })
    : buildHomeSuppressedPeriod({ currentMonth, previousMonth, current, previous });
  const metrics = buildHomeMetricPayloads(period);
  const detailCharts = buildHomeDetailCharts({ monthRows: safeMonths, period });

  return {
    period,
    metrics,
    detailCharts,
    primaryBasis: buildMetricDetailPrimaryBasisMap({
      period,
      metrics,
      detailCharts,
      source: "home"
    })
  };
}

function buildHomeComparablePeriod({ currentMonth, previousMonth, current, previous }){
  const confidenceLabel = classifyHomeConfidence({ currentTrips: current.trips, previousTrips: previous.trips });
  return {
    comparable: true,
    suppressed: false,
    confidence: confidenceLabel === "strong" ? "high" : (confidenceLabel === "early" ? "medium" : "low"),
    confidenceLabel,
    trustLabel: confidenceLabel,
    reason: "",
    suppressionCode: "",
    explanation: HOME_METRIC_DETAIL_COMPARE_CONTRACT.explanation,
    currentLabel: currentMonth.label || currentMonth.monthKey,
    previousLabel: previousMonth.label || previousMonth.monthKey,
    ...buildHomeCompareContractFields(),
    current,
    previous
  };
}

function buildHomeSuppressedPeriod({ currentMonth, previousMonth, current, previous }){
  return {
    comparable: false,
    suppressed: true,
    confidence: "none",
    confidenceLabel: "suppressed",
    trustLabel: "suppressed",
    reason: HOME_METRIC_DETAIL_COMPARE_CONTRACT.missingReason,
    suppressionCode: HOME_METRIC_DETAIL_COMPARE_CONTRACT.missingSuppressionCode,
    explanation: HOME_METRIC_DETAIL_COMPARE_CONTRACT.missingExplanation,
    currentLabel: currentMonth?.label || "Current month",
    previousLabel: previousMonth?.label || "Previous month",
    ...buildHomeCompareContractFields({ support: "Visible Home months" }),
    current,
    previous
  };
}

function buildHomeCompareContractFields({ support } = {}){
  return {
    fairWindowLabel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.fairWindowLabel,
    compareModel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.compareModel,
    compareModelLabel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.compareModelLabel,
    supportLabel: HOME_METRIC_DETAIL_COMPARE_CONTRACT.supportLabel,
    support: support || HOME_METRIC_DETAIL_COMPARE_CONTRACT.support
  };
}

function summarizeHomeMonthRow(row){
  const pounds = Number(row?.lbs) || 0;
  const amount = Number(row?.amt) || 0;
  const trips = Number(row?.trips) || 0;
  const uniqueDays = Number(row?.fishingDays) || trips;
  return {
    trips,
    lbs: pounds,
    amount,
    ppl: pounds > 0 ? amount / pounds : 0,
    uniqueDays,
    amountPerTrip: trips > 0 ? amount / trips : 0,
    poundsPerTrip: trips > 0 ? pounds / trips : 0,
    amountPerDay: uniqueDays > 0 ? amount / uniqueDays : 0,
    poundsPerDay: uniqueDays > 0 ? pounds / uniqueDays : 0
  };
}

function classifyHomeConfidence({ currentTrips, previousTrips }){
  const floor = Math.min(Number(currentTrips) || 0, Number(previousTrips) || 0);
  if(floor >= 4) return "strong";
  if(floor >= 2) return "early";
  return "weak";
}

function buildHomeMetricPayloads(period){
  const current = period?.current || {};
  const previous = period?.previous || {};
  return {
    trips: buildHomeMetricPayload({ metricKey: "trips", label: "Trips", currentValue: current.trips, previousValue: previous.trips, period }),
    pounds: buildHomeMetricPayload({ metricKey: "pounds", label: "Pounds", currentValue: current.lbs, previousValue: previous.lbs, period }),
    amount: buildHomeMetricPayload({ metricKey: "amount", label: "Amount", currentValue: current.amount, previousValue: previous.amount, period }),
    ppl: buildHomeMetricPayload({
      metricKey: "ppl",
      label: "Avg $/lb",
      currentValue: current.ppl,
      previousValue: previous.ppl,
      period,
      suppressed: !(current.lbs > 0 && previous.lbs > 0),
      reason: "Add pounds in both visible Home months to compare average $/lb."
    })
  };
}

function buildHomeMetricPayload({ metricKey, label, currentValue, previousValue, period, suppressed = false, reason = "" }){
  const current = Number(currentValue) || 0;
  const previous = Number(previousValue) || 0;
  const deltaValue = current - previous;
  const deltaPct = previous > 0 ? (deltaValue / previous) : null;
  const confidenceLabel = String(period?.confidenceLabel || "weak");
  return {
    metricKey,
    label,
    currentValue: current,
    previousValue: previous,
    deltaValue,
    deltaPct,
    compareTone: !suppressed
      ? (deltaPct == null ? (deltaValue > 0 ? "up" : (deltaValue < 0 ? "down" : "steady")) : toneFromDelta(deltaPct, metricKey === "ppl" ? 0.035 : 0.05))
      : "steady",
    suppressed,
    reason,
    explanation: suppressed ? reason : HOME_METRIC_DETAIL_COMPARE_CONTRACT.metricExplanation(label),
    suppressionCode: suppressed ? "home-baseline-missing" : "",
    confidence: String(period?.confidence || "low"),
    confidenceLabel,
    trustLabel: confidenceLabel,
    percentValid: !suppressed && deltaPct != null,
    support: {
      currentTrips: Number(period?.current?.trips) || 0,
      previousTrips: Number(period?.previous?.trips) || 0,
      currentUniqueDays: Number(period?.current?.uniqueDays) || 0,
      previousUniqueDays: Number(period?.previous?.uniqueDays) || 0
    }
  };
}


function buildMetricDetailPrimaryBasisMap({ period, metrics, detailCharts, source }){
  const safePeriod = period && typeof period === "object" ? period : {};
  const safeMetrics = metrics && typeof metrics === "object" ? metrics : {};
  const safeCharts = detailCharts && typeof detailCharts === "object" ? detailCharts : {};
  const defaultBasisLabel = String(safePeriod.supportLabel || safePeriod.support || safePeriod.fairWindowLabel || (source === "home" ? "Visible Home month view" : "Matched date range"));
  const currentLabel = String(safePeriod.currentLabel || "Current");
  const previousLabel = String(safePeriod.previousLabel || "Previous");

  return {
    trips: buildMetricPrimaryBasis({ metricKey: "trips", metricPayload: safeMetrics.trips, primaryChart: safeCharts.trips, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    pounds: buildMetricPrimaryBasis({ metricKey: "pounds", metricPayload: safeMetrics.pounds, primaryChart: safeCharts.pounds, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    amount: buildMetricPrimaryBasis({ metricKey: "amount", metricPayload: safeMetrics.amount, primaryChart: safeCharts.amountCompare || safeCharts.amount, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel }),
    ppl: buildMetricPrimaryBasis({ metricKey: "ppl", metricPayload: safeMetrics.ppl, primaryChart: safeCharts.ppl, period: safePeriod, basisLabel: defaultBasisLabel, currentLabel, previousLabel })
  };
}

function buildMetricPrimaryBasis({ metricKey, metricPayload, primaryChart, period, basisLabel, currentLabel, previousLabel }){
  const payload = metricPayload && typeof metricPayload === "object" ? metricPayload : null;
  const chart = primaryChart && typeof primaryChart === "object" ? primaryChart : null;
  return {
    metricKey,
    basisLabel: String(chart?.basisLabel || basisLabel || ""),
    currentLabel,
    previousLabel,
    currentValue: Number(payload?.currentValue) || 0,
    previousValue: Number(payload?.previousValue) || 0,
    comparePayload: payload,
    primaryChart: chart,
    period: period && typeof period === "object" ? period : {}
  };
}

function buildHomeDetailCharts({ monthRows, period }){
  const safeMonths = Array.isArray(monthRows) ? monthRows : [];
  const labels = [
    String(period?.currentLabel || "Current month"),
    String(period?.previousLabel || "Previous month")
  ];
  const amountTrendChart = {
    chartType: "time-series",
    metricKey: "amount",
    basisLabel: "Visible Home month view",
    labels: safeMonths.map((row)=> String(row?.label || row?.monthKey || "")),
    values: safeMonths.map((row)=> Number(row?.amt) || 0)
  };
  return {
    trips: buildHomeCompareBarChart({ labels, metricKey: "trips", currentValue: period?.current?.trips, previousValue: period?.previous?.trips }),
    pounds: buildHomeCompareBarChart({ labels, metricKey: "pounds", currentValue: period?.current?.lbs, previousValue: period?.previous?.lbs }),
    amount: buildHomeCompareBarChart({ labels, metricKey: "amount", currentValue: period?.current?.amount, previousValue: period?.previous?.amount }),
    amountTrend: amountTrendChart,
    ppl: buildHomeCompareBarChart({ labels, metricKey: "ppl", currentValue: period?.current?.ppl, previousValue: period?.previous?.ppl })
  };
}

function buildHomeCompareBarChart({ labels, metricKey, currentValue, previousValue }){
  return {
    chartType: "compare-bars",
    metricKey,
    basisLabel: String(labels?.length ? labels.join(" vs ") : "Visible Home month view"),
    labels: Array.isArray(labels) ? labels.slice(0, 2) : ["Current month", "Previous month"],
    values: [Number(currentValue) || 0, Number(previousValue) || 0]
  };
}

function toneFromDelta(deltaPct, epsilonPct){
  const v = Number(deltaPct) || 0;
  if(Math.abs(v) <= epsilonPct) return "steady";
  return v > 0 ? "up" : "down";
}

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
    bindDatePill
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

  const chip = (key,label) => `<button class="chip segBtn ${fMode===key?'on is-selected':''}" data-rf="${key}" type="button">${label}</button>`;
  const REPORTS_SECTION_ITEMS = [
    { key: "insights", label: "Insights", intro: "Range insights and highlights for this active filter." },
    { key: "charts", label: "Charts", intro: "Trend charts for a quick visual scan of this range." },
    { key: "seasonality", label: "Seasonality", intro: "See repeat timing across months and matched dates." },
    { key: "records", label: "Records", intro: "Jump straight to high and low trip records for this range." },
    { key: "detail", label: "Detail", intro: "Dealer, area, and monthly summary rows for this range." }
  ];
  const activeReportsSection = REPORTS_SECTION_ITEMS.some((item)=> item.key === reportsSectionKey) ? reportsSectionKey : "insights";
  const renderReportsSectionChip = (item)=> `<button class="chip reportsSectionChip ${activeReportsSection===item.key?'on is-selected':''}" data-reports-section="${item.key}" type="button" role="tab" id="reports-tab-${item.key}" aria-controls="reportsTransitionRoot" aria-selected="${activeReportsSection===item.key ? 'true' : 'false'}" tabindex="${activeReportsSection===item.key ? "0" : "-1"}">${item.label}</button>`;

  const advOpen = !!rf.adv;
  const advPanel = renderReportsAdvancedPanel({
    reportsFilter: rf,
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
          : (fMode === "ALL" ? "All Time"
            : "YTD")));
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
      <div class="reportsTopHeader cardHeaderRow">
        <b>Reports</b>
        <span class="pill">Range <b>${escapeHtml(rangeLabel)}</b></span>
      </div>

      <section class="reportsTimeframeShell" aria-label="Reports timeframe controls">
        <div class="reportsTopLabel">Timeframe</div>
        <div class="segWrap timeframeUnifiedControl reportsTimeframeControl" role="group" aria-label="Reports timeframe filter">
          ${chip("YTD","YTD")}
          ${chip("THIS_MONTH","This Month")}
          ${chip("LAST_MONTH","Last Month")}
          ${chip("ALL","All Time")}
        </div>
      </section>

      <div class="repCtlRow cardActionRow">
        <button class="btn btn-ghost affordanceBtn repAdvToggle" type="button">${advOpen ? "Hide advanced filters" : "Advanced filters"}</button>
      </div>

      <div class="reportsAdvancedShell" aria-label="Reports advanced filters">
        ${advPanel}
      </div>

      <section class="reportsNavShell" aria-label="Reports sections">
        <div class="reportsNavLabel">Section tabs</div>
        <div class="reportsSectionSwitch" role="tablist" aria-label="Reports sections">
          ${REPORTS_SECTION_ITEMS.map((item)=> renderReportsSectionChip(item)).join("")}
        </div>
        <div class="reportsSectionIntro">${escapeHtml((REPORTS_SECTION_ITEMS.find((item)=> item.key === activeReportsSection) || REPORTS_SECTION_ITEMS[0]).intro)}</div>
      </section>

      ${body}
    </div>
  `;

  const renderNoResultsState = ()=> {
    const invalidRange = fMode === "RANGE" && !hasValidRange;
    const beginnerEmpty = !hasSavedTrips;
    const title = invalidRange
      ? "Choose a valid date range"
      : (beginnerEmpty ? "Reports unlock after your first trip" : "No trips in this range");
    const body = invalidRange
      ? "Set both dates, then tap Apply."
      : (beginnerEmpty
        ? "Save your first trip to unlock Reports."
        : "No trips match this filter yet. Add a trip or switch to All Time.");
    const followup = invalidRange
      ? ""
      : (beginnerEmpty
        ? '<div class="emptyStateFollowup">Next best step: save your first trip.</div>'
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

  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      ${renderReportsTopShell({ body: renderNoResultsState() })}
    `;
    getApp().scrollTop = 0;

    // quick range buttons
    getApp().querySelectorAll(".chip[data-rf]").forEach(btn=>{
      btn.onclick = ()=>{
        const key = String(btn.getAttribute("data-rf")||"YTD").toUpperCase();
        state.reportsFilter.mode = key;
        if(key !== "RANGE"){
          state.reportsFilter.from = "";
          state.reportsFilter.to = "";
        }
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
    recordPools
  } = buildReportsAggregationState({
    trips,
    canonicalDealerGroupKey,
    normalizeDealerDisplay,
    resolveTripArea
  });

  const renderSummaryAverageLine = (row)=> `<span class="muted">Avg / Trip</span> <span class="money">${formatMoney(to2(row.amountPerTrip))}</span> • <span class="lbsBlue">${to2(row.poundsPerTrip)} lbs</span>`;

  const renderAggList = (rows, emptyMsg)=>{
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
            <div><b class="money">${formatMoney(r.amt)}</b></div>
            <div><span class="ppl">$/lb</span> <b class="rate ppl">${formatMoney(r.avg)}</b></div>
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
    if(metric === "ppl") return (lbsNum > 0 && amtNum > 0) ? (amtNum / lbsNum) : 0;
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
    const ppl = (lbsNum>0 && amtNum>0) ? (amtNum/lbsNum) : 0;
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
          ${typeof renderStandardReadOnlyTripCard === "function" ? renderStandardReadOnlyTripCard(t) : ""}
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
        takeaway: amountTakeaway,
        title: "Monthly Total Amount",
        subhead: "Month-by-month payout trend for the selected range",
        hero: `<span class="money">${latestMonth ? formatMoney(to2(latestMonth.amt)) : "—"}</span>`,
        context: `Latest ${latestMonth ? escapeHtml(latestMonth.label) : "month"} • Range high <span class="money">${amountPeak ? formatMoney(to2(amountPeak.amt)) : "—"}</span>`,
        canvasId: "c_amount_monthly"
      }),
      renderChartCard({
        takeaway: pplTakeaway,
        title: "Avg $/lb by Month",
        subhead: "Month-by-month pay-rate trend for the selected range",
        hero: `<span class="rate ppl">${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</span>`,
        context: `Latest ${latestMonth ? escapeHtml(latestMonth.label) : "month"} • Range high <span class="rate ppl">${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</span>`,
        canvasId: "c_ppl"
      }),
      renderChartCard({
        takeaway: dealerRateTakeaway,
        title: "Dealer Avg $/lb",
        subhead: "Buyer pay rates across this active range",
        hero: `<span class="rate ppl">${dealerRatePeak ? `${formatMoney(to2(dealerRatePeak.avg))}/lb` : "—"}</span>`,
        context: `Highest pay-rate dealer this range • ${dealerRatePeak ? escapeHtml(String(dealerRatePeak.name || "—")) : "—"}`,
        canvasId: "c_dealer_rate",
        height: 220
      }),
      renderChartCard({
        takeaway: dealerAmountTakeaway,
        title: "Dealer Amount",
        subhead: "Top dealers by total amount in this range",
        hero: `<span class="money">${dealerAmountPeak ? formatMoney(to2(dealerAmountPeak.amt)) : "—"}</span>`,
        context: `Leading dealer this range • ${dealerAmountPeak ? escapeHtml(String(dealerAmountPeak.name || "—")) : "—"}`,
        canvasId: "c_dealer",
        height: 220
      }),
      renderChartCard({
        takeaway: amountPerTripTakeaway,
        title: "Monthly Amount per Trip",
        subhead: "Average payout value per trip by month",
        hero: `<span class="money">${latestMonth ? formatMoney(to2(latestMonth.amountPerTrip)) : "—"}</span>`,
        context: `Latest ${latestMonth ? escapeHtml(latestMonth.label) : "month"} • Range high <span class="money">${amountPerTripPeak ? formatMoney(to2(amountPerTripPeak.amountPerTrip)) : "—"}</span>`,
        canvasId: "c_amount_per_trip"
      }),
      renderChartCard({
        takeaway: lbsTakeaway,
        title: "Monthly Pounds",
        subhead: "Month-by-month pounds landed in this range",
        hero: `<span class="lbsBlue">${latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"}</span>`,
        context: `Latest ${latestMonth ? escapeHtml(latestMonth.label) : "month"} • Range high <span class="lbsBlue">${lbsPeak ? `${to2(lbsPeak.lbs)} lbs` : "—"}</span>`,
        canvasId: "c_lbs"
      }),
      renderChartCard({
        takeaway: tripsTakeaway,
        title: "Trips over time",
        subhead: "Trip count by month for this same range",
        hero: `<span class="trips">${tripsLatest ? tripsLatest.count : "—"}</span>`,
        context: `Latest ${tripsLatest ? escapeHtml(tripsLatest.shortLabel) : "month"} • Range high <span class="trips">${tripsPeak ? tripsPeak.count : "—"}</span> • Total <span class="trips">${tripsTotal}</span>`,
        canvasId: "c_trips"
      })
    ].join("");
  };

  const seasonalityFoundation = isHomeMetricDetail
    ? null
    : buildReportsSeasonalityFoundation({ trips: seasonalityTrips, nowDate: new Date() });

  const compareFoundation = isHomeMetricDetail
    ? buildHomeMetricDetailFoundation({ monthRows })
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

  const reportsSection = ({ title, intro, body, extraClass = "" })=> `
    <section class="reportsSection ${extraClass}">
      <div class="reportsSectionHead">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(intro)}</p>
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
      intro: "Seasonality uses matched dates across years, while the first card keeps the year-over-year view clear.",
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
    intro: "Quick mobile-read charts for trend scanning in this active range.",
    body: `<div class="reportsChartsStack">${renderChartsSection()}</div>`,
    extraClass: "reportsSection--charts"
  });

  const PERCENT_TOKEN_RE = /([+-]?\d+%)/g;
  const renderPercentEmphasisText = (text)=> escapeHtml(String(text || "")).replace(PERCENT_TOKEN_RE, '<span class="reportsPercentEmphasis">$1</span>');

  const formatMetricCompareValue = (metricKey, value)=>{
    const safeValue = Number(value);
    if(!Number.isFinite(safeValue)) return "—";
    if(metricKey === "trips") return `${Math.round(safeValue)} trips`;
    if(metricKey === "pounds") return `${to2(safeValue)} lbs`;
    if(metricKey === "amount") return formatMoney(to2(safeValue));
    if(metricKey === "ppl") return `${formatMoney(to2(safeValue))}/lb`;
    return `${to2(safeValue)}`;
  };

  const buildMetricCompareSummary = (metricKey, payload)=>{
    if(compareFoundation.period?.suppressed || !payload || payload.suppressed){
      const reason = payload?.reason || compareFoundation.period?.reason || "This comparison appears once both periods have enough trips.";
      return {
        tone: "steady",
        text: reason,
        currentValue: formatMetricCompareValue(metricKey, payload?.currentValue),
        previousValue: formatMetricCompareValue(metricKey, payload?.previousValue)
      };
    }
    const tone = String(payload.compareTone || "steady");
    const period = compareFoundation.period || {};
    const currentLabel = period.currentLabel || "Current";
    const previousLabel = period.previousLabel || "Previous";
    const safeNum = (value)=> Number(value) || 0;
    const pctText = (value)=> `${Math.abs(Math.round((Number(value) || 0) * 100))}%`;
    const amountPayload = compareFoundation.metrics?.amount || null;
    const poundsPayload = compareFoundation.metrics?.pounds || null;
    const tripsPayload = compareFoundation.metrics?.trips || null;
    const pplPayload = compareFoundation.metrics?.ppl || null;
    const currentPoundsPerTrip = safeNum(period.current?.poundsPerTrip);
    const previousPoundsPerTrip = safeNum(period.previous?.poundsPerTrip);
    const currentAmountPerTrip = safeNum(period.current?.amountPerTrip);
    const previousAmountPerTrip = safeNum(period.previous?.amountPerTrip);
    const currentAmountPerDay = safeNum(period.current?.amountPerDay);
    const previousAmountPerDay = safeNum(period.previous?.amountPerDay);
    const currentPoundsPerDay = safeNum(period.current?.poundsPerDay);
    const previousPoundsPerDay = safeNum(period.previous?.poundsPerDay);
    const productivityTone = currentPoundsPerTrip > previousPoundsPerTrip * 1.05
      ? "up"
      : (currentPoundsPerTrip < previousPoundsPerTrip * 0.95 ? "down" : "steady");
    const amountPerTripTone = currentAmountPerTrip > previousAmountPerTrip * 1.05
      ? "up"
      : (currentAmountPerTrip < previousAmountPerTrip * 0.95 ? "down" : "steady");
    const amountPerDayTone = currentAmountPerDay > previousAmountPerDay * 1.05
      ? "up"
      : (currentAmountPerDay < previousAmountPerDay * 0.95 ? "down" : "steady");
    const poundsPerDayTone = currentPoundsPerDay > previousPoundsPerDay * 1.05
      ? "up"
      : (currentPoundsPerDay < previousPoundsPerDay * 0.95 ? "down" : "steady");

    const homePrefix = isHomeMetricDetail ? "" : `${currentLabel} `;

    const summaryBuilders = {
      trips: ()=> {
        if(tone === "up") return `${homePrefix}${isHomeMetricDetail ? "Trips rose." : `ran more trips than ${previousLabel}.`} ${productivityTone === "down" ? "Average pounds per trip slipped while effort increased." : (productivityTone === "up" ? "Average pounds per trip improved with the extra effort." : "Average pounds per trip stayed close." )} ${poundsPerDayTone === "up" ? "Pounds per fishing day also improved." : (poundsPerDayTone === "down" ? "Pounds per fishing day also softened." : "")}`.trim();
        if(tone === "down") return `${homePrefix}${isHomeMetricDetail ? "Trips fell." : `ran fewer trips than ${previousLabel}.`} ${productivityTone === "up" ? "Average pounds per trip improved even with less effort." : (productivityTone === "down" ? "Average pounds per trip also softened." : "Average pounds per trip stayed close." )} ${poundsPerDayTone === "up" ? "Pounds per fishing day still improved." : (poundsPerDayTone === "down" ? "Pounds per fishing day also eased." : "")}`.trim();
        return `${isHomeMetricDetail ? "Trip count held close" : `${currentLabel} matched ${previousLabel} on trip count`}, with pounds per trip ${productivityTone === "up" ? "improving" : (productivityTone === "down" ? "slipping" : "holding steady")}${poundsPerDayTone === "steady" ? "." : ` and pounds per fishing day ${poundsPerDayTone === "up" ? "improving" : "slipping"}.`}`;
      },
      pounds: ()=> {
        if(tone === "up") return `${homePrefix}${isHomeMetricDetail ? "Pounds rose." : `landed more pounds than ${previousLabel} in this matched range.`} ${tripsPayload?.compareTone === "up" ? "More trips helped drive the gain." : (productivityTone === "up" ? "The gain came from stronger pounds per trip." : "Trip count stayed close while pounds climbed.")} ${poundsPerDayTone === "up" ? "Pounds per fishing day improved too." : ""}`.trim();
        if(tone === "down") return `${homePrefix}${isHomeMetricDetail ? "Pounds fell." : `landed fewer pounds than ${previousLabel} in this matched range.`} ${tripsPayload?.compareTone === "down" ? "Fewer trips were part of the drop." : (productivityTone === "down" ? "Average pounds per trip also declined." : "Trip count stayed close while pounds fell.")} ${poundsPerDayTone === "down" ? "Pounds per fishing day also declined." : ""}`.trim();
        return `${isHomeMetricDetail ? "Pounds held close" : `${currentLabel} held close to ${previousLabel} on pounds`}, with ${productivityTone === "up" ? "better" : (productivityTone === "down" ? "softer" : "steady")} pounds per trip${poundsPerDayTone === "steady" ? "." : ` and pounds per fishing day ${poundsPerDayTone === "up" ? "up" : "down"}.`}`;
      },
      amount: ()=> {
        if(tone === "up") return `${homePrefix}${isHomeMetricDetail ? "Amount rose." : `earned more than ${previousLabel} in this matched range.`} ${poundsPayload?.compareTone === "up" && pplPayload?.compareTone === "up" ? "Both pounds and $/lb moved up." : (poundsPayload?.compareTone === "up" ? "Heavier pounds carried most of the gain." : (pplPayload?.compareTone === "up" ? "Stronger $/lb did most of the lifting." : "Volume and rate both stayed fairly close."))} ${amountPerTripTone === "up" ? "Amount per trip improved." : ""} ${amountPerDayTone === "up" ? "Amount per fishing day improved too." : ""}`.trim();
        if(tone === "down") return `${homePrefix}${isHomeMetricDetail ? "Amount fell." : `earned less than ${previousLabel} in this matched range.`} ${poundsPayload?.compareTone === "down" && pplPayload?.compareTone === "down" ? "Lighter pounds and softer $/lb both contributed." : (poundsPayload?.compareTone === "down" ? "The drop came mostly from lighter pounds." : (pplPayload?.compareTone === "down" ? "Softer $/lb did most of the damage." : "Volume and rate both stayed fairly close."))} ${amountPerTripTone === "down" ? "Amount per trip also softened." : ""} ${amountPerDayTone === "down" ? "Amount per fishing day softened too." : ""}`.trim();
        return `${isHomeMetricDetail ? "Amount held close." : `${currentLabel} stayed close to ${previousLabel} on amount in this matched range,`} ${isHomeMetricDetail ? `Pounds were ${poundsPayload?.compareTone === "up" ? "up" : (poundsPayload?.compareTone === "down" ? "down" : "steady")} and $/lb was ${pplPayload?.compareTone === "up" ? "up" : (pplPayload?.compareTone === "down" ? "down" : "steady")}.` : `while pounds were ${poundsPayload?.compareTone === "up" ? "up" : (poundsPayload?.compareTone === "down" ? "down" : "steady")} and $/lb was ${pplPayload?.compareTone === "up" ? "up" : (pplPayload?.compareTone === "down" ? "down" : "steady")}.`} ${amountPerTripTone === "steady" ? "Amount per trip stayed close." : `Amount per trip moved ${amountPerTripTone}.`} ${amountPerDayTone === "steady" ? "Amount per fishing day stayed close." : `Amount per fishing day moved ${amountPerDayTone}.`}`.trim();
      },
      ppl: ()=> {
        if(tone === "up") return `${isHomeMetricDetail ? "Average $/lb improved" : `${currentLabel} improved average $/lb over ${previousLabel}`}${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "down" ? "That happened even with lighter pounds." : (isHomeMetricDetail ? "Pricing strengthened." : "Pricing strengthened versus the prior period.")}`;
        if(tone === "down") return `${isHomeMetricDetail ? "Average $/lb softened" : `${currentLabel} came in below ${previousLabel} on average $/lb`}${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "up" ? "Heavier pounds did not fully offset the softer rate." : (isHomeMetricDetail ? "Pricing softened." : "Pricing softened versus the prior period.")}`;
        return `${isHomeMetricDetail ? "Average $/lb held close." : `${currentLabel} held close to ${previousLabel} on average $/lb in this matched range,`} ${isHomeMetricDetail ? `Amount was ${amountPayload?.compareTone === "up" ? "still up" : (amountPayload?.compareTone === "down" ? "still down" : "also holding steady")}.` : `with amount ${amountPayload?.compareTone === "up" ? "still up" : (amountPayload?.compareTone === "down" ? "still down" : "also holding steady")}.`}`;
      }
    };
    const summaryText = (summaryBuilders[metricKey] || summaryBuilders.amount)();
    const trustNote = payload.confidenceLabel === "early"
      ? "Early read."
      : (payload.confidenceLabel === "weak" ? "Light read." : "");
    return {
      tone,
      text: `${summaryText} ${trustNote}`.trim(),
      currentValue: formatMetricCompareValue(metricKey, payload.currentValue),
      previousValue: formatMetricCompareValue(metricKey, payload.previousValue)
    };
  };

  const renderMetricDetailSection = ({ meta, compareSummary })=> {
    const detailBackLabel = isHomeMetricDetail ? "← Home KPIs" : "← Back to reports";
    const detailEyebrow = isHomeMetricDetail ? "Home insight" : meta.eyebrow;
    const detailContext = isHomeMetricDetail
      ? String(homeScope?.contextText || `Home • Range ${rangeLabel} • ${homeScope?.tripCount ?? trips.length} trips`)
      : `Range ${rangeLabel} • ${trips.length} trips`;
    const detailChartTitle = isHomeMetricDetail ? meta.homeChartTitle : meta.chartTitle;
    const detailChartContext = meta.primaryBasis?.basisLabel || (isHomeMetricDetail ? meta.homeChartContext : meta.chartContext);
    const detailInsight = isHomeMetricDetail ? meta.homeInsight : meta.insight;
    const compareContractLabel = compareFoundation.period?.compareModelLabel || "Comparison";
    const compareContractBasis = compareFoundation.period?.currentLabel && compareFoundation.period?.previousLabel
      ? `${compareFoundation.period.currentLabel} vs ${compareFoundation.period.previousLabel}`
      : (meta.primaryBasis?.basisLabel || compareFoundation.period?.supportLabel || compareFoundation.period?.support || compareFoundation.period?.fairWindowLabel || "Matched date range");
    const compareContractText = (!isHomeMetricDetail || compareFoundation.period?.suppressed || compareSummary.tone === "steady")
      ? (compareFoundation.period?.explanation || "")
      : "";
    const secondaryCharts = Array.isArray(meta.secondaryCharts) ? meta.secondaryCharts.filter(Boolean) : [];
    return `
    <section class="${detailSurfaceClass}" aria-label="${escapeHtml(meta.title)}">
      <div class="${detailCardClass}">
        <button class="btn btn-ghost affordanceBtn ${detailBackClass}" type="button" id="reportsMetricBack">${detailBackLabel}</button>
        <div class="${detailEyebrowClass}">${escapeHtml(detailEyebrow)}</div>
        <h2 class="${detailTitleClass}">${escapeHtml(isHomeMetricDetail ? meta.homeTitle : meta.title)}</h2>
        <div class="${detailContextClass}">${escapeHtml(detailContext)}</div>

        <div class="${detailHeroWrapClass}">
          <div class="${detailHeroLabelClass}">${escapeHtml(isHomeMetricDetail ? meta.homeHeroLabel : meta.heroLabel)}</div>
          <div class="${detailHeroValueClass} ${escapeHtml(meta.heroClass)}">${escapeHtml(meta.heroValue)}</div>
          <div class="${detailChartContextClass}">Compared range • ${escapeHtml(compareContractBasis)}</div>
        </div>

        <div class="${detailCompareClass} tone-${escapeHtml(compareSummary.tone)}">
          <div class="${detailCompareTextClass}">${renderPercentEmphasisText(compareSummary.text)}</div>
          <div class="${detailCompareRowsClass}">
            <div><span>${escapeHtml(meta.primaryBasis?.currentLabel || compareFoundation.period?.currentLabel || "Current")}</span><b>${escapeHtml(compareSummary.currentValue)}</b></div>
            <div><span>${escapeHtml(meta.primaryBasis?.previousLabel || compareFoundation.period?.previousLabel || "Previous")}</span><b>${escapeHtml(compareSummary.previousValue)}</b></div>
          </div>
          <div class="${detailChartContextClass}"><b>${escapeHtml(compareContractLabel)}</b> • ${escapeHtml(compareContractBasis)}</div>
          ${compareContractText ? `<div class="${detailChartContextClass}">${escapeHtml(compareContractText)}</div>` : ""}
        </div>

        <div class="${detailChartClass}">
          <b>${escapeHtml(detailChartTitle)}</b>
          <div class="${detailChartContextClass}">${escapeHtml(detailChartContext)}</div>
          <canvas class="chart" id="${escapeHtml(meta.chartCanvasId)}" height="220"></canvas>
        </div>

        ${secondaryCharts.map((chart)=> `
          <div class="${detailChartClass}">
            <b>${escapeHtml(chart.title)}</b>
            <div class="${detailChartContextClass}">${escapeHtml(chart.context)}</div>
            <canvas class="chart" id="${escapeHtml(chart.canvasId)}" height="220"></canvas>
          </div>
        `).join("")}

        <div class="${detailInsightClass}">${escapeHtml(detailInsight)}</div>
      </div>
    </section>
  `;
  };

  const buildMetricDetailView = (metricKey)=>{
    const primaryBasis = primaryBasisByMetric?.[metricKey] || null;
    const primaryPayload = primaryBasis?.comparePayload || compareFoundation.metrics?.[metricKey] || null;
    const primaryChart = primaryBasis?.primaryChart || detailCharts?.[metricKey] || null;
    const formatHeroFromPrimaryBasis = (targetMetric, basis)=> {
      const value = Number(basis?.currentValue);
      if(!Number.isFinite(value)) return "—";
      if(targetMetric === "trips") return `${Math.round(value)} trips`;
      if(targetMetric === "pounds") return `${to2(value)} lbs`;
      if(targetMetric === "amount") return formatMoney(to2(value));
      if(targetMetric === "ppl") return value > 0 ? `${formatMoney(to2(value))}/lb` : "—";
      return `${to2(value)}`;
    };
    const detailMeta = {
      trips: {
        title: "Trips breakdown",
        homeTitle: "Trips",
        eyebrow: "Metric breakdown",
        heroLabel: "Trips in current range",
        homeHeroLabel: "Trips in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("trips", primaryBasis),
        heroClass: "trips",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Trips for this range",
        homeChartTitle: "Trips",
        chartContext: primaryChart?.basisLabel || "Trips in this matched date range",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_trips",
        insight: "Use this view to compare the current range with the earlier matched range.",
        homeInsight: "Use the compare card and chart together for the cleanest trip-count read."
      },
      pounds: {
        title: "Pounds breakdown",
        homeTitle: "Pounds",
        eyebrow: "Metric breakdown",
        heroLabel: "Pounds in current range",
        homeHeroLabel: "Pounds in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("pounds", primaryBasis),
        heroClass: "lbsBlue",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Pounds for this range",
        homeChartTitle: "Pounds",
        chartContext: primaryChart?.basisLabel || "Pounds in this matched date range",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_lbs",
        insight: "Use this view to compare pounds in one matched range so the headline, compare rows, and chart stay aligned.",
        homeInsight: "Use the compare card and chart together to judge pound movement."
      },
      amount: {
        title: "Amount breakdown",
        homeTitle: "Amount",
        eyebrow: "Metric breakdown",
        heroLabel: "Amount in current range",
        homeHeroLabel: "Amount in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("amount", primaryBasis),
        heroClass: "money",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "Amount for this range",
        homeChartTitle: "Amount",
        chartContext: primaryChart?.basisLabel || "Amount in this matched date range",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_amount_detail",
        secondaryCharts: [
          detailCharts.amountTrend ? {
            title: "Amount trend across the range",
            context: isHomeMetricDetail
              ? "Extra context • visible Home months in this filter"
              : "Extra context • full months in this active Reports range",
            canvasId: "c_amount_trend",
            chartModel: detailCharts.amountTrend,
            metricKey: "amount"
          } : null,
          {
            title: "Dealer mix",
            context: "Extra context for this same active filter range",
            canvasId: "c_dealer"
          }
        ],
        insight: "Read the main amount view first, then use the trend and dealer mix for added context.",
        homeInsight: "Read the main comparison first, then use trend and dealer mix for added context."
      },
      ppl: {
        title: "$/lb breakdown",
        homeTitle: "Avg $/lb",
        eyebrow: "Metric breakdown",
        heroLabel: "Average $/lb in current range",
        homeHeroLabel: "Average $/lb in latest visible Home month",
        heroValue: formatHeroFromPrimaryBasis("ppl", primaryBasis),
        heroClass: "rate ppl",
        comparePayload: primaryPayload,
        primaryBasis,
        chartTitle: "$/lb for this range",
        homeChartTitle: "Avg $/lb",
        chartContext: primaryChart?.basisLabel || "$/lb in this matched date range",
        homeChartContext: primaryChart?.basisLabel || "Latest visible month vs previous visible month",
        chartCanvasId: "c_ppl",
        insight: "Use this view to compare $/lb in one matched range without mixing in full-range averages.",
        homeInsight: "Use the compare card and chart together to judge pricing."
      }
    };
    const meta = detailMeta[metricKey];
    if(!meta) return "";
    const compareSummary = buildMetricCompareSummary(metricKey, meta.comparePayload);
    return renderMetricDetailSection({ meta, compareSummary });
  };

  const renderTableCard = (title, body)=> `
    <div class="card">
      <b>${escapeHtml(title)}</b>
      <div class="sep"></div>
      ${body}
    </div>
  `;

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
        <div class="emptyStateTitle">$/lb insights pending</div>
        <div class="emptyStateBody">Add trips that include both pounds and amount to unlock this view.</div>
      </div>`}
  `;

  const renderRecordsBlock = ()=> reportsSection({
    title: "Records",
    intro: "High and low trip records for pounds, amount, and when available $/lb.",
    body: `<div class="reportsTablesStack">${renderTableCard("High / Low Summary", highLowBody)}</div>`,
    extraClass: "reportsSection--records"
  });

  const renderDetailBlock = ()=> reportsSection({
    title: "Detail",
    intro: "Dealer, area, and monthly summary rows for this active range.",
    body: `<div class="reportsTablesStack">${[
      renderTableCard("Dealer Summary", renderAggList(dealerRows, "Add a trip in this range to populate dealer totals.")),
      renderTableCard("Area Summary", renderAggList(areaRows, "Add a trip in this range to populate area totals.")),
      renderTableCard("Monthly Totals", renderMonthList())
    ].join("")}</div>`,
    extraClass: "reportsSection--detail"
  });

  const renderActiveReportsSection = ()=> {
    if(activeReportsSection === "charts") return renderChartsBlock();
    if(activeReportsSection === "seasonality") return renderSeasonalitySection() || reportsSection({
      title: "Seasonality",
      intro: "Seasonality unlocks once enough dated history exists across months and years.",
      body: `<div class="reportsHighlightsEmpty"><div class="muted small">Add more dated trips across multiple months to unlock seasonality reads.</div></div>`,
      extraClass: "reportsSection--seasonality"
    });
    if(activeReportsSection === "records") return renderRecordsBlock();
    if(activeReportsSection === "detail") return renderDetailBlock();
    return reportsSection({
      title: "Insights",
      intro: "Analysis takeaways from this date range.",
      body: highlightsStrip || `<div class="reportsHighlightsEmpty"><div class="muted small">Highlights will appear as more trips are added.</div></div>`,
      extraClass: "reportsSection--highlights"
    });
  };

  const reportsBodyView = activeMetricDetail ? "metric-detail" : activeReportsSection;
  getApp().innerHTML = homeMetricOnly ? `
    ${renderPageHeader("home")}

    <div id="reportsTransitionRoot" class="reportsTransitionRoot reportsTransitionRoot--detail" data-reports-view="${escapeHtml(reportsBodyView)}">
      ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : ""}
    </div>
  ` : `
    ${renderPageHeader("reports")}

    ${renderReportsTopShell({
      shellMode: activeMetricDetail ? "detail" : "overview",
      body: `<div id="reportsTransitionRoot" class="reportsTransitionRoot" data-reports-view="${escapeHtml(reportsBodyView)}" role="tabpanel" aria-labelledby="reports-tab-${escapeHtml(activeReportsSection)}" tabindex="-1">
        ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : renderActiveReportsSection()}
      </div>`
    })}
  `;

  getApp().scrollTop = 0;
  animateReportsShellEnter(document.getElementById("reportsTransitionRoot"));
  flushReportsAnnouncement();

  // range chips
  getApp().querySelectorAll(".chip[data-rf]").forEach(btn=>{
    btn.onclick = ()=>{
      state.reportsFilter.mode = String(btn.getAttribute("data-rf")||"YTD");
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
        tabs[nextIdx]?.focus();
        return;
      }
      if(event.key === "Home" || event.key === "End"){
        event.preventDefault();
        const target = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
        target?.focus();
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
      queueReportsAnnouncement(`Opened ${metricName} detail.`);
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
    scheduleReportsChartsDraw(monthRows, dealerRows, tripsTimeline, {
      metricDetail: {
        metricKey: activeMetricDetail,
        compareChart: primaryBasisByMetric?.[activeMetricDetail]?.primaryChart || detailCharts?.[activeMetricDetail] || null,
        secondaryCharts: activeMetricDetail === "amount"
          ? [
            detailCharts.amountTrend ? { canvasId: "c_amount_trend", chartModel: detailCharts.amountTrend, metricKey: "amount" } : null,
            document.getElementById("c_dealer") ? { canvasId: "c_dealer", chartModel: null, metricKey: "amount" } : null
          ].filter(Boolean)
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
