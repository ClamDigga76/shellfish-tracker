import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";
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

  const reportsHighlights = createReportsHighlightsSeam({
    escapeHtml,
    formatMoney,
    to2
  });

function renderReports(){
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
  const advPanel = reportsAdvancedPanel.renderAdvancedPanel({
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
  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:0">
          <b>Reports</b>
          <span class="pill">Range: <b>${escapeHtml(rangeLabel)}</b></span>
        </div>

        <div class="segWrap timeframeUnifiedControl reportsTimeframeControl" role="group" aria-label="Reports timeframe filter">
          ${chip("YTD","YTD")}
          ${chip("THIS_MONTH","This Month")}
          ${chip("LAST_MONTH","Last Month")}
          ${chip("ALL","All Time")}
        </div>

        <div class="row" style="justify-content:flex-end;margin-top:10px">
          <button class="btn repAdvToggle" type="button">${advOpen ? "Hide" : "Advanced"}</button>
        </div>

        ${advPanel}


        <div class="emptyState">
          <div class="emptyStateTitle">${fMode==="RANGE" && !hasValidRange ? "Choose a valid date range" : "No trips in this report range"}</div>
          <div class="emptyStateBody">${fMode==="RANGE" && !hasValidRange
            ? "Set both dates, then tap Apply to load this report."
            : "No saved trips match this report filter yet. Add a trip to unlock dealer, area, and monthly summaries."}</div>
          <div class="emptyStateAction">
            <button class="btn good" id="reportsEmptyPrimary" type="button">${fMode==="RANGE" && !hasValidRange ? "Open advanced filters" : "＋ Add Trip"}</button>
            <button class="btn" id="reportsEmptySecondary" type="button">${fMode==="RANGE" && !hasValidRange ? "Open Help" : "Switch to All Time"}</button>
          </div>
        </div>
      </div>
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
        renderReports();
      };
    });

    reportsAdvancedPanel.bindAdvancedPanel({
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
          renderReports();
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
        renderReports();
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
    tripsTimeline
  } = buildReportsAggregationState({
    trips,
    canonicalDealerGroupKey,
    normalizeDealerDisplay
  });

  const renderAggList = (rows, emptyMsg)=>{
    if(!rows.length) return `
      <div class="emptyState compact">
        <div class="emptyStateTitle">Summary pending</div>
        <div class="emptyStateBody">${escapeHtml(emptyMsg||"Add trips to unlock this summary.")}</div>
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
    const ordered = trips
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
    const tripDate = formatDateDMY(t?.dateISO || "") || "—";
    const tripArea = String(t?.area || "").trim() || "(area)";
    const tripDealer = String(t?.dealer || "").trim() || "(dealer)";
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
    return `
      <div class="hlStatCard">
        <div class="hlTopRow hlTopRow--stacked">
          <div class="hlHdr">${escapeHtml(label)}</div>
          <div class="hlValue ${metricClass}">${escapeHtml(metricText)}</div>
          ${hasCompare ? `<div class="hlDelta tone-${compareTone}">${deltaPct}% ${compareWord} vs previous record</div>` : ""}
        </div>
        <div class="hlTripFlat">
          <div class="hlTripCardHdr">Record trip</div>
          <div class="hlTripLine"><b>${escapeHtml(tripDate)}</b></div>
          <div class="hlTripLine muted">${escapeHtml(tripArea)} • ${escapeHtml(tripDealer)}</div>
          <div class="hlTripMeta">
            <span><b class="lbsBlue">${to2(lbsNum)}</b> lbs</span>
            <span><b class="rate ppl">${ppl>0 ? `${formatMoney(to2(ppl))}/lb` : "—"}</b></span>
            <span><b class="money">${formatMoney(to2(amtNum))}</b></span>
          </div>
        </div>
      </div>
    `;
  };

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
      if(tone === "up") return { text: "Higher than prior month", tone };
      if(tone === "down") return { text: "Lower than prior month", tone };
      return { text: "Holding steady", tone };
    };

    const buildTripsTakeaway = ()=>{
      const latest = Number(tripsLatest?.count) || 0;
      const prior = Number(tripsPrior?.count) || 0;
      if(!tripsPrior) return { text: "Strongest recent month", tone: "up" };
      if(latest === prior) return { text: "Trips flat", tone: "steady" };
      return latest > prior
        ? { text: "Trips rising", tone: "up" }
        : { text: "Trips down", tone: "down" };
    };

    const pplTakeaway = buildMonthTakeaway("avg");
    const lbsTakeaway = buildMonthTakeaway("lbs");
    const tripsTakeaway = buildTripsTakeaway();
    const dealerTakeaway = dealerPeak ? { text: "Strongest recent month", tone: "up" } : { text: "Holding steady", tone: "steady" };

    return `
      <div class="card chartCard">
        <div class="chartTakeaway tone-${pplTakeaway.tone}">${escapeHtml(pplTakeaway.text)}</div>
        <div class="chartTitle">Avg $/lb by Month</div>
        <div class="chartSubhead">Monthly trend for this range</div>
        <div class="chartHero rate ppl">${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</div>
        <div class="chartContext">Latest month • Peak <span class="rate ppl">${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</span></div>
        <canvas class="chart" id="c_ppl" height="210"></canvas>
      </div>
      <div class="card chartCard">
        <div class="chartTakeaway tone-${dealerTakeaway.tone}">${escapeHtml(dealerTakeaway.text)}</div>
        <div class="chartTitle">Dealer Amount (Top)</div>
        <div class="chartSubhead">Top dealers in this filter range</div>
        <div class="chartHero money">${dealerPeak ? formatMoney(to2(dealerPeak.amt)) : "—"}</div>
        <div class="chartContext">Lead dealer • ${dealerPeak ? escapeHtml(String(dealerPeak.name || "—")) : "—"}</div>
        <canvas class="chart" id="c_dealer" height="220"></canvas>
      </div>
      <div class="card chartCard">
        <div class="chartTakeaway tone-${lbsTakeaway.tone}">${escapeHtml(lbsTakeaway.text)}</div>
        <div class="chartTitle">Monthly Pounds</div>
        <div class="chartSubhead">Total pounds by month</div>
        <div class="chartHero lbsBlue">${latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"}</div>
        <div class="chartContext">Latest month • Peak <span class="lbsBlue">${lbsPeak ? `${to2(lbsPeak.lbs)} lbs` : "—"}</span></div>
        <canvas class="chart" id="c_lbs" height="210"></canvas>
      </div>
      <div class="card chartCard">
        <div class="chartTakeaway tone-${tripsTakeaway.tone}">${escapeHtml(tripsTakeaway.text)}</div>
        <div class="chartTitle">Trips over time</div>
        <div class="chartSubhead">Monthly activity in this range</div>
        <div class="chartHero">${tripsLatest ? tripsLatest.count : "—"}</div>
        <div class="chartContext">Latest month • Peak ${tripsPeak ? tripsPeak.count : "—"} • Total ${tripsTotal}</div>
        <canvas class="chart" id="c_trips" height="210"></canvas>
      </div>
    `;
  };

  const highlightsStrip = reportsHighlights.renderHighlightsStrip({
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

  const buildMetricCompareSummary = (payload)=>{
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
    let text = `${period.currentLabel} held close to ${period.previousLabel}.`;
    if(tone === "up") text = `${period.currentLabel} moved above ${period.previousLabel}.`;
    if(tone === "down") text = `${period.currentLabel} moved below ${period.previousLabel}.`;
    return {
      tone,
      text,
      currentValue: payload.currentLabel || "—",
      previousValue: payload.previousLabel || "—"
    };
  };

  const buildMetricDetailView = (metricKey)=>{
    const avgPpl = totalLbs > 0 ? (totalAmount / totalLbs) : 0;
    const tripsCompare = compareFoundation.metrics?.trips || null;
    const pplCompare = compareFoundation.metrics?.ppl || null;
    const detailMeta = {
      trips: {
        title: "Trips detail",
        eyebrow: "Metric detail",
        heroLabel: "Total trips",
        heroValue: `${trips.length}`,
        heroClass: "",
        comparePayload: tripsCompare,
        chartTitle: "Trips over time",
        chartContext: "Monthly activity in this range",
        chartCanvasId: "c_trips",
        insight: "Use this view to track effort volume and quickly spot whether recent activity is increasing, flat, or cooling."
      },
      pounds: {
        title: "Pounds detail",
        eyebrow: "Metric detail",
        heroLabel: "Total pounds",
        heroValue: `${to2(totalLbs)} lbs`,
        heroClass: "lbsBlue",
        comparePayload: lbsCompare,
        chartTitle: "Monthly pounds trend",
        chartContext: "This range, month by month",
        chartCanvasId: "c_lbs",
        insight: "Use this view to spot weight consistency and quickly confirm if this range is trending heavier or lighter than your prior period."
      },
      amount: {
        title: "Amount detail",
        eyebrow: "Metric detail",
        heroLabel: "Total amount",
        heroValue: formatMoney(to2(totalAmount)),
        heroClass: "money",
        comparePayload: amountCompare,
        chartTitle: "Dealer amount distribution",
        chartContext: "Top dealers for this same range",
        chartCanvasId: "c_dealer",
        insight: "Use this view to see whether changes in total amount are broad-based or mostly concentrated in one buyer relationship."
      },
      ppl: {
        title: "$/lb detail",
        eyebrow: "Metric detail",
        heroLabel: "Average $/lb",
        heroValue: avgPpl > 0 ? `${formatMoney(to2(avgPpl))}/lb` : "—",
        heroClass: "rate ppl",
        comparePayload: pplCompare,
        chartTitle: "Monthly $/lb trend",
        chartContext: "This range, month by month",
        chartCanvasId: "c_ppl",
        insight: "Use this view to watch price efficiency independent of total volume so rate movement is easier to separate from trip count swings."
      }
    };
    const meta = detailMeta[metricKey];
    if(!meta) return "";
    const compareSummary = buildMetricCompareSummary(meta.comparePayload);
    return `
      <section class="reportsMetricDetail" aria-label="${escapeHtml(meta.title)}">
        <div class="card reportsMetricDetailCard">
          <button class="btn reportsMetricBackBtn" type="button" id="reportsMetricBack">${isHomeMetricDetail ? "← Back to Home" : "← Back to reports"}</button>
          <div class="reportsMetricEyebrow">${escapeHtml(isHomeMetricDetail ? "Home metric detail" : meta.eyebrow)}</div>
          <h2 class="reportsMetricTitle">${escapeHtml(meta.title)}</h2>
          <div class="reportsMetricContext">Range ${escapeHtml(rangeLabel)} • ${trips.length} trips</div>

          <div class="reportsMetricHeroWrap">
            <div class="reportsMetricHeroLabel">${escapeHtml(meta.heroLabel)}</div>
            <div class="reportsMetricHeroValue ${escapeHtml(meta.heroClass)}">${escapeHtml(meta.heroValue)}</div>
          </div>

          <div class="reportsMetricCompare tone-${escapeHtml(compareSummary.tone)}">
            <div class="reportsMetricCompareText">${escapeHtml(compareSummary.text)}</div>
            <div class="reportsMetricCompareRows">
              <div><span>${escapeHtml(compareFoundation.period?.currentLabel || "Current")}</span><b>${escapeHtml(compareSummary.currentValue)}</b></div>
              <div><span>${escapeHtml(compareFoundation.period?.previousLabel || "Previous")}</span><b>${escapeHtml(compareSummary.previousValue)}</b></div>
            </div>
          </div>

          <div class="reportsMetricChartBlock">
            <b>${escapeHtml(meta.chartTitle)}</b>
            <div class="reportsMetricChartContext">${escapeHtml(meta.chartContext)}</div>
            <canvas class="chart" id="${escapeHtml(meta.chartCanvasId)}" height="220"></canvas>
          </div>

          <div class="reportsMetricInsight">${escapeHtml(meta.insight)}</div>
        </div>
      </section>
    `;
  };

  const renderTablesSection = ()=>{
    return `
      <div class="card">
        <b>Dealer Summary</b>
        <div class="sep"></div>
        ${renderAggList(dealerRows, "Add a trip in this range to populate dealer totals.")}
      </div>

      <div class="card">
        <b>Area Summary</b>
        <div class="sep"></div>
        ${renderAggList(areaRows, "Add a trip in this range to populate area totals.")}
      </div>

      <div class="card">
        <b>Monthly Totals</b>
        <div class="sep"></div>
        ${renderMonthList()}
      </div>

      <div class="card">
        <b>High / Low Summary</b>
        <div class="sep"></div>

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
            <div class="emptyStateTitle">$/lb summary pending</div>
            <div class="emptyStateBody">Add trips that include both pounds and amount to unlock this view.</div>
          </div>`}
      </div>
    `;
  };

  getApp().innerHTML = `
    ${renderPageHeader("reports")}

    <div class="card">
      <div class="row" style="justify-content:space-between;align-items:center;margin-top:0">
        <b>Reports</b>
        <span class="pill">Range: <b>${escapeHtml(rangeLabel)}</b></span>
      </div>

      <div class="segWrap timeframeUnifiedControl reportsTimeframeControl" role="group" aria-label="Reports timeframe filter">
          ${chip("YTD","YTD")}
          ${chip("THIS_MONTH","This Month")}
          ${chip("LAST_MONTH","Last Month")}
          ${chip("ALL","All Time")}
        </div>

        <div class="row repCtlRow" style="justify-content:space-between;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
          <button class="btn repAdvToggle" type="button">${advOpen ? "Hide" : "Advanced"}</button>
          <div class="row" style="gap:8px;margin-top:0">
            ${seg("charts","Charts")}
            ${seg("tables","Tables")}
          </div>
        </div>

        ${advPanel}
    </div>

    ${activeMetricDetail ? buildMetricDetailView(activeMetricDetail) : ""}

    ${activeMetricDetail ? "" : reportsSection({
      title: "Highlights",
      intro: "Analysis takeaways from this date range.",
      body: highlightsStrip || `<div class="card"><div class="muted small">Highlights will appear as more trips are added.</div></div>`,
      extraClass: "reportsSection--highlights"
    })}

    ${activeMetricDetail ? "" : (mode === "charts"
      ? `${reportsSection({
          title: "Charts",
          intro: "Visual trends first, then switch to tables for row-level detail.",
          body: `<div class="reportsChartsStack">${renderChartsSection()}</div>`,
          extraClass: "reportsSection--charts"
        })}
        ${reportsSection({
          title: "Deeper detail",
          intro: "Need line-item breakdowns? Open table mode for dealer, area, and monthly rows.",
          body: `<div class="card reportsDetailHint"><button class="btn" type="button" id="reportsSwitchToTables">Open table detail</button></div>`,
          extraClass: "reportsSection--detail"
        })}`
      : reportsSection({
          title: "Deeper detail",
          intro: "Dealer, area, and high/low summaries for this same range.",
          body: `<div class="reportsTablesStack">${renderTablesSection()}</div>`,
          extraClass: "reportsSection--detail"
        }))}
  `;

  getApp().scrollTop = 0;

  // range chips
  getApp().querySelectorAll(".chip[data-rf]").forEach(btn=>{
    btn.onclick = ()=>{
      state.reportsFilter.mode = String(btn.getAttribute("data-rf")||"YTD");
      saveState();
      renderReports();
    };
  });

  // mode chips
  getApp().querySelectorAll(".chip[data-m]").forEach(btn=>{
    btn.onclick = ()=>{
      const key = btn.getAttribute("data-m");
      state.reportsMode = key;
      saveState();
      renderReports();
    };
  });

  reportsAdvancedPanel.bindAdvancedPanel({
    root: getApp(),
    state,
    saveState,
    renderReports,
    showToast
  });


  const metricDetailButtons = getApp().querySelectorAll("[data-metric-detail]");
  metricDetailButtons.forEach((btn)=>{
    btn.onclick = ()=>{
      state.reportsMetricDetail = String(btn.getAttribute("data-metric-detail") || "").toLowerCase();
      state.reportsMetricDetailContext = { source: "reports" };
      saveState();
      renderReports();
    };
  });

  const reportsMetricBack = document.getElementById("reportsMetricBack");
  if(reportsMetricBack){
    reportsMetricBack.onclick = ()=>{
      state.reportsMetricDetail = "";
      if(isHomeMetricDetail){
        state.reportsMetricDetailContext = null;
        state.view = "home";
        saveState();
        renderApp();
        return;
      }
      state.reportsMetricDetailContext = null;
      saveState();
      renderReports();
    };
  }


  if(activeMetricDetail){
    setTimeout(()=>{ drawReportsCharts(monthRows, dealerRows, trips); }, 0);
    return;
  }

  if(mode === "charts"){
    const reportsSwitchToTables = document.getElementById("reportsSwitchToTables");
    if(reportsSwitchToTables){
      reportsSwitchToTables.onclick = ()=>{
        state.reportsMode = "tables";
        saveState();
        renderReports();
      };
    }
    setTimeout(()=>{ drawReportsCharts(monthRows, dealerRows, trips); }, 0);
  }
}


  return { renderReports };
}
