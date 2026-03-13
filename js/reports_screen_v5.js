import { createReportsAdvancedPanelSeam } from "./reports_advanced_panel_v5.js";
import { createReportsHighlightsSeam } from "./reports_highlights_v5.js";

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
    computePPL,
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

  const hasValidRange = (fMode !== "RANGE") || (parseReportDateToISO(rf.from) && parseReportDateToISO(rf.to));
  const unified = buildUnifiedFilterFromReportsFilter(rf);
  let trips = applyUnifiedTripFilter(tripsAll, hasValidRange ? unified : { ...unified, range:"all" }).rows;

  const chip = (key,label) => `<button class="chip ${fMode===key?'on':''}" data-rf="${key}">${label}</button>`;
  const seg = (key,label) => `<button class="chip ${mode===key?'on':''}" data-m="${key}">${label}</button>`;

  const advOpen = !!rf.adv;
  const advPanel = reportsAdvancedPanel.renderAdvancedPanel({
    reportsFilter: rf,
    dealers: state.dealers,
    areas: state.areas
  });

  const resolvedReportsRange = resolveUnifiedRange(unified);
  const rangeLabel = (fMode === "RANGE")
    ? (hasValidRange ? `${formatDateDMY(resolvedReportsRange.fromISO)} → ${formatDateDMY(resolvedReportsRange.toISO)}` : "Set dates")
    : (fMode === "THIS_MONTH" ? "This Month"
      : (fMode === "LAST_MONTH" ? "Last Month"
        : (fMode === "ALL" ? "All Time"
          : "YTD")));
  const activeReportFilters = [];
  if(String(rf.dealer || "").trim()) activeReportFilters.push(`Dealer: ${String(rf.dealer).trim()}`);
  if(String(rf.area || "").trim()) activeReportFilters.push(`Area: ${String(rf.area).trim()}`);
  const reportFilterSummary = activeReportFilters.length ? activeReportFilters.join(" • ") : "No dealer or area filter";

  if(!trips.length){
    getApp().innerHTML = `
      ${renderPageHeader("reports")}

      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center;margin-top:0">
          <b>Reports</b>
          <span class="pill">Range: <b>${escapeHtml(rangeLabel)}</b></span>
        </div>
        <div class="muted tiny mt6">${escapeHtml(reportFilterSummary)} • Showing <b>${trips.length}</b> of <b>${tripsAll.length}</b> saved trips</div>

        <div class="chipGrid cols-4" style="margin-top:10px">
          ${chip("YTD","YTD")}
          ${chip("THIS_MONTH","This Month")}
          ${chip("LAST_MONTH","Last Month")}
          ${chip("ALL","All Time")}
        </div>

        <div class="row" style="justify-content:flex-end;margin-top:10px">
          <button class="btn repAdvToggle" type="button">${advOpen ? "Hide" : "Advanced"}</button>
        </div>

        ${advPanel}


        <div class="emptyState" style="margin-top:12px">
          <div class="emptyStateTitle">${fMode==="RANGE" && !hasValidRange ? "Choose a valid date range" : "No trips yet for this report"}</div>
          <div class="emptyStateBody">${fMode==="RANGE" && !hasValidRange
            ? "Set both dates, then tap Apply to load this report."
            : "No saved trips match this report filter yet. Add a trip to start dealer, area, and monthly summaries."}</div>
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
            <div>$/lb <b class="rate ppl">${formatMoney(r.avg)}</b></div>
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
            <div>$/lb <b class="rate ppl">${formatMoney(r.avg)}</b></div>
          </div>
        </div>
      `;
    }).join("");
  };

  const renderHLItem = (label, t, metric)=>{
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
    return `
      <div class="hlStatCard">
        <div class="hlTopRow">
          <div class="hlHdr">${escapeHtml(label)}</div>
          <div class="hlValue ${metricClass}">${escapeHtml(metricText)}</div>
        </div>
        <div class="hlTripFlat">
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
    const pplPeak = monthRows.reduce((best,r)=> (Number(r?.avg)||0) > (Number(best?.avg)||0) ? r : best, monthRows[0] || null);
    const dealerPeak = dealerRows[0] || null;
    const lbsPeak = monthRows.reduce((best,r)=> (Number(r?.lbs)||0) > (Number(best?.lbs)||0) ? r : best, monthRows[0] || null);
    const tripsLatest = tripsTimeline[tripsTimeline.length - 1] || null;
    const tripsPeak = tripsTimeline.reduce((best,r)=> (Number(r?.count)||0) > (Number(best?.count)||0) ? r : best, tripsTimeline[0] || null);
    const tripsTotal = tripsTimeline.reduce((sum,r)=> sum + (Number(r?.count)||0), 0);

    return `
      <div class="card">
        <b>Avg $/lb by Month</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Latest: <b>${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</b> • Peak: <b>${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</b></div>
        <div class="sep"></div>
        <canvas class="chart" id="c_ppl" height="210"></canvas>
      </div>
      <div class="card">
        <b>Dealer Amount (Top)</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Top: <b>${dealerPeak ? escapeHtml(String(dealerPeak.name || "—")) : "—"}</b> • ${dealerPeak ? formatMoney(to2(dealerPeak.amt)) : "—"}</div>
        <div class="sep"></div>
        <canvas class="chart" id="c_dealer" height="220"></canvas>
      </div>
      <div class="card">
        <b>Monthly Pounds</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Latest: <b>${latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"}</b> • Peak: <b>${lbsPeak ? `${to2(lbsPeak.lbs)} lbs` : "—"}</b></div>
        <div class="sep"></div>
        <canvas class="chart" id="c_lbs" height="210"></canvas>
      </div>
      <div class="card">
        <b>Trips over time</b>
        <div class="muted tiny" style="margin-top:6px;line-height:1.35">Latest: <b>${tripsLatest ? tripsLatest.count : "—"}</b> • Peak: <b>${tripsPeak ? tripsPeak.count : "—"}</b> • Total: <b>${tripsTotal}</b></div>
        <div class="sep"></div>
        <canvas class="chart" id="c_trips" height="210"></canvas>
      </div>
    `;
  };

  const highlightsStrip = reportsHighlights.renderHighlightsStrip({
    dealerRows,
    monthRows,
    areaRows
  });

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

        ${renderHLItem("Most Pounds", maxLbs, "lbs")}
        <div class="sep"></div>

        ${renderHLItem("Least Pounds", minLbs, "lbs")}
        <div class="sep"></div>

        ${renderHLItem("Highest Amount", maxAmt, "amount")}
        <div class="sep"></div>

        ${renderHLItem("Lowest Amount", minAmt, "amount")}
        <div class="sep"></div>

        ${pplRows.length ? `
          ${renderHLItem("Highest $/lb", maxPpl, "ppl")}
          <div class="sep"></div>

          ${renderHLItem("Lowest $/lb", minPpl, "ppl")}
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
      <div class="muted tiny mt6">${escapeHtml(reportFilterSummary)} • Showing <b>${trips.length}</b> of <b>${tripsAll.length}</b> saved trips</div>

      <div class="chipGrid cols-4" style="margin-top:10px">
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

    ${highlightsStrip}

    ${mode === "charts" ? renderChartsSection() : renderTablesSection()}
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


  if(mode === "charts"){
    setTimeout(()=>{ drawReportsCharts(monthRows, dealerRows, trips); }, 0);
  }
}


  return { renderReports };
}
