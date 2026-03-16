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

  const chip = (key,label) => `<button class="chip segBtn ${fMode===key?'on is-selected':''}" data-rf="${key}" type="button">${label}</button>`;
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
        <b>Avg $/lb by Month</b>
        <div class="chartHero rate ppl">${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</div>
        <div class="chartContext">Latest month • Peak ${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</div>
        <canvas class="chart" id="c_ppl" height="210"></canvas>
      </div>
      <div class="card chartCard">
        <div class="chartTakeaway tone-${dealerTakeaway.tone}">${escapeHtml(dealerTakeaway.text)}</div>
        <b>Dealer Amount (Top)</b>
        <div class="chartHero money">${dealerPeak ? formatMoney(to2(dealerPeak.amt)) : "—"}</div>
        <div class="chartContext">Lead dealer • ${dealerPeak ? escapeHtml(String(dealerPeak.name || "—")) : "—"}</div>
        <canvas class="chart" id="c_dealer" height="220"></canvas>
      </div>
      <div class="card chartCard">
        <div class="chartTakeaway tone-${lbsTakeaway.tone}">${escapeHtml(lbsTakeaway.text)}</div>
        <b>Monthly Pounds</b>
        <div class="chartHero lbsBlue">${latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"}</div>
        <div class="chartContext">Latest month • Peak ${lbsPeak ? `${to2(lbsPeak.lbs)} lbs` : "—"}</div>
        <canvas class="chart" id="c_lbs" height="210"></canvas>
      </div>
      <div class="card chartCard">
        <div class="chartTakeaway tone-${tripsTakeaway.tone}">${escapeHtml(tripsTakeaway.text)}</div>
        <b>Trips over time</b>
        <div class="chartHero">${tripsLatest ? tripsLatest.count : "—"}</div>
        <div class="chartContext">Latest month • Peak ${tripsPeak ? tripsPeak.count : "—"} • Total ${tripsTotal}</div>
        <canvas class="chart" id="c_trips" height="210"></canvas>
      </div>
    `;
  };

  const highlightsStrip = reportsHighlights.renderHighlightsStrip({
    dealerRows,
    monthRows,
    areaRows
  });

  const latestMonth = monthRows[monthRows.length - 1] || null;
  const priorMonth = monthRows.length > 1 ? monthRows[monthRows.length - 2] : null;
  const topDealer = dealerRows[0] || null;
  const strongestArea = areaRows[0] || null;
  const totalLbs = trips.reduce((sum, t)=> sum + (Number(t?.pounds) || 0), 0);
  const totalAmount = trips.reduce((sum, t)=> sum + (Number(t?.amount) || 0), 0);
  const latestLabel = latestMonth?.label || "Latest month";
  const monthDeltaText = (()=>{
    if(!latestMonth || !priorMonth) return "Building trend context from your latest entries.";
    const cur = Number(latestMonth.lbs) || 0;
    const prev = Number(priorMonth.lbs) || 0;
    if(cur === prev) return `${latestLabel} held steady versus ${priorMonth.label}.`;
    return cur > prev
      ? `${latestLabel} pounds moved higher than ${priorMonth.label}.`
      : `${latestLabel} pounds moved lower than ${priorMonth.label}.`;
  })();

  const reportsHero = `
    <div class="card reportsHeroCard">
      <div class="reportsHeroEyebrow">Reports overview</div>
      <div class="reportsHeroHeadline">${escapeHtml(monthDeltaText)}</div>
      <div class="reportsHeroSub">Range ${escapeHtml(rangeLabel)} • ${trips.length} trips analyzed</div>
      <div class="reportsHeroGrid">
        <div class="reportsHeroStat">
          <div class="reportsHeroLabel">Total amount</div>
          <div class="reportsHeroValue money">${formatMoney(to2(totalAmount))}</div>
        </div>
        <div class="reportsHeroStat">
          <div class="reportsHeroLabel">Total pounds</div>
          <div class="reportsHeroValue lbsBlue">${to2(totalLbs)} lbs</div>
        </div>
        <div class="reportsHeroStat">
          <div class="reportsHeroLabel">Top dealer</div>
          <div class="reportsHeroValue">${escapeHtml(topDealer?.name || "—")}</div>
          <div class="reportsHeroMeta">${topDealer ? formatMoney(to2(topDealer.amt)) : "No data"}</div>
        </div>
        <div class="reportsHeroStat">
          <div class="reportsHeroLabel">Strongest area</div>
          <div class="reportsHeroValue">${escapeHtml(strongestArea?.name || "—")}</div>
          <div class="reportsHeroMeta">${strongestArea ? formatMoney(to2(strongestArea.amt)) : "No data"}</div>
        </div>
      </div>
    </div>
  `;

  const reportsSection = ({ title, intro, body, extraClass = "" })=> `
    <section class="reportsSection ${extraClass}">
      <div class="reportsSectionHead">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(intro)}</p>
      </div>
      ${body}
    </section>
  `;

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

    ${reportsHero}

    ${reportsSection({
      title: "Highlights",
      intro: "Key takeaways from this date range.",
      body: highlightsStrip || `<div class="card"><div class="muted small">Highlights will appear as more trips are added.</div></div>`,
      extraClass: "reportsSection--highlights"
    })}

    ${mode === "charts"
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
        })}
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
