import { buildReportsCompareFoundation } from "./reports_compare_foundations_v5.js";

export function createReportsHighlightsSeam(deps){
  const {
    escapeHtml,
    formatMoney,
    to2
  } = deps;

  const safeNum = (v)=> Number(v) || 0;
  const pctText = (value)=> `${Math.abs(Math.round(safeNum(value) * 100))}%`;
  const signedPctText = (value)=> `${safeNum(value) > 0 ? "+" : ""}${Math.round(safeNum(value) * 100)}%`;
  const signedMoneyText = (value)=> `${safeNum(value) > 0 ? "+" : ""}${formatMoney(to2(safeNum(value)))}`;
  const buildPeriodLabel = (period)=> `${period?.currentLabel || "Current"} vs ${period?.previousLabel || "Prior"}`;
  const buildComparableWindowLabel = (period)=> period?.fairWindowLabel || "Comparable window";

  function buildAmountDriverText(compare){
    const pounds = compare?.metrics?.pounds;
    const ppl = compare?.metrics?.ppl;
    if(!pounds || !ppl || pounds.suppressed || ppl.suppressed){
      return "using the same comparable window.";
    }
    if(pounds.compareTone === "up" && ppl.compareTone === "up") return "as both pounds and $/lb moved up.";
    if(pounds.compareTone === "down" && ppl.compareTone === "down") return "as lighter pounds and softer $/lb stacked together.";
    if(pounds.compareTone === "up" && ppl.compareTone === "down") return "$ grew on heavier pounds even with a softer rate.";
    if(pounds.compareTone === "down" && ppl.compareTone === "up") return "$ shifted on stronger $/lb despite lighter pounds.";
    if(pounds.compareTone === "steady" && ppl.compareTone === "up") return "mostly because $/lb improved.";
    if(pounds.compareTone === "steady" && ppl.compareTone === "down") return "mostly because $/lb eased.";
    if(pounds.compareTone === "up" && ppl.compareTone === "steady") return "mostly because pounds increased.";
    if(pounds.compareTone === "down" && ppl.compareTone === "steady") return "mostly because pounds fell.";
    return "with pounds and pricing staying fairly close.";
  }

  function buildTripsDriverText(compare){
    const period = compare?.period || {};
    const currentRate = safeNum(period.current?.trips) > 0 ? safeNum(period.current?.lbs) / safeNum(period.current?.trips) : 0;
    const previousRate = safeNum(period.previous?.trips) > 0 ? safeNum(period.previous?.lbs) / safeNum(period.previous?.trips) : 0;
    if(!currentRate && !previousRate) return "";
    if(currentRate > previousRate * 1.05) return `Average pounds per trip improved to ${to2(currentRate)} lbs.`;
    if(currentRate < previousRate * 0.95) return `Average pounds per trip slipped to ${to2(currentRate)} lbs.`;
    return `Average pounds per trip held near ${to2(currentRate)} lbs.`;
  }

  function buildPoundsDriverText(compare){
    const trips = compare?.metrics?.trips;
    if(!trips || trips.suppressed){
      return "using the same comparable window.";
    }
    const period = compare?.period || {};
    const currentRate = safeNum(period.current?.trips) > 0 ? safeNum(period.current?.lbs) / safeNum(period.current?.trips) : 0;
    const previousRate = safeNum(period.previous?.trips) > 0 ? safeNum(period.previous?.lbs) / safeNum(period.previous?.trips) : 0;
    const productivityTone = currentRate > previousRate * 1.05
      ? "up"
      : (currentRate < previousRate * 0.95 ? "down" : "steady");

    if(trips.compareTone === "up" && productivityTone === "up") return "with both trip count and pounds per trip rising.";
    if(trips.compareTone === "down" && productivityTone === "down") return "as fewer trips also produced less per trip.";
    if(trips.compareTone === "up" && productivityTone === "down") return "because extra trips offset softer pounds per trip.";
    if(trips.compareTone === "down" && productivityTone === "up") return "because stronger pounds per trip partly covered fewer trips.";
    if(trips.compareTone === "up") return "mostly on more trips.";
    if(trips.compareTone === "down") return "mostly on fewer trips.";
    if(productivityTone === "up") return "mostly on stronger pounds per trip.";
    if(productivityTone === "down") return "mostly on weaker pounds per trip.";
    return "with trip count and productivity staying close.";
  }

  function buildPplDriverText(compare){
    const pounds = compare?.metrics?.pounds;
    const amount = compare?.metrics?.amount;
    if(!pounds || !amount || pounds.suppressed || amount.suppressed){
      return "using the same comparable window.";
    }
    if(amount.compareTone === "up" && pounds.compareTone !== "up") return "even without heavier pounds.";
    if(amount.compareTone === "down" && pounds.compareTone !== "down") return "even though pounds did not grow.";
    if(amount.compareTone === "up" && pounds.compareTone === "up") return "while both sales and pounds climbed.";
    if(amount.compareTone === "down" && pounds.compareTone === "down") return "while both sales and pounds softened.";
    return "relative to how much weight moved.";
  }

  function buildMetricHeadline({ payload, headlineLabel, compare, period }){
    const currentLabel = period?.currentLabel || "Current";
    const previousLabel = period?.previousLabel || "prior period";
    if(payload.compareTone === "steady"){
      return `${headlineLabel} stayed close to ${previousLabel}.`;
    }

    const direction = payload.compareTone === "up" ? "rose" : "fell";
    const magnitude = payload.percentValid ? signedPctText(payload.deltaPct) : (payload.metricKey === "amount" ? signedMoneyText(payload.deltaValue) : "updated");
    let driverText = "";
    if(payload.metricKey === "amount") driverText = buildAmountDriverText(compare);
    if(payload.metricKey === "pounds") driverText = buildPoundsDriverText(compare);
    if(payload.metricKey === "trips") driverText = buildTripsDriverText(compare);
    if(payload.metricKey === "ppl") driverText = buildPplDriverText(compare);
    return `${currentLabel} ${headlineLabel.toLowerCase()} ${direction} ${magnitude} from ${previousLabel}${driverText ? ` ${driverText}` : ""}`;
  }

  function buildMetricCompareText({ payload, compare, period }){
    const windowText = buildComparableWindowLabel(period);
    if(payload.metricKey === "trips"){
      return `${buildTripsDriverText(compare)} • ${windowText}`;
    }
    if(payload.metricKey === "amount"){
      return `${buildAmountDriverText(compare).replace(/\.$/, "")} • ${windowText}`;
    }
    if(payload.metricKey === "pounds"){
      return `${buildPoundsDriverText(compare).replace(/\.$/, "")} • ${windowText}`;
    }
    if(payload.metricKey === "ppl"){
      return `${buildPplDriverText(compare).replace(/\.$/, "")} • ${windowText}`;
    }
    return `${buildPeriodLabel(period)} • ${windowText}`;
  }

  function buildLeaderSummary({ label, entity, totalAmount, noun }){
    if(!entity) return null;
    const share = totalAmount > 0 ? Math.round((safeNum(entity.amt) / totalAmount) * 100) : 0;
    const headline = share >= 50
      ? `${entity.name} carried most ${noun} dollars in this range.`
      : `${entity.name} finished on top for ${noun} dollars in this range.`;
    const statusText = share > 0
      ? `${entity.trips} trips • ${to2(entity.lbs)} lbs • ${share}% of range $`
      : `${entity.trips} trips • ${to2(entity.lbs)} lbs`;
    return {
      type: "summary",
      label,
      headline,
      value: formatMoney(to2(entity.amt)),
      valueClass: "money",
      statusTone: "up",
      statusText
    };
  }

  function buildTrailingSummary({ label, entity, leader, noun }){
    if(!entity || !leader) return null;
    const leaderAmt = safeNum(leader.amt);
    const entityAmt = safeNum(entity.amt);
    if(leaderAmt <= 0 || (entityAmt / leaderAmt) > 0.7) return null;
    return {
      type: "summary",
      label,
      headline: `${entity.name} lagged the ${noun} pack in this range.`,
      value: formatMoney(to2(entityAmt)),
      valueClass: "money",
      statusTone: "down",
      statusText: `${entity.trips} trips • ${to2(entity.lbs)} lbs`
    };
  }

  function buildEntityCompareSummary({ payload, period, share, noun }){
    if(!payload || payload.suppressed) return null;
    const currentLabel = period?.currentLabel || "Current";
    const previousLabel = period?.previousLabel || "prior period";
    let headline = `${payload.entityName} held close to ${previousLabel}.`;
    if(payload.compareTone === "up"){
      headline = `${payload.entityName} out-earned its ${previousLabel} window${share >= 45 ? " and drove much of the gain" : ""}.`;
    }else if(payload.compareTone === "down"){
      headline = `${payload.entityName} cooled versus ${previousLabel}${share >= 45 ? ", which pulled on the overall result" : ""}.`;
    }
    const value = payload.percentValid ? signedPctText(payload.deltaPct) : signedMoneyText(payload.deltaValue);
    const statusBits = [`${currentLabel} ${payload.currentTrips || 0} trips`, `${previousLabel} ${payload.previousTrips || 0} trips`];
    if(share > 0) statusBits.push(`${share}% of ${noun} $ now`);
    return {
      type: "summary",
      label: `${noun[0].toUpperCase()}${noun.slice(1)} compare`,
      headline,
      value,
      valueClass: "money",
      statusTone: payload.compareTone,
      statusText: statusBits.join(" • ")
    };
  }

  function renderHighlightsStrip({ dealerRows, monthRows, areaRows, trips }){
    const topDealer = dealerRows[0] || null;
    const strongestArea = areaRows[0] || null;
    const latestMonth = monthRows[monthRows.length - 1] || null;
    const priorMonth = monthRows[monthRows.length - 2] || null;
    const compare = buildReportsCompareFoundation({ trips, monthRows, dealerRows, areaRows });
    const totalDealerAmount = dealerRows.reduce((sum, row)=> sum + safeNum(row?.amt), 0);
    const totalAreaAmount = areaRows.reduce((sum, row)=> sum + safeNum(row?.amt), 0);

    const metricCompareCards = [
      buildMetricCard({
        payload: compare.metrics.pounds,
        headlineLabel: "Total pounds",
        formatter: (v)=> `${to2(v)} lbs`,
        period: compare.period,
        compare
      }),
      buildMetricCard({
        payload: compare.metrics.ppl,
        headlineLabel: "Average price per lb",
        formatter: (v)=> `${formatMoney(to2(v))}/lb`,
        period: compare.period,
        compare
      }),
      buildMetricCard({
        payload: compare.metrics.trips,
        headlineLabel: "Trip count",
        formatter: (v)=> `${Math.round(v)} trips`,
        period: compare.period,
        compare
      }),
      buildMetricCard({
        payload: compare.metrics.amount,
        headlineLabel: "Total amount",
        formatter: (v)=> formatMoney(to2(v)),
        period: compare.period,
        compare
      })
    ].filter(Boolean);

    const weakestDealer = dealerRows.length >= 3 ? dealerRows[dealerRows.length - 1] : null;
    const weakestArea = areaRows.length >= 3 ? areaRows[areaRows.length - 1] : null;

    const buildEntityMovementInsight = ({ entityType, label, minRatio = 0.2 })=>{
      if(!latestMonth || !priorMonth) return null;
      const data = Array.isArray(trips) ? trips : [];
      if(data.length < 4) return null;
      const byEntity = new Map();

      data.forEach((t)=>{
        const dateISO = String(t?.dateISO || "");
        if(!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
        const monthKey = dateISO.slice(0, 7);
        const monthLabel = monthRows.find((m)=> m.monthKey === monthKey)?.label;
        if(monthLabel !== latestMonth.label && monthLabel !== priorMonth.label) return;

        const rawName = entityType === "dealer" ? String(t?.dealer || "") : String(t?.area || "");
        const name = rawName.trim() || "(Unspecified)";
        const key = name.toLowerCase();

        const slot = byEntity.get(key) || { name, latest: 0, prior: 0 };
        const amt = safeNum(t?.amount);
        if(monthLabel === latestMonth.label) slot.latest += amt;
        if(monthLabel === priorMonth.label) slot.prior += amt;
        byEntity.set(key, slot);
      });

      let best = null;
      byEntity.forEach((slot)=>{
        if(slot.latest <= 0 && slot.prior <= 0) return;
        const baseline = Math.max(slot.prior, 1);
        const delta = slot.latest - slot.prior;
        const ratio = Math.abs(delta) / baseline;
        if(ratio < minRatio) return;
        if(!best || ratio > best.ratio){
          best = { ...slot, delta, ratio };
        }
      });

      if(!best) return null;
      return {
        type: "summary",
        label,
        headline: `${best.name} ${best.delta > 0 ? "moved up fastest" : "fell back most"} month over month.`,
        value: `${best.delta > 0 ? "+" : ""}${Math.round(best.ratio * 100)}%`,
        statusTone: best.delta > 0 ? "up" : "down",
        statusText: `${latestMonth.label} ${formatMoney(to2(best.latest))} vs ${priorMonth.label} ${formatMoney(to2(best.prior))}`
      };
    };

    const dealerMovement = buildEntityMovementInsight({ entityType: "dealer", label: "Dealer movement" });
    const areaMovement = buildEntityMovementInsight({ entityType: "area", label: "Area movement" });

    const trendCue = (()=>{
      if(monthRows.length < 3) return null;
      const recent = monthRows.slice(-3);
      const lbs = recent.map((r)=> safeNum(r.lbs));
      const tripsVals = recent.map((r)=> safeNum(r.trips));
      const isUp = (arr)=> arr[2] > arr[1] && arr[1] > arr[0];
      const isDown = (arr)=> arr[2] < arr[1] && arr[1] < arr[0];
      if(isUp(lbs)) return { headline: "Pounds have climbed for three months.", tone: "up" };
      if(isDown(lbs)) return { headline: "Pounds have softened for three months.", tone: "down" };
      if(isUp(tripsVals)) return { headline: "Trips are trending up across recent months.", tone: "up" };
      if(isDown(tripsVals)) return { headline: "Trips are trending down across recent months.", tone: "down" };
      return { headline: "No strong rolling trend yet in this range.", tone: "steady" };
    })();

    const dealerShare = totalDealerAmount > 0 ? Math.round((safeNum(topDealer?.amt) / totalDealerAmount) * 100) : 0;
    const areaShare = totalAreaAmount > 0 ? Math.round((safeNum(strongestArea?.amt) / totalAreaAmount) * 100) : 0;

    const summaryCards = [
      buildLeaderSummary({ label: "Top dealer", entity: topDealer, totalAmount: totalDealerAmount, noun: "dealer" }),
      buildEntityCompareSummary({ payload: compare.dealer, period: compare.period, share: dealerShare, noun: "dealer" }),
      buildTrailingSummary({ label: "Weakest dealer", entity: weakestDealer, leader: topDealer, noun: "dealer" }),
      buildLeaderSummary({ label: "Strongest area", entity: strongestArea, totalAmount: totalAreaAmount, noun: "area" }),
      buildEntityCompareSummary({ payload: compare.area, period: compare.period, share: areaShare, noun: "area" }),
      buildTrailingSummary({ label: "Weakest area", entity: weakestArea, leader: strongestArea, noun: "area" }),
      dealerMovement,
      areaMovement,
      trendCue ? {
        type: "summary",
        label: "Rolling trend",
        headline: trendCue.headline,
        value: latestMonth ? `${to2(latestMonth.lbs)} lbs` : "—",
        valueClass: "lbsBlue",
        statusTone: trendCue.tone,
        statusText: latestMonth && priorMonth ? `${latestMonth.label} vs ${priorMonth.label}` : "Gathering trend context"
      } : null,
      compare.period?.suppressed ? {
        type: "summary",
        label: "Compare guardrail",
        headline: "Comparison held back for fairness.",
        value: "Suppressed",
        statusTone: "steady",
        statusText: compare.period.reason || "Low-data baseline"
      } : null
    ].filter(Boolean);

    const highlights = [];
    if(metricCompareCards.length >= 2 && summaryCards.length){
      highlights.push(summaryCards[0], metricCompareCards[0], metricCompareCards[1], ...summaryCards.slice(1, 4));
    }else if(metricCompareCards.length === 1){
      highlights.push(metricCompareCards[0], ...summaryCards.slice(0, 4));
    }else{
      highlights.push(...summaryCards.slice(0, 6));
    }

    if(!highlights.length) return "";

    return `
      <div class="card reportsHighlightsCard">
        <div class="reportsHighlightsHdr">Range insights</div>
        <div class="reportsHighlightsGrid">
          ${highlights.map(item=>`
            <div class="reportsHighlightItem reportsHighlightItem--${item.type === "compare" ? "compare" : "summary"}">
              <div class="reportsHighlightLabel">${escapeHtml(item.label)}</div>
              <div class="reportsHighlightHeadline">${escapeHtml(item.headline)}</div>
              ${item.type === "compare" ? `
                <div class="reportsHighlightMetricRow">
                  <div class="reportsHighlightValue ${item.valueClass || ""}">${escapeHtml(item.value)}</div>
                  <div class="reportsMiniPreview" role="presentation" aria-hidden="true">
                    <span class="reportsMiniPreviewBar"><span class="reportsMiniPreviewFill" style="width:${item.aPct}%"></span></span>
                    <span class="reportsMiniPreviewBar muted"><span class="reportsMiniPreviewFill" style="width:${item.bPct}%"></span></span>
                  </div>
                </div>
                <div class="reportsCompareRow tone-${escapeHtml(item.compareTone)}">${escapeHtml(item.compareText)}</div>
                <div class="reportsCompareBars" role="presentation">
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta"><span>${escapeHtml(item.aLabel)}</span><b class="${item.valueClass || ""}">${escapeHtml(item.aValue)}</b></div>
                    <div class="reportsCompareBarTrack"><span style="width:${item.aPct}%"></span></div>
                  </div>
                  <div class="reportsCompareLine">
                    <div class="reportsCompareMeta"><span>${escapeHtml(item.bLabel)}</span><b class="${item.valueClass || ""}">${escapeHtml(item.bValue)}</b></div>
                    <div class="reportsCompareBarTrack muted"><span style="width:${item.bPct}%"></span></div>
                  </div>
                </div>
              ` : `
                <div class="reportsHighlightMetricRow reportsHighlightMetricRow--summary">
                  <div class="reportsHighlightValue ${item.valueClass || ""}">${escapeHtml(item.value)}</div>
                </div>
                <div class="reportsCompareRow tone-${escapeHtml(item.statusTone)}">${escapeHtml(item.statusText)}</div>
              `}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function buildMetricCard({ payload, headlineLabel, formatter, period, compare }){
    if(!payload || payload.suppressed) return null;
    const cur = payload.currentValue;
    const prev = payload.previousValue;
    const maxVal = Math.max(cur, prev, 1);

    return {
      type: "compare",
      label: payload.label,
      headline: buildMetricHeadline({ payload, headlineLabel, compare, period }),
      value: formatter(cur),
      valueClass: payload.metricKey === "amount"
        ? "money"
        : (payload.metricKey === "pounds" ? "lbsBlue" : (payload.metricKey === "ppl" ? "rate ppl" : (payload.metricKey === "trips" ? "trips" : ""))),
      compareTone: payload.compareTone,
      compareText: buildMetricCompareText({ payload, compare, period }),
      aLabel: period.currentLabel || "Current",
      bLabel: period.previousLabel || "Prior",
      aValue: formatter(cur),
      bValue: formatter(prev),
      aPct: Math.max(10, Math.round((cur / maxVal) * 100)),
      bPct: Math.max(10, Math.round((prev / maxVal) * 100))
    };
  }

  return {
    renderHighlightsStrip
  };
}
