export function createReportsOverviewSectionsSeam(deps){
  const {
    escapeHtml,
    formatMoney,
    to2,
    renderStandardReadOnlyTripCard
  } = deps;

  const reportsSection = ({ title, intro = "", body, extraClass = "" })=> `
    <section class="reportsSection ${extraClass}">
      <div class="reportsSectionHead">
        <h2>${escapeHtml(title)}</h2>
        ${intro ? `<p>${escapeHtml(intro)}</p>` : ""}
      </div>
      ${body}
    </section>
  `;

  const renderTableCard = (title, body)=> `
    <div class="card">
      <b>${escapeHtml(title)}</b>
      <div class="sep"></div>
      ${body}
    </div>
  `;

  const formatRateValue = (value)=> {
    const safe = Number(value) || 0;
    return safe > 0 ? `${formatMoney(to2(safe))}/lb` : "—";
  };

  const formatSeasonalityMetric = (metricKey, value)=> {
    const safeValue = Number(value) || 0;
    if(metricKey === "trips") return `${Math.round(safeValue)} trips`;
    if(metricKey === "pounds") return `${to2(safeValue)} lbs`;
    if(metricKey === "amount") return formatMoney(to2(safeValue));
    if(metricKey === "ppl") return `${formatMoney(to2(safeValue))}/lb`;
    return `${to2(safeValue)}`;
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

  function renderNoResultsState(context){
    const { fMode, hasValidRange, hasSavedTrips, quarantinedSupportCopy } = context;
    const invalidRange = fMode === "RANGE" && !hasValidRange;
    const beginnerEmpty = !hasSavedTrips;
    const title = invalidRange
      ? "Choose a valid date range"
      : (beginnerEmpty ? "Add a trip to start Reports" : "No trips in this range");
    const body = invalidRange
      ? "Set both dates, then tap Apply."
      : (beginnerEmpty
        ? "Once one trip is saved, trend insights appear here."
        : "No trips match this filter yet. Add a trip or switch to All Time.");
    const bodyWithQuarantineNote = quarantinedSupportCopy && !invalidRange
      ? `${body} ${quarantinedSupportCopy}`
      : body;
    const followup = invalidRange
      ? ""
      : (beginnerEmpty
        ? '<div class="emptyStateFollowup">Next step: open New Trip.</div>'
        : '<div class="emptyStateFollowup">Tip: switch to All Time for your widest view.</div>');
    return `
      <div class="emptyState ${beginnerEmpty ? "emptyStateBeginner" : ""}">
        <div class="emptyStateTitle">${title}</div>
        <div class="emptyStateBody">${bodyWithQuarantineNote}</div>
        ${followup}
        <div class="emptyStateAction cardActionRow">
          <button class="btn primary" id="reportsEmptyPrimary" type="button">${invalidRange ? "Open advanced filters" : "＋ Add Trip"}</button>
          <button class="btn btn-ghost" id="reportsEmptySecondary" type="button">${invalidRange || beginnerEmpty ? "Open Help" : "Switch to All Time"}</button>
        </div>
      </div>
    `;
  }

  function renderChartsSection(context){
    const { monthRows, dealerRows, tripsTimeline } = context;
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

    const trendTone = (delta, epsilon = 0.02)=> {
      if(Math.abs(delta) <= epsilon) return "steady";
      return delta > 0 ? "up" : "down";
    };

    const buildMonthTakeaway = (metricKey)=> {
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

    const buildTripsTakeaway = ()=> {
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
        takeaway: tripsTakeaway,
        title: "Trips • Monthly",
        subhead: "Bars • trip count by month",
        hero: `<span class="trips">${tripsLatest ? tripsLatest.count : "—"}</span>`,
        context: `<span class="chartContextValue">${tripsLatest ? escapeHtml(tripsLatest.shortLabel) : "Latest month"}</span> • High <span class="trips">${tripsPeak ? tripsPeak.count : "—"}</span> • Total <span class="trips">${tripsTotal}</span>`,
        canvasId: "c_trips"
      }),
      renderChartCard({
        takeaway: lbsTakeaway,
        title: "Pounds • Monthly",
        subhead: "Bars • pounds by month",
        hero: `<span class="lbsBlue">${latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="lbsBlue">${lbsPeak ? `${to2(lbsPeak.lbs)} lbs` : "—"}</span>`,
        canvasId: "c_lbs"
      }),
      renderChartCard({
        takeaway: amountTakeaway,
        title: "Amount • Monthly",
        subhead: "Bars • total payout by month",
        hero: `<span class="money">${latestMonth ? formatMoney(to2(latestMonth.amt)) : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="money">${amountPeak ? formatMoney(to2(amountPeak.amt)) : "—"}</span>`,
        canvasId: "c_amount_monthly"
      }),
      renderChartCard({
        takeaway: pplTakeaway,
        title: "$/lb • Monthly",
        subhead: "Bars • average pay rate by month",
        hero: `<span class="rate ppl">${latestMonth ? `${formatMoney(to2(latestMonth.avg))}/lb` : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="rate ppl">${pplPeak ? `${formatMoney(to2(pplPeak.avg))}/lb` : "—"}</span>`,
        canvasId: "c_ppl"
      }),
      renderChartCard({
        takeaway: amountPerTripTakeaway,
        title: "Amount/Trip • Monthly",
        subhead: "Bars • average payout per trip",
        hero: `<span class="money">${latestMonth ? formatMoney(to2(latestMonth.amountPerTrip)) : "—"}</span>`,
        context: `<span class="chartContextValue">${latestMonth ? escapeHtml(latestMonth.label) : "Latest month"}</span> • High <span class="money">${amountPerTripPeak ? formatMoney(to2(amountPerTripPeak.amountPerTrip)) : "—"}</span>`,
        canvasId: "c_amount_per_trip"
      }),
      renderChartCard({
        takeaway: dealerRateTakeaway,
        title: "$/lb • Dealer",
        subhead: "Bars • dealer pay rates",
        hero: `<span class="rate ppl">${dealerRatePeak ? `${formatMoney(to2(dealerRatePeak.avg))}/lb` : "—"}</span>`,
        context: `Top pay-rate dealer: <span class="chartContextValue">${dealerRatePeak ? escapeHtml(String(dealerRatePeak.name || "—")) : "—"}</span>`,
        canvasId: "c_dealer_rate",
        height: 220
      }),
      renderChartCard({
        takeaway: dealerAmountTakeaway,
        title: "Amount • Dealer",
        subhead: "Bars • total payout by dealer",
        hero: `<span class="money">${dealerAmountPeak ? formatMoney(to2(dealerAmountPeak.amt)) : "—"}</span>`,
        context: `Leading dealer: <span class="chartContextValue">${dealerAmountPeak ? escapeHtml(String(dealerAmountPeak.name || "—")) : "—"}</span>`,
        canvasId: "c_dealer",
        height: 220
      })
    ].join("");
  }

  function renderSeasonalitySection(context){
    const { isHomeMetricDetail, seasonalityFoundation } = context;
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
      intro: "Matched windows across years.",
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
  }

  function renderRecordsBlock(context){
    const { maxLbs, minLbs, maxAmt, minAmt, pplRows, maxPpl, minPpl, recordPools, trips, getTripMetricValue } = context;

    const selectRecordBaseline = (metric, direction, selectedTrip)=> {
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

    const formatHLDeltaValue = (metric, deltaValue)=> {
      const absDelta = Math.abs(Number(deltaValue) || 0);
      const sign = deltaValue > 0 ? "+" : "-";
      if(!(absDelta > 0)) return "";
      if(metric === "lbs") return `${sign}${to2(absDelta)} lbs`;
      if(metric === "amount") return `${sign}${formatMoney(to2(absDelta))}`;
      if(metric === "ppl") return `${sign}${formatMoney(to2(absDelta))}/lb`;
      return `${sign}${to2(absDelta)}`;
    };

    const renderHLItem = (label, t, metric, direction)=> {
      if(!t) return `<div class="muted small">—</div>`;
      const lbsNum = Number(t?.pounds)||0;
      const amtNum = Number(t?.amount)||0;
      const ppl = getTripMetricValue(t, "ppl");
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
            ${typeof renderStandardReadOnlyTripCard === "function" ? renderStandardReadOnlyTripCard(t, { variant: "standard" }) : ""}
          </div>
        </div>
      `;
    };

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
          <div class="emptyStateTitle">$/lb insights unavailable</div>
          <div class="emptyStateBody">Add trips with both pounds and amount to populate this view.</div>
        </div>`}
    `;

    return reportsSection({
      title: "Records",
      intro: "High and low trip records for core metrics.",
      body: `<div class="reportsTablesStack">${renderTableCard("High / Low Summary", highLowBody)}</div>`,
      extraClass: "reportsSection--records"
    });
  }

  function renderDetailBlock(context){
    const { dealerRows, areaRows, monthRows, dealerRangeRows } = context;

    const renderSummaryAverageLine = (row)=> `<span class="muted">Avg / Trip</span> <span class="money">${formatMoney(to2(row.amountPerTrip))}</span> • <span class="lbsBlue">${to2(row.poundsPerTrip)} lbs</span>`;
    const sortDealerRowsForSummary = (rows)=> rows.slice().sort((a, b)=> {
      const rateDiff = (Number(b?.avg) || 0) - (Number(a?.avg) || 0);
      if(rateDiff !== 0) return rateDiff;
      const lbsDiff = (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0);
      if(lbsDiff !== 0) return lbsDiff;
      return (Number(b?.amt) || 0) - (Number(a?.amt) || 0);
    });
    const sortAreaRowsForSummary = (rows)=> rows.slice().sort((a, b)=> {
      const lbsDiff = (Number(b?.lbs) || 0) - (Number(a?.lbs) || 0);
      if(lbsDiff !== 0) return lbsDiff;
      return (Number(b?.amt) || 0) - (Number(a?.amt) || 0);
    });

    const renderDealerAggList = (rows, emptyMsg)=>{
      if(!rows.length) return `
        <div class="emptyState compact">
          <div class="emptyStateTitle">Insights pending</div>
          <div class="emptyStateBody">${escapeHtml(emptyMsg||"Add trips to unlock these insights.")}</div>
        </div>`;
      return rows.map((r)=> `
        <div class="trow">
          <div>
            <div class="tname">${escapeHtml(r.name)}</div>
            <div class="tsub">${r.trips} trips • ${r.fishingDays || 0} days • <span class="lbsBlue">${to2(r.lbs)} lbs</span></div>
            <div class="tsub">${renderSummaryAverageLine(r)}</div>
          </div>
          <div class="tright">
            <div><span class="ppl">$/lb</span> <b class="rate ppl">${formatMoney(r.avg)}</b></div>
            <div><b class="money">${formatMoney(r.amt)}</b></div>
          </div>
        </div>
      `).join("");
    };

    const renderAreaAggList = (rows, emptyMsg)=>{
      if(!rows.length) return `
        <div class="emptyState compact">
          <div class="emptyStateTitle">Insights pending</div>
          <div class="emptyStateBody">${escapeHtml(emptyMsg||"Add trips to unlock these insights.")}</div>
        </div>`;
      return rows.map((r)=> `
        <div class="trow">
          <div>
            <div class="tname">${escapeHtml(r.name)}</div>
            <div class="tsub">${r.trips} trips • ${r.fishingDays || 0} days</div>
            <div class="tsub"><span class="money">${formatMoney(to2(r.amt))}</span> outcome • <span class="ppl">$/lb</span> <b class="rate ppl">${formatMoney(r.avg)}</b></div>
          </div>
          <div class="tright">
            <div><b class="lbsBlue">${to2(r.lbs)} lbs</b></div>
            <div><b class="money">${formatMoney(r.amt)}</b></div>
          </div>
        </div>
      `).join("");
    };

    const renderMonthList = ()=> monthRows.map((r)=> `
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
    `).join("");

    const renderDealerPriceRangeComparison = ()=>{
      if(!Array.isArray(dealerRangeRows) || !dealerRangeRows.length){
        return `
          <div class="emptyState compact">
            <div class="emptyStateTitle">Dealer range comparison unavailable</div>
            <div class="emptyStateBody">Add priced trips with dealer info to populate this table.</div>
          </div>
        `;
      }
      return dealerRangeRows.map((row, idx)=> `
        <div class="trow">
          <div>
            <div class="tname">${idx + 1}. ${escapeHtml(String(row?.name || "(Unspecified)"))}</div>
            <div class="tsub">${Number(row?.sampleCount) || 0} priced trips • Avg ${formatRateValue(row?.avg)}</div>
          </div>
          <div class="tright">
            <div><span class="ppl">Low</span> <b class="rate ppl">${formatRateValue(row?.rateLow)}</b></div>
            <div><span class="ppl">High</span> <b class="rate ppl">${formatRateValue(row?.rateHigh)}</b></div>
            <div><span class="ppl">Spread</span> <b class="rate ppl">${formatRateValue(row?.spread)}</b></div>
          </div>
        </div>
      `).join("");
    };

    return reportsSection({
      title: "Detail",
      intro: "Dealer, area, and monthly tables.",
      body: `<div class="reportsTablesStack">${[
        renderTableCard("Dealer Summary", renderDealerAggList(sortDealerRowsForSummary(dealerRows), "Add a trip in this range to populate dealer totals.")),
        renderTableCard("Area Summary", renderAreaAggList(sortAreaRowsForSummary(areaRows), "Add a trip in this range to populate area totals.")),
        renderTableCard("Monthly Totals", renderMonthList()),
        renderTableCard("Dealer Price Range Comparison", renderDealerPriceRangeComparison())
      ].join("")}</div>`,
      extraClass: "reportsSection--detail"
    });
  }

  function renderActiveReportsSection(context){
    const { activeReportsSection, highlightsStrip } = context;
    if(activeReportsSection === "charts") return reportsSection({
      title: "Charts",
      intro: "Trend direction at a glance.",
      body: `<div class="reportsChartsStack">${renderChartsSection(context)}</div>`,
      extraClass: "reportsSection--charts"
    });
    if(activeReportsSection === "seasonality") return renderSeasonalitySection(context) || reportsSection({
      title: "Seasonality",
      intro: "Available after enough dated history builds.",
      body: `<div class="reportsHighlightsEmpty"><div class="muted small">Add more dated trips across multiple months to reveal seasonality reads.</div></div>`,
      extraClass: "reportsSection--seasonality"
    });
    if(activeReportsSection === "records") return renderRecordsBlock(context);
    if(activeReportsSection === "detail") return renderDetailBlock(context);
    return reportsSection({
      title: "Insights",
      intro: "Top takeaways for this range.",
      body: `${highlightsStrip || `<div class="reportsHighlightsEmpty"><div class="muted small">Highlights appear automatically as more trips are added.</div></div>`}`,
      extraClass: "reportsSection--highlights"
    });
  }

  return {
    renderNoResultsState,
    renderChartsSection,
    renderSeasonalitySection,
    renderRecordsBlock,
    renderDetailBlock,
    renderActiveReportsSection
  };
}
