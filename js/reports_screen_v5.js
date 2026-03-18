import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";
import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";
import { createTripCardRendererCore } from "./trip_card_renderer_core_v5.js";

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
    canonicalDealerGroupKey,
    normalizeDealerDisplay,
    formatMoney,
    to2,
    drawReportsCharts,
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
  const { resolveTripCardModel, renderTripCardHTML } = createTripCardRendererCore({
    formatDateDMY,
    to2,
    computePPL: (lbs, amt)=> (Number(lbs) > 0 && Number(amt) > 0) ? (Number(amt) / Number(lbs)) : 0,
    formatMoney,
    escapeHtml
  });
  const renderReportsHighlightsStrip = typeof reportsHighlights?.renderHighlightsStrip === "function"
    ? reportsHighlights.renderHighlightsStrip
    : (()=>"");

  const REPORTS_TRANSITION_MS = 150;
  let reportsTransitionTimer = null;

  function animateReportsShellEnter(root){
    if(!root) return;
    root.classList.remove("is-ready");
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        root.classList.add("is-ready");
      });
    });
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

  const tripsAll = Array.isArray(state.trips) ? state.trips.slice() : [];
  const rf = state.reportsFilter || { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
  const fMode = String(rf.mode || "YTD").toUpperCase();
  const mode = state.reportsMode || "tables"; // "charts" | "tables"
  const activeMetricDetail = String(state.reportsMetricDetail || "").toLowerCase();
  const metricDetailContext = state.reportsMetricDetailContext && typeof state.reportsMetricDetailContext === "object"
    ? state.reportsMetricDetailContext
    : null;
  const isHomeMetricDetail = metricDetailContext?.source === "home";

  if (homeMetricOnly && !isHomeMetricDetail) {
    renderApp();
    return;
  }

  const hasValidRange = (fMode !== "RANGE") || (parseReportDateToISO(rf.from) && parseReportDateToISO(rf.to));
  const homeCtxFilter = (isHomeMetricDetail && metricDetailContext?.homeFilter && typeof metricDetailContext.homeFilter === "object")
    ? metricDetailContext.homeFilter
    : null;
  const homeMode = String(homeCtxFilter?.mode || "YTD").toUpperCase();
  const homeRangeMode = homeMode === "RANGE"
    ? "custom"
    : (homeMode === "MONTH" ? "this_month" : (homeMode === "7D" ? "last_7_days" : "ytd"));
  const unified = (isHomeMetricDetail && activeMetricDetail && homeCtxFilter)
    ? {
      range: homeRangeMode,
      fromISO: parseReportDateToISO(homeCtxFilter.from || "") || "",
      toISO: parseReportDateToISO(homeCtxFilter.to || "") || "",
      dealer: "all",
      area: "all",
      species: "all",
      text: ""
    }
    : buildUnifiedFilterFromReportsFilter(rf);
  let trips = applyUnifiedTripFilter(tripsAll, hasValidRange ? unified : { ...unified, range:"all" }).rows;

  const chip = (key,label) => `<button class="chip segBtn ${fMode===key?'on is-selected':''}" data-rf="${key}" type="button">${label}</button>`;
  const seg = (key,label) => `<button class="chip ${mode===key?'on':''}" data-m="${key}">${label}</button>`;

  const advOpen = !!rf.adv;
  const advPanel = renderReportsAdvancedPanel({
    reportsFilter: rf,
    dealers: state.dealers,
    areas: state.areas
  });

  const resolvedReportsRange = resolveUnifiedRange(unified);
  const rangeLabel = isHomeMetricDetail
    ? (homeMode === "RANGE"
      ? `${formatDateDMY(resolvedReportsRange.fromISO)} → ${formatDateDMY(resolvedReportsRange.toISO)}`
      : (homeMode === "MONTH" ? "This Month" : (homeMode === "7D" ? "Last 7 Days" : "YTD")))
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

  const renderReportsTopShell = ({ includeModeToggle = true, body = "" } = {})=> `
    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;margin-top:0">
        <b>Reports</b>
        <span class="pill">Range <b>${escapeHtml(rangeLabel)}</b></span>
      </div>

      <div class="segWrap timeframeUnifiedControl reportsTimeframeControl" role="group" aria-label="Reports timeframe filter">
        ${chip("YTD","YTD")}
        ${chip("THIS_MONTH","This Month")}
        ${chip("LAST_MONTH","Last Month")}
        ${chip("ALL","All Time")}
      </div>

      <div class="row ${includeModeToggle ? "repCtlRow" : ""}" style="justify-content:${includeModeToggle ? "space-between" : "flex-end"};align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
        <button class="btn repAdvToggle" type="button">${advOpen ? "Hide" : "Advanced"}</button>
        ${includeModeToggle ? `
          <div class="row" style="gap:8px;margin-top:0">
            ${seg("charts","Charts")}
            ${seg("tables","Tables")}
          </div>
        ` : ""}
      </div>

      ${advPanel}
      ${body}
    </div>
  `;

  const renderNoResultsState = ()=> `
    <div class="emptyState">
      <div class="emptyStateTitle">${fMode==="RANGE" && !hasValidRange ? "Choose a valid date range" : "No trips in this range"}</div>
      <div class="emptyStateBody">${fMode==="RANGE" && !hasValidRange
        ? "Set both dates, then tap Apply to load this report."
        : "No saved trips match this filter yet. Add a trip to unlock dealer, area, and monthly summaries."}</div>
      <div class="emptyStateAction">
        <button class="btn good" id="reportsEmptyPrimary" type="button">${fMode==="RANGE" && !hasValidRange ? "Open advanced filters" : "＋ Add Trip"}</button>
        <button class="btn" id="reportsEmptySecondary" type="button">${fMode==="RANGE" && !hasValidRange ? "Open Help" : "Switch to All Time"}</button>
      </div>
    </div>
  `;

  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      ${renderReportsTopShell({ includeModeToggle: false, body: renderNoResultsState() })}
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
        if (fMode === "RANGE" && !hasValidRange) {
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
    normalizeDealerDisplay
  });

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
            <div class="tsub">${r.trips} trips • <span class="lbsBlue">${to2(r.lbs)} lbs</span></div>
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
            <div class="tsub">${r.trips} trips • <span class="lbsBlue">${to2(r.lbs)} lbs</span></div>
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
    const deltaRatio = (baselineValue && baselineValue > 0)
      ? ((currentValue - baselineValue) / baselineValue)
      : null;
    const hasCompare = Number.isFinite(deltaRatio) && Math.abs(deltaRatio) >= 0.005;
    const deltaPct = hasCompare ? Math.round(Math.abs(deltaRatio) * 1000) / 10 : 0;
    const compareWord = hasCompare
      ? (deltaRatio > 0 ? "higher" : "lower")
      : "";
    const compareTone = hasCompare
      ? (deltaRatio > 0 ? "up" : "down")
      : "steady";
    const recordModel = resolveTripCardModel(t, {
      metaOverride: formatDateDMY(t?.dateISO || "") || "—"
    });
    return `
      <div class="hlStatCard">
        <div class="hlTopRow hlTopRow--stacked">
          <div class="hlHdr">${escapeHtml(label)}</div>
          <div class="hlValue ${metricClass}">${escapeHtml(metricText)}</div>
          ${hasCompare ? `<div class="hlDelta tone-${compareTone}">${deltaPct}% ${compareWord} vs previous record</div>` : ""}
        </div>
        <div class="hlTripCardWrap">
          <div class="hlTripCardHdr">Record trip</div>
          ${renderTripCardHTML(recordModel, { compact: true, extraClass: "tripsBrowseCard reportsRecordTripCard" })}
        </div>
      </div>
    `;
  };

  const renderChartCard = ({ takeaway, title, subhead, hero, context, canvasId, height = 210 })=> `
    <div class="card chartCard">
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
    const pplPeak = monthRows.reduce((best,r)=> (Number(r?.avg)||0) > (Number(best?.avg)||0) ? r : best, monthRows[0] || null);
    const dealerPeak = dealerRows[0] || null;
    const lbsPeak = monthRows.reduce((best,r)=> (Number(r?.lbs)||0) > (Number(best?.lbs)||0) ? r : best, monthRows[0] || null);
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

    const pplTakeaway = buildMonthTakeaway("avg");
    const lbsTakeaway = buildMonthTakeaway("lbs");
    const tripsTakeaway = buildTripsTakeaway();
    const dealerTakeaway = dealerPeak ? { text: "Top dealer stands out in this range", tone: "up" } : { text: "Dealer mix still building", tone: "steady" };

    return [
      renderChartCard({
        takeaway: pplTakeaway,
        title: "Avg $/lb by Month",
        subhead: "Month-by-month trend for the selected range",
        hero: `<span class="rate ppl">${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</span>`,
        context: `Latest ${latestMonth ? escapeHtml(latestMonth.label) : "month"} • Range high <span class="rate ppl">${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</span>`,
        canvasId: "c_ppl"
      }),
      renderChartCard({
        takeaway: dealerTakeaway,
        title: "Dealer Amount (Top)",
        subhead: "Top dealers by total amount in this range",
        hero: `<span class="money">${dealerPeak ? formatMoney(to2(dealerPeak.amt)) : "—"}</span>`,
        context: `Leading dealer this range • ${dealerPeak ? escapeHtml(String(dealerPeak.name || "—")) : "—"}`,
        canvasId: "c_dealer",
        height: 220
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

  const highlightsStrip = renderReportsHighlightsStrip({
    dealerRows,
    monthRows,
    areaRows,
    trips
  });

  const totalLbs = trips.reduce((sum, t)=> sum + (Number(t?.pounds) || 0), 0);
  const totalAmount = trips.reduce((sum, t)=> sum + (Number(t?.amount) || 0), 0);
  const compareFoundation = buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows });
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

  const renderMainModeSection = ()=> {
    if(mode === "charts"){
      return `${reportsSection({
        title: "Charts",
        intro: "Quick mobile-read charts for trend scanning; switch to tables for exact rows.",
        body: `<div class="reportsChartsStack">${renderChartsSection()}</div>`,
        extraClass: "reportsSection--charts"
      })}
      ${reportsSection({
        title: "Deeper detail",
        intro: "Need line-item breakdowns? Open table mode for dealer, area, and monthly rows.",
        body: `<div class="card reportsDetailHint"><button class="btn" type="button" id="reportsSwitchToTables">Open table detail</button></div>`,
        extraClass: "reportsSection--detail"
      })}`;
    }
    return reportsSection({
      title: "Deeper detail",
      intro: "Dealer, area, and high/low summaries for this same range.",
      body: `<div class="reportsTablesStack">${renderTablesSection()}</div>`,
      extraClass: "reportsSection--detail"
    });
  };

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
      return {
        tone: "steady",
        text: "Comparison unlocks automatically after enough trips in both periods.",
        currentValue: "—",
        previousValue: "—"
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
    const currentPoundsPerTrip = safeNum(period.current?.trips) > 0 ? safeNum(period.current?.lbs) / safeNum(period.current?.trips) : 0;
    const previousPoundsPerTrip = safeNum(period.previous?.trips) > 0 ? safeNum(period.previous?.lbs) / safeNum(period.previous?.trips) : 0;
    const productivityTone = currentPoundsPerTrip > previousPoundsPerTrip * 1.05
      ? "up"
      : (currentPoundsPerTrip < previousPoundsPerTrip * 0.95 ? "down" : "steady");

    const summaryBuilders = {
      trips: ()=> {
        if(tone === "up") return `${currentLabel} added more trips than ${previousLabel}. ${productivityTone === "down" ? "Average pounds per trip slipped while effort increased." : (productivityTone === "up" ? "Average pounds per trip improved alongside the extra effort." : "Average pounds per trip stayed close." )}`;
        if(tone === "down") return `${currentLabel} ran fewer trips than ${previousLabel}. ${productivityTone === "up" ? "Average pounds per trip improved even with less effort." : (productivityTone === "down" ? "Average pounds per trip also softened." : "Average pounds per trip stayed close." )}`;
        return `${currentLabel} matched ${previousLabel} on trip count, with pounds per trip ${productivityTone === "up" ? "improving" : (productivityTone === "down" ? "slipping" : "holding steady")}.`;
      },
      pounds: ()=> {
        if(tone === "up") return `${currentLabel} landed more pounds than ${previousLabel}. ${tripsPayload?.compareTone === "up" ? "More trips helped drive the gain." : (productivityTone === "up" ? "The gain came from stronger pounds per trip." : "Trip count stayed close while pounds climbed.")}`;
        if(tone === "down") return `${currentLabel} landed fewer pounds than ${previousLabel}. ${tripsPayload?.compareTone === "down" ? "Fewer trips were part of the drop." : (productivityTone === "down" ? "Average pounds per trip also declined." : "Trip count stayed close while pounds fell.")}`;
        return `${currentLabel} held close to ${previousLabel} on pounds, with ${productivityTone === "up" ? "better" : (productivityTone === "down" ? "softer" : "steady")} pounds per trip.`;
      },
      amount: ()=> {
        if(tone === "up") return `${currentLabel} earned more than ${previousLabel}. ${poundsPayload?.compareTone === "up" && pplPayload?.compareTone === "up" ? "Both pounds and $/lb moved up." : (poundsPayload?.compareTone === "up" ? "Heavier pounds carried most of the gain." : (pplPayload?.compareTone === "up" ? "Stronger $/lb did most of the lifting." : "Volume and rate both stayed fairly close."))}`;
        if(tone === "down") return `${currentLabel} earned less than ${previousLabel}. ${poundsPayload?.compareTone === "down" && pplPayload?.compareTone === "down" ? "Lighter pounds and softer $/lb both contributed." : (poundsPayload?.compareTone === "down" ? "The drop came mostly from lighter pounds." : (pplPayload?.compareTone === "down" ? "Softer $/lb did most of the damage." : "Volume and rate both stayed fairly close."))}`;
        return `${currentLabel} stayed close to ${previousLabel} on total amount, while pounds were ${poundsPayload?.compareTone === "up" ? "up" : (poundsPayload?.compareTone === "down" ? "down" : "steady")} and $/lb was ${pplPayload?.compareTone === "up" ? "up" : (pplPayload?.compareTone === "down" ? "down" : "steady")}.`;
      },
      ppl: ()=> {
        if(tone === "up") return `${currentLabel} improved average $/lb over ${previousLabel}${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "down" ? "That happened even with lighter pounds." : "Pricing strengthened across the comparable window."}`;
        if(tone === "down") return `${currentLabel} came in below ${previousLabel} on average $/lb${payload.percentValid ? ` by ${pctText(payload.deltaPct)}` : ""}. ${poundsPayload?.compareTone === "up" ? "Heavier pounds did not fully offset the softer rate." : "Pricing softened across the comparable window."}`;
        return `${currentLabel} held close to ${previousLabel} on average $/lb, with total amount ${amountPayload?.compareTone === "up" ? "still up" : (amountPayload?.compareTone === "down" ? "still down" : "also holding steady")}.`;
      }
    };
    const summaryText = (summaryBuilders[metricKey] || summaryBuilders.amount)();
    return {
      tone,
      text: summaryText,
      currentValue: formatMetricCompareValue(metricKey, payload.currentValue),
      previousValue: formatMetricCompareValue(metricKey, payload.previousValue)
    };
  };

  const renderMetricDetailSection = ({ meta, compareSummary })=> {
    const detailBackLabel = isHomeMetricDetail ? "← Home KPIs" : "← Back to reports";
    const detailEyebrow = isHomeMetricDetail ? "Home KPI detail" : meta.eyebrow;
    const detailContext = isHomeMetricDetail
      ? `Home • Range ${rangeLabel} • ${trips.length} trips`
      : `Range ${rangeLabel} • ${trips.length} trips`;
    const detailChartTitle = isHomeMetricDetail ? meta.homeChartTitle : meta.chartTitle;
    const detailChartContext = isHomeMetricDetail ? meta.homeChartContext : meta.chartContext;
    const detailInsight = isHomeMetricDetail ? meta.homeInsight : meta.insight;
    return `
    <section class="${detailSurfaceClass}" aria-label="${escapeHtml(meta.title)}">
      <div class="card ${detailCardClass}">
        <button class="btn ${detailBackClass}" type="button" id="reportsMetricBack">${detailBackLabel}</button>
        <div class="${detailEyebrowClass}">${escapeHtml(detailEyebrow)}</div>
        <h2 class="${detailTitleClass}">${escapeHtml(isHomeMetricDetail ? meta.homeTitle : meta.title)}</h2>
        <div class="${detailContextClass}">${escapeHtml(detailContext)}</div>

        <div class="${detailHeroWrapClass}">
          <div class="${detailHeroLabelClass}">${escapeHtml(isHomeMetricDetail ? meta.homeHeroLabel : meta.heroLabel)}</div>
          <div class="${detailHeroValueClass} ${escapeHtml(meta.heroClass)}">${escapeHtml(meta.heroValue)}</div>
        </div>

        <div class="${detailCompareClass} tone-${escapeHtml(compareSummary.tone)}">
          <div class="${detailCompareTextClass}">${renderPercentEmphasisText(compareSummary.text)}</div>
          <div class="${detailCompareRowsClass}">
            <div><span>${escapeHtml(compareFoundation.period?.currentLabel || "Current")}</span><b>${escapeHtml(compareSummary.currentValue)}</b></div>
            <div><span>${escapeHtml(compareFoundation.period?.previousLabel || "Previous")}</span><b>${escapeHtml(compareSummary.previousValue)}</b></div>
          </div>
        </div>

        <div class="${detailChartClass}">
          <b>${escapeHtml(detailChartTitle)}</b>
          <div class="${detailChartContextClass}">${escapeHtml(detailChartContext)}</div>
          <canvas class="chart" id="${escapeHtml(meta.chartCanvasId)}" height="220"></canvas>
        </div>

        <div class="${detailInsightClass}">${escapeHtml(detailInsight)}</div>
      </div>
    </section>
  `;
  };

  const buildMetricDetailView = (metricKey)=>{
    const avgPpl = totalLbs > 0 ? (totalAmount / totalLbs) : 0;
    const tripsCompare = compareFoundation.metrics?.trips || null;
    const pplCompare = compareFoundation.metrics?.ppl || null;
    const detailMeta = {
      trips: {
        title: "Trips detail",
        homeTitle: "Home trips snapshot",
        eyebrow: "Metric detail",
        heroLabel: "Total trips",
        homeHeroLabel: "Trips in this Home range",
        heroValue: `${trips.length}`,
        heroClass: "trips",
        comparePayload: tripsCompare,
        chartTitle: "Trips over time",
        homeChartTitle: "Home trip activity",
        chartContext: "Monthly activity in this range",
        homeChartContext: "Monthly trips for this Home filter",
        chartCanvasId: "c_trips",
        insight: "Use this view to track effort volume and quickly spot whether recent activity is increasing, flat, or cooling.",
        homeInsight: "Stay in Home while checking whether trip activity in this saved range is building, steady, or cooling off."
      },
      pounds: {
        title: "Pounds detail",
        homeTitle: "Home pounds snapshot",
        eyebrow: "Metric detail",
        heroLabel: "Total pounds",
        homeHeroLabel: "Pounds in this Home range",
        heroValue: `${to2(totalLbs)} lbs`,
        heroClass: "lbsBlue",
        comparePayload: lbsCompare,
        chartTitle: "Monthly pounds trend",
        homeChartTitle: "Home pounds trend",
        chartContext: "This range, month by month",
        homeChartContext: "Monthly pounds for this Home filter",
        chartCanvasId: "c_lbs",
        insight: "Use this view to spot weight consistency and quickly confirm if this range is trending heavier or lighter than your prior period.",
        homeInsight: "Stay in Home while checking whether this range is landing heavier or lighter than the prior comparison period."
      },
      amount: {
        title: "Amount detail",
        homeTitle: "Home amount snapshot",
        eyebrow: "Metric detail",
        heroLabel: "Total amount",
        homeHeroLabel: "Amount in this Home range",
        heroValue: formatMoney(to2(totalAmount)),
        heroClass: "money",
        comparePayload: amountCompare,
        chartTitle: "Dealer amount distribution",
        homeChartTitle: "Home dealer amount mix",
        chartContext: "Top dealers for this same range",
        homeChartContext: "Top dealers inside this Home filter",
        chartCanvasId: "c_dealer",
        insight: "Use this view to see whether changes in total amount are broad-based or mostly concentrated in one buyer relationship.",
        homeInsight: "Stay in Home while checking whether this range stays balanced across dealers or leans on one buyer."
      },
      ppl: {
        title: "$/lb detail",
        homeTitle: "Home $/lb snapshot",
        eyebrow: "Metric detail",
        heroLabel: "Average $/lb",
        homeHeroLabel: "Average $/lb in this Home range",
        heroValue: avgPpl > 0 ? `${formatMoney(to2(avgPpl))}/lb` : "—",
        heroClass: "rate ppl",
        comparePayload: pplCompare,
        chartTitle: "Monthly $/lb trend",
        homeChartTitle: "Home $/lb trend",
        chartContext: "This range, month by month",
        homeChartContext: "Monthly average $/lb for this Home filter",
        chartCanvasId: "c_ppl",
        insight: "Use this view to watch price efficiency independent of total volume so rate movement is easier to separate from trip count swings.",
        homeInsight: "Stay in Home while checking whether rate strength is improving without leaving your Home KPI context."
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

  const renderTablesSection = ()=>{
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
    return [
      renderTableCard("Dealer Summary", renderAggList(dealerRows, "Add a trip in this range to populate dealer totals.")),
      renderTableCard("Area Summary", renderAggList(areaRows, "Add a trip in this range to populate area totals.")),
      renderTableCard("Monthly Totals", renderMonthList()),
      renderTableCard("High / Low Summary", highLowBody)
    ].join("");
  };

  const reportsBodyView = activeMetricDetail ? "metric-detail" : mode;
  getApp().innerHTML = homeMetricOnly ? `
    ${renderPageHeader("home")}

    <div id="reportsTransitionRoot" class="reportsTransitionRoot reportsTransitionRoot--detail" data-reports-view="${escapeHtml(reportsBodyView)}">
      ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : ""}
    </div>
  ` : `
    ${renderPageHeader("reports")}

    ${renderReportsTopShell({
      body: `<div id="reportsTransitionRoot" class="reportsTransitionRoot" data-reports-view="${escapeHtml(reportsBodyView)}">
        ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : `${reportsSection({
          title: "Highlights",
          intro: "Analysis takeaways from this date range.",
          body: highlightsStrip || `<div class="card"><div class="muted small">Highlights will appear as more trips are added.</div></div>`,
          extraClass: "reportsSection--highlights"
        })}

        ${renderMainModeSection()}`}
      </div>`
    })}
  `;

  getApp().scrollTop = 0;
  animateReportsShellEnter(document.getElementById("reportsTransitionRoot"));

  // range chips
  getApp().querySelectorAll(".chip[data-rf]").forEach(btn=>{
    btn.onclick = ()=>{
      state.reportsFilter.mode = String(btn.getAttribute("data-rf")||"YTD");
      saveState();
      renderReportsScreen();
    };
  });

  // mode chips
  getApp().querySelectorAll(".chip[data-m]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.getAttribute("data-m");
      runReportsTransition({
        mutate: ()=>{
          state.reportsMode = key;
          saveState();
        }
      });
    };
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
      runReportsTransition({
        mutate: ()=>{
          state.reportsMetricDetail = String(btn.getAttribute("data-metric-detail") || "").toLowerCase();
          state.reportsMetricDetailContext = { source: "reports" };
          saveState();
        }
      });
    };
  });

  const reportsMetricBack = document.getElementById("reportsMetricBack");
  if(reportsMetricBack){
    reportsMetricBack.onclick = ()=>{
      if(isHomeMetricDetail){
        runReportsTransition({
          mutate: ()=>{
            state.reportsMetricDetail = "";
            state.reportsMetricDetailContext = null;
            state.view = "home";
            saveState();
          },
          renderNext: ()=>{ renderApp(); }
        });
        return;
      }
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
    requestAnimationFrame(()=>{ drawReportsCharts(monthRows, dealerRows, trips); });
    return;
  }

  if(mode === "charts"){
    const reportsSwitchToTables = document.getElementById("reportsSwitchToTables");
    if(reportsSwitchToTables){
      reportsSwitchToTables.onclick = ()=>{
        runReportsTransition({
          mutate: ()=>{
            state.reportsMode = "tables";
            saveState();
          }
        });
      };
    }
    requestAnimationFrame(()=>{ drawReportsCharts(monthRows, dealerRows, trips); });
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
