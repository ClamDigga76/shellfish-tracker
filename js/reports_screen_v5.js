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
    computePPL
  } = deps;

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
  const advFromValue = formatReportDateValue(rf.from);
  const advToValue = formatReportDateValue(rf.to);

  const dealerOpts = ['<option value="">Any Dealer</option>'].concat(
    (Array.isArray(state.dealers)?state.dealers:[]).map(d=>{
      const v = String(d||"");
      return `<option value="${escapeHtml(v)}" ${v===String(rf.dealer||"")?'selected':''}>${escapeHtml(v)}</option>`;
    })
  ).join("");

  const areaOpts = ['<option value="">Any Area</option>'].concat(
    (Array.isArray(state.areas)?state.areas:[]).map(a=>{
      const v = String(a||"");
      return `<option value="${escapeHtml(v)}" ${v===String(rf.area||"")?'selected':''}>${escapeHtml(v)}</option>`;
    })
  ).join("");

  const advPanel = advOpen ? `
    <div class="sep"></div>
    <div class="grid2">
      <div class="field">
        <div class="label">From</div>
        <input class="input" id="repAdvFrom" type="date" value="${escapeHtml(advFromValue)}">
      </div>
      <div class="field">
        <div class="label">To</div>
        <input class="input" id="repAdvTo" type="date" value="${escapeHtml(advToValue)}">
      </div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div class="field">
        <div class="label">Dealer</div>
        <select class="input" id="repAdvDealer">${dealerOpts}</select>
      </div>
      <div class="field">
        <div class="label">Area</div>
        <select class="input" id="repAdvArea">${areaOpts}</select>
      </div>
    </div>
    <div class="row" style="justify-content:flex-end;gap:10px;margin-top:10px">
      <button class="btn" id="repAdvReset" type="button">Reset</button>
      <button class="btn primary" id="repAdvApply" type="button">Apply</button>
    </div>
  ` : "";

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
          <div class="emptyStateTitle">${fMode==="RANGE" && !hasValidRange ? "Pick a valid date range" : "No trips found for this report"}</div>
          <div class="emptyStateBody">${fMode==="RANGE" && !hasValidRange
            ? "Set both From and To dates in Advanced, then tap Apply to load tables and charts."
            : "Try a broader range, or add a trip to start seeing dealer, area, and monthly summaries."}</div>
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
        showToast("Filter applied");
        renderReports();
      };
    });

    document.querySelectorAll(".repAdvToggle").forEach(btn=>{
      btn.onclick = ()=>{
        state.reportsFilter.adv = !state.reportsFilter.adv;
        saveState();
        renderReports();
      };
    });

    const advFrom = document.getElementById("repAdvFrom");
    const advTo = document.getElementById("repAdvTo");
    bindDatePill("repAdvFrom");
    bindDatePill("repAdvTo");

    const advApply = document.getElementById("repAdvApply");
    if(advApply){
      advApply.onclick = ()=>{
        let from = String(advFrom?.value || "").trim();
        let to = String(advTo?.value || "").trim();
        const dealer = String(document.getElementById("repAdvDealer")?.value || "");
        const area = String(document.getElementById("repAdvArea")?.value || "");

        state.reportsFilter.dealer = dealer;
        state.reportsFilter.area = area;

        if(from && !to) to = from;
        if(!from && to) from = to;

        if(from || to){
          const sISO = parseReportDateToISO(from);
          const eISO = parseReportDateToISO(to);
          if(!sISO || !eISO){ showToast("Invalid dates"); return; }
          state.reportsFilter.mode = "RANGE";
        }

        from = parseReportDateToISO(from);
        to = parseReportDateToISO(to);

        state.reportsFilter.from = from;
        state.reportsFilter.to = to;

        saveState();
        showToast("Filter applied");
        renderReports();
      };
    }

    const advReset = document.getElementById("repAdvReset");
    if(advReset){
      advReset.onclick = ()=>{
        state.reportsFilter.mode = "YTD";
        state.reportsFilter.from = "";
        state.reportsFilter.to = "";
        state.reportsFilter.dealer = "";
        state.reportsFilter.area = "";
        saveState();
        showToast("Filters reset");
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
        <div class="emptyStateTitle">Nothing to summarize</div>
        <div class="emptyStateBody">${escapeHtml(emptyMsg||"No data")}</div>
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

  const renderHighlights = ()=>{
    const topDealer = dealerRows[0] || null;
    const bestPplMonth = monthRows.reduce((best,row)=>{
      if(!best) return row;
      return (Number(row?.avg)||0) > (Number(best?.avg)||0) ? row : best;
    }, null);
    const peakLbsMonth = monthRows.reduce((best,row)=>{
      if(!best) return row;
      return (Number(row?.lbs)||0) > (Number(best?.lbs)||0) ? row : best;
    }, null);
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const strongestArea = areaRows[0] || null;

    const highlights = [
      topDealer ? {
        label: "Top dealer",
        value: formatMoney(to2(topDealer.amt)),
        detail: `${topDealer.name} • ${topDealer.trips} trips • ${to2(topDealer.lbs)} lbs`
      } : null,
      bestPplMonth ? {
        label: "Best $/lb month",
        value: `${formatMoney(to2(bestPplMonth.avg))}/lb`,
        detail: `${bestPplMonth.label} • ${bestPplMonth.trips} trips`
      } : null,
      peakLbsMonth ? {
        label: "Peak pounds month",
        value: `${to2(peakLbsMonth.lbs)} lbs`,
        detail: `${peakLbsMonth.label} • ${formatMoney(to2(peakLbsMonth.amt))}`
      } : null,
      latestMonth ? {
        label: "Latest month",
        value: `${to2(latestMonth.lbs)} lbs`,
        detail: `${latestMonth.label} • ${formatMoney(to2(latestMonth.avg))}/lb`
      } : null,
      strongestArea ? {
        label: "Strongest area",
        value: formatMoney(to2(strongestArea.amt)),
        detail: `${strongestArea.name} • ${strongestArea.trips} trips`
      } : null
    ].filter(Boolean);

    if(!highlights.length) return "";

    return `
      <div class="card reportsHighlightsCard">
        <div class="reportsHighlightsHdr">Range highlights</div>
        <div class="reportsHighlightsGrid">
          ${highlights.map(item=>`
            <div class="reportsHighlightItem">
              <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
              <div class="reportsHighlightValue">${escapeHtml(item.value)}</div>
              <div class="reportsHighlightDetail">${escapeHtml(item.detail)}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  };

  const renderTablesSection = ()=>{
    return `
      <div class="card">
        <b>Dealer Summary</b>
        <div class="sep"></div>
        ${renderAggList(dealerRows, "No trips in this range yet.")}
      </div>

      <div class="card">
        <b>Area Summary</b>
        <div class="sep"></div>
        ${renderAggList(areaRows, "No trips in this range yet.")}
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
            <div class="emptyStateTitle">Not enough valid data yet</div>
            <div class="emptyStateBody">No trips with valid pounds and amount in this range.</div>
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
      <div class="hint"></div>
    </div>

    ${renderHighlights()}

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

  // advanced toggle
  getApp().querySelectorAll(".repAdvToggle").forEach(btn=>{
    btn.onclick = ()=>{
      state.reportsFilter.adv = !state.reportsFilter.adv;
      saveState();
      renderReports();
    };
  });

  // advanced apply/reset (only present when panel open)
  bindDatePill("repAdvFrom");
  bindDatePill("repAdvTo");
  const advApply = getApp().querySelector("#repAdvApply");
  if(advApply){
    advApply.onclick = ()=>{
      const from = String(getApp().querySelector("#repAdvFrom")?.value||"").trim();
      const to   = String(getApp().querySelector("#repAdvTo")?.value||"").trim();
      const dealer = String(getApp().querySelector("#repAdvDealer")?.value||"");
      const area   = String(getApp().querySelector("#repAdvArea")?.value||"");
      const fromISO = parseReportDateToISO(from);
      const toISO = parseReportDateToISO(to);
      if((from && !fromISO) || (to && !toISO)){
        showToast("Invalid dates");
        return;
      }
      state.reportsFilter.from = fromISO;
      state.reportsFilter.to = toISO;
      state.reportsFilter.dealer = dealer;
      state.reportsFilter.area = area;
      if(fromISO || toISO){
        state.reportsFilter.mode = "RANGE";
      }
      saveState();
      showToast("Filter applied");
      renderReports();
    };
  }

  const advReset = getApp().querySelector("#repAdvReset");
  if(advReset){
    advReset.onclick = ()=>{
      state.reportsFilter = { mode:"YTD", from:"", to:"", dealer:"", area:"", adv:false };
      saveState();
      showToast("Filters reset");
      renderReports();
    };
  }


  if(mode === "charts"){
    setTimeout(()=>{ drawReportsCharts(monthRows, dealerRows, trips); }, 0);
  }
}


  return { renderReports };
}
